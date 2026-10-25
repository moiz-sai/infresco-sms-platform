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
  classSchema,
  schoolUpdateSchema,
  sectionListQuerySchema,
  sectionSchema,
  settingsSchema,
  yearSchema,
  type ClassInput,
  type SchoolUpdate,
  type SectionInput,
  type SectionListQuery,
  type SettingsInput,
  type YearInput,
} from '@sms/shared';
import type { Actor } from '../common/actor';
import {
  Authenticated,
  CurrentActor,
  RequirePermission,
} from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { SetupService } from './setup.service';

const MANAGE = 'settings.manage';
const id = new ParseUUIDPipe();

@Controller('school')
export class SchoolController {
  constructor(private readonly setup: SetupService) {}

  @Get()
  @Authenticated()
  get(@CurrentActor() actor: Actor) {
    return this.setup.getSchool(actor.schoolId);
  }

  @Put()
  @RequirePermission(MANAGE)
  update(
    @Body(new ZodPipe(schoolUpdateSchema)) body: SchoolUpdate,
    @CurrentActor() actor: Actor,
  ) {
    return this.setup.updateSchool(actor, body);
  }
}

@Controller('years')
export class YearsController {
  constructor(private readonly setup: SetupService) {}

  @Get()
  @Authenticated()
  list(@CurrentActor() actor: Actor) {
    return this.setup.listYears(actor.schoolId);
  }

  @Post()
  @RequirePermission(MANAGE)
  create(
    @Body(new ZodPipe(yearSchema)) body: YearInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.setup.saveYear(actor, body);
  }

  @Put(':id')
  @RequirePermission(MANAGE)
  update(
    @Param('id', id) yearId: string,
    @Body(new ZodPipe(yearSchema)) body: YearInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.setup.saveYear(actor, body, yearId);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  remove(@Param('id', id) yearId: string, @CurrentActor() actor: Actor) {
    return this.setup.deleteYear(actor, yearId);
  }
}

@Controller('classes')
export class ClassesController {
  constructor(private readonly setup: SetupService) {}

  @Get()
  @Authenticated()
  list(@CurrentActor() actor: Actor) {
    return this.setup.listClasses(actor.schoolId);
  }

  @Post()
  @RequirePermission(MANAGE)
  create(
    @Body(new ZodPipe(classSchema)) body: ClassInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.setup.saveClass(actor, body);
  }

  @Put(':id')
  @RequirePermission(MANAGE)
  update(
    @Param('id', id) classId: string,
    @Body(new ZodPipe(classSchema)) body: ClassInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.setup.saveClass(actor, body, classId);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  remove(@Param('id', id) classId: string, @CurrentActor() actor: Actor) {
    return this.setup.deleteClass(actor, classId);
  }
}

@Controller('sections')
export class SectionsController {
  constructor(private readonly setup: SetupService) {}

  @Get()
  @Authenticated()
  list(
    @Query(new ZodPipe(sectionListQuerySchema)) q: SectionListQuery,
    @CurrentActor() actor: Actor,
  ) {
    return this.setup.listSections(actor.schoolId, q);
  }

  @Post()
  @RequirePermission(MANAGE)
  create(
    @Body(new ZodPipe(sectionSchema)) body: SectionInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.setup.saveSection(actor, body);
  }

  @Put(':id')
  @RequirePermission(MANAGE)
  update(
    @Param('id', id) sectionId: string,
    @Body(new ZodPipe(sectionSchema)) body: SectionInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.setup.saveSection(actor, body, sectionId);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  remove(@Param('id', id) sectionId: string, @CurrentActor() actor: Actor) {
    return this.setup.deleteSection(actor, sectionId);
  }
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly setup: SetupService) {}

  @Get()
  @RequirePermission(MANAGE)
  get(@CurrentActor() actor: Actor) {
    return this.setup.getSettings(actor.schoolId);
  }

  @Put()
  @RequirePermission(MANAGE)
  update(
    @Body(new ZodPipe(settingsSchema)) body: SettingsInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.setup.updateSettings(actor, body);
  }
}
