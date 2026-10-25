import { Inject, Injectable } from '@nestjs/common';
import type { AuditQuery } from '@sms/shared';
import { and, count, desc, eq, gte, lt, type SQL } from 'drizzle-orm';
import { DB, type Db } from '../db/database.module';
import { auditLog } from '../db/schema';
import type { Tx } from '../db/tx';
import type { Actor } from './actor';

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

const nextDay = (date: string) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d;
};

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  // Newest first; from/to are local dates, both inclusive.
  async search(schoolId: string, q: AuditQuery) {
    const filters: (SQL | undefined)[] = [
      eq(auditLog.schoolId, schoolId),
      q.userId ? eq(auditLog.userId, q.userId) : undefined,
      q.entity ? eq(auditLog.entity, q.entity) : undefined,
      q.from
        ? gte(auditLog.createdAt, new Date(`${q.from}T00:00:00`))
        : undefined,
      q.to ? lt(auditLog.createdAt, nextDay(q.to)) : undefined,
    ];
    const where = and(...filters);
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(auditLog)
        .where(where)
        .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
        .limit(q.size)
        .offset((q.page - 1) * q.size),
      this.db.select({ total: count() }).from(auditLog).where(where),
    ]);
    return { rows, total };
  }

  // Always call inside the same transaction as the change it describes.
  async record(tx: Tx, actor: Actor, entry: AuditEntry): Promise<void> {
    await tx.insert(auditLog).values({
      schoolId: actor.schoolId,
      userId: actor.userId,
      deviceId: actor.deviceId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
    });
  }
}
