import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import {
  brandingSchema,
  licenseSchema,
  logoSchema,
  unlockSchema,
  type BrandingInput,
  type LicenseInput,
  type LogoInput,
  type UnlockInput,
} from '@sms/shared';
import type { Request, Response } from 'express';
import {
  Authenticated,
  DeveloperOnly,
  LicenseExempt,
  Public,
} from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { DeveloperService } from './developer.service';
import { LicenseService } from './license.service';

const ip = (req: Request) => req.ip ?? undefined;

// Logged-in users read this for the expiry banner; no install id or module list leaks.
@Controller('license')
export class LicenseController {
  constructor(private readonly license: LicenseService) {}

  @Authenticated()
  @Get()
  async get() {
    const { state, daysLeft, expires } = await this.license.status();
    return { state, daysLeft, expires };
  }
}

// Public branding: login page, sidebar and every print read it even when the license is locked.
@Controller('branding')
export class BrandingController {
  constructor(private readonly dev: DeveloperService) {}

  @Public()
  @LicenseExempt()
  @Get()
  get() {
    return this.dev.getBranding();
  }

  @Public()
  @LicenseExempt()
  @Get('logo')
  async logo(@Res() res: Response) {
    const logo = await this.dev.getLogo();
    if (!logo) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'No logo' });
      return;
    }
    res.setHeader('Content-Type', logo.type);
    res.setHeader('Cache-Control', 'no-cache');
    res.send(logo.data);
  }
}

// The developer profile. Hidden from the school: no user account, no sidebar link.
@Controller('_dev')
export class DeveloperController {
  constructor(
    private readonly dev: DeveloperService,
    private readonly license: LicenseService,
  ) {}

  @Public()
  @LicenseExempt()
  @Post('challenge')
  @HttpCode(200)
  challenge(@Req() req: Request) {
    return this.dev.challenge(ip(req));
  }

  @Public()
  @LicenseExempt()
  @Post('unlock')
  @HttpCode(200)
  unlock(
    @Body(new ZodPipe(unlockSchema)) body: UnlockInput,
    @Req() req: Request,
  ) {
    const until = this.dev.unlock(body.code, body.signature, ip(req));
    req.session.devUntil = until;
    return { until };
  }

  @DeveloperOnly()
  @Post('lock')
  @HttpCode(204)
  lock(@Req() req: Request) {
    delete req.session.devUntil;
  }

  @DeveloperOnly()
  @Get('status')
  status() {
    return this.dev.status();
  }

  @DeveloperOnly()
  @Put('branding')
  @HttpCode(204)
  async setBranding(
    @Body(new ZodPipe(brandingSchema)) body: BrandingInput,
    @Req() req: Request,
  ) {
    await this.dev.setBranding(body, ip(req));
  }

  @DeveloperOnly()
  @Put('logo')
  @HttpCode(204)
  async setLogo(
    @Body(new ZodPipe(logoSchema)) body: LogoInput,
    @Req() req: Request,
  ) {
    await this.dev.setLogo(body, ip(req));
  }

  @DeveloperOnly()
  @Delete('logo')
  @HttpCode(204)
  async clearLogo(@Req() req: Request) {
    await this.dev.clearLogo(ip(req));
  }

  @DeveloperOnly()
  @Put('license')
  @HttpCode(204)
  async setLicense(
    @Body(new ZodPipe(licenseSchema)) body: LicenseInput,
    @Req() req: Request,
  ) {
    await this.dev.setLicense(body, ip(req));
  }
}
