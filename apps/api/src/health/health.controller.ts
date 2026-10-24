import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Public } from '../common/decorators';
import { DB, type Db } from '../db/database.module';

@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Public()
  @Get()
  async check() {
    try {
      await this.db.execute(sql`select 1`);
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException({
        code: 'DB_UNAVAILABLE',
        message: 'Database is not reachable',
      });
    }
  }
}
