import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type {
  BackupFile,
  BackupRunItem,
  BackupSettingsInput,
  BackupSummary,
  ResetModule,
} from '@sms/shared';
import { desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import {
  access,
  mkdir,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Pool } from 'pg';
import type { Env } from '../config/env';
import { DB, type Db } from '../db/database.module';
import { backupRun, installation, school } from '../db/schema';
import { seed } from '../db/seed';

const PREFIX = 'sms-';
const SUFFIX = '.dump';
const STALE_HOURS = 20;
const BANNER_HOURS = 48;

type Trigger = 'scheduled' | 'startup' | 'manual' | 'pre_restore' | 'pre_reset';

interface InstallBackupRow {
  id: string;
  primaryDir: string | null;
  secondaryDir: string | null;
  times: string[];
  keep: number;
}

// Tables cleared per reset module. Unknown tables (T15–T18 not built yet) are skipped at runtime.
const RESET_TABLES: Record<Exclude<ResetModule, 'all'>, string[]> = {
  attendance: ['attendance_event'],
  fees: ['ledger_entry', 'receipt', 'cash_close', 'student_fee_plan'],
  staff_attendance: ['staff_attendance_event'],
  payroll: ['salary_entry', 'salary_slip', 'salary_structure'],
  expenses: ['expense'],
  students: [
    'attendance_event',
    'ledger_entry',
    'receipt',
    'cash_close',
    'student_fee_plan',
    'approval_request',
    'enrollment',
    'guardian_student',
  ],
  staff: [
    'staff_attendance_event',
    'salary_entry',
    'salary_slip',
    'salary_structure',
    'staff_profile',
  ],
};

@Injectable()
export class BackupService implements OnApplicationBootstrap {
  private readonly log = new Logger('BackupService');

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private lastScheduledMinute = '';

  async onApplicationBootstrap() {
    // Tests drive backups explicitly; no cron or startup backup there.
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.backupIfStale();
    } catch (e) {
      this.log.warn(`backup bootstrap skipped: ${(e as Error).message}`);
    }
  }

  // ---------- configuration / readiness

  private adminUrl(): string | undefined {
    return this.config.get('DATABASE_ADMIN_URL', { infer: true });
  }

  private tool(name: 'pg_dump' | 'pg_restore'): string {
    const dir = this.config.get('PG_BIN_DIR', { infer: true });
    return dir ? join(dir, name) : name;
  }

  pgReady(): boolean {
    return !!this.adminUrl();
  }

  private requireAdmin(): string {
    const url = this.adminUrl();
    if (!url) {
      throw new BadRequestException({
        code: 'BACKUP_NOT_CONFIGURED',
        message: 'Admin database access is not configured on this server',
      });
    }
    return url;
  }

  private async row(): Promise<InstallBackupRow> {
    const [r] = await this.db
      .select({
        id: installation.id,
        primaryDir: installation.backupPrimaryDir,
        secondaryDir: installation.backupSecondaryDir,
        times: installation.backupTimes,
        keep: installation.backupKeep,
      })
      .from(installation)
      .limit(1);
    if (!r)
      throw new BadRequestException({
        code: 'NO_INSTALL',
        message: 'Not installed',
      });
    return r;
  }

  private primaryDir(r: InstallBackupRow): string {
    return (
      r.primaryDir ??
      process.env.SMS_BACKUP_DIR ??
      resolve(process.cwd(), 'backups')
    );
  }

  // ---------- scheduling

  // Fires every minute; runs a backup when the clock reaches a configured HH:MM. Avoids a
  // dynamic `cron` dependency and re-reads the times each tick, so settings changes take effect.
  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (process.env.NODE_ENV === 'test') return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes(),
    ).padStart(2, '0')}`;
    if (hhmm === this.lastScheduledMinute) return;
    try {
      const { times } = await this.row();
      if (!times.includes(hhmm) || !this.pgReady()) return;
      this.lastScheduledMinute = hhmm;
      await this.runBackup('scheduled');
    } catch (e) {
      this.log.error(`scheduled backup failed: ${(e as Error).message}`);
    }
  }

  async backupIfStale() {
    if (!this.pgReady()) return;
    if (await this.isStale(STALE_HOURS)) await this.runBackup('startup');
  }

  private async lastGoodAt(): Promise<Date | null> {
    const [r] = await this.db
      .select({ at: backupRun.createdAt })
      .from(backupRun)
      .where(eq(backupRun.status, 'ok'))
      .orderBy(desc(backupRun.createdAt))
      .limit(1);
    return r?.at ?? null;
  }

  private async isStale(hours: number): Promise<boolean> {
    const last = await this.lastGoodAt();
    if (!last) return true;
    return Date.now() - last.getTime() > hours * 3600_000;
  }

  // ---------- backup

  private child(cmd: string, args: string[]): Promise<void> {
    return new Promise((res, rej) => {
      const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      p.stderr.on('data', (d) => (err += d));
      p.on('error', (e) => rej(e));
      p.on('close', (code) =>
        code === 0
          ? res()
          : rej(new Error(err.trim() || `${cmd} exited ${code}`)),
      );
    });
  }

  async runBackup(trigger: Trigger): Promise<{ file: string; bytes: number }> {
    const url = this.requireAdmin();
    const r = await this.row();
    const dir = this.primaryDir(r);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = join(dir, `${PREFIX}${stamp}${SUFFIX}`);
    try {
      await mkdir(dir, { recursive: true });
      await this.child(this.tool('pg_dump'), [
        '--format=custom',
        '--no-owner',
        `--file=${file}`,
        `--dbname=${url}`,
      ]);
      // Prove the archive is readable before counting it as good.
      await this.child(this.tool('pg_restore'), ['--list', file]);
      const { size } = await stat(file);
      const secondaryCopied = await this.copyOffsite(r, file);
      await this.prune(dir, r.keep);
      await this.db.insert(backupRun).values({
        trigger,
        status: 'ok',
        filePath: file,
        fileBytes: size,
        secondaryCopied,
      });
      return { file, bytes: size };
    } catch (e) {
      const message = (e as Error).message.slice(0, 1000);
      await this.db.insert(backupRun).values({
        trigger,
        status: 'failed',
        filePath: file,
        error: message,
      });
      throw new BadRequestException({ code: 'BACKUP_FAILED', message });
    }
  }

  // Copy to the secondary folder (if reachable) and any removable drive carrying an
  // "InfrescoSMS-Backups" folder; keep N in each. Returns whether a secondary copy was made.
  private async copyOffsite(
    r: InstallBackupRow,
    file: string,
  ): Promise<boolean> {
    const targets: string[] = [];
    if (r.secondaryDir && (await this.reachable(r.secondaryDir))) {
      targets.push(r.secondaryDir);
    }
    for (const usb of await this.usbTargets()) targets.push(usb);
    let copied = false;
    const data = await readFile(file);
    const name = file.split(/[/\\]/).pop()!;
    for (const dir of targets) {
      try {
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, name), data);
        await this.prune(dir, r.keep);
        copied = true;
      } catch (e) {
        this.log.warn(`offsite copy to ${dir} failed: ${(e as Error).message}`);
      }
    }
    return copied;
  }

  private async reachable(dir: string): Promise<boolean> {
    try {
      await access(dir, constants.W_OK);
      return true;
    } catch {
      // A not-yet-existing but creatable path is still a valid target.
      try {
        await mkdir(dir, { recursive: true });
        return true;
      } catch {
        return false;
      }
    }
  }

  // Removable drives with an InfrescoSMS-Backups folder (Windows drive letters; no-op elsewhere).
  private async usbTargets(): Promise<string[]> {
    if (process.platform !== 'win32') return [];
    const found: string[] = [];
    for (const letter of 'DEFGHIJKLMNOPQRSTUVWXYZ') {
      const dir = `${letter}:\\InfrescoSMS-Backups`;
      try {
        await access(dir, constants.W_OK);
        found.push(dir);
      } catch {
        /* drive absent or no folder */
      }
    }
    return found;
  }

  private async prune(dir: string, keep: number) {
    const files = (await readdir(dir).catch(() => []))
      .filter((f) => f.startsWith(PREFIX) && f.endsWith(SUFFIX))
      .sort()
      .reverse();
    for (const old of files.slice(keep)) {
      await unlink(join(dir, old)).catch(() => undefined);
    }
  }

  // ---------- listing, settings, status

  async listFiles(): Promise<BackupFile[]> {
    const r = await this.row();
    const dirs: [string, 'primary' | 'secondary'][] = [
      [this.primaryDir(r), 'primary'],
    ];
    if (r.secondaryDir) dirs.push([r.secondaryDir, 'secondary']);
    const out: BackupFile[] = [];
    for (const [dir, location] of dirs) {
      const names = (await readdir(dir).catch(() => [])).filter(
        (f) => f.startsWith(PREFIX) && f.endsWith(SUFFIX),
      );
      for (const name of names) {
        const s = await stat(join(dir, name)).catch(() => null);
        if (s) {
          out.push({
            name,
            bytes: s.size,
            modifiedAt: s.mtime.toISOString(),
            location,
          });
        }
      }
    }
    return out.sort((a, b) => b.name.localeCompare(a.name));
  }

  async recentRuns(limit = 20): Promise<BackupRunItem[]> {
    const rows = await this.db
      .select()
      .from(backupRun)
      .orderBy(desc(backupRun.createdAt))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      trigger: r.trigger,
      status: r.status as 'ok' | 'failed',
      fileName: r.filePath ? r.filePath.split(/[/\\]/).pop()! : null,
      bytes: r.fileBytes,
      secondaryCopied: r.secondaryCopied,
      error: r.error,
      at: r.createdAt.toISOString(),
    }));
  }

  async summary(): Promise<BackupSummary> {
    const r = await this.row();
    const last = await this.lastGoodAt();
    return {
      primaryDir: r.primaryDir,
      secondaryDir: r.secondaryDir,
      times: r.times,
      keep: r.keep,
      lastGoodAt: last?.toISOString() ?? null,
      stale: await this.isStale(BANNER_HOURS),
      pgReady: this.pgReady(),
    };
  }

  async updateSettings(input: BackupSettingsInput) {
    const r = await this.row();
    await this.db
      .update(installation)
      .set({
        backupPrimaryDir: input.primaryDir ?? null,
        backupSecondaryDir: input.secondaryDir ?? null,
        backupTimes: input.times,
        backupKeep: input.keep,
      })
      .where(eq(installation.id, r.id));
  }

  // ---------- restore

  async restore(fileName: string): Promise<void> {
    const url = this.requireAdmin();
    const r = await this.row();
    const path = await this.locate(r, fileName);
    await this.runBackup('pre_restore');

    // Keep the current license/branding/backup settings across a restore of older data.
    const [keep] = await this.db.select().from(installation).limit(1);

    // Idle pooled connections hold no table locks, so --clean can DROP/CREATE without a
    // terminate step; --single-transaction keeps the live DB consistent if it fails.
    await this.child(this.tool('pg_restore'), [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--single-transaction',
      `--dbname=${url}`,
      path,
    ]);

    const pool = new Pool({ connectionString: url, max: 1 });
    pool.on('error', () => undefined);
    try {
      await migrate(drizzle(pool), { migrationsFolder: 'drizzle' });
      if (keep) {
        await pool.query(
          `update installation set license_json=$1, license_sig=$2, logo_data=$3, logo_type=$4,
             footer_en=$5, footer_ur=$6, backup_primary_dir=$7, backup_secondary_dir=$8,
             backup_times=$9, backup_keep=$10`,
          [
            keep.licenseJson,
            keep.licenseSig,
            keep.logoData,
            keep.logoType,
            keep.footerEn,
            keep.footerUr,
            keep.backupPrimaryDir,
            keep.backupSecondaryDir,
            JSON.stringify(keep.backupTimes),
            keep.backupKeep,
          ],
        );
      }
      await pool.query(`delete from session`); // everyone logged out
    } finally {
      await pool.end();
    }
  }

  private async locate(r: InstallBackupRow, name: string): Promise<string> {
    if (name.includes('/') || name.includes('\\') || name.includes('..')) {
      throw new BadRequestException({
        code: 'BAD_FILE',
        message: 'Invalid file name',
      });
    }
    for (const dir of [this.primaryDir(r), r.secondaryDir].filter(
      Boolean,
    ) as string[]) {
      const p = join(dir, name);
      if (
        await access(p, constants.R_OK)
          .then(() => true)
          .catch(() => false)
      )
        return p;
    }
    throw new BadRequestException({
      code: 'FILE_NOT_FOUND',
      message: 'Backup not found',
    });
  }

  // ---------- reset

  async reset(module: ResetModule, confirm: string): Promise<void> {
    const [s] = await this.db
      .select({ nameEn: school.nameEn })
      .from(school)
      .limit(1);
    if (!s || confirm.trim() !== s.nameEn.trim()) {
      throw new BadRequestException({
        code: 'CONFIRM_MISMATCH',
        message: 'Type the exact school name to confirm',
      });
    }
    const url = this.requireAdmin();
    await this.runBackup('pre_reset');

    const pool = new Pool({ connectionString: url, max: 1 });
    pool.on('error', () => undefined);
    try {
      if (module === 'all') {
        await this.resetAll(pool);
      } else {
        const tables = await this.existing(pool, RESET_TABLES[module]);
        if (tables.length) {
          await pool.query(
            `truncate ${tables.map((t) => `"${t}"`).join(', ')} restart identity cascade`,
          );
        }
      }
    } finally {
      await pool.end();
    }
  }

  // Keep school, installation, users & roles; wipe everything else; re-seed the defaults.
  private async resetAll(pool: Pool) {
    const keepTables = new Set([
      'school',
      'installation',
      'user_account',
      'person', // includes staff accounts; student/guardian rows are removed below
      'role',
      'permission',
      'role_permission',
      'user_role',
      'device',
      'session',
      'drizzle',
    ]);
    const { rows } = await pool.query<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public'`,
    );
    const wipe = rows.map((r) => r.tablename).filter((t) => !keepTables.has(t));
    await pool.query('begin');
    try {
      if (wipe.length) {
        await pool.query(
          `truncate ${wipe.map((t) => `"${t}"`).join(', ')} restart identity cascade`,
        );
      }
      // Non-user persons (students, guardians) go; staff accounts stay.
      await pool.query(
        `delete from person where kind in ('student', 'guardian')`,
      );
      await pool.query('commit');
    } catch (e) {
      await pool.query('rollback');
      throw e;
    }
    // Re-seed defaults (year, classes, sections, heads, structures); idempotent.
    await seed(drizzle(pool, { casing: 'snake_case' }));
  }

  private async existing(pool: Pool, tables: string[]): Promise<string[]> {
    if (!tables.length) return [];
    const { rows } = await pool.query<{ tablename: string }>(
      `select tablename from pg_tables where schemaname='public' and tablename = any($1)`,
      [tables],
    );
    return rows.map((r) => r.tablename);
  }
}
