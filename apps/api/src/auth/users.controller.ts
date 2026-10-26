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
  roleCreateSchema,
  roleUpdateSchema,
  userCreateSchema,
  userResetSchema,
  userRolesSchema,
  userUpdateSchema,
  type RoleCreate,
  type RoleUpdate,
  type UserCreate,
  type UserReset,
  type UserRolesInput,
  type UserUpdate,
} from '@sms/shared';
import type { Actor } from '../common/actor';
import { CurrentActor, RequirePermission } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { RolesService } from './roles.service';
import { UsersService } from './users.service';

const MANAGE = 'users.manage';
const ROLES = 'roles.manage';
const id = new ParseUUIDPipe();
type UserActor = Actor & { userId: string };

@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  // Users & roles needs the list to assign roles; editing roles is principal-only.
  @Get()
  @RequirePermission(MANAGE)
  list(@CurrentActor() actor: Actor) {
    return this.roles.list(actor.schoolId);
  }

  @Post()
  @RequirePermission(ROLES)
  create(
    @Body(new ZodPipe(roleCreateSchema)) body: RoleCreate,
    @CurrentActor() actor: Actor,
  ) {
    return this.roles.create(actor, body);
  }

  @Put(':id')
  @RequirePermission(ROLES)
  update(
    @Param('id', id) roleId: string,
    @Body(new ZodPipe(roleUpdateSchema)) body: RoleUpdate,
    @CurrentActor() actor: Actor,
  ) {
    return this.roles.update(actor, roleId, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(ROLES)
  remove(@Param('id', id) roleId: string, @CurrentActor() actor: Actor) {
    return this.roles.remove(actor, roleId);
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
