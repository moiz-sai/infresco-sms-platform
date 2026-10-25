import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CounterService } from './counter.service';
import { SchoolContextService } from './school-context.service';

@Global()
@Module({
  providers: [AuditService, CounterService, SchoolContextService],
  exports: [AuditService, CounterService, SchoolContextService],
})
export class CommonModule {}
