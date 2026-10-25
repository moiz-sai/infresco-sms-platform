import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  userCreateSchema,
  userResetSchema,
  userRolesSchema,
  userUpdateSchema,
  type UserCreate,
  type UserReset,
  type UserRolesInput,
  type UserUpdate,
} from '@sms/shared';
import type { Actor } from '../common/actor';
import { CurrentActor, RequirePermission } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { UsersService } from './users.service';

const MANAGE = 'users.manage';
const id = new ParseUUIDPipe();
type UserActor = Actor & { userId: string };

@Controller('roles')
export class RolesController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission(MANAGE)
  list(@CurrentActor() actor: Actor) {
    return this.users.listRoles(actor.schoolId);
  }
}

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission(MANAGE)
  list(@CurrentActor() actor: Actor) {
    return this.users.list(actor.schoolId);
  }

  @Post()
  @RequirePermission(MANAGE)
  create(
    @Body(new ZodPipe(userCreateSchema)) body: UserCreate,
    @CurrentActor() actor: UserActor,
  ) {
    return this.users.create(actor, body);
  }

  @Put(':id')
  @RequirePermission(MANAGE)
  update(
    @Param('id', id) userId: string,
    @Body(new ZodPipe(userUpdateSchema)) body: UserUpdate,
    @CurrentActor() actor: UserActor,
  ) {
    return this.users.update(actor, userId, body);
  }

  @Put(':id/roles')
  @RequirePermission(MANAGE)
  roles(
    @Param('id', id) userId: string,
    @Body(new ZodPipe(userRolesSchema)) body: UserRolesInput,
    @CurrentActor() actor: UserActor,
  ) {
    return this.users.setRoles(actor, userId, body.roleIds);
  }

  @Post(':id/reset')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  reset(
    @Param('id', id) userId: string,
    @Body(new ZodPipe(userResetSchema)) body: UserReset,
    @CurrentActor() actor: UserActor,
  ) {
    return this.users.reset(actor, userId, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  remove(@Param('id', id) userId: string, @CurrentActor() actor: UserActor) {
    return this.users.remove(actor, userId);
  }
}
