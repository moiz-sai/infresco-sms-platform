import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { ApprovalItem, ApprovalListQuery, Page } from '@sms/shared';
import { AccessService } from '../auth/access.service';
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Actor } from '../common/actor';
import { AuditService } from '../common/audit.service';
import { DB, type Db } from '../db/database.module';
import { approvalRequest } from '../db/schema';
import { withTx, type Tx } from '../db/tx';

export type ApprovalRow = typeof approvalRequest.$inferSelect;
export type ApprovalAction = ApprovalRow['action'];
type UserActor = Actor & { userId: string };

// Runs an approved request inside the approval tx. It must re-validate and throw if the request
// no longer makes sense; the throw rolls back both the action and the status change.
export type ApprovalHandler = (
  tx: Tx,
  request: ApprovalRow,
  decider: UserActor,
) => Promise<void>;

@Injectable()
export class ApprovalsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly access: AccessService,
  ) {}

  private readonly handlers = new Map<ApprovalAction, ApprovalHandler>();

  // Owning modules register how to execute their actions (keeps approvals free of their tables).
  registerHandler(action: ApprovalAction, handler: ApprovalHandler) {
    this.handlers.set(action, handler);
  }

  private async lockPending(tx: Tx, schoolId: string, id: string) {
    const [row] = await tx
      .select()
      .from(approvalRequest)
      .where(
        and(eq(approvalRequest.id, id), eq(approvalRequest.schoolId, schoolId)),
      )
      .for('update');
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Request not found',
      });
    }
    if (row.status !== 'pending') {
      throw new ConflictException({
        code: 'NOT_PENDING',
        message: `Request is already ${row.status}`,
      });
    }
    return row;
  }

  approve(actor: UserActor, id: string) {
    return withTx(this.db, async (tx) => {
      const request = await this.lockPending(tx, actor.schoolId, id);
      const handler = this.handlers.get(request.action);
      if (!handler) {
        throw new InternalServerErrorException({
          code: 'NO_HANDLER',
          message: `No handler for ${request.action}`,
        });
      }
      await handler(tx, request, actor);
      await tx
        .update(approvalRequest)
        .set({
          status: 'approved',
          decidedBy: actor.userId,
          decidedAt: new Date(),
        })
        .where(eq(approvalRequest.id, id));
      await this.audit.record(tx, actor, {
        action: 'approval.approve',
        entity: 'approval_request',
        entityId: id,
        after: { action: request.action },
      });
      return { id, status: 'approved' as const };
    });
  }

  reject(actor: UserActor, id: string, reason: string) {
    return withTx(this.db, async (tx) => {
      const request = await this.lockPending(tx, actor.schoolId, id);
      await tx
        .update(approvalRequest)
        .set({
          status: 'rejected',
          decidedBy: actor.userId,
          decidedAt: new Date(),
          reason,
        })
        .where(eq(approvalRequest.id, id));
      await this.audit.record(tx, actor, {
        action: 'approval.reject',
        entity: 'approval_request',
        entityId: id,
        after: { action: request.action, reason },
      });
      return { id, status: 'rejected' as const };
    });
  }

  // Creates a pending request inside the caller's tx; an identical pending request is reused.
  async request(
    tx: Tx,
    actor: Actor & { userId: string },
    action: ApprovalAction,
    payload: Record<string, unknown>,
  ): Promise<{ id: string; created: boolean }> {
    const [existing] = await tx
      .select({ id: approvalRequest.id })
      .from(approvalRequest)
      .where(
        and(
          eq(approvalRequest.schoolId, actor.schoolId),
          eq(approvalRequest.action, action),
          eq(approvalRequest.status, 'pending'),
          sql`${approvalRequest.payload} = ${JSON.stringify(payload)}::jsonb`,
        ),
      )
      .limit(1);
    if (existing) return { id: existing.id, created: false };
    const [row] = await tx
      .insert(approvalRequest)
      .values({
        schoolId: actor.schoolId,
        action,
        requestedBy: actor.userId,
        payload,
      })
      .returning({ id: approvalRequest.id });
    await this.audit.record(tx, actor, {
      action: 'approval.request',
      entity: 'approval_request',
      entityId: row.id,
      after: { action, payload },
    });
    return { id: row.id, created: true };
  }

  async list(
    schoolId: string,
    q: ApprovalListQuery,
  ): Promise<Page<ApprovalItem>> {
    const where = and(
      eq(approvalRequest.schoolId, schoolId),
      isNull(approvalRequest.deletedAt),
      q.status ? eq(approvalRequest.status, q.status) : undefined,
    );
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(approvalRequest)
        .where(where)
        .orderBy(desc(approvalRequest.createdAt))
        .limit(q.size)
        .offset((q.page - 1) * q.size),
      this.db.select({ total: count() }).from(approvalRequest).where(where),
    ]);
    const names = await this.access.displayNames([
      ...new Set(
        rows.flatMap((r) => [
          r.requestedBy,
          ...(r.decidedBy ? [r.decidedBy] : []),
        ]),
      ),
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      action: r.action,
      status: r.status,
      payload: r.payload,
      requestedBy: r.requestedBy,
      requestedByName: names.get(r.requestedBy) ?? '',
      createdAt: r.createdAt.toISOString(),
      decidedByName: r.decidedBy ? (names.get(r.decidedBy) ?? '') : null,
      decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
      reason: r.reason,
    }));
    return { items, total };
  }
}
