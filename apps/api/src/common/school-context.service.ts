import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNull } from 'drizzle-orm';
import { Env } from '../config/env';
import { DB, type Db } from '../db/database.module';
import { device, school } from '../db/schema';

export interface SchoolContext {
  schoolId: string;
  deviceId: string | null;
}

// This server's school and device, identified by DEVICE_PREFIX.
@Injectable()
export class SchoolContextService {
  private cached?: SchoolContext;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async get(): Promise<SchoolContext> {
    if (this.cached) return this.cached;
    const prefix = this.config.get('DEVICE_PREFIX', { infer: true });
    const [row] = await this.db
      .select({ schoolId: school.id, deviceId: device.id })
      .from(school)
      .leftJoin(
        device,
        and(eq(device.schoolId, school.id), eq(device.prefix, prefix)),
      )
      .where(and(eq(school.devicePrefix, prefix), isNull(school.deletedAt)))
      .limit(1);
    if (!row) {
      throw new ServiceUnavailableException({
        code: 'SCHOOL_NOT_CONFIGURED',
        message: `No school with device prefix ${prefix}; run the seed`,
      });
    }
    this.cached = row;
    return row;
  }
}
