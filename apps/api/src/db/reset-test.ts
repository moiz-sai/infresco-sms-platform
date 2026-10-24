import { Client } from 'pg';
import { loadScriptEnv } from './script-env';

async function main() {
  const env = loadScriptEnv();
  const dbName = new URL(env.DATABASE_ADMIN_URL).pathname.slice(1);
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to reset "${dbName}": only *_test databases`);
  }
  const client = new Client({ connectionString: env.DATABASE_ADMIN_URL });
  await client.connect();
  try {
    await client.query(
      'DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;',
    );
    console.log(`reset ${dbName}`);
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
