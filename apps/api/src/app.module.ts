import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from './config/env';
import { DatabaseModule } from './db/database.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { SetupModule } from './setup/setup.module';
import { StudentsModule } from './students/students.module';
import { AttendanceModule } from './attendance/attendance.module';
import { FeesModule } from './fees/fees.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.SMS_ENV_FILE ?? '.env',
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    CommonModule,
    AuthModule,
    ApprovalsModule,
    SetupModule,
    StudentsModule,
    AttendanceModule,
    FeesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
