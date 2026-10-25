import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type {
  AttendanceDay,
  AttendanceEntry,
  AttendanceSaveResult,
  AttendanceStatus,
  MonthRegister,
} from '@sms/shared';
import { and, between, eq, inArray, sql } from 'drizzle-orm';
import type { Actor } from '../common/actor';
import { ApprovalsService } from '../approvals/approvals.service';
import { AuditService } from '../common/audit.service';
import { HlcService } from '../common/hlc.service';
import { DB, type Db } from '../db/database.module';
import { attendanceEffective, attendanceEvent } from '../db/schema';
import { withTx, type Tx } from '../db/tx';
import { SetupService } from '../setup/setup.service';
import { StudentsService } from '../students/students.service';

type UserActor = Actor & { userId: string };

const localDate = (d: Date) => d.toLocaleDateString('en-CA');
const today = () => localDate(new Date());
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDate(d);
};

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly hlc: HlcService,
    private readonly setup: SetupService,
    private readonly students: StudentsService,
    private readonly approvals: ApprovalsService,
  ) {}

  private async lockInfo(schoolId: string, date: string) {
    const { attendanceLockDays } = await this.setup.getSettings(schoolId);
    return {
      lockDays: attendanceLockDays,
      locked: date < daysAgo(attendanceLockDays),
    };
  }

  private async effective(
    executor: Db | Tx,
    enrollmentIds: string[],
    date: string,
  ) {
    if (enrollmentIds.length === 0)
      return new Map<string, { id: string; status: AttendanceStatus }>();
    const rows = await executor
      .select({
        id: attendanceEffective.id,
        enrollmentId: attendanceEffective.enrollmentId,
        status: attendanceEffective.status,
      })
      .from(attendanceEffective)
      .where(
        and(
          inArray(attendanceEffective.enrollmentId, enrollmentIds),
          eq(attendanceEffective.date, date),
        ),
      );
    return new Map(
      rows.map((r) => [r.enrollmentId!, { id: r.id!, status: r.status! }]),
    );
  }

  async day(
    actor: Actor,
    sectionId: string,
    date: string,
  ): Promise<AttendanceDay> {
    await this.setup.getSection(actor.schoolId, sectionId);
    const roster = await this.students.sectionRoster(
      actor.schoolId,
      sectionId,
      date,
      date,
    );
    const current = await this.effective(
      this.db,
      roster.map((r) => r.enrollmentId),
      date,
    );
    return {
      sectionId,
      date,
      ...(await this.lockInfo(actor.schoolId, date)),
      rows: roster.map((r) => {
        const cur = current.get(r.enrollmentId);
        return {
          enrollmentId: r.enrollmentId,
          studentId: r.studentId,
          admissionNo: r.admissionNo,
          rollNo: r.rollNo,
          nameEn: r.nameEn,
          nameUr: r.nameUr,
          status: cur?.status ?? 'P',
          marked: !!cur,
        };
      }),
    };
  }

  async save(
    actor: UserActor,
    sectionId: string,
    date: string,
    input: AttendanceEntry[],
  ): Promise<AttendanceSaveResult> {
    if (date > today()) {
      throw new BadRequestException({
        code: 'FUTURE_DATE',
        message: 'Attendance cannot be marked for a future date',
      });
    }
    await this.setup.getSection(actor.schoolId, sectionId);
    // Last entry per student wins.
    const entries = [
      ...new Map(input.map((e) => [e.enrollmentId, e])).values(),
    ];
    const roster = await this.students.sectionRoster(
      actor.schoolId,
      sectionId,
      date,
      date,
    );
    const inSection = new Set(roster.map((r) => r.enrollmentId));
    const outside = entries.filter((e) => !inSection.has(e.enrollmentId));
    if (outside.length) {
      throw new BadRequestException({
        code: 'NOT_IN_SECTION',
        message: `Not enrolled in this section on ${date}: ${outside.map((e) => e.enrollmentId).join(', ')}`,
      });
    }

    const { locked } = await this.lockInfo(actor.schoolId, date);
    if (!locked) {
      return withTx(this.db, (tx) =>
        this.applyEntries(tx, actor, sectionId, date, entries),
      );
    }

    const current = await this.effective(
      this.db,
      entries.map((e) => e.enrollmentId),
      date,
    );
    const changes = entries
      .filter((e) => current.get(e.enrollmentId)?.status !== e.status)
      .sort((a, b) => a.enrollmentId.localeCompare(b.enrollmentId));
    if (changes.length === 0) return { inserted: 0, unchanged: entries.length };
    const { id } = await withTx(this.db, (tx) =>
      this.approvals.request(tx, actor, 'attendance.edit_old', {
        sectionId,
        date,
        entries: changes,
      }),
    );
    return {
      inserted: 0,
      unchanged: entries.length - changes.length,
      pendingApprovalId: id,
    };
  }

  // Inserts only entries whose status differs from the effective one. Also used by T7 when an
  // attendance.edit_old approval is approved.
  async applyEntries(
    tx: Tx,
    actor: UserActor,
    sectionId: string,
    date: string,
    entries: AttendanceEntry[],
  ): Promise<AttendanceSaveResult> {
    // Serialise concurrent saves of the same section/day so "changed" is computed on fresh data.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`${sectionId}:${date}`}))`,
    );
    const current = await this.effective(
      tx,
      entries.map((e) => e.enrollmentId),
      date,
    );
    const changed = entries.filter(
      (e) => current.get(e.enrollmentId)?.status !== e.status,
    );
    if (changed.length === 0) return { inserted: 0, unchanged: entries.length };

    const inserted = await tx
      .insert(attendanceEvent)
      .values(
        changed.map((e) => ({
          id: e.id,
          schoolId: actor.schoolId,
          enrollmentId: e.enrollmentId,
          date,
          status: e.status,
          markedBy: actor.userId,
          deviceId: actor.deviceId,
          hlc: this.hlc.now(),
          supersedesId: current.get(e.enrollmentId)?.id ?? null,
        })),
      )
      .onConflictDoNothing({ target: attendanceEvent.id })
      .returning({ id: attendanceEvent.id });
    if (inserted.length) {
      await this.audit.record(tx, actor, {
        action: 'attendance.mark',
        entity: 'section',
        entityId: sectionId,
        after: {
          date,
          changes: changed.map(({ enrollmentId, status }) => ({
            enrollmentId,
            status,
          })),
        },
      });
    }
    return {
      inserted: inserted.length,
      unchanged: entries.length - changed.length,
    };
  }

  async month(
    actor: Actor,
    sectionId: string,
    month: string,
  ): Promise<MonthRegister> {
    await this.setup.getSection(actor.schoolId, sectionId);
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const days = Array.from(
      { length: lastDay },
      (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`,
    );
    const roster = await this.students.sectionRoster(
      actor.schoolId,
      sectionId,
      days[0],
      days[lastDay - 1],
    );
    const ids = roster.map((r) => r.enrollmentId);
    const events = ids.length
      ? await this.db
          .select({
            enrollmentId: attendanceEffective.enrollmentId,
            date: attendanceEffective.date,
            status: attendanceEffective.status,
          })
          .from(attendanceEffective)
          .where(
            and(
              inArray(attendanceEffective.enrollmentId, ids),
              between(attendanceEffective.date, days[0], days[lastDay - 1]),
            ),
          )
      : [];

    const byEnrollment = new Map<string, Record<string, AttendanceStatus>>();
    for (const e of events) {
      const map = byEnrollment.get(e.enrollmentId!) ?? {};
      map[e.date!] = e.status!;
      byEnrollment.set(e.enrollmentId!, map);
    }
    return {
      sectionId,
      month,
      days,
      markedDays: [...new Set(events.map((e) => e.date!))].sort(),
      rows: roster.map((r) => {
        const statuses = byEnrollment.get(r.enrollmentId) ?? {};
        const totals = { P: 0, A: 0, L: 0, V: 0 };
        for (const s of Object.values(statuses)) totals[s]++;
        return {
          enrollmentId: r.enrollmentId,
          admissionNo: r.admissionNo,
          rollNo: r.rollNo,
          nameEn: r.nameEn,
          nameUr: r.nameUr,
          statuses,
          totals,
        };
      }),
    };
  }
}
