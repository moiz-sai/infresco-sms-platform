import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  attendanceDateSchema,
  attendanceMonthSchema,
  attendanceSaveSchema,
  type AttendanceEntry,
} from '@sms/shared';
import type { Actor } from '../common/actor';
import { CurrentActor, RequirePermission } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { AttendanceService } from './attendance.service';

const section = { sectionParam: 'id' };

@Controller('attendance/sections/:id')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('days/:date')
  @RequirePermission('attendance.view', section)
  day(
    @Param('id', ParseUUIDPipe) sectionId: string,
    @Param('date', new ZodPipe(attendanceDateSchema)) date: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.attendance.day(actor, sectionId, date);
  }

  @Post('days/:date')
  @HttpCode(200)
  @RequirePermission('attendance.mark', section)
  save(
    @Param('id', ParseUUIDPipe) sectionId: string,
    @Param('date', new ZodPipe(attendanceDateSchema)) date: string,
    @Body(new ZodPipe(attendanceSaveSchema)) body: AttendanceEntry[],
    @CurrentActor() actor: Actor & { userId: string },
  ) {
    return this.attendance.save(actor, sectionId, date, body);
  }

  @Get('months/:month')
  @RequirePermission('attendance.view', section)
  month(
    @Param('id', ParseUUIDPipe) sectionId: string,
    @Param('month', new ZodPipe(attendanceMonthSchema)) month: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.attendance.month(actor, sectionId, month);
  }
}
