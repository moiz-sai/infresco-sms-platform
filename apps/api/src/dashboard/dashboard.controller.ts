import { Controller, Get } from '@nestjs/common';
import type { Actor } from '../common/actor';
import { CurrentActor, RequirePermission } from '../common/decorators';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @RequirePermission('dashboard.view')
  get(@CurrentActor() actor: Actor) {
    return this.dashboard.get(actor.schoolId);
  }
}
