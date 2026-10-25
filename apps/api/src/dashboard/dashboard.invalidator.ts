import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { tap } from 'rxjs';
import { DashboardCache } from '../common/dashboard-cache.service';

// Any successful write (payment, attendance save, approval, cash close, admission…) clears the
// dashboard cache. Runs after the handler resolved, so the write's transaction has committed.
@Injectable()
export class DashboardInvalidator implements NestInterceptor {
  constructor(private readonly cache: DashboardCache) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const { method } = ctx.switchToHttp().getRequest<Request>();
    if (method === 'GET' || method === 'HEAD') return next.handle();
    return next.handle().pipe(tap(() => this.cache.invalidate()));
  }
}
