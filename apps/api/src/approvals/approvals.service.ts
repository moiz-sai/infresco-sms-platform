import { Inject, Injectable } from '@nestjs/common';
import type { ApprovalListQuery, Page } from '@sms/shared';
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Actor } from '../common/actor';
import { AuditService } from '../common/audit.service';
import { DB, type Db } from '../db/database.module';
import { approvalRequest } from '../db/schema';
import type { Tx } from '../db/tx';

export type ApprovalRow = typeof approvalRequest.$inferSelect;
export type ApprovalAction = ApprovalRow['action'];

@Injectable()
export class ApprovalsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

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
  ): Promise<Page<ApprovalRow>> {
    const where = and(
      eq(approvalRequest.schoolId, schoolId),
      isNull(approvalRequest.deletedAt),
      q.status ? eq(approvalRequest.status, q.status) : undefined,
    );
    const [items, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(approvalRequest)
        .where(where)
        .orderBy(desc(approvalRequest.createdAt))
        .limit(q.size)
        .offset((q.page - 1) * q.size),
      this.db.select({ total: count() }).from(approvalRequest).where(where),
    ]);
    return { items, total };
  }
}
