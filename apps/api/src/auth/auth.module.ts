import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AccessService } from './access.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { RolesService } from './roles.service';
import { RolesController, UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [AuthController, UsersController, RolesController],
  providers: [
    AuthService,
    UsersService,
    RolesService,
    AccessService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AccessService],
})
export class AuthModule {}
