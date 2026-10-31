#!/usr/bin/env node
// Infresco developer signing tool. Needs the private key (never in the repo).
//   node scripts/dev-sign.mjs keygen                        -> a new key pair (public goes in keys.ts)
//   node scripts/dev-sign.mjs unlock <code>                 -> signature for a developer unlock code
//   node scripts/dev-sign.mjs license <installId> <school> <YYYY-MM-DD> [mod,mod]
//                                                           -> {license, signature} to paste in the app
// Key file: $INFRESCO_DEV_KEY or ~/.config/infresco/dev-key.json ({x, d} base64url, JWK Ed25519).
import {
  createPrivateKey,
  generateKeyPairSync,
  sign as edSign,
} from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const keyPath =
  process.env.INFRESCO_DEV_KEY || join(homedir(), '.config/infresco/dev-key.json');

function privateKey() {
  const { x, d } = JSON.parse(readFileSync(keyPath, 'utf8'));
  return createPrivateKey({
    key: { kty: 'OKP', crv: 'Ed25519', x, d },
    format: 'jwk',
  });
}

const sign = (msg) => edSign(null, Buffer.from(msg, 'utf8'), privateKey()).toString('base64url');

const [cmd, ...args] = process.argv.slice(2);

if (cmd === 'keygen') {
  const { publicKey, privateKey: pk } = generateKeyPairSync('ed25519');
  const pub = publicKey.export({ format: 'jwk' });
  const prv = pk.export({ format: 'jwk' });
  console.log('Add this to apps/api/src/developer/keys.ts BUILT_IN:');
  console.log(`  '${pub.x}'`);
  console.log(`\nSave this privately (e.g. ${keyPath}):`);
  console.log(JSON.stringify({ alg: 'Ed25519', x: pub.x, d: prv.d }));
} else if (cmd === 'unlock') {
  if (!args[0]) throw new Error('usage: unlock <code>');
  console.log(sign(args[0]));
} else if (cmd === 'license') {
  const [installId, school, expires, mods] = args;
  if (!installId || !school || !expires) {
    throw new Error('usage: license <installId> <school> <YYYY-MM-DD> [mod,mod]');
  }
  const payload = {
    installId,
    school,
    issued: new Date().toISOString().slice(0, 10),
    expires,
    modules: mods ? mods.split(',').map((m) => m.trim()).filter(Boolean) : [],
  };
  // Must match canonicalLicense() in @sms/shared: fixed, sorted keys.
  const canonical = JSON.stringify({
    expires: payload.expires,
    installId: payload.installId,
    issued: payload.issued,
    modules: payload.modules,
    school: payload.school,
  });
  console.log(
    JSON.stringify(
      { license: JSON.stringify(payload), signature: sign(canonical) },
      null,
      2,
    ),
  );
} else {
  console.error('commands: keygen | unlock <code> | license <installId> <school> <expires> [mods]');
  process.exit(1);
}
