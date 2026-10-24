import { z } from 'zod';
import { envSchema } from '../config/env';

const scriptEnvSchema = envSchema.extend({
  DATABASE_ADMIN_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export function loadScriptEnv() {
  process.loadEnvFile(process.env.SMS_ENV_FILE ?? '.env');
  return scriptEnvSchema.parse(process.env);
}
