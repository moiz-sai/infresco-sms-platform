// Regression gate: every task must leave this green before committing (see docs/SPEC.md §1 rule 13).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const apiDir = join(root, 'apps', 'api');
const env = { ...process.env, SMS_ENV_FILE: '.env.test', FORCE_COLOR: '0' };

const steps = [
  ['build shared', 'pnpm --filter @sms/shared build'],
  ['typecheck api', 'pnpm --filter api typecheck'],
  ['lint api', 'pnpm --filter api lint:check'],
  ['lint web', 'pnpm --filter web lint'],
  ['build api', 'pnpm --filter api build'],
  ['build web (incl. typecheck)', 'pnpm --filter web build'],
  ['reset sms_test', 'pnpm --filter api db:reset-test'],
  ['migrate from zero', 'pnpm --filter api db:migrate'],
  ['seed #1', 'pnpm --filter api db:seed'],
  ['seed #2 (idempotent)', 'pnpm --filter api db:seed'],
  ['unit tests', 'pnpm --filter api test'],
  ['e2e tests (all tasks)', 'pnpm --filter api test:e2e'],
];

function run(cmd, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, { cwd: root, env, shell: true, ...opts });
    let out = '';
    child.stdout?.on('data', (d) => (out += d));
    child.stderr?.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
  });
}

function fail(name, out) {
  console.log(`✗ ${name}\n${out.trim().split('\n').slice(-40).join('\n')}`);
  process.exit(1);
}

async function smokeProd() {
  const child = spawn(process.execPath, ['dist/main.js'], { cwd: apiDir, env });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  try {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const res = await fetch('http://localhost:8090/api/health').catch(
        () => null,
      );
      if (res) {
        const body = await res.json();
        return body.status === 'ok' ? null : JSON.stringify(body);
      }
    }
    return out || 'no response from :8090';
  } finally {
    child.kill();
  }
}

if (!existsSync(join(apiDir, '.env.test'))) {
  fail(
    'setup',
    'apps/api/.env.test missing — copy apps/api/.env.test.example and fill it in',
  );
}

const started = Date.now();
for (const [name, cmd] of steps) {
  const t = Date.now();
  const { code, out } = await run(cmd);
  if (code !== 0) fail(name, out);
  console.log(`✓ ${name} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
}
const smoke = await smokeProd();
if (smoke) fail('prod boot + /api/health', smoke);
console.log('✓ prod boot + /api/health');
console.log(`verify passed in ${((Date.now() - started) / 1000).toFixed(0)}s`);
