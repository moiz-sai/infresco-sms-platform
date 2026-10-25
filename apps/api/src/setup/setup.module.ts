import { Module } from '@nestjs/common';
import {
  ClassesController,
  SchoolController,
  SectionsController,
  SettingsController,
  YearsController,
} from './setup.controller';
import { SetupService } from './setup.service';

@Module({
  controllers: [
    SchoolController,
    YearsController,
    ClassesController,
    SectionsController,
    SettingsController,
  ],
  providers: [SetupService],
  exports: [SetupService],
})
export class SetupModule {}
