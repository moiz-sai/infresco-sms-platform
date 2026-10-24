import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env';
import { DatabaseModule } from './db/database.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.SMS_ENV_FILE ?? '.env',
      validate: validateEnv,
    }),
    DatabaseModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
