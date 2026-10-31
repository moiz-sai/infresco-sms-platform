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
  // T14 fills these
  backup: {
    primaryDir: string | null;
    secondaryDir: string | null;
    times: string[];
    keep: number;
    lastGoodAt: string | null;
  };
}
