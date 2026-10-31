# Continuation prompt (hand to the next agent)

Paste everything in the block below as the agent's instructions.

---

You are continuing work on **Infresco SMS**, a clerk + principal school-office system (offline,
single school per install, English + Urdu). A previous agent built T1–T13; you continue from T14.
Work **exactly** like that agent: one task per session, strict regression testing so nothing already
working breaks, and a written handoff every time.

## 1. Read before doing anything (in this order, once)
1. `CLAUDE.md` (root) — the standing rule.
2. `docs/STATUS.md` — current state and which task is next.
3. `docs/SPEC.md` §0–§8 — shared context, rules, schema, API, screens, handoff format.
4. The **one** `§T<n>` section in `docs/SPEC.md` for the task you are doing — never read other task sections.
5. Only the `docs/progress/*.md` files that STATUS.md lists under "Read next" (usually the previous 1–2).

Do not read `node_modules`, `dist`, `pnpm-lock.yaml`, built files, or migrations already applied.
Read a source file only if you will call or change it.

## 2. Non-negotiable rules (from SPEC §1 and §3)
- **Stop when the task's Accept checks pass.** No extra features, no refactoring other tasks' code.
- **Regression gate:** `pnpm verify` (from repo root) must pass **before every commit**. It runs:
  build, typecheck, lint (api + web), i18n check, fresh migrate + seed ×2 on `sms_test`, all unit +
  e2e tests for every task, and a production boot. If an earlier task's test breaks because of your
  change, fix it; if the fix needs an earlier design change, stop and report instead of forcing it.
- **Write the tests the Accept block lists** as `apps/api/test/*.e2e-spec.ts` (pure logic →
  `apps/api/src/**/*.spec.ts`). Never delete or weaken an earlier task's test to go green.
- **Money** = integer paisa (`bigint`), never floats. **No stored balances/totals** — always `SUM`.
- **Append-only tables** (`audit_log`, `attendance_event`, `ledger_entry`, `receipt`, `cash_close`,
  `developer_log`, and any you add): corrections are new rows; add a `REVOKE UPDATE, DELETE, TRUNCATE`
  for each new one in its migration.
- **Every write is one transaction** that also writes an `audit_log` row via `AuditService.record`.
- **Every endpoint** declares `@RequirePermission('<code>')`, `@Public()`, `@Authenticated()`, or
  `@DeveloperOnly()`. The global guard denies anything undeclared.
- **Validation:** Zod schemas in `packages/shared`, reused by API (pipe) and web (forms).
- **UI:** English + Urdu, every string from `locales/{en,ur}.json` (no hard-coded text — the i18n
  check enforces this), RTL correct, works at 390 px phone width, forms save on Ctrl+Enter.
- Modules never import another module's tables/repository — call its exported service.

## 3. Task workflow
1. Implement the smallest change that passes the Accept checks.
2. Generate boilerplate with CLIs where possible (`nest g …`, `pnpm dlx shadcn@latest add …`).
3. Run `pnpm verify` and make it green.
4. Write the handoff (SPEC §8):
   - Overwrite `docs/STATUS.md` (≤30 lines): updated time, last task + result, Done line, Next task,
     "Read next", open issues, how to run.
   - Write `docs/progress/T<n>.md` (≤40 lines) using the §8 template: Built / Accept results /
     Decisions that differ from SPEC / Contracts the next tasks rely on / Left undone / Next notes.
   - Add manual UI checks to `docs/CHECKLIST.md`; add any Windows-specific steps to `docs/WINDOWS_TEST.md`.
   - Keep `docs/USER_MANUAL.md` and `docs/DEVELOPER.md` current if behaviour changed.
5. Commit: `git add -A && git commit -m "T<n>: <title>"`. A task is not done until its handoff is committed.
   (Use your own author identity; do not claim to be another agent.)

## 4. Environment & how to run
- Monorepo, pnpm workspaces: `apps/api` (NestJS 11 + Drizzle + Postgres 18), `apps/web`
  (React 19 + Vite + Tailwind v4 + shadcn), `packages/shared` (`@sms/shared`, built with tsup).
