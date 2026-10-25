import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ADVANCE_HEAD,
  formatPaisa,
  type ApprovalOutcome,
  type CashCloseView,
  type DiscountInput,
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
import { ApprovalsService } from '../approvals/approvals.service';
import { AccessService } from '../auth/access.service';
import type { Actor } from '../common/actor';
import { AuditService } from '../common/audit.service';
import { CounterService } from '../common/counter.service';
import { HlcService } from '../common/hlc.service';
import { Env } from '../config/env';
import { DB, type Db } from '../db/database.module';
import {
  cashClose,
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
const today = () => localDate(new Date());
const dayRange = (date: string) => {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return [start, end] as const;
};
const lockEnrollment = (tx: Tx, enrollmentId: string) =>
  tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`fees:${enrollmentId}`}))`,
  );

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
export class FeesService implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly counter: CounterService,
    private readonly hlc: HlcService,
    private readonly setup: SetupService,
    private readonly students: StudentsService,
    private readonly access: AccessService,
    private readonly approvals: ApprovalsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit() {
    this.approvals.registerHandler(
      'fees.discount',
      async (tx, request, decider) => {
        const p = request.payload as Record<string, unknown> & {
          kind?: string;
        };
        if (p.kind === 'plan') {
          await this.applyPlan(tx, decider, {
            enrollmentId: p.enrollmentId as string,
            headId: p.headId as string,
            discountType: p.discountType as 'pct' | 'fixed',
            value: p.value as number,
            reason: (p.reason as string | null) ?? null,
          });
        } else {
          await this.applyDiscount(tx, decider, {
            enrollmentId: p.enrollmentId as string,
            headId: p.headId as string,
            period: p.period as string,
            amountPaisa: p.amountPaisa as number,
            reason: p.reason as string,
          });
        }
      },
    );
    this.approvals.registerHandler(
      'fees.reverse',
      async (tx, request, decider) => {
        const p = request.payload as { receiptId: string; reason: string };
        await this.applyReversal(tx, decider, p.receiptId, p.reason);
      },
    );
  }

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

  // SPEC §Z2: plans whose monthly discount exceeds the threshold need approval (principal applies directly).
  async savePlan(
    actor: UserActor,
    input: FeePlanInput,
  ): Promise<ApprovalOutcome> {
    const student = await this.studentOrThrow(
      actor.schoolId,
      input.enrollmentId,
    );
    const sec = await this.setup.getSection(actor.schoolId, student.sectionId);
    const [structure] = await this.db
      .select({ amountPaisa: feeStructure.amountPaisa })
      .from(feeStructure)
      .where(
        and(
          eq(feeStructure.classId, sec.classId),
          eq(feeStructure.yearId, sec.yearId),
          eq(feeStructure.headId, input.headId),
        ),
      );
    const fee = structure?.amountPaisa ?? 0;
    const discount =
      input.discountType === 'pct'
        ? Math.round((fee * input.value) / 100)
        : Math.min(fee, input.value);
    const { discountThresholdPaisa } = await this.setup.getSettings(
      actor.schoolId,
    );
    if (actor.canApprove || discount <= discountThresholdPaisa) {
      await withTx(this.db, (tx) => this.applyPlan(tx, actor, input));
      return { applied: true };
    }
    const headCode = (await this.listHeads(actor.schoolId)).find(
      (h) => h.id === input.headId,
    )?.code;
    const { id } = await withTx(this.db, (tx) =>
      this.approvals.request(tx, actor, 'fees.discount', {
        kind: 'plan',
        ...input,
        reason: input.reason ?? null,
        display: {
          kind: 'plan',
          studentNameEn: student.nameEn,
          studentNameUr: student.nameUr,
          admissionNo: student.admissionNo,
          headCode,
          amountPaisa: discount,
          reason: input.reason ?? null,
        },
      }),
    );
    return { applied: false, pendingApprovalId: id };
  }

  private async applyPlan(tx: Tx, actor: Actor, input: FeePlanInput) {
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
      // Sequential: these run on the transaction's single connection.
      const structures = await tx
        .select()
        .from(feeStructure)
        .where(
          and(
            eq(feeStructure.schoolId, actor.schoolId),
            inArray(feeStructure.yearId, yearIds),
            isNull(feeStructure.deletedAt),
          ),
        );
      const plans = await tx
        .select()
        .from(studentFeePlan)
        .where(
          and(
            inArray(studentFeePlan.enrollmentId, enrollmentIds),
            isNull(studentFeePlan.deletedAt),
          ),
        );
      const oneOff = await tx
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
        );
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

  async balances(enrollmentIds: string[]) {
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
    if (
      input.method === 'cash' &&
      (await this.closedOn(actor.schoolId, today()))
    ) {
      throw new ConflictException({
        code: 'CASH_CLOSED',
        message:
          "Today's cash is already closed; record it as bank/online or tomorrow",
      });
    }
    const prefix = this.config.get('DEVICE_PREFIX', { infer: true });

    return withTx(this.db, async (tx) => {
      await lockEnrollment(tx, input.enrollmentId);
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

  // ---------- discounts, reversal, cash close, carry-forward (T7)

  private async studentOrThrow(schoolId: string, enrollmentId: string) {
    const s = (
      await this.students.enrollmentInfo(schoolId, [enrollmentId])
    ).get(enrollmentId);
    if (!s) throw notFound('Enrollment');
    return s;
  }

  async discount(
    actor: UserActor,
    input: DiscountInput,
  ): Promise<ApprovalOutcome> {
    const student = await this.studentOrThrow(
      actor.schoolId,
      input.enrollmentId,
    );
    const line = (await this.dues(this.db, input.enrollmentId)).find(
      (d) => d.period === input.period && d.headId === input.headId,
    );
    if (!line || input.amountPaisa > line.amountPaisa) {
      throw new BadRequestException({
        code: 'EXCEEDS_DUE',
        message: `Discount is more than the ${formatPaisa(line?.amountPaisa ?? 0)} due for that fee`,
      });
    }
    const { discountThresholdPaisa } = await this.setup.getSettings(
      actor.schoolId,
    );
    if (actor.canApprove || input.amountPaisa <= discountThresholdPaisa) {
      await withTx(this.db, (tx) => this.applyDiscount(tx, actor, input));
      return { applied: true };
    }
    const { id } = await withTx(this.db, (tx) =>
      this.approvals.request(tx, actor, 'fees.discount', {
        kind: 'adjust',
        ...input,
        display: {
          kind: 'adjust',
          studentNameEn: student.nameEn,
          studentNameUr: student.nameUr,
          admissionNo: student.admissionNo,
          headCode: line.headCode,
          period: input.period,
          amountPaisa: input.amountPaisa,
          reason: input.reason,
        },
      }),
    );
    return { applied: false, pendingApprovalId: id };
  }

  // Re-checks the due under the enrollment lock: an approval may run long after the request.
  private async applyDiscount(tx: Tx, actor: Actor, input: DiscountInput) {
    await lockEnrollment(tx, input.enrollmentId);
    const line = (await this.dues(tx, input.enrollmentId)).find(
      (d) => d.period === input.period && d.headId === input.headId,
    );
    if (!line || input.amountPaisa > line.amountPaisa) {
      throw new ConflictException({
        code: 'STALE',
        message: `Only ${formatPaisa(line?.amountPaisa ?? 0)} is still due for that fee`,
      });
    }
    const [row] = await tx
      .insert(ledgerEntry)
      .values({
        schoolId: actor.schoolId,
        enrollmentId: input.enrollmentId,
        headId: input.headId,
        period: input.period,
        type: 'adjust',
        amountPaisa: -input.amountPaisa,
        note: input.reason,
        createdBy: actor.userId,
        deviceId: actor.deviceId,
        hlc: this.hlc.now(),
      })
      .returning({ id: ledgerEntry.id });
    await this.audit.record(tx, actor, {
      action: 'fees.discount',
      entity: 'ledger_entry',
      entityId: row.id,
      after: input,
    });
  }

  async reverse(
    actor: UserActor,
    receiptId: string,
    reason: string,
  ): Promise<ApprovalOutcome> {
    const view = await this.receipt(actor.schoolId, receiptId);
    if (view.cancelled) {
      throw new ConflictException({
        code: 'ALREADY_REVERSED',
        message: `Receipt ${view.receiptNo} is already cancelled`,
      });
    }
    if (actor.canApprove) {
      await withTx(this.db, (tx) =>
        this.applyReversal(tx, actor, receiptId, reason),
      );
      return { applied: true };
    }
    const { id } = await withTx(this.db, (tx) =>
      this.approvals.request(tx, actor, 'fees.reverse', {
        receiptId,
        reason,
        display: {
          receiptNo: view.receiptNo,
          amountPaisa: view.totalPaisa,
          studentNameEn: view.student.nameEn,
          studentNameUr: view.student.nameUr,
          admissionNo: view.student.admissionNo,
          reason,
        },
      }),
    );
    return { applied: false, pendingApprovalId: id };
  }

  // reversal = −(original) per payment line; reverses_id is UNIQUE, so a payment can be reversed once.
  private async applyReversal(
    tx: Tx,
    actor: Actor,
    receiptId: string,
    reason: string,
  ) {
    const lines = await tx
      .select()
      .from(ledgerEntry)
      .where(
        and(
          eq(ledgerEntry.schoolId, actor.schoolId),
          eq(ledgerEntry.receiptId, receiptId),
          eq(ledgerEntry.type, 'payment'),
        ),
      );
    if (lines.length === 0) throw notFound('Receipt');
    await lockEnrollment(tx, lines[0].enrollmentId);
    const [done] = await tx
      .select({ id: ledgerEntry.id })
      .from(ledgerEntry)
      .where(
        inArray(
          ledgerEntry.reversesId,
          lines.map((l) => l.id),
        ),
      )
      .limit(1);
    if (done) {
      throw new ConflictException({
        code: 'ALREADY_REVERSED',
        message: 'This receipt is already cancelled',
      });
    }
    await tx.insert(ledgerEntry).values(
      lines.map((l) => ({
        schoolId: actor.schoolId,
        enrollmentId: l.enrollmentId,
        headId: l.headId,
        period: l.period,
        type: 'reversal' as const,
        amountPaisa: -l.amountPaisa,
        receiptId,
        reversesId: l.id,
        note: reason,
        createdBy: actor.userId,
        deviceId: actor.deviceId,
        hlc: this.hlc.now(),
      })),
    );
    await this.audit.record(tx, actor, {
      action: 'fees.reverse',
      entity: 'receipt',
      entityId: receiptId,
      after: { reason, lines: lines.length },
    });
  }

  private async closedOn(schoolId: string, date: string) {
    const [row] = await this.db
      .select({ id: cashClose.id })
      .from(cashClose)
      .where(and(eq(cashClose.schoolId, schoolId), eq(cashClose.date, date)));
    return !!row;
  }

  // Cash receipts taken that day, excluding cancelled ones.
  private async cashTotal(executor: Db | Tx, schoolId: string, date: string) {
    const [start, end] = dayRange(date);
    const [row] = await executor
      .select({
        total: sql<number>`coalesce(sum(${receipt.totalPaisa}), 0)`.mapWith(
          Number,
        ),
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(receipt)
      .where(
        and(
          eq(receipt.schoolId, schoolId),
          eq(receipt.method, 'cash'),
          sql`${receipt.createdAt} >= ${start} and ${receipt.createdAt} < ${end}`,
          sql`not exists (
            select 1 from ledger_entry rev
            join ledger_entry pay on pay.id = rev.reverses_id
            where pay.receipt_id = ${receipt.id})`,
        ),
      );
    return row;
  }

  async cashCloseView(schoolId: string, date: string): Promise<CashCloseView> {
    const [{ total, count: receiptCount }, [close]] = await Promise.all([
      this.cashTotal(this.db, schoolId, date),
      this.db
        .select()
        .from(cashClose)
        .where(and(eq(cashClose.schoolId, schoolId), eq(cashClose.date, date))),
    ]);
    const names = close
      ? await this.access.displayNames([close.closedBy])
      : new Map<string, string>();
    return {
      date,
      // Once closed, report the figure that was closed against.
      systemTotalPaisa: close ? close.systemTotalPaisa : total,
      receiptCount,
      close: close
        ? {
            countedTotalPaisa: close.countedTotalPaisa,
            differencePaisa: close.differencePaisa,
            closedByName: names.get(close.closedBy) ?? '',
            createdAt: close.createdAt.toISOString(),
          }
        : null,
    };
  }

  async closeCash(actor: UserActor, date: string, countedTotalPaisa: number) {
    if (date > today()) {
      throw new BadRequestException({
        code: 'FUTURE_DATE',
        message: 'Cannot close a future date',
      });
    }
    await withTx(this.db, async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`cash-close:${actor.schoolId}:${date}`}))`,
      );
      const [existing] = await tx
        .select({ id: cashClose.id })
        .from(cashClose)
        .where(
          and(eq(cashClose.schoolId, actor.schoolId), eq(cashClose.date, date)),
        );
      if (existing) {
        throw new ConflictException({
          code: 'ALREADY_CLOSED',
          message: `Cash for ${date} is already closed`,
        });
      }
      const { total } = await this.cashTotal(tx, actor.schoolId, date);
      const [row] = await tx
        .insert(cashClose)
        .values({
          schoolId: actor.schoolId,
          date,
          systemTotalPaisa: total,
          countedTotalPaisa,
          differencePaisa: countedTotalPaisa - total,
          closedBy: actor.userId,
        })
        .returning({ id: cashClose.id });
      await this.audit.record(tx, actor, {
        action: 'cash.close',
        entity: 'cash_close',
        entityId: row.id,
        after: { date, systemTotalPaisa: total, countedTotalPaisa },
      });
    });
    return this.cashCloseView(actor.schoolId, date);
  }

  // SPEC §Z6: move every open (period, head) amount of the old enrollment to the new one.
  async carryForward(
    tx: Tx,
    actor: Actor,
    fromEnrollmentId: string,
    toEnrollmentId: string,
    fromLabel: string,
    toLabel: string,
  ) {
    await lockEnrollment(tx, fromEnrollmentId);
    const open = await tx
      .select({
        period: ledgerEntry.period,
        headId: ledgerEntry.headId,
        total: sql<number>`sum(${ledgerEntry.amountPaisa})`.mapWith(Number),
      })
      .from(ledgerEntry)
      .where(eq(ledgerEntry.enrollmentId, fromEnrollmentId))
      .groupBy(ledgerEntry.period, ledgerEntry.headId)
      .having(sql`sum(${ledgerEntry.amountPaisa}) <> 0`);
    if (open.length === 0) return;
    const base = {
      schoolId: actor.schoolId,
      type: 'adjust' as const,
      createdBy: actor.userId,
      deviceId: actor.deviceId,
    };
    await tx.insert(ledgerEntry).values(
      open.flatMap((o) => [
        {
          ...base,
          enrollmentId: fromEnrollmentId,
          headId: o.headId,
          period: o.period,
          amountPaisa: -o.total,
          note: `Carried forward to ${toLabel}`,
          hlc: this.hlc.now(),
        },
        {
          ...base,
          enrollmentId: toEnrollmentId,
          headId: o.headId,
          period: o.period,
          amountPaisa: o.total,
          note: `Carried forward from ${fromLabel}`,
          hlc: this.hlc.now(),
        },
      ]),
    );
    await this.audit.record(tx, actor, {
      action: 'fees.carry_forward',
      entity: 'enrollment',
      entityId: toEnrollmentId,
      after: {
        fromEnrollmentId,
        lines: open.length,
        totalPaisa: open.reduce((s, o) => s + o.total, 0),
      },
    });
  }
}
