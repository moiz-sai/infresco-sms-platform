import {
  Global,
  Inject,
  Injectable,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { Env } from '../config/env';
import * as schema from './schema';

export const PG_POOL = Symbol('PG_POOL');
export const DB = Symbol('DB');
export type Db = NodePgDatabase<typeof schema>;

@Injectable()
class PoolCloser implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}
  onApplicationShutdown() {
    return this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const pool = new Pool({
          connectionString: config.get('DATABASE_URL', { infer: true }),
          max: 10,
        });
        // A restore terminates backends (§T14); an idle client erroring must not crash the
        // process. pg drops the client from the pool and reconnects on the next query.
        pool.on('error', () => undefined);
        return pool;
      },
    },
    {
      provide: DB,
      inject: [PG_POOL],
      useFactory: (pool: Pool): Db =>
        drizzle({ client: pool, schema, casing: 'snake_case' }),
    },
    PoolCloser,
  ],
  exports: [DB, PG_POOL],
})
export class DatabaseModule {}
