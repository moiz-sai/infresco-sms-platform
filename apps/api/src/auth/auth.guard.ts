import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import '../common/actor';
import {
  IS_AUTHENTICATED,
  IS_DEVELOPER,
  IS_LICENSE_EXEMPT,
  IS_PUBLIC,
  PERMISSION,
  type PermissionRequirement,
} from '../common/decorators';
import { SchoolContextService } from '../common/school-context.service';
import { LicenseService } from '../developer/license.service';
import { AccessService } from './access.service';
import { endSession } from './session.util';

// Global guard: endpoints without @Public/@Authenticated/@RequirePermission are denied.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
    private readonly school: SchoolContextService,
    private readonly license: LicenseService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const req = ctx.switchToHttp().getRequest<Request>();
    const isDeveloper = this.reflector.getAllAndOverride<boolean>(
      IS_DEVELOPER,
      targets,
    );
    const licenseExempt =
      isDeveloper ||
      this.reflector.getAllAndOverride<boolean>(IS_LICENSE_EXEMPT, targets);

    // Hard lock (§T13): an expired/invalid license stops everything but the exempt routes,
    // including login, so the school cannot use the system until a new license is entered.
    if (!licenseExempt && (await this.license.locked())) {
      throw new HttpException(
        {
          code: 'LICENSE_LOCKED',
          message: 'License expired — contact Infresco',
        },
        423,
      );
    }

    // Developer profile: a signed unlock, not a school login.
    if (isDeveloper) {
      const until = req.session?.devUntil;
      if (!until || until < Date.now()) {
        throw new UnauthorizedException({
          code: 'DEV_LOCKED',
          message: 'Developer unlock required',
        });
      }
      const { schoolId, deviceId } = await this.school.get().catch(() => ({
        schoolId: '',
        deviceId: null,
      }));
      req.actor = { schoolId, userId: null, deviceId, canApprove: false };
      return true;
    }

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) {
      return true;
    }
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
    req.actor = {
      schoolId: access.user.schoolId,
      userId,
      deviceId,
      canApprove: access.can('approvals.decide'),
    };

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
