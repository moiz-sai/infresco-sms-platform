import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { PromoteInput, PromoteResult } from '@sms/shared';
import { ApprovalsService } from '../approvals/approvals.service';
import type { Actor } from '../common/actor';
import { DB, type Db } from '../db/database.module';
import { withTx, type Tx } from '../db/tx';
import { FeesService } from '../fees/fees.service';
import { SetupService } from '../setup/setup.service';
import { StudentsService } from '../students/students.service';

type UserActor = Actor & { userId: string };

// SPEC §Z6: promotion = move enrollments (students) + carry open fee amounts forward (fees),
// with students who still owe fees going to the principal when a clerk promotes.
@Injectable()
export class PromotionService implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly students: StudentsService,
    private readonly fees: FeesService,
    private readonly setup: SetupService,
    private readonly approvals: ApprovalsService,
  ) {}

  onModuleInit() {
    this.approvals.registerHandler(
      'students.promote',
      async (tx, request, decider) => {
        const p = request.payload as PromoteInput;
        await this.execute(tx, decider, {
          fromSectionId: p.fromSectionId,
          toSectionId: p.toSectionId,
          studentIds: p.studentIds,
        });
      },
    );
  }

  private async execute(tx: Tx, actor: Actor, input: PromoteInput) {
    const result = await this.students.promoteTx(tx, actor, input);
    for (const m of result.moves) {
      await this.fees.carryForward(
        tx,
        actor,
        m.fromEnrollmentId,
        m.toEnrollmentId,
        result.fromLabel,
        result.toLabel,
      );
    }
    return result.moves.length;
  }

  async promote(actor: UserActor, input: PromoteInput): Promise<PromoteResult> {
    const studentIds = [...new Set(input.studentIds)];
    const current = await this.students.activeIn(
      actor.schoolId,
      input.fromSectionId,
      studentIds,
    );
    const balances = await this.fees.balances(
      current.map((c) => c.enrollmentId),
    );
    const owes = (enrollmentId: string) =>
      (balances.get(enrollmentId) ?? 0) > 0;
    const owing = actor.canApprove
      ? []
      : current.filter((c) => owes(c.enrollmentId));
    const owingIds = new Set(owing.map((o) => o.studentId));
    // Unknown ids stay in the direct batch so promoteTx reports them as NOT_IN_SECTION.
    const direct = studentIds.filter((s) => !owingIds.has(s));

    const promoted = direct.length
      ? await withTx(this.db, (tx) =>
          this.execute(tx, actor, { ...input, studentIds: direct }),
        )
      : 0;
    if (owing.length === 0) return { promoted, pendingCount: 0 };

    const [from, to, info] = await Promise.all([
      this.setup.getSection(actor.schoolId, input.fromSectionId),
      this.setup.getSection(actor.schoolId, input.toSectionId),
      this.students.enrollmentInfo(
        actor.schoolId,
        owing.map((o) => o.enrollmentId),
      ),
    ]);
    const { id } = await withTx(this.db, (tx) =>
      this.approvals.request(tx, actor, 'students.promote', {
        fromSectionId: input.fromSectionId,
        toSectionId: input.toSectionId,
        studentIds: [...owingIds].sort(),
        display: {
          fromSection: `${from.classNameEn} — ${from.name} (${from.yearLabel})`,
          toSection: `${to.classNameEn} — ${to.name} (${to.yearLabel})`,
          count: owing.length,
          students: owing.map((o) => {
            const s = info.get(o.enrollmentId)!;
            return {
              nameEn: s.nameEn,
              nameUr: s.nameUr,
              admissionNo: s.admissionNo,
              balancePaisa: balances.get(o.enrollmentId) ?? 0,
            };
          }),
        },
      }),
    );
    return { promoted, pendingApprovalId: id, pendingCount: owing.length };
  }
}
