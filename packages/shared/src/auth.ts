import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(256),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const switchUserSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(64),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4–6 digits'),
});
export type SwitchUserInput = z.infer<typeof switchUserSchema>;

export interface Me {
  id: string;
  username: string;
  nameEn: string;
  nameUr: string | null;
  schoolId: string;
  roles: string[];
  permissions: string[];
}
