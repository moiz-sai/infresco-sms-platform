import { INestApplication } from '@nestjs/common';
import {
  canonicalLicense,
  type Branding,
  type Challenge,
  type DeveloperStatus,
  type LicensePayload,
} from '@sms/shared';
import {
  createPrivateKey,
  generateKeyPairSync,
  sign as edSign,
} from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { App } from 'supertest/types';
import { createTestApp, loginAs } from './app.factory';

// A 1x1 PNG.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

describe('T13 developer profile, license, branding', () => {
  let app: INestApplication<App>;
  let dev: TestAgent;
  let installId: string;
  let priv: ReturnType<typeof createPrivateKey>;
  const admin = new Pool({
    connectionString: process.env.DATABASE_ADMIN_URL,
    max: 1,
  });
  const sign = (msg: string) =>
    edSign(null, Buffer.from(msg, 'utf8'), priv).toString('base64url');
  // Sign a license the way scripts/dev-sign.mjs does: over its canonical form.
  const putLicense = (p: LicensePayload) =>
    dev.put('/api/_dev/license').send({
      license: JSON.stringify(p),
      signature: sign(canonicalLicense(p)),
    });

  beforeAll(async () => {
    // An ephemeral team key, trusted via env (no secret in the repo).
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    priv = privateKey;
    process.env.SMS_DEV_PUBLIC_KEYS = (
      publicKey.export({ format: 'jwk' }).x as string
    ).toString();
    app = await createTestApp();
    dev = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    // Leave no license behind, so other suites are not locked.
    await admin.query(
      `update installation set license_json = null, license_sig = null`,
    );
    await admin.end();
    await app.close();
    delete process.env.SMS_DEV_PUBLIC_KEYS;
  });

  const unlock = async () => {
    const ch = (await dev.post('/api/_dev/challenge').expect(200))
      .body as Challenge;
    installId = ch.installId;
    await dev
      .post('/api/_dev/unlock')
      .send({ code: ch.code, signature: sign(ch.code) })
      .expect(200);
  };

  it('is unreachable without a valid signature', async () => {
    await dev.get('/api/_dev/status').expect(401);
    const ch = (await dev.post('/api/_dev/challenge').expect(200))
      .body as Challenge;
    // wrong signature
    await dev
      .post('/api/_dev/unlock')
      .send({ code: ch.code, signature: sign('not-the-code') })
      .expect(401);
    // tampered code
    await dev
      .post('/api/_dev/unlock')
      .send({ code: `${ch.code}x`, signature: sign(ch.code) })
      .expect(401);
    await dev.get('/api/_dev/status').expect(401);
  });

  it('unlocks with a signed code, single use', async () => {
    const ch = (await dev.post('/api/_dev/challenge').expect(200))
      .body as Challenge;
    const sig = sign(ch.code);
    await dev
      .post('/api/_dev/unlock')
      .send({ code: ch.code, signature: sig })
      .expect(200);
    await dev.get('/api/_dev/status').expect(200);
    // the same code cannot be reused
    const fresh = request.agent(app.getHttpServer());
    await fresh
      .post('/api/_dev/unlock')
      .send({ code: ch.code, signature: sig })
      .expect(401);
  });

  it('sets branding and logo, served publicly', async () => {
    await unlock();
    await dev
      .put('/api/_dev/branding')
      .send({
        nameEn: 'Infresco Model School',
        nameUr: 'انفریسکو ماڈل اسکول',
        address: 'Qasimabad, Hyderabad',
        phone: '022-111000',
        footerEn: 'Powered by Infresco',
        footerUr: 'انفریسکو کی خدمت',
      })
      .expect(204);
    await dev
      .put('/api/_dev/logo')
      .send({ type: 'image/png', data: PNG_BASE64 })
      .expect(204);

    const anon = request.agent(app.getHttpServer());
    const b = (await anon.get('/api/branding').expect(200)).body as Branding;
    expect(b.nameEn).toBe('Infresco Model School');
    expect(b.footerEn).toBe('Powered by Infresco');
    expect(b.hasLogo).toBe(true);
    expect(b.logoVersion).toBeTruthy();
    const logo = await anon.get('/api/branding/logo').expect(200);
    expect(logo.headers['content-type']).toBe('image/png');
    expect((logo.body as Buffer).length).toBeGreaterThan(0);

    // The principal's Setup can no longer change the name (endpoint removed).
    const principal = await loginAs(app, 'principal');
    await principal
      .put('/api/school')
      .send({ nameEn: 'Hacked', address: null, phone: null })
      .expect(404);
  });

  it('rejects a license for a different install or a bad signature', async () => {
    await unlock();
    const wrong = await putLicense({
      installId: '00000000-0000-0000-0000-000000000000',
      school: 'Other',
      issued: '2026-01-01',
      expires: '2099-01-01',
      modules: [],
    });
    expect(wrong.status).toBe(400);
    expect((wrong.body as { code: string }).code).toBe('LICENSE_WRONG_INSTALL');

    const mine: LicensePayload = {
      installId,
      school: 'Mine',
      issued: '2026-01-01',
      expires: '2099-01-01',
      modules: [],
    };
    await dev
      .put('/api/_dev/license')
      .send({ license: JSON.stringify(mine), signature: sign('tampered') })
      .expect(400);
  });

  it('hard-locks logins when the license is expired, developer still works', async () => {
    await unlock();
    await putLicense({
      installId,
      school: 'Infresco Model School',
      issued: '2025-01-01',
      expires: '2025-02-01',
      modules: [],
    }).expect(204);

    const anon = request.agent(app.getHttpServer());
    const locked = await anon
      .post('/api/auth/login')
      .send({ username: 'principal', password: 'Admin@123' });
    expect(locked.status).toBe(423);
    expect((locked.body as { code: string }).code).toBe('LICENSE_LOCKED');
    // Branding and the developer profile stay reachable so the license can be fixed.
    await anon.get('/api/branding').expect(200);
    const status = (await dev.get('/api/_dev/status').expect(200))
      .body as DeveloperStatus;
    expect(status.license.locked).toBe(true);

    // A fresh valid license unlocks the school again.
    await putLicense({
      installId,
      school: 'Infresco Model School',
      issued: '2026-01-01',
      expires: '2099-01-01',
      modules: [],
    }).expect(204);
    await anon
      .post('/api/auth/login')
      .send({ username: 'principal', password: 'Admin@123' })
      .expect(200);
  });
});
