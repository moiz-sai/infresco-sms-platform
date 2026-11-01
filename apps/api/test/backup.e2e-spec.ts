import { INestApplication } from '@nestjs/common';
import type { BackupFile, BackupRunItem, Challenge } from '@sms/shared';
import { generateKeyPairSync, sign as edSign } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { App } from 'supertest/types';
import * as schema from '../src/db/schema';
import { seed } from '../src/db/seed';
import { createTestApp, loginAs } from './app.factory';

describe('T14 backups, restore, reset', () => {
  let app: INestApplication<App>;
  let dev: TestAgent;
  let principal: TestAgent;
  let priv: ReturnType<typeof generateKeyPairSync>['privateKey'];
  let backupDir: string;
  let schoolName: string;
  const admin = new Pool({
    connectionString: process.env.DATABASE_ADMIN_URL,
    max: 1,
  });
  const sign = (m: string) =>
    edSign(null, Buffer.from(m), priv).toString('base64url');

  const unlock = async () => {
    const ch = (await dev.post('/api/_dev/challenge').expect(200))
      .body as Challenge;
    await dev
      .post('/api/_dev/unlock')
      .send({ code: ch.code, signature: sign(ch.code) })
      .expect(200);
  };
  const setSettings = (dir: string, keep = 14) =>
    dev
      .put('/api/_dev/backup/settings')
      .send({ primaryDir: dir, secondaryDir: null, times: ['13:30'], keep })
      .expect(204);
  const files = async () =>
    (await dev.get('/api/_dev/backup/files').expect(200)).body as BackupFile[];
  const runs = async () =>
    (await dev.get('/api/_dev/backup/runs').expect(200))
      .body as BackupRunItem[];

  beforeAll(async () => {
    const kp = generateKeyPairSync('ed25519');
    priv = kp.privateKey;
    process.env.SMS_DEV_PUBLIC_KEYS = kp.publicKey.export({ format: 'jwk' }).x;
    app = await createTestApp();
    dev = request.agent(app.getHttpServer());
    principal = await loginAs(app, 'principal');
    backupDir = mkdtempSync(join(tmpdir(), 'sms-bak-'));
    schoolName = (
      (await principal.get('/api/school').expect(200)).body as {
        nameEn: string;
      }
    ).nameEn;
    await unlock();
    await setSettings(backupDir);
  });

  afterAll(async () => {
    // Leave the base seed intact for later suites, and no license behind.
    await seed(drizzle({ client: admin, schema, casing: 'snake_case' }));
    await admin.query(
      `update installation set license_json=null, license_sig=null`,
    );
    rmSync(backupDir, { recursive: true, force: true });
    await admin.end();
    await app.close();
    delete process.env.SMS_DEV_PUBLIC_KEYS;
  });

  it('makes a verified backup and records it', async () => {
    const res = await dev.post('/api/_dev/backup').expect(200);
    const body = res.body as { file: string; bytes: number };
    expect(body.bytes).toBeGreaterThan(0);
    const list = await files();
    expect(list.some((f) => body.file.endsWith(f.name))).toBe(true);
    const last = (await runs())[0];
    expect(last.status).toBe('ok');
    expect(last.trigger).toBe('manual');
  });

  it('keeps only N backups in the folder', async () => {
    await setSettings(backupDir, 2);
    for (let i = 0; i < 3; i++) await dev.post('/api/_dev/backup').expect(200);
    expect(
      (await files()).filter((f) => f.location === 'primary').length,
    ).toBeLessThanOrEqual(2);
    await setSettings(backupDir, 14);
  });

  it('records a failed run with the error', async () => {
    const blocker = join(tmpdir(), `sms-block-${Date.now()}`);
    writeFileSync(blocker, 'x'); // a file, so mkdir of a path under it fails
    await setSettings(join(blocker, 'sub'));
    await dev.post('/api/_dev/backup').expect(400);
    const last = (await runs())[0];
    expect(last.status).toBe('failed');
    expect(last.error).toBeTruthy();
    rmSync(blocker, { force: true });
    await setSettings(backupDir);
  });

  it('reset "fees" clears balances but keeps students and setup', async () => {
    const classes = (await principal.get('/api/classes').expect(200)).body as {
      id: string;
    }[];
    const years = (await principal.get('/api/years').expect(200)).body as {
      id: string;
      isCurrent: boolean;
    }[];
    const sec = await principal
      .post('/api/sections')
      .send({
        classId: classes[0].id,
        yearId: years.find((y) => y.isCurrent)!.id,
        name: 'BK1',
      })
      .expect(201);
    const sectionId = (sec.body as { id: string }).id;
    const adm = await principal
      .post('/api/students/admit')
      .send({
        student: { nameEn: 'Backup Kid', gender: 'm' },
        sectionId,
        joinedOn: '2026-04-01',
      })
      .expect(201);
    const enrollmentId = (adm.body as { enrollmentId: string }).enrollmentId;
    await principal.post('/api/fees/post-charges').send({ period: '2026-04' });

    await dev
      .post('/api/_dev/reset')
      .send({ module: 'fees', confirm: schoolName })
      .expect(204);

    // Student + enrollment + classes still there; ledger empty → balance 0.
    const found = await principal
      .get('/api/students')
      .query({ q: 'Backup Kid' })
      .expect(200);
    expect((found.body as { total: number }).total).toBe(1);
    expect(
      ((await principal.get('/api/classes')).body as unknown[]).length,
    ).toBeGreaterThan(0);
    const bal = await admin.query<{ n: string }>(
      `select coalesce(sum(amount_paisa),0)::text as n from ledger_entry where enrollment_id=$1`,
      [enrollmentId],
    );
    expect(bal.rows[0].n).toBe('0');
  });

  it('restores a backup, bringing data back and keeping the license', async () => {
    // A valid future license that must survive the restore.
    const status = (await dev.get('/api/_dev/status').expect(200)).body as {
      installId: string;
    };
    const installId = status.installId;
    const payload = {
      installId,
      school: schoolName,
      issued: '2026-01-01',
      expires: '2099-01-01',
      modules: [] as string[],
    };
    const canonical = JSON.stringify({
      expires: payload.expires,
      installId: payload.installId,
      issued: payload.issued,
      modules: payload.modules,
      school: payload.school,
    });
    await dev
      .put('/api/_dev/license')
      .send({ license: JSON.stringify(payload), signature: sign(canonical) })
      .expect(204);

    const before = (await principal.get('/api/students').expect(200)).body as {
      total: number;
    };
    const snap = await dev.post('/api/_dev/backup').expect(200);
    const snapName = (await files()).find((f) =>
      (snap.body as { file: string }).file.endsWith(f.name),
    )!.name;

    // Mutate: admit another student.
    const classes = (await principal.get('/api/classes').expect(200)).body as {
      id: string;
    }[];
    const years = (await principal.get('/api/years').expect(200)).body as {
      id: string;
      isCurrent: boolean;
    }[];
    const sec = await principal
      .post('/api/sections')
      .send({
        classId: classes[0].id,
        yearId: years.find((y) => y.isCurrent)!.id,
        name: 'BK2',
      })
      .expect(201);
    await principal
      .post('/api/students/admit')
      .send({
        student: { nameEn: 'Temp Kid', gender: 'f' },
        sectionId: (sec.body as { id: string }).id,
        joinedOn: '2026-04-01',
      })
      .expect(201);

    await dev
      .post('/api/_dev/backup/restore')
      .send({ file: snapName })
      .expect(204);

    // Restore terminated connections and cleared sessions; log back in and re-unlock dev.
    principal = await loginAs(app, 'principal');
    await unlock();
    const after = (await principal.get('/api/students').expect(200)).body as {
      total: number;
    };
    expect(after.total).toBe(before.total);
    // License survived the restore.
    const lic = (await dev.get('/api/_dev/status').expect(200)).body as {
      license: { state: string };
    };
    expect(lic.license.state).toBe('licensed');
  });

  it('reset "all" wipes data but login still works', async () => {
    await dev
      .post('/api/_dev/reset')
      .send({ module: 'all', confirm: schoolName })
      .expect(204);
    const fresh = await loginAs(app, 'principal');
    const students = (await fresh.get('/api/students').expect(200)).body as {
      total: number;
    };
    expect(students.total).toBe(0);
    // Classes were re-seeded.
    expect(
      ((await fresh.get('/api/classes')).body as unknown[]).length,
    ).toBeGreaterThan(0);
  });

  it('wrong confirmation is refused', async () => {
    await dev
      .post('/api/_dev/reset')
      .send({ module: 'fees', confirm: 'nope' })
      .expect(400);
  });
});
