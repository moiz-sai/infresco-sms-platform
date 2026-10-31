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
export const IS_DEVELOPER = 'sms:developer';
export const IS_LICENSE_EXEMPT = 'sms:license-exempt';

export interface PermissionRequirement {
  code: string;
  // Route param holding a section id; lets section-scoped roles pass for that section.
  sectionParam?: string;
}

export const Public = () => SetMetadata(IS_PUBLIC, true);

// Reachable only with a valid developer session (Ed25519 unlock); no school user needed.
// Developer routes are always license-exempt so the license can be fixed while locked.
export const DeveloperOnly = () => SetMetadata(IS_DEVELOPER, true);

// Works even when the license is expired (health, branding, unlock).
export const LicenseExempt = () => SetMetadata(IS_LICENSE_EXEMPT, true);

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
