import { createPublicKey, type KeyObject } from 'node:crypto';

// Infresco team Ed25519 public keys (base64url of the 32-byte key, the JWK `x`).
// The matching private key never lives in this repo; it signs unlock codes and licenses
// through scripts/dev-sign.mjs. Rotate by adding a new key here and by env (below).
// Generate a pair with: node scripts/dev-sign.mjs keygen
const BUILT_IN = ['VB4Sy1Z6rniOZeHxHqXuTKEdus_ff7jgsHKb1pWJ6k8'];

// Extra keys may be supplied by env (comma-separated) without a rebuild; tests use this.
export function developerPublicKeys(): KeyObject[] {
  const env =
    process.env.SMS_DEV_PUBLIC_KEYS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  return [...BUILT_IN, ...env]
    .filter((x) => x && !x.startsWith('REPLACE'))
    .map(publicKeyFromX);
}

export function publicKeyFromX(x: string): KeyObject {
  return createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x },
    format: 'jwk',
  });
}