- Node 24+. Postgres 18 on localhost:5432. DBs: `sms_dev` (dev), `sms_test` (tests, via `.env.test`).
- Dev: `pnpm dev:api` + `pnpm dev:web` → web on :5173 (proxies /api to :8080). Phones: add `--host`.
- Prod on one PC: `pnpm build` then `cd apps/api && node dist/main.js` (serves the web app on :8080).
- Gate: `pnpm verify` (repo root). After schema edits: `pnpm --filter api db:migrate` /
  `pnpm --filter api db:seed` / `pnpm --filter api db:seed-demo` (all need `DATABASE_ADMIN_URL`).
- Login (dev/demo): `principal` / `clerk`, password `Admin@123`, PIN `1234`.
- **Shell is zsh** (bash syntax in commands; quote globs like `"src/**/*.ts"` — an unmatched glob errors).

## 5. Adding a new module without breaking anything
- **Schema:** add tables to `apps/api/src/db/schema.ts`, then `pnpm --filter api db:generate`. Rename
  the generated `drizzle/NNNN_*.sql` to something meaningful and update its tag in
  `drizzle/meta/_journal.json`. Add `REVOKE …` for any append-only table. New tables auto-grant
  `sms_app` via default privileges.
- **Permissions:** add `{ module, codes, licensed?: true }` to `PERMISSION_MODULES` in
  `packages/shared/src/permissions.ts`. Mark staff/payroll/expenses modules `licensed: true` so the
  license can switch them off (filter already built: `filterByLicense`, honoured in
  `AccessService.load`). Add every code to `locales/{en,ur}.json` under `perm.*`, and the module name
  under `module.*`. The Roles screen (`RolesPanel.tsx`) then shows them automatically. The seed grants
  new codes to the built-in Clerk only when the code is first created, except those listed in
  `CLERK_DEFAULT_EXCLUDED` — so the principal's role choices survive upgrades. Principal always has all.
- **Approvals:** reuse the existing flow — add an `approval_action` enum value and handle it in
  `ApprovalsService`; clerk actions over a threshold or cancellations create an `approval_request`,
  the principal's apply directly (SPEC §Z1).
- **Cash close:** when a module spends/collects cash, include it in the cash-close net
  (T17: receipts − cash expenses − cash salary payments) so the drawer reconciles.
- **Developer profile / license:** `LicenseService` (global) gives `status/locked/enabledModules`.
  For e2e tests that must unlock the developer profile, generate an ephemeral Ed25519 key and set
  `process.env.SMS_DEV_PUBLIC_KEYS` to its public `x` before `createTestApp()`, then sign challenge
  codes and the **canonical** license string (`canonicalLicense` from `@sms/shared` — jsonb reorders
  keys, so always sign/verify the canonical form). See `apps/api/test/developer.e2e-spec.ts`.

## 6. The tasks remaining (full detail in `docs/SPEC.md`)
Do them in order, one per session. Read only the matching §T section each time.
- **§T14** Backups in the app (replace the Windows task), restore, module/whole data reset — developer-profile only.
- **§T15** Staff (staff_profile, employee numbers, profiles; class-teacher picker from teaching staff).
- **§T16** Staff attendance (append-only, same keyboard grid + month register + lock rule as students).
- **§T17** Expenses + make cash close net out cash expenses/salaries.
- **§T18** Salary / payroll (structures, monthly prepare/post/pay, slips, advances) + dashboard cards.

## 7. Definition of done for the whole batch
All of T14–T18 committed, each with passing Accept checks; `pnpm verify` green; handoff docs written;
no existing test weakened or removed; new modules hideable from the Roles screen and switchable by
license. Then update `docs/STATUS.md` to point at the remaining human steps (real-PC Windows test,
code-signing certificate).

## 8. If you get stuck
Same error after 2 fix attempts, or a task clearly needs an earlier design change → **stop**, write
the handoff with `Result: BLOCKED` and the exact error + file, and report. Never loop on the same fix.
