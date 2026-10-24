import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  PORT: z.coerce.number().int().positive().default(8080),
  SESSION_SECRET: z.string().min(32),
  DEVICE_PREFIX: z
    .string()
    .regex(/^[A-Z0-9]{1,4}$/)
    .default('D1'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  - ${i.path.join('.')}: ${i.message}`,
    );
    // Exit directly: ConfigModule validates at import time, before Nest's logger exists.
    console.error(`Invalid environment (apps/api/.env):\n${lines.join('\n')}`);
    process.exit(1);
  }
  return result.data;
}
