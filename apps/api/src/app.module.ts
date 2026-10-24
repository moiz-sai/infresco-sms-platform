import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env';
import { DatabaseModule } from './db/database.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { ApprovalsModule } from './approvals/approvals.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.SMS_ENV_FILE ?? '.env',
      validate: validateEnv,
    }),
    DatabaseModule,
    CommonModule,
    AuthModule,
    ApprovalsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
