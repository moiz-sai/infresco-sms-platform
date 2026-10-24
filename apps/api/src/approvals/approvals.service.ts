import { Inject, Injectable } from '@nestjs/common';
import type { ApprovalListQuery, Page } from '@sms/shared';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { DB, type Db } from '../db/database.module';
import { approvalRequest } from '../db/schema';

export type ApprovalRow = typeof approvalRequest.$inferSelect;

@Injectable()
export class ApprovalsService {
  constructor(@Inject(DB) private readonly db: Db) {}

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
