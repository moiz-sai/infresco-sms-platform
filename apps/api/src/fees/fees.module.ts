import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AuthModule } from '../auth/auth.module';
import { SetupModule } from '../setup/setup.module';
import { StudentsModule } from '../students/students.module';
import {
  FeeHeadsController,
  FeePlansController,
  FeesController,
  FeeStructuresController,
} from './fees.controller';
import { FeesScheduler } from './fees.scheduler';
import { FeesService } from './fees.service';

@Module({
  imports: [AuthModule, ApprovalsModule, SetupModule, StudentsModule],
  controllers: [
    FeeHeadsController,
    FeeStructuresController,
    FeePlansController,
    FeesController,
  ],
  providers: [FeesService, FeesScheduler],
  exports: [FeesService],
})
export class FeesModule {}
