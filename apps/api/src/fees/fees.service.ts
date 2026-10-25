import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ADVANCE_HEAD,
  type DueLine,
  type FeeHead,
  type FeeHeadInput,
  type FeePlanInput,
  type FeeStructureInput,
  type PaymentInput,
  type PostChargesResult,
  type ReceiptView,
  type Statement,
} from '@sms/shared';
import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { AccessService } from '../auth/access.service';
import type { Actor } from '../common/actor';
import { AuditService } from '../common/audit.service';
import { CounterService } from '../common/counter.service';
import { HlcService } from '../common/hlc.service';
import { Env } from '../config/env';
import { DB, type Db } from '../db/database.module';
import {
  feeHead,
  feeStructure,
  ledgerEntry,
  receipt,
  studentFeePlan,
} from '../db/schema';
import { withTx, type Tx } from '../db/tx';
import { SetupService } from '../setup/setup.service';
import { StudentsService } from '../students/students.service';

type UserActor = Actor & { userId: string };

const localDate = (d: Date) => d.toLocaleDateString('en-CA');
export const currentPeriod = () => localDate(new Date()).slice(0, 7);
const lastDayOf = (period: string) => {
  const [y, m] = period.split('-').map(Number);
  return `${period}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
};
const notFound = (what: string) =>
  new NotFoundException({ code: 'NOT_FOUND', message: `${what} not found` });
const CHUNK = 1000;

function applyPlan(
  amount: number,
  plan?: { discountType: 'pct' | 'fixed'; value: number },
) {
  if (!plan) return amount;
  return plan.discountType === 'pct'
    ? Math.round((amount * (100 - plan.value)) / 100)
    : Math.max(0, amount - plan.value);
}

@Injectable()
export class FeesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly counter: CounterService,
    private readonly hlc: HlcService,
    private readonly setup: SetupService,
    private readonly students: StudentsService,
    private readonly access: AccessService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ---------- heads

  listHeads(schoolId: string): Promise<FeeHead[]> {
    return this.db
      .select({
        id: feeHead.id,
        code: feeHead.code,
        nameEn: feeHead.nameEn,
        nameUr: feeHead.nameUr,
        priority: feeHead.priority,
      })
      .from(feeHead)
      .where(and(eq(feeHead.schoolId, schoolId), isNull(feeHead.deletedAt)))
      .orderBy(asc(feeHead.priority), asc(feeHead.code));
  }

  private async advanceHeadId(executor: Db | Tx, schoolId: string) {
    const [row] = await executor
      .select({ id: feeHead.id })
      .from(feeHead)
      .where(
        and(eq(feeHead.schoolId, schoolId), eq(feeHead.code, ADVANCE_HEAD)),
      );
    if (!row) {
      throw new ConflictException({
        code: 'NO_ADVANCE_HEAD',
        message: `Fee head ${ADVANCE_HEAD} is missing; run the seed`,
      });
    }
    return row.id;
  }

  saveHead(actor: Actor, input: FeeHeadInput, id?: string) {
    return withTx(this.db, async (tx) => {
      if (id) {
        const [before] = await tx
          .select()
          .from(feeHead)
          .where(and(eq(feeHead.id, id), eq(feeHead.schoolId, actor.schoolId)));
        if (!before) throw notFound('Fee head');
        if ((before.code === ADVANCE_HEAD) !== (input.code === ADVANCE_HEAD)) {
          throw new BadRequestException({
            code: 'ADVANCE_HEAD',
            message: `The ${ADVANCE_HEAD} code is reserved for advance payments`,
          });
        }
      } else if (input.code === ADVANCE_HEAD) {
        throw new BadRequestException({
          code: 'ADVANCE_HEAD',
          message: `The ${ADVANCE_HEAD} code is reserved for advance payments`,
        });
      }
      const [row] = id
        ? await tx
            .update(feeHead)
            .set(input)
            .where(eq(feeHead.id, id))
            .returning()
        : await tx
            .insert(feeHead)
            .values({ ...input, schoolId: actor.schoolId })
            .returning();
      await this.audit.record(tx, actor, {
        action: id ? 'fee_head.update' : 'fee_head.create',
        entity: 'fee_head',
        entityId: row.id,
        after: input,
      });
      return row;
    });
  }

  deleteHead(actor: Actor, id: string) {
    return withTx(this.db, async (tx) => {
      if (id === (await this.advanceHeadId(tx, actor.schoolId))) {
        throw new BadRequestException({
          code: 'ADVANCE_HEAD',
          message: `The ${ADVANCE_HEAD} head holds advance payments and cannot be deleted`,
        });
      }
      const [row] = await tx
        .delete(feeHead)
        .where(
          and(
            eq(feeHead.id, id),
            eq(feeHead.schoolId, actor.schoolId),
            ne(feeHead.code, ADVANCE_HEAD),
          ),
        )
        .returning();
      if (!row) throw notFound('Fee head');
      await this.audit.record(tx, actor, {
        action: 'fee_head.delete',
        entity: 'fee_head',
        entityId: id,
        before: row,
      });
    });
  }

  // ---------- structures

  async listStructures(schoolId: string, yearId?: string) {
    const year = yearId ?? (await this.setup.currentYear(schoolId)).id;
    return this.db
      .select({
        id: feeStructure.id,
        classId: feeStructure.classId,
        yearId: feeStructure.yearId,
        headId: feeStructure.headId,
        amountPaisa: feeStructure.amountPaisa,
        frequency: feeStructure.frequency,
      })
      .from(feeStructure)
      .where(
        and(
          eq(feeStructure.schoolId, schoolId),
          eq(feeStructure.yearId, year),
          isNull(feeStructure.deletedAt),
        ),
      );
  }

  // Upsert by (class, year, head) so the setup grid can save cell by cell.
  saveStructure(actor: Actor, input: FeeStructureInput) {
    return withTx(this.db, async (tx) => {
      if (input.headId === (await this.advanceHeadId(tx, actor.schoolId))) {
        throw new BadRequestException({
          code: 'ADVANCE_HEAD',
          message: `${ADVANCE_HEAD} cannot have a fee amount`,
        });
      }
      const [row] = await tx
        .insert(feeStructure)
        .values({ ...input, schoolId: actor.schoolId })
        .onConflictDoUpdate({
          target: [
            feeStructure.classId,
            feeStructure.yearId,
            feeStructure.headId,
          ],
          set: {
            amountPaisa: input.amountPaisa,
            frequency: input.frequency,
            deletedAt: null,
            updatedAt: new Date(),
          },
        })
        .returning();
      await this.audit.record(tx, actor, {
        action: 'fee_structure.save',
        entity: 'fee_structure',
        entityId: row.id,
        after: input,
      });
      return row;
    });
  }

  deleteStructure(actor: Actor, id: string) {
    return withTx(this.db, async (tx) => {
      const [row] = await tx
        .delete(feeStructure)
        .where(
          and(
            eq(feeStructure.id, id),
            eq(feeStructure.schoolId, actor.schoolId),
          ),
        )
        .returning();
      if (!row) throw notFound('Fee structure');
      await this.audit.record(tx, actor, {
        action: 'fee_structure.delete',
        entity: 'fee_structure',
        entityId: id,
        before: row,
      });
    });
  }

  // ---------- plans (standing per-student discounts, applied when charges are posted)

  listPlans(schoolId: string, enrollmentId: string) {
    return this.db
      .select({
        id: studentFeePlan.id,
        enrollmentId: studentFeePlan.enrollmentId,
        headId: studentFeePlan.headId,
        discountType: studentFeePlan.discountType,
        value: studentFeePlan.value,
        reason: studentFeePlan.reason,
      })
      .from(studentFeePlan)
      .where(
        and(
          eq(studentFeePlan.schoolId, schoolId),
          eq(studentFeePlan.enrollmentId, enrollmentId),
          isNull(studentFeePlan.deletedAt),
        ),
      );
  }

  savePlan(actor: Actor, input: FeePlanInput) {
    return withTx(this.db, async (tx) => {
      const [row] = await tx
        .insert(studentFeePlan)
        .values({ ...input, schoolId: actor.schoolId })
        .onConflictDoUpdate({
          target: [studentFeePlan.enrollmentId, studentFeePlan.headId],
          set: {
            discountType: input.discountType,
            value: input.value,
            reason: input.reason ?? null,
            deletedAt: null,
            updatedAt: new Date(),
          },
        })
        .returning();
      await this.audit.record(tx, actor, {
        action: 'fee_plan.save',
        entity: 'student_fee_plan',
        entityId: row.id,
        after: input,
      });
      return row;
    });
  }

  deletePlan(actor: Actor, id: string) {
    return withTx(this.db, async (tx) => {
      const [row] = await tx
        .delete(studentFeePlan)
        .where(
          and(
            eq(studentFeePlan.id, id),
            eq(studentFeePlan.schoolId, actor.schoolId),
          ),
        )
        .returning();
      if (!row) throw notFound('Fee plan');
      await this.audit.record(tx, actor, {
        action: 'fee_plan.delete',
        entity: 'student_fee_plan',
        entityId: id,
        before: row,
      });
    });
  }

  // ---------- charges

  // Monthly heads: one charge per period (unique index makes re-runs no-ops).
  // Yearly heads: once per enrollment, in the first run after joining. Once heads: same, first enrollment only.
  async postCharges(actor: Actor, period: string): Promise<PostChargesResult> {
    const periodEnd = lastDayOf(period);
    return withTx(this.db, async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`post-charges:${actor.schoolId}`}))`,
      );
      const enrollments = (
        await this.students.billableEnrollments(actor.schoolId, periodEnd)
      ).filter((e) => e.joinedOn.slice(0, 7) <= period);
      if (enrollments.length === 0) return { period, inserted: 0 };

      const sections = await this.setup.describeSections(
        actor.schoolId,
        enrollments.map((e) => e.sectionId),
      );
      const yearIds = [...new Set(enrollments.map((e) => e.yearId))];
      const enrollmentIds = enrollments.map((e) => e.enrollmentId);
      const [structures, plans, oneOff] = await Promise.all([
        tx
          .select()
          .from(feeStructure)
          .where(
            and(
              eq(feeStructure.schoolId, actor.schoolId),
              inArray(feeStructure.yearId, yearIds),
              isNull(feeStructure.deletedAt),
            ),
          ),
        tx
          .select()
          .from(studentFeePlan)
          .where(
            and(
              inArray(studentFeePlan.enrollmentId, enrollmentIds),
              isNull(studentFeePlan.deletedAt),
            ),
          ),
        tx
          .select({
            enrollmentId: ledgerEntry.enrollmentId,
            headId: ledgerEntry.headId,
          })
          .from(ledgerEntry)
          .innerJoin(feeStructure, eq(feeStructure.headId, ledgerEntry.headId))
          .where(
            and(
              inArray(ledgerEntry.enrollmentId, enrollmentIds),
              eq(ledgerEntry.type, 'charge'),
              ne(feeStructure.frequency, 'monthly'),
            ),
          ),
      ]);
      const planOf = new Map(
        plans.map((p) => [`${p.enrollmentId}:${p.headId}`, p]),
      );
      const charged = new Set(
        oneOff.map((c) => `${c.enrollmentId}:${c.headId}`),
      );

      const rows: (typeof ledgerEntry.$inferInsert)[] = [];
      for (const e of enrollments) {
        const sec = sections.get(e.sectionId);
        if (!sec) continue;
        if (
          period < sec.yearStartsOn.slice(0, 7) ||
          period > sec.yearEndsOn.slice(0, 7)
        ) {
          continue;
        }
        for (const st of structures) {
          if (st.classId !== sec.classId || st.yearId !== e.yearId) continue;
          const key = `${e.enrollmentId}:${st.headId}`;
          if (st.frequency !== 'monthly' && charged.has(key)) continue;
          if (st.frequency === 'once' && !e.isFirst) continue;
          const plan = planOf.get(key);
          const amount = applyPlan(st.amountPaisa, plan);
          if (amount <= 0) continue;
          rows.push({
            schoolId: actor.schoolId,
            enrollmentId: e.enrollmentId,
            headId: st.headId,
            period,
            type: 'charge',
            amountPaisa: amount,
            note: plan
              ? `Plan: ${plan.discountType === 'pct' ? `${plan.value}%` : `${plan.value / 100} off`}`
              : null,
            createdBy: actor.userId,
            deviceId: actor.deviceId,
            hlc: this.hlc.now(),
          });
        }
      }

      let inserted = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const done = await tx
          .insert(ledgerEntry)
          .values(rows.slice(i, i + CHUNK))
          .onConflictDoNothing()
          .returning({ id: ledgerEntry.id });
        inserted += done.length;
      }
      if (inserted > 0) {
        await this.audit.record(tx, actor, {
          action: 'fees.post_charges',
          entity: 'ledger_entry',
          after: { period, inserted },
        });
      }
      return { period, inserted };
    });
  }

  // ---------- statement

  private dues(executor: Db | Tx, enrollmentId: string): Promise<DueLine[]> {
    return executor
      .select({
        period: ledgerEntry.period,
        headId: ledgerEntry.headId,
        headCode: feeHead.code,
        headNameEn: feeHead.nameEn,
        headNameUr: feeHead.nameUr,
        amountPaisa: sql<number>`sum(${ledgerEntry.amountPaisa})`.mapWith(
          Number,
        ),
      })
      .from(ledgerEntry)
      .innerJoin(feeHead, eq(feeHead.id, ledgerEntry.headId))
      .where(
        and(
          eq(ledgerEntry.enrollmentId, enrollmentId),
          ne(feeHead.code, ADVANCE_HEAD),
        ),
      )
      .groupBy(
        ledgerEntry.period,
        ledgerEntry.headId,
        feeHead.code,
        feeHead.nameEn,
        feeHead.nameUr,
        feeHead.priority,
      )
      .having(sql`sum(${ledgerEntry.amountPaisa}) > 0`)
      .orderBy(asc(ledgerEntry.period), asc(feeHead.priority));
  }

  private async balances(enrollmentIds: string[]) {
    if (enrollmentIds.length === 0) return new Map<string, number>();
    const rows = await this.db
      .select({
        enrollmentId: ledgerEntry.enrollmentId,
        total: sql<number>`sum(${ledgerEntry.amountPaisa})`.mapWith(Number),
      })
      .from(ledgerEntry)
      .where(inArray(ledgerEntry.enrollmentId, enrollmentIds))
      .groupBy(ledgerEntry.enrollmentId);
    return new Map(rows.map((r) => [r.enrollmentId, r.total]));
  }

  async statement(schoolId: string, enrollmentId: string): Promise<Statement> {
    const student = (
      await this.students.enrollmentInfo(schoolId, [enrollmentId])
    ).get(enrollmentId);
    if (!student) throw notFound('Enrollment');

    const [entries, dues, siblingIds] = await Promise.all([
      this.db
        .select({
          id: ledgerEntry.id,
          createdAt: ledgerEntry.createdAt,
          period: ledgerEntry.period,
          headCode: feeHead.code,
          headNameEn: feeHead.nameEn,
          headNameUr: feeHead.nameUr,
          type: ledgerEntry.type,
          amountPaisa: ledgerEntry.amountPaisa,
          receiptId: ledgerEntry.receiptId,
          receiptNo: receipt.receiptNo,
          note: ledgerEntry.note,
          balancePaisa:
            sql<number>`sum(${ledgerEntry.amountPaisa}) over (order by ${ledgerEntry.hlc}, ${ledgerEntry.id})`.mapWith(
              Number,
            ),
        })
        .from(ledgerEntry)
        .innerJoin(feeHead, eq(feeHead.id, ledgerEntry.headId))
        .leftJoin(receipt, eq(receipt.id, ledgerEntry.receiptId))
        .where(eq(ledgerEntry.enrollmentId, enrollmentId))
        .orderBy(asc(ledgerEntry.hlc), asc(ledgerEntry.id)),
      this.dues(this.db, enrollmentId),
      this.students.siblingEnrollmentIds(schoolId, student.studentId),
    ]);

    const balancePaisa = entries.at(-1)?.balancePaisa ?? 0;
    const advancePaisa = -entries
      .filter((e) => e.headCode === ADVANCE_HEAD)
      .reduce((sum, e) => sum + e.amountPaisa, 0);
    const [siblingInfo, siblingBalances] = await Promise.all([
      this.students.enrollmentInfo(schoolId, siblingIds),
      this.balances(siblingIds),
    ]);
    return {
      student,
      entries: entries.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
      dues,
      balancePaisa,
      advancePaisa: Math.max(0, advancePaisa),
      siblings: [...siblingInfo.values()].map((s) => ({
        ...s,
        balancePaisa: siblingBalances.get(s.enrollmentId) ?? 0,
      })),
    };
  }

  // ---------- payments

  // Allocates oldest period first, then head priority; anything left over is an advance (ADV).
  async pay(actor: UserActor, input: PaymentInput) {
    const student = (
      await this.students.enrollmentInfo(actor.schoolId, [input.enrollmentId])
    ).get(input.enrollmentId);
    if (!student) throw notFound('Enrollment');
    const prefix = this.config.get('DEVICE_PREFIX', { infer: true });

    return withTx(this.db, async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`fees:${input.enrollmentId}`}))`,
      );
      const dues = await this.dues(tx, input.enrollmentId);
      let remaining = input.amountPaisa;
      const lines: { headId: string; period: string; amount: number }[] = [];
      for (const d of dues) {
        if (remaining === 0) break;
        const amount = Math.min(remaining, d.amountPaisa);
        lines.push({ headId: d.headId, period: d.period, amount });
        remaining -= amount;
      }
      if (remaining > 0) {
        lines.push({
          headId: await this.advanceHeadId(tx, actor.schoolId),
          period: currentPeriod(),
          amount: remaining,
        });
      }

      const year = currentPeriod().slice(0, 4);
      const seq = await this.counter.next(tx, actor.schoolId, `rcpt:${year}`);
      const receiptNo = `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
      const [rcpt] = await tx
        .insert(receipt)
        .values({
          schoolId: actor.schoolId,
          receiptNo,
          enrollmentId: input.enrollmentId,
          method: input.method,
          totalPaisa: input.amountPaisa,
          receivedBy: actor.userId,
          deviceId: actor.deviceId,
        })
        .returning({ id: receipt.id });
      await tx.insert(ledgerEntry).values(
        lines.map((l) => ({
          schoolId: actor.schoolId,
          enrollmentId: input.enrollmentId,
          headId: l.headId,
          period: l.period,
          type: 'payment' as const,
          amountPaisa: -l.amount,
          receiptId: rcpt.id,
          createdBy: actor.userId,
          deviceId: actor.deviceId,
          hlc: this.hlc.now(),
        })),
      );
      await this.audit.record(tx, actor, {
        action: 'fees.payment',
        entity: 'receipt',
        entityId: rcpt.id,
        after: { receiptNo, ...input, lines },
      });
      return { receiptId: rcpt.id, receiptNo };
    });
  }

  async receipt(schoolId: string, id: string): Promise<ReceiptView> {
    const [r] = await this.db
      .select()
      .from(receipt)
      .where(and(eq(receipt.id, id), eq(receipt.schoolId, schoolId)));
    if (!r) throw notFound('Receipt');

    const lines = await this.db
      .select({
        id: ledgerEntry.id,
        period: ledgerEntry.period,
        headCode: feeHead.code,
        headNameEn: feeHead.nameEn,
        headNameUr: feeHead.nameUr,
        amountPaisa: ledgerEntry.amountPaisa,
        hlc: ledgerEntry.hlc,
      })
      .from(ledgerEntry)
      .innerJoin(feeHead, eq(feeHead.id, ledgerEntry.headId))
      .where(
        and(eq(ledgerEntry.receiptId, id), eq(ledgerEntry.type, 'payment')),
      )
      .orderBy(asc(ledgerEntry.period), asc(feeHead.priority));
    const lastHlc = Math.max(0, ...lines.map((l) => l.hlc));
    const lineIds = lines.map((l) => l.id);

    const [school, students, names, [after], reversals] = await Promise.all([
      this.setup.getSchool(schoolId),
      this.students.enrollmentInfo(schoolId, [r.enrollmentId]),
      this.access.displayNames([r.receivedBy]),
      this.db
        .select({
          total:
            sql<number>`coalesce(sum(${ledgerEntry.amountPaisa}), 0)`.mapWith(
              Number,
            ),
        })
        .from(ledgerEntry)
        .where(
          and(
            eq(ledgerEntry.enrollmentId, r.enrollmentId),
            sql`${ledgerEntry.hlc} <= ${lastHlc}`,
          ),
        ),
      lineIds.length
        ? this.db
            .select({ id: ledgerEntry.id })
            .from(ledgerEntry)
            .where(inArray(ledgerEntry.reversesId, lineIds))
            .limit(1)
        : Promise.resolve([]),
    ]);
    return {
      id: r.id,
      receiptNo: r.receiptNo,
      createdAt: r.createdAt.toISOString(),
      method: r.method,
      totalPaisa: r.totalPaisa,
      receivedBy: names.get(r.receivedBy) ?? '',
      cancelled: reversals.length > 0,
      balanceAfterPaisa: after.total,
      school: {
        nameEn: school.nameEn,
        nameUr: school.nameUr,
        address: school.address,
        phone: school.phone,
      },
      student: students.get(r.enrollmentId)!,
      lines: lines.map((l) => ({
        period: l.period,
        headCode: l.headCode,
        headNameEn: l.headNameEn,
        headNameUr: l.headNameUr,
        amountPaisa: -l.amountPaisa,
      })),
    };
  }
}
