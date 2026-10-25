import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CounterService } from './counter.service';
import { DashboardCache } from './dashboard-cache.service';
import { HlcService } from './hlc.service';
import { SchoolContextService } from './school-context.service';

@Global()
@Module({
  providers: [
    AuditService,
    CounterService,
    DashboardCache,
    HlcService,
    SchoolContextService,
  ],
  exports: [
    AuditService,
    CounterService,
    DashboardCache,
    HlcService,
    SchoolContextService,
  ],
})
export class CommonModule {}
