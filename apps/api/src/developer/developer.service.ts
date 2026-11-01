import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  type Branding,
  type BrandingInput,
  type Challenge,
  type DeveloperStatus,
  type LicenseInput,
  LOGO_MAX_BYTES,
  type LogoInput,
  type LicensePayload,
  canonicalLicense,
} from '@sms/shared';
import { randomUUID, verify } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { DB, type Db } from '../db/database.module';
import { developerLog, installation, school } from '../db/schema';
import { developerPublicKeys } from './keys';
import { BackupService } from './backup.service';
import { LicenseService } from './license.service';

const CHALLENGE_MS = 10 * 60 * 1000;
export const DEV_SESSION_MS = 4 * 60 * 60 * 1000;

@Injectable()
export class DeveloperService {
  // nonce -> expiry; single use, memory only (a restart invalidates pending codes, which is fine).
  private readonly challenges = new Map<string, number>();

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly license: LicenseService,
    private readonly backup: BackupService,
  ) {}

  async log(action: string, detail?: Record<string, unknown>, ip?: string) {
    await this.db
      .insert(developerLog)
      .values({ action, detail: detail ?? null, ip: ip ?? null });
  }

  private sweep(now: number) {
    for (const [nonce, exp] of this.challenges) {
      if (exp < now) this.challenges.delete(nonce);
    }
  }

  async challenge(ip?: string): Promise<Challenge> {
    const { installId } = await this.license.row();
    const now = Date.now();
    this.sweep(now);
    const nonce = randomUUID();
    const expiresAt = now + CHALLENGE_MS;
    this.challenges.set(nonce, expiresAt);
    await this.log('dev.challenge', undefined, ip);
    // The signed message carries the install id and expiry so a code cannot be replayed elsewhere.
    const code = `${installId}.${nonce}.${expiresAt}`;
    return { code, installId };
  }

  // Returns the dev-session expiry (epoch ms) the controller stores in the session.
  unlock(code: string, signature: string, ip?: string): number {
    const now = Date.now();
    const parts = code.split('.');
    const bad = () =>
      new UnauthorizedException({
        code: 'DEV_UNLOCK_FAILED',
        message: 'Unlock failed',
      });
    if (parts.length !== 3) throw bad();
    const [, nonce, expiresRaw] = parts;
    const expiresAt = Number(expiresRaw);
    const stored = this.challenges.get(nonce);
    if (!stored || stored !== expiresAt || expiresAt < now) throw bad();

    let sig: Buffer;
    try {
      sig = Buffer.from(signature, 'base64url');
    } catch {
      throw bad();
    }
    const msg = Buffer.from(code, 'utf8');
    const ok = developerPublicKeys().some((key) => {
      try {
        return verify(null, msg, key, sig);
      } catch {
        return false;
      }
    });
    if (!ok) throw bad();

    this.challenges.delete(nonce); // single use
    void this.log('dev.unlock', undefined, ip);
    return now + DEV_SESSION_MS;
  }

  async getBranding(): Promise<Branding> {
    const row = await this.license.row();
    const [s] = await this.db
      .select({
        nameEn: school.nameEn,
        nameUr: school.nameUr,
        address: school.address,
        phone: school.phone,
      })
      .from(school)
      .limit(1);
    const [b] = await this.db
      .select({
        footerEn: installation.footerEn,
        footerUr: installation.footerUr,
        logoData: installation.logoData,
        updatedAt: installation.updatedAt,
      })
      .from(installation)
      .where(eq(installation.id, row.id));
    return {
      nameEn: s?.nameEn ?? '',
      nameUr: s?.nameUr ?? null,
      address: s?.address ?? null,
      phone: s?.phone ?? null,
      footerEn: b?.footerEn ?? null,
      footerUr: b?.footerUr ?? null,
      hasLogo: !!b?.logoData,
      logoVersion: b?.logoData ? b.updatedAt.getTime().toString(36) : null,
    };
  }

  async getLogo(): Promise<{ data: Buffer; type: string } | null> {
    const [b] = await this.db
      .select({
        logoData: installation.logoData,
        logoType: installation.logoType,
      })
      .from(installation)
      .limit(1);
    if (!b?.logoData || !b.logoType) return null;
    return { data: Buffer.from(b.logoData, 'base64'), type: b.logoType };
  }

  async setBranding(input: BrandingInput, ip?: string) {
    const row = await this.license.row();
    const [s] = await this.db.select({ id: school.id }).from(school).limit(1);
    if (s) {
      await this.db
        .update(school)
        .set({
          nameEn: input.nameEn,
          nameUr: input.nameUr ?? null,
          address: input.address ?? null,
          phone: input.phone ?? null,
        })
        .where(eq(school.id, s.id));
    }
    await this.db
      .update(installation)
      .set({
        footerEn: input.footerEn ?? null,
        footerUr: input.footerUr ?? null,
      })
      .where(eq(installation.id, row.id));
    await this.log('dev.branding', { nameEn: input.nameEn }, ip);
  }

  async setLogo(input: LogoInput, ip?: string) {
    const bytes = Buffer.from(input.data, 'base64');
    if (bytes.length === 0 || bytes.length > LOGO_MAX_BYTES) {
      throw new BadRequestException({
        code: 'LOGO_TOO_LARGE',
        message: 'Logo must be a PNG, JPEG or WebP up to 300 KB',
      });
    }
    const row = await this.license.row();
    await this.db
      .update(installation)
      .set({ logoData: bytes.toString('base64'), logoType: input.type })
      .where(eq(installation.id, row.id));
    await this.log('dev.logo', { type: input.type, bytes: bytes.length }, ip);
  }

  async clearLogo(ip?: string) {
    const row = await this.license.row();
    await this.db
      .update(installation)
      .set({ logoData: null, logoType: null })
      .where(eq(installation.id, row.id));
    await this.log('dev.logo.clear', undefined, ip);
  }

  async setLicense(input: LicenseInput, ip?: string) {
    let payload: LicensePayload;
    try {
      payload = JSON.parse(input.license) as LicensePayload;
    } catch {
      throw new BadRequestException({
        code: 'LICENSE_INVALID',
        message: 'The license is not valid JSON',
      });
    }
    const row = await this.license.row();
    // Reject before saving: wrong install id, or a signature that does not verify.
    if (payload.installId !== row.installId) {
      throw new BadRequestException({
        code: 'LICENSE_WRONG_INSTALL',
        message: 'This license is for a different installation',
      });
    }
    let sig: Buffer;
    try {
      sig = Buffer.from(input.signature, 'base64url');
    } catch {
      throw new BadRequestException({
        code: 'LICENSE_INVALID',
        message: 'The signature is not valid',
      });
    }
    const msg = Buffer.from(canonicalLicense(payload), 'utf8');
    const ok = developerPublicKeys().some((key) => {
      try {
        return verify(null, msg, key, sig);
      } catch {
        return false;
      }
    });
    if (!ok) {
      throw new BadRequestException({
        code: 'LICENSE_INVALID',
        message: 'The signature does not match',
      });
    }
    await this.db
      .update(installation)
      .set({ licenseJson: payload, licenseSig: input.signature })
      .where(eq(installation.id, row.id));
    this.license.refresh();
    await this.log('dev.license', { expires: payload.expires }, ip);
  }

  async status(): Promise<DeveloperStatus> {
    const [license, branding, backup] = await Promise.all([
      this.license.status(),
      this.getBranding(),
      this.backup.summary(),
    ]);
    return { installId: license.installId, license, branding, backup };
  }
}
