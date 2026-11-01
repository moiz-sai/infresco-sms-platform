import { z } from 'zod';

// ---------- branding (public read; developer-only write)

export interface Branding {
  nameEn: string;
  nameUr: string | null;
  address: string | null;
  phone: string | null;
  footerEn: string | null;
  footerUr: string | null;
  hasLogo: boolean;
  // cache-buster so a new logo shows without a hard refresh
  logoVersion: string | null;
}

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullish();

export const brandingSchema = z.object({
  nameEn: z.string().trim().min(1, 'Required').max(200),
  nameUr: optText(200),
  address: optText(500),
  phone: optText(50),
  footerEn: optText(300),
  footerUr: optText(300),
});
export type BrandingInput = z.infer<typeof brandingSchema>;

export const LOGO_MAX_BYTES = 300 * 1024;
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export const logoSchema = z.object({
  type: z.enum(LOGO_TYPES),
  // base64 (no data: prefix)
  data: z.string().min(1).max(Math.ceil((LOGO_MAX_BYTES * 4) / 3) + 16),
});
export type LogoInput = z.infer<typeof logoSchema>;

// ---------- developer unlock (Ed25519 challenge/response)

export const unlockSchema = z.object({
  code: z.string().min(1).max(500),
  signature: z.string().min(1).max(500),
});
export type UnlockInput = z.infer<typeof unlockSchema>;

export interface Challenge {
  code: string;
  installId: string;
}

// ---------- license

// Signed by Infresco, bound to installId (also used by the DB schema).
export interface LicensePayload {
  installId: string;
  school: string;
  issued: string;
  expires: string;
  modules: string[];
}

// The exact bytes that are signed. Keys are fixed and sorted so the signature survives a
// round-trip through Postgres jsonb (which does not preserve key order).
export function canonicalLicense(p: LicensePayload): string {
  return JSON.stringify({
    expires: p.expires,
    installId: p.installId,
    issued: p.issued,
    modules: p.modules,
    school: p.school,
  });
}


export const licenseSchema = z.object({
  license: z.string().min(1, 'Paste the license'),
  signature: z.string().min(1, 'Paste the signature'),
});
export type LicenseInput = z.infer<typeof licenseSchema>;

export type LicenseState = 'licensed' | 'trial' | 'expired' | 'none';

export interface LicenseStatus {
  state: LicenseState;
  // present when licensed or trial
  school: string | null;
  expires: string | null;
  daysLeft: number | null;
  // optional modules enabled (trial = all)
  modules: string[];
  installId: string;
  locked: boolean;
}

export interface DeveloperStatus {
  installId: string;
  license: LicenseStatus;
  branding: Branding;
  backup: BackupSummary;
}

// ---------- backups, restore, reset (developer only)

export interface BackupSummary {
  primaryDir: string | null;
  secondaryDir: string | null;
  times: string[];
  keep: number;
  lastGoodAt: string | null;
  // true when no good backup in 48 h (drives the principal's banner)
  stale: boolean;
  pgReady: boolean; // admin DB + pg tools available
}

export interface BackupFile {
  name: string;
  bytes: number;
  modifiedAt: string;
  location: 'primary' | 'secondary';
}

export interface BackupRunItem {
  id: string;
  trigger: string;
  status: 'ok' | 'failed';
  fileName: string | null;
  bytes: number | null;
  secondaryCopied: boolean;
  error: string | null;
  at: string;
}

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour)');
const dir = z
  .string()
  .trim()
  .max(500)
  .transform((v) => v || null)
  .nullish();

export const backupSettingsSchema = z.object({
  primaryDir: dir,
  secondaryDir: dir,
  times: z.array(hhmm).min(1, 'At least one time').max(6),
  keep: z.coerce.number().int().min(1).max(365),
});
export type BackupSettingsInput = z.infer<typeof backupSettingsSchema>;

export const restoreSchema = z.object({
  file: z.string().min(1).max(300),
});
export type RestoreInput = z.infer<typeof restoreSchema>;

// Reset scopes (SPEC §T14). Order widest-last.
export const RESET_MODULES = [
  'attendance',
  'fees',
  'staff_attendance',
  'payroll',
  'expenses',
  'students',
  'staff',
  'all',
] as const;
export type ResetModule = (typeof RESET_MODULES)[number];

export const resetSchema = z.object({
  module: z.enum(RESET_MODULES),
  // Typed confirmation: the school's English name, to prevent accidents.
  confirm: z.string().min(1),
});
export type ResetInput = z.infer<typeof resetSchema>;
