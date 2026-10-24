import { Injectable } from '@nestjs/common';
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

@Injectable()
export class AuditService {
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
