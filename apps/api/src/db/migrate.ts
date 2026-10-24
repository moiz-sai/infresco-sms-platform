import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { loadScriptEnv } from './script-env';

async function main() {
  const env = loadScriptEnv();
  const appUrl = new URL(env.DATABASE_URL);
  if (appUrl.username !== 'sms_app') {
    throw new Error('DATABASE_URL must connect as sms_app');
  }
  const pool = new Pool({ connectionString: env.DATABASE_ADMIN_URL, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: 'drizzle' });
    // Keep the role's password in sync with DATABASE_URL (needed where pg_hba uses scram, e.g. Windows).
    if (appUrl.password) {
      const client = await pool.connect();
      try {
        const pw = client.escapeLiteral(decodeURIComponent(appUrl.password));
        await client.query(`ALTER ROLE sms_app PASSWORD ${pw}`);
      } finally {
        client.release();
      }
    }
    console.log('migrations applied');
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
