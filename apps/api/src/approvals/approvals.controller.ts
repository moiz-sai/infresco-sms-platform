import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  approvalListQuerySchema,
  rejectSchema,
  type ApprovalListQuery,
} from '@sms/shared';
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

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission('approvals.decide')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: Actor & { userId: string },
  ) {
    return this.approvals.approve(actor, id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermission('approvals.decide')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(rejectSchema)) body: { reason: string },
    @CurrentActor() actor: Actor & { userId: string },
  ) {
    return this.approvals.reject(actor, id, body.reason);
  }
}
