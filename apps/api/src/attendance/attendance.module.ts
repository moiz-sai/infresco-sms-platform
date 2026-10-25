import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { SetupModule } from '../setup/setup.module';
import { StudentsModule } from '../students/students.module';
import {
  AttendanceController,
  AttendanceSummaryController,
} from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [SetupModule, StudentsModule, ApprovalsModule],
  controllers: [AttendanceController, AttendanceSummaryController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
