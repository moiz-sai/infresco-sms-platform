import '../common/actor';
import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';

export const IS_PUBLIC = 'sms:public';
export const IS_AUTHENTICATED = 'sms:authenticated';
export const PERMISSION = 'sms:permission';

export interface PermissionRequirement {
  code: string;
  // Route param holding a section id; lets section-scoped roles pass for that section.
  sectionParam?: string;
}

export const Public = () => SetMetadata(IS_PUBLIC, true);

// Logged in, no specific permission (e.g. /auth/me, /auth/logout).
export const Authenticated = () => SetMetadata(IS_AUTHENTICATED, true);

export const RequirePermission = (
  code: string,
  opts: Omit<PermissionRequirement, 'code'> = {},
) => SetMetadata(PERMISSION, { code, ...opts } satisfies PermissionRequirement);

export const CurrentActor = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<Request>().actor,
);
