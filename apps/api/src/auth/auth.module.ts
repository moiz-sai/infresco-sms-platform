import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AccessService } from './access.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AccessService],
})
export class AuthModule {}
