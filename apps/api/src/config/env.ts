import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  PORT: z.coerce.number().int().positive().default(8080),
  SESSION_SECRET: z.string().min(32),
  DEVICE_PREFIX: z
    .string()
    .regex(/^[A-Z0-9]{1,4}$/)
    .default('D1'),
  // Admin DB role for backup/restore/reset (pg_dump/pg_restore). Optional: those features
  // report "not configured" if it is absent. Present in dev .env and the installer's app.env.
  DATABASE_ADMIN_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
  // Folder holding pg_dump/pg_restore; empty means they are on PATH (installer sets it).
  PG_BIN_DIR: z.string().optional(),
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
