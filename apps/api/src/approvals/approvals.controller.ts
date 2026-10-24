import { Controller, Get, Query } from '@nestjs/common';
import { approvalListQuerySchema, type ApprovalListQuery } from '@sms/shared';
import type { Actor } from '../common/actor';
import { CurrentActor, RequirePermission } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { ApprovalsService } from './approvals.service';

@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  @RequirePermission('approvals.decide')
  list(
    @Query(new ZodPipe(approvalListQuerySchema)) q: ApprovalListQuery,
    @CurrentActor() actor: Actor,
  ) {
    return this.approvals.list(actor.schoolId, q);
  }
}
