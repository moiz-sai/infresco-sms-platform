# Infresco SMS

School-office system: admissions, attendance, fees with printed receipts, approvals and cash close. English and Urdu (RTL).
It runs on one office PC; other PCs and phones on the same Wi-Fi use it in the browser.

Stack: NestJS + Drizzle + PostgreSQL 18 (apps/api), React + Vite + Tailwind (apps/web), shared zod schemas (packages/shared).

## Run (development)
1. Copy `apps/api/.env.example` → `apps/api/.env` and `apps/api/.env.test.example` → `apps/api/.env.test`, then fill in the DB passwords and `SESSION_SECRET`
2. `pnpm install`
3. `pnpm --filter api db:migrate` then `pnpm --filter api db:seed`
4. `pnpm dev:api` and `pnpm dev:web` (for phones, use `pnpm dev:web --host`) → http://localhost:5173
5. Log in as `principal` or `clerk` with password `Admin@123` (switch-user PIN `1234`)

Run `pnpm verify` before every commit: build, typecheck, lint, fresh test DB, migrations, seed ×2, all tests and a production boot check. It must end with `verify passed`.

## Docs
| File | What it's for |
|---|---|
| [docs/STATUS.md](docs/STATUS.md) | Where the project is now, the next task and open issues. Start here |
| [docs/SPEC.md](docs/SPEC.md) | The specification: rules, data model, tasks T1–T10, human decisions (§Z) |
| [docs/progress/](docs/progress/) | One handoff note per finished task: what was built, test results, deviations, contracts |
| [docs/CHECKLIST.md](docs/CHECKLIST.md) | Manual screen checks for a human to tick after each task |
| [docs/WINDOWS_TEST.md](docs/WINDOWS_TEST.md) | Self-contained guide for the Windows test PC |
| [CLAUDE.md](CLAUDE.md) | Instructions for the coding agent |
