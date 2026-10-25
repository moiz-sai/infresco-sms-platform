import { Controller, Get, Query } from '@nestjs/common';
import {
  auditQuerySchema,
  type AuditItem,
  type AuditQuery,
  type Page,
} from '@sms/shared';
import { AccessService } from '../auth/access.service';
import type { Actor } from '../common/actor';
import { AuditService } from '../common/audit.service';
import { CurrentActor, RequirePermission } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { auditSummary } from './audit.summary';

@Controller('audit')
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly access: AccessService,
  ) {}

  @Get()
  @RequirePermission('audit.view')
  async search(
    @Query(new ZodPipe(auditQuerySchema)) q: AuditQuery,
    @CurrentActor() actor: Actor,
  ): Promise<Page<AuditItem>> {
    const { rows, total } = await this.audit.search(actor.schoolId, q);
    const names = await this.access.displayNames([
      ...new Set(rows.flatMap((r) => (r.userId ? [r.userId] : []))),
    ]);
    return {
      total,
      items: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        userId: r.userId,
        userName: r.userId ? (names.get(r.userId) ?? null) : null,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        summary: auditSummary(r.action, r.entity, r.before, r.after),
        before: r.before,
        after: r.after,
      })),
    };
  }
}
