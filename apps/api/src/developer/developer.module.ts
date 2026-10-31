import { Global, Module } from '@nestjs/common';
import {
  BrandingController,
  DeveloperController,
  LicenseController,
} from './developer.controller';
import { DeveloperService } from './developer.service';
import { LicenseService } from './license.service';

// Global so the auth guard and AccessService can use LicenseService without an import cycle.
@Global()
@Module({
  controllers: [BrandingController, DeveloperController, LicenseController],
  providers: [DeveloperService, LicenseService],
  exports: [DeveloperService, LicenseService],
})
export class DeveloperModule {}
