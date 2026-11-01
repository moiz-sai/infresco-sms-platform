import { Global, Module } from '@nestjs/common';
import {
  BackupHealthController,
  BrandingController,
  DeveloperController,
  LicenseController,
} from './developer.controller';
import { DeveloperService } from './developer.service';
import { BackupService } from './backup.service';
import { LicenseService } from './license.service';

// Global so the auth guard and AccessService can use LicenseService without an import cycle.
@Global()
@Module({
  controllers: [
    BrandingController,
    DeveloperController,
    LicenseController,
    BackupHealthController,
  ],
  providers: [DeveloperService, LicenseService, BackupService],
  exports: [DeveloperService, LicenseService, BackupService],
})
export class DeveloperModule {}
