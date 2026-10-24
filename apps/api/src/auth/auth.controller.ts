import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  loginSchema,
  switchUserSchema,
  type LoginInput,
  type SwitchUserInput,
} from '@sms/shared';
import type { Request, Response } from 'express';
import type { Actor } from '../common/actor';
import { Authenticated, CurrentActor, Public } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodPipe(loginSchema)) body: LoginInput, @Req() req: Request) {
    return this.auth.login(body, req);
  }

  @Authenticated()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req);
    res.clearCookie('sms.sid');
  }

  @Authenticated()
  @Get('me')
  me(@CurrentActor() actor: Actor & { userId: string }) {
    return this.auth.me(actor.userId);
  }

  @Authenticated()
  @Post('switch')
  @HttpCode(200)
  switchUser(
    @Body(new ZodPipe(switchUserSchema)) body: SwitchUserInput,
    @Req() req: Request,
  ) {
    return this.auth.switchUser(body, req);
  }
}
