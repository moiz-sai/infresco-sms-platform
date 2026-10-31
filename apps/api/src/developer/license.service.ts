import { Inject, Injectable } from '@nestjs/common';
import {
  canonicalLicense,
  LICENSED_MODULES,
  type LicenseStatus,
} from '@sms/shared';
import { verify } from 'node:crypto';
import { DB, type Db } from '../db/database.module';
import { installation, type LicensePayload } from '../db/schema';
import { developerPublicKeys } from './keys';

const TRIAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface InstallationRow {
  id: string;
  installId: string;
  licenseJson: LicensePayload | null;
  licenseSig: string | null;
  createdAt: Date;
}

function daysBetween(from: number, toIso: string): number {
  return Math.ceil((Date.parse(`${toIso}T23:59:59`) - from) / DAY_MS);
}

// Single source of truth for license state and which optional modules are enabled (§T13).
@Injectable()
export class LicenseService {
  private cached?: InstallationRow;

  constructor(@Inject(DB) private readonly db: Db) {}

  // One installation row per database; created here if the seed has not yet run.
  async row(): Promise<InstallationRow> {
    if (this.cached) return this.cached;
    let [row] = await this.db
      .select({
        id: installation.id,
        installId: installation.installId,
        licenseJson: installation.licenseJson,
        licenseSig: installation.licenseSig,
        createdAt: installation.createdAt,
      })
      .from(installation)
      .limit(1);
    if (!row) {
      [row] = await this.db.insert(installation).values({}).returning({
        id: installation.id,
        installId: installation.installId,
        licenseJson: installation.licenseJson,
        licenseSig: installation.licenseSig,
        createdAt: installation.createdAt,
      });
    }
    this.cached = row;
    return row;
  }

  refresh() {
    this.cached = undefined;
  }

  private signatureValid(row: InstallationRow): boolean {
    if (!row.licenseJson || !row.licenseSig) return false;
    if (row.licenseJson.installId !== row.installId) return false;
    const msg = Buffer.from(canonicalLicense(row.licenseJson), 'utf8');
    let sig: Buffer;
    try {
      sig = Buffer.from(row.licenseSig, 'base64url');
    } catch {
      return false;
    }
    return developerPublicKeys().some((key) => {
      try {
        return verify(null, msg, key, sig);
      } catch {
        return false;
      }
    });
  }

  async status(): Promise<LicenseStatus> {
    const row = await this.row();
    const now = Date.now();
    const createdAt = row.createdAt.getTime();
    const base = {
      installId: row.installId,
      school: null as string | null,
      expires: null as string | null,
      daysLeft: null as number | null,
      modules: [] as string[],
    };

    // A license present but unsigned / wrong install / tampered → locked (treated as expired).
    if (row.licenseJson || row.licenseSig) {
      if (!this.signatureValid(row)) {
        return { ...base, state: 'expired', locked: true };
      }
      const lic = row.licenseJson!;
      const daysLeft = daysBetween(now, lic.expires);
      const expired = daysLeft < 0;
      return {
        ...base,
        state: expired ? 'expired' : 'licensed',
        school: lic.school,
        expires: lic.expires,
        daysLeft,
        modules: expired ? [] : lic.modules,
        locked: expired,
      };
    }

    // No license yet: a trial from the install date.
    const start = createdAt;
    const daysLeft = Math.ceil((start + TRIAL_DAYS * DAY_MS - now) / DAY_MS);
    if (daysLeft < 0) {
      return { ...base, state: 'expired', locked: true };
    }
    return {
      ...base,
      state: 'trial',
      daysLeft,
      modules: LICENSED_MODULES,
      locked: false,
    };
  }

  // Cheap boolean for the request guard.
  async locked(): Promise<boolean> {
    return (await this.status()).locked;
  }

  // Optional modules currently enabled (trial = all). Empty when locked.
  async enabledModules(): Promise<string[]> {
    return (await this.status()).modules;
  }
}
