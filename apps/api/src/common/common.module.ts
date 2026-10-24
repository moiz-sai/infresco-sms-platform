import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { SchoolContextService } from './school-context.service';

@Global()
@Module({
  providers: [AuditService, SchoolContextService],
  exports: [AuditService, SchoolContextService],
})
export class CommonModule {}
