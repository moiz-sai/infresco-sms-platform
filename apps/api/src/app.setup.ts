import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import type { Pool } from 'pg';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { Env } from './config/env';
import { PG_POOL } from './db/database.module';

const SESSION_MS = 12 * 60 * 60 * 1000;

// Shared by main.ts and e2e tests so both run the same app configuration.
export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService<Env, true>);
  const PgStore = connectPgSimple(session);
  app.use(
    session({
      name: 'sms.sid',
      secret: config.get('SESSION_SECRET', { infer: true }),
      resave: false,
      saveUninitialized: false,
      store: new PgStore({
        pool: app.get<Pool>(PG_POOL),
        tableName: 'session',
        createTableIfMissing: false,
        // The prune timer would keep Jest from exiting.
        pruneSessionInterval: process.env.NODE_ENV === 'test' ? false : 15 * 60,
      }),
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: SESSION_MS,
      },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
}
