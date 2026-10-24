import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  423: 'LOCKED',
  429: 'TOO_MANY_REQUESTS',
};

// Every error leaves the API as { code, message } (SPEC §3).
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (!(exception instanceof HttpException)) {
      this.logger.error(exception);
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ code: 'INTERNAL', message: 'Internal server error' });
      return;
    }
    const status = exception.getStatus();
    const body = exception.getResponse();
    const obj =
      typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const raw = typeof body === 'string' ? body : obj.message;
    const message = Array.isArray(raw)
      ? raw.join('; ')
      : typeof raw === 'string'
        ? raw
        : exception.message;
    res.status(status).json({
      code:
        typeof obj.code === 'string'
          ? obj.code
          : (DEFAULT_CODES[status] ?? `HTTP_${status}`),
      message,
    });
  }
}
