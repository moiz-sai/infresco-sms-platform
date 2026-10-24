import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import '../common/actor';
import {
  IS_AUTHENTICATED,
  IS_PUBLIC,
  PERMISSION,
  type PermissionRequirement,
} from '../common/decorators';
import { SchoolContextService } from '../common/school-context.service';
import { AccessService } from './access.service';
import { endSession } from './session.util';

// Global guard: endpoints without @Public/@Authenticated/@RequirePermission are denied.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
    private readonly school: SchoolContextService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) {
      return true;
    }
    const req = ctx.switchToHttp().getRequest<Request>();
    const userId = req.session?.userId;
    if (!userId) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Login required',
      });
    }
    const access = await this.access.load(userId);
    if (!access) {
      await endSession(req);
      throw new UnauthorizedException({
        code: 'SESSION_ENDED',
        message: 'Account is disabled or removed',
      });
    }
    const { deviceId } = await this.school.get();
    req.actor = { schoolId: access.user.schoolId, userId, deviceId };

    const requirement = this.reflector.getAllAndOverride<
      PermissionRequirement | undefined
    >(PERMISSION, targets);
    if (requirement) {
      const param = requirement.sectionParam
        ? req.params[requirement.sectionParam]
        : undefined;
      const sectionId = typeof param === 'string' ? param : undefined;
      if (access.can(requirement.code, sectionId)) return true;
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Missing permission ${requirement.code}`,
      });
    }
    if (this.reflector.getAllAndOverride<boolean>(IS_AUTHENTICATED, targets)) {
      return true;
    }
    throw new ForbiddenException({
      code: 'NO_PERMISSION_DECLARED',
      message: 'Endpoint declares no permission',
    });
  }
}
