import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  attendanceDateSchema,
  cashCloseSchema,
  defaulterQuerySchema,
  discountSchema,
  feeHeadSchema,
  feePlanQuerySchema,
  feePlanSchema,
  feeStructureQuerySchema,
  feeStructureSchema,
  paymentSchema,
  postChargesSchema,
  reverseSchema,
  type DefaulterQuery,
  type DiscountInput,
  type FeeHeadInput,
  type FeePlanInput,
  type FeeStructureInput,
  type PaymentInput,
} from '@sms/shared';
import type { Actor } from '../common/actor';
import { CurrentActor, RequirePermission } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { FeesService } from './fees.service';

const id = new ParseUUIDPipe();
const VIEW = 'fees.collect';
const CONFIGURE = 'fees.configure';

@Controller('fee-heads')
export class FeeHeadsController {
  constructor(private readonly fees: FeesService) {}

  @Get()
  @RequirePermission(VIEW)
  list(@CurrentActor() actor: Actor) {
    return this.fees.listHeads(actor.schoolId);
  }

  @Post()
  @RequirePermission(CONFIGURE)
  create(
    @Body(new ZodPipe(feeHeadSchema)) body: FeeHeadInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.fees.saveHead(actor, body);
  }

  @Put(':id')
  @RequirePermission(CONFIGURE)
  update(
    @Param('id', id) headId: string,
    @Body(new ZodPipe(feeHeadSchema)) body: FeeHeadInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.fees.saveHead(actor, body, headId);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(CONFIGURE)
  remove(@Param('id', id) headId: string, @CurrentActor() actor: Actor) {
    return this.fees.deleteHead(actor, headId);
  }
}

@Controller('fee-structures')
export class FeeStructuresController {
  constructor(private readonly fees: FeesService) {}

  @Get()
  @RequirePermission(VIEW)
  list(
    @Query(new ZodPipe(feeStructureQuerySchema)) q: { yearId?: string },
    @CurrentActor() actor: Actor,
  ) {
    return this.fees.listStructures(actor.schoolId, q.yearId);
  }

  @Post()
  @RequirePermission(CONFIGURE)
  save(
    @Body(new ZodPipe(feeStructureSchema)) body: FeeStructureInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.fees.saveStructure(actor, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(CONFIGURE)
  remove(@Param('id', id) structureId: string, @CurrentActor() actor: Actor) {
    return this.fees.deleteStructure(actor, structureId);
  }
}

@Controller('fee-plans')
export class FeePlansController {
  constructor(private readonly fees: FeesService) {}

  @Get()
  @RequirePermission(VIEW)
  list(
    @Query(new ZodPipe(feePlanQuerySchema)) q: { enrollmentId: string },
    @CurrentActor() actor: Actor,
  ) {
    return this.fees.listPlans(actor.schoolId, q.enrollmentId);
  }

  @Post()
  @RequirePermission(CONFIGURE)
  save(
    @Body(new ZodPipe(feePlanSchema)) body: FeePlanInput,
    @CurrentActor() actor: Actor & { userId: string },
  ) {
    return this.fees.savePlan(actor, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(CONFIGURE)
  remove(@Param('id', id) planId: string, @CurrentActor() actor: Actor) {
    return this.fees.deletePlan(actor, planId);
  }
}

@Controller('fees')
export class FeesController {
  constructor(private readonly fees: FeesService) {}

  @Post('post-charges')
  @HttpCode(200)
  @RequirePermission(CONFIGURE)
  postCharges(
    @Body(new ZodPipe(postChargesSchema)) body: { period: string },
    @CurrentActor() actor: Actor,
  ) {
    return this.fees.postCharges(actor, body.period);
  }

  @Get('students/:enrollmentId/statement')
  @RequirePermission(VIEW)
  statement(
    @Param('enrollmentId', id) enrollmentId: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.fees.statement(actor.schoolId, enrollmentId);
  }

  @Post('payments')
  @RequirePermission(VIEW)
  pay(
    @Body(new ZodPipe(paymentSchema)) body: PaymentInput,
    @CurrentActor() actor: Actor & { userId: string },
  ) {
    return this.fees.pay(actor, body);
  }

  @Get('receipts/:id')
  @RequirePermission(VIEW)
  receipt(@Param('id', id) receiptId: string, @CurrentActor() actor: Actor) {
    return this.fees.receipt(actor.schoolId, receiptId);
  }

  @Post('discounts')
  @RequirePermission('fees.discount')
  discount(
    @Body(new ZodPipe(discountSchema)) body: DiscountInput,
    @CurrentActor() actor: Actor & { userId: string },
  ) {
    return this.fees.discount(actor, body);
  }

  @Post('receipts/:id/reverse')
  @HttpCode(200)
  @RequirePermission('fees.reverse.request')
  reverse(
    @Param('id', id) receiptId: string,
    @Body(new ZodPipe(reverseSchema)) body: { reason: string },
    @CurrentActor() actor: Actor & { userId: string },
  ) {
    return this.fees.reverse(actor, receiptId, body.reason);
  }

  @Get('defaulters')
  @RequirePermission('fees.defaulters')
  defaulters(
    @Query(new ZodPipe(defaulterQuerySchema)) q: DefaulterQuery,
    @CurrentActor() actor: Actor,
  ) {
    return this.fees.defaulters(actor.schoolId, q);
  }

  @Get('cash-close/:date')
  @RequirePermission('fees.cash_close')
  cashClose(
    @Param('date', new ZodPipe(attendanceDateSchema)) date: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.fees.cashCloseView(actor.schoolId, date);
  }

  @Post('cash-close/:date')
  @RequirePermission('fees.cash_close')
  closeCash(
    @Param('date', new ZodPipe(attendanceDateSchema)) date: string,
    @Body(new ZodPipe(cashCloseSchema)) body: { countedTotalPaisa: number },
    @CurrentActor() actor: Actor & { userId: string },
  ) {
    return this.fees.closeCash(actor, date, body.countedTotalPaisa);
  }
}
