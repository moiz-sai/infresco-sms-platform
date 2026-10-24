import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// process.loadEnvFile writes to the real process.env, not Jest's sandboxed copy.
process.env.SMS_ENV_FILE ??= '.env.test';
Object.assign(
  process.env,
  parseEnv(readFileSync(process.env.SMS_ENV_FILE, 'utf8')),
);
