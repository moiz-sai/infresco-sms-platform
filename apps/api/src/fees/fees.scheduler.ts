import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SchoolContextService } from '../common/school-context.service';
import { currentPeriod, FeesService } from './fees.service';

// SPEC §T6: post the current period's charges on boot and daily at 07:00.
@Injectable()
export class FeesScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger('FeesScheduler');

  constructor(
    private readonly fees: FeesService,
    private readonly school: SchoolContextService,
  ) {}

  onApplicationBootstrap() {
    // Tests post charges for explicit periods; a boot run would make their numbers depend on the date.
    if (process.env.NODE_ENV === 'test') return;
    void this.run('boot');
  }

  @Cron('0 7 * * *')
  daily() {
    return this.run('daily');
  }

  private async run(reason: string) {
    try {
      const { schoolId, deviceId } = await this.school.get();
      const result = await this.fees.postCharges(
        { schoolId, deviceId, userId: null },
        currentPeriod(),
      );
      this.logger.log(
        `${reason}: posted ${result.inserted} charges for ${result.period}`,
      );
    } catch (err) {
      this.logger.warn(`${reason}: charge posting skipped — ${String(err)}`);
    }
  }
}
