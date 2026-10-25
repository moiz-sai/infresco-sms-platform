import { Module } from '@nestjs/common';
import {
  ClassesController,
  SchoolController,
  SectionsController,
  YearsController,
} from './setup.controller';
import { SetupService } from './setup.service';

@Module({
  controllers: [
    SchoolController,
    YearsController,
    ClassesController,
    SectionsController,
  ],
  providers: [SetupService],
  exports: [SetupService],
})
export class SetupModule {}
