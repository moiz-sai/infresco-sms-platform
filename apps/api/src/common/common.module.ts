import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CounterService } from './counter.service';
import { HlcService } from './hlc.service';
import { SchoolContextService } from './school-context.service';

@Global()
@Module({
  providers: [AuditService, CounterService, HlcService, SchoolContextService],
  exports: [AuditService, CounterService, HlcService, SchoolContextService],
})
export class CommonModule {}
