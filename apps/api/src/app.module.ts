import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
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
import { PromotionModule } from './promotion/promotion.module';
import { AuditModule } from './audit/audit.module';
import { DashboardModule } from './dashboard/dashboard.module';

// Production: the API also serves the built web app (SPA fallback to index.html; /api excluded).
// Same relative path from src/ (dev, tests) and dist/ (built).
const WEB_DIST = join(__dirname, '..', '..', 'web', 'dist');
const webApp = existsSync(join(WEB_DIST, 'index.html'))
  ? [
      ServeStaticModule.forRoot({
        rootPath: WEB_DIST,
        exclude: ['/api/{*path}'],
      }),
    ]
  : [];

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
    PromotionModule,
    AuditModule,
    DashboardModule,
    ...webApp,
  ],
  controllers: [HealthController],
})
export class AppModule {}
