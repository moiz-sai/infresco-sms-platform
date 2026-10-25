import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import {
  promoteCandidatesQuerySchema,
  promoteSchema,
  type PromoteInput,
} from '@sms/shared';
import type { Actor } from '../common/actor';
import { CurrentActor, RequirePermission } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { PromotionService } from './promotion.service';

@Controller('enrollments')
export class PromotionController {
  constructor(private readonly promotion: PromotionService) {}

  @Get('promote/candidates')
  @RequirePermission('students.edit')
  candidates(
    @Query(new ZodPipe(promoteCandidatesQuerySchema)) q: { sectionId: string },
    @CurrentActor() actor: Actor,
  ) {
    return this.promotion.candidates(actor.schoolId, q.sectionId);
  }

  @Post('promote')
  @HttpCode(200)
  @RequirePermission('students.edit')
  promote(
    @Body(new ZodPipe(promoteSchema)) body: PromoteInput,
    @CurrentActor() actor: Actor & { userId: string },
  ) {
    return this.promotion.promote(actor, body);
  }
}
