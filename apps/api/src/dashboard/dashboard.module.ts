import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { FeesModule } from '../fees/fees.module';
import { SetupModule } from '../setup/setup.module';
import { StudentsModule } from '../students/students.module';
import { DashboardController } from './dashboard.controller';
import { DashboardInvalidator } from './dashboard.invalidator';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    SetupModule,
    StudentsModule,
    FeesModule,
    AttendanceModule,
    ApprovalsModule,
  ],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    { provide: APP_INTERCEPTOR, useClass: DashboardInvalidator },
  ],
})
export class DashboardModule {}
