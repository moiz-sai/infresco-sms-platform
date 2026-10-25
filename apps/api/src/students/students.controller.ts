import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  admitSchema,
  leaveSchema,
  guardianSearchSchema,
  studentFieldsSchema,
  studentListQuerySchema,
  type AdmitInput,
  type LeaveInput,
  type StudentFields,
  type StudentListQuery,
} from '@sms/shared';
import type { Actor } from '../common/actor';
import { CurrentActor, RequirePermission } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { StudentsService } from './students.service';

const id = new ParseUUIDPipe();

@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Post('admit')
  @RequirePermission('students.edit')
  admit(
    @Body(new ZodPipe(admitSchema)) body: AdmitInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.students.admit(actor, body);
  }

  @Get()
  @RequirePermission('students.view')
  list(
    @Query(new ZodPipe(studentListQuerySchema)) q: StudentListQuery,
    @CurrentActor() actor: Actor,
  ) {
    return this.students.list(actor.schoolId, q);
  }

  @Get(':id')
  @RequirePermission('students.view')
  get(@Param('id', id) studentId: string, @CurrentActor() actor: Actor) {
    return this.students.get(actor.schoolId, studentId);
  }

  @Put(':id')
  @RequirePermission('students.edit')
  update(
    @Param('id', id) studentId: string,
    @Body(new ZodPipe(studentFieldsSchema)) body: StudentFields,
    @CurrentActor() actor: Actor,
  ) {
    return this.students.update(actor, studentId, body);
  }

  @Post(':id/leave')
  @HttpCode(200)
  @RequirePermission('students.edit')
  leave(
    @Param('id', id) studentId: string,
    @Body(new ZodPipe(leaveSchema)) body: LeaveInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.students.leave(actor, studentId, body);
  }
}

@Controller('guardians')
export class GuardiansController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @RequirePermission('students.view')
  search(
    @Query(new ZodPipe(guardianSearchSchema)) q: { q: string },
    @CurrentActor() actor: Actor,
  ) {
    return this.students.searchGuardians(actor.schoolId, q.q);
  }
}
