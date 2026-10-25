import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { promoteSchema, type PromoteInput } from '@sms/shared';
import type { Actor } from '../common/actor';
import { CurrentActor, RequirePermission } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { PromotionService } from './promotion.service';

@Controller('enrollments')
export class PromotionController {
  constructor(private readonly promotion: PromotionService) {}

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
