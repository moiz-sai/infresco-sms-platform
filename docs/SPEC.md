# Infresco SMS — Agent Build Spec (2-day MVP)
v1.1 · 2026-10-24 · Owner: Vik (Infresco) · Target: clerk + principal school-office system, demo-ready

## §0 How to use (agent: read first)
- Save this file as `docs/SPEC.md`. Root `CLAUDE.md` must contain only:
  `Read docs/STATUS.md first. Then docs/SPEC.md §0–§8 once, ONLY the §T section named in the prompt, and only the docs/progress/ files STATUS.md lists under "Read next". Obey §1. End every task with the §8 handoff.`
- One session = one task. Prompt: `Do T4 from docs/SPEC.md.` (or just `Continue.` — the next task is in `docs/STATUS.md`).
- Session start order: `docs/STATUS.md` → this spec §0–§8 → your §T section → listed progress notes. Read nothing else until you need a specific file.
- §0–§8 are shared context. §T1–§T10 are tasks. Never read a task section you were not given.
- Human does before T1: install Node 26 LTS, pnpm (`npm i -g pnpm`), PostgreSQL 18 (port 5432), VS Code. Create DB `sms_dev`.

## §1 Token rules (mandatory)
1. Stop as soon as the task's Accept checks pass. No extras, no refactors of other tasks' code.
2. Never open: `node_modules`, `dist`, `pnpm-lock.yaml`, `*.map`, `drizzle/*.sql` already applied, logs. Read `schema.ts` for the data model.
3. Read a file only if you will change or call it. Read once; do not re-read after your own edit.
4. Existing files: targeted edits only. Full writes only for new files.
5. Generate boilerplate with CLIs: `nest g resource|module|service|controller`, `pnpm dlx shadcn@latest add <names>`.
6. Never paste code, diffs or file contents into chat. Final message ≤ 8 lines: what was done, check results, open issues, and the path of the progress note written.
7. Long command output: `| Select-Object -Last 40` (Linux/macOS: `| tail -40`).
8. Dependencies: only those in §2. No README or other docs, except the two handoff files in §8, `docs/CHECKLIST.md` and `docs/WINDOWS_TEST.md`. Comments only for non-obvious logic.
9. Same error after 2 fix attempts → stop, report the exact error and file. Never loop.
10. Write the tests listed in Accept as automated tests (`apps/api/test/*.e2e-spec.ts`) and keep them; never delete an earlier task's test.
11. Each task has a token budget (approximate, input+output). Expect to exceed by >30% → stop and report.
12. Before committing, write the §8 handoff. Then: `git add -A && git commit -m "T<n>: <title>"`. A task is not done until its handoff is committed.
13. A task stopped early (rule 9 or 11) still writes its handoff, with `Status: BLOCKED` and the exact error.
14. Regression gate: before the handoff/commit, `pnpm verify` must pass (build, lint, fresh migrate + seed ×2 on `sms_test`, ALL tasks' tests, prod boot). If an earlier task's test breaks: fix it when the cause is the current task's code; if the fix needs an earlier design change, stop and report (rule 13). Manual UI checks the task adds go in `docs/CHECKLIST.md`; anything Windows-specific (setup steps, firewall, printing, scripts) goes in the matching round of `docs/WINDOWS_TEST.md`.

## §2 Stack (fixed)
- Windows dev, PowerShell. Node 26 LTS (fallback 24). pnpm workspaces.
- Repo `infresco-sms/`: `apps/api` (NestJS 11, Express), `apps/web` (React 19 + Vite + TS), `packages/shared` (`@sms/shared`).
- DB: PostgreSQL 18, Drizzle ORM + drizzle-kit, driver `pg`. IDs `uuid default uuidv7()`.
- API deps: `@nestjs/config`, `@nestjs/schedule`, `@nestjs/serve-static`, `drizzle-orm`, `pg`, `express-session`, `connect-pg-simple`, `@node-rs/argon2` (fallback `bcryptjs`), `zod`, `pino`, `nestjs-pino`.
- Web deps: `tailwindcss` v4, shadcn/ui, `react-router`, `@tanstack/react-query`, `@tanstack/react-table`, `i18next`, `react-i18next`, `recharts`, `@fontsource-variable/inter`, `@fontsource/noto-naskh-arabic`, `sonner`.
- Dev/test: `jest`, `supertest` (Nest defaults), `tsup` for shared.
- Env (`apps/api/.env`, validated by Zod at boot): `DATABASE_URL` (as `sms_app`), `PORT=8080`, `SESSION_SECRET`, `DEVICE_PREFIX=D1`. Scripts (`db:migrate`, `db:seed`) also need `DATABASE_ADMIN_URL` (owner role). `SMS_ENV_FILE` selects the file; tests use `apps/api/.env.test` → DB `sms_test`, port 8090.

## §3 Global rules
- Every table: `id`, `school_id` (except `permission`), `created_at`; mutable tables add `updated_at`, `deleted_at`.
- Append-only (no UPDATE/DELETE ever): `audit_log`, `attendance_event`, `ledger_entry`, `receipt`, `cash_close`. Corrections = new rows.
- Money = integer paisa (`bigint`), never floats. Format only in UI (`Rs 3,000`).
- No stored balances or totals. Balance = `SUM(ledger_entry.amount_paisa)`.
- Every write: one transaction = change + `audit_log` row (`AuditService.record(tx, …)`).
- Every endpoint: `@RequirePermission('<code>')` or `@Public()`. Global guard denies by default.
- Modules never import another module's repository/tables; call its exported service.
- Validation: Zod schemas in `@sms/shared`, used by API (pipe) and web (forms).
- No school-specific `if`. Differences live in `school.settings` (jsonb).
- API prefix `/api`. Errors: `{ code, message }`. Lists: `?page&size` (size ≤ 100) → `{ items, total }`.
- UI: English + Urdu; `dir="rtl"` for Urdu; logical Tailwind classes only (`ms-`/`me-`/`ps-`/`pe-`/`start`/`end`). Fonts bundled, no CDN (school is offline).
- Keyboard-first: every form saves on Ctrl+Enter; grids move with arrows/Enter.

## §4 Schema (single source: `apps/api/src/db/schema.ts`)
`*` = append-only. Enums in brackets. FK names imply targets.
- `school`: name_en, name_ur, address, phone, device_prefix, settings jsonb `{attendanceLockDays:3, discountThresholdPaisa:100000, allocation:"oldest_first"}`
- `person`: kind[student|staff|guardian], name_en, name_ur, father_name, gender[m|f], dob, b_form, phone, cnic, address, status[active|left], extra jsonb, search_text
- `user_account`: person_id (unique), username (unique per school), password_hash, pin_hash, is_active, failed_count, locked_until
- `role`: school_id NULL = built-in, code, name_en, name_ur
- `permission`: code PK, module
- `role_permission`: role_id, permission_code (PK both)
- `user_role`: user_id, role_id, scope_type[school|section], scope_id, valid_from, valid_to
- `device`: name, prefix, kind[pc|phone]
- `audit_log*`: user_id, device_id, action, entity, entity_id, before jsonb, after jsonb
- `counter`: key (unique per school), value bigint — sequences via `UPDATE … SET value=value+1 RETURNING value`
- `academic_year`: label, starts_on, ends_on, is_current (partial unique `WHERE is_current`)
- `class`: name_en, name_ur, level int
- `section`: class_id, year_id, name, class_teacher_id
- `guardian_student`: guardian_id, student_id, relation, is_primary
- `enrollment`: student_id, section_id, year_id, roll_no, admission_no (unique per school), joined_on, left_on, status[active|left|promoted]
- `attendance_event*`: enrollment_id, date, status[P|A|L|V], marked_by, device_id, hlc bigint, supersedes_id. View `attendance_effective`: `DISTINCT ON (enrollment_id,date) ORDER BY hlc DESC`. Index (enrollment_id,date).
- `fee_head`: code, name_en, name_ur, priority int. Seed `ADV` (Advance) priority 999.
- `fee_structure`: class_id, year_id, head_id, amount_paisa, frequency[monthly|yearly|once]
- `student_fee_plan`: enrollment_id, head_id, discount_type[pct|fixed], value, reason
- `receipt*`: receipt_no (unique), enrollment_id, method[cash|bank|online], total_paisa, received_by, device_id
- `ledger_entry*`: enrollment_id, head_id, period char(7) 'YYYY-MM', type[charge|payment|adjust|reversal], amount_paisa (signed), receipt_id, reverses_id (UNIQUE), note, created_by, device_id, hlc. Unique (enrollment_id, head_id, period) WHERE type='charge'. Index (enrollment_id, period).
- `approval_request`: action[fees.discount|fees.reverse|attendance.edit_old], requested_by, payload jsonb, status[pending|approved|rejected], decided_by, decided_at, reason
- `cash_close*`: date (unique per school), system_total_paisa, counted_total_paisa, difference_paisa, closed_by
- `session`: connect-pg-simple table.

Signs: charge `+`, payment `−`, discount adjust `−`, reversal = `−(original)`. `hlc` = monotonic `max(last+1, Date.now()*1000)` per process.
Numbers: admission `{prefix}-{seq6}` key `adm`; receipt `{prefix}-{YYYY}-{seq6}` key `rcpt:{YYYY}`.

## §5 Permissions and built-in roles
Codes: `students.view students.edit attendance.mark attendance.view fees.configure fees.collect fees.discount fees.reverse.request approvals.decide dashboard.view users.manage audit.view settings.manage`
- Clerk: all except `approvals.decide users.manage settings.manage audit.view`.
- Principal: all.
- Approval rules: discount > `discountThresholdPaisa` → request; reversal → always request; attendance date older than `attendanceLockDays` → request.

## §6 API (all under `/api`)
- auth: `POST /auth/login {username,password}` · `POST /auth/logout` · `GET /auth/me` · `POST /auth/switch {username,pin}`
- setup: `GET|PUT /school` · CRUD `/years` `/classes` `/sections`
- people: `POST /students/admit` (person+guardians+enrollment, 1 tx) · `GET /students?q&classId&sectionId&status` · `GET|PUT /students/:id` · `POST /students/:id/leave` · `POST /enrollments/promote {fromSectionId,toSectionId,studentIds}`
- attendance: `GET|POST /attendance/sections/:id/days/:date` (body `[{id(uuid from client),enrollmentId,status}]`, idempotent) · `GET /attendance/sections/:id/months/:yyyymm`
- fees: CRUD `/fee-heads` `/fee-structures` `/fee-plans` · `POST /fees/post-charges {period}` · `GET /fees/students/:enrollmentId/statement` · `POST /fees/payments {enrollmentId,amountPaisa,method}` → receipt · `GET /fees/receipts/:id` · `POST /fees/discounts` · `POST /fees/receipts/:id/reverse {reason}` · `GET /fees/defaulters?classId&minMonths` · `GET|POST /fees/cash-close/:date`
- approvals: `GET /approvals?status` · `POST /approvals/:id/approve` · `POST /approvals/:id/reject {reason}`
- principal: `GET /dashboard` · `GET /audit?userId&from&to&entity` · CRUD `/users` (+ `/users/:id/roles`, `/users/:id/reset`)
- system: `GET /health`

## §7 Screens (`apps/web/src/pages`)
Login · Shell (sidebar filtered by permissions, school name, language toggle, Switch User PIN dialog) · Setup (school, years, classes/sections) · Students list (search, filters, paging) · Admission form · Student profile (details, guardians, attendance %, fee statement, history) · Attendance grid (keyboard: ↑↓ move, P/A/L/V set, Space toggle, Ctrl+S save; mobile: big P/A buttons) · Attendance month register (print A4 landscape) · Fee setup (classes × heads grid) · Fee collection (search focused → dues → amount prefilled → Ctrl+Enter save & print → refocus search; siblings shown) · Receipt print (`/print/receipt/:id`, 80 mm and A4 ×2 copies, `window.print()`) · Defaulters · Cash close · Approvals inbox · Dashboard · Users & roles · Audit · Settings.

## §8 Handoff files (mandatory, every task)
Two files carry state between sessions, so the next session never re-reads code to find out where things stand.

**`docs/STATUS.md`** — one file, overwritten each task, ≤ 30 lines:
```
# STATUS
Updated: <YYYY-MM-DD HH:MM> · Last task: T<n> <title> · Result: DONE | PARTIAL | BLOCKED
## Done
- T1 ✔  T2 ✔  T3 ✔  (one line, task ids only)
## Next
- Task: T<n+1> <title>
- Before starting: <human action needed, or "none">
## Read next
- docs/progress/T<n>.md   (only notes the next task truly needs; max 2)
## Open issues
- <issue> → <file:line or command> (max 5; delete when fixed)
## How to run
- api: pnpm --filter api start:dev · web: pnpm --filter web dev · seed: pnpm --filter api seed
```

**`docs/progress/T<n>.md`** — one per task, written once, ≤ 40 lines:
```
# T<n> <title> — DONE | PARTIAL | BLOCKED
## Built
- <module/screen>: <one line> (`path/to/main/file.ts`)
## Accept results
- <check>: PASS | FAIL (<one-line reason>)
## Decisions that differ from SPEC
- <what and why> (or "none")
## Contracts the next tasks rely on
- Endpoints added: <METHOD /path> (one line each)
- Services exported: <Name.method(args)>  · Tables/columns added beyond §4: <list or "none">
## Left undone / known bugs
- <item> → <where>
## Next task notes
- <anything T<n+1> must know, ≤ 3 lines>
```
Rules: plain facts, no code blocks except one-line commands, no prose paragraphs. Never copy spec text into these files. If a later task fixes an issue, update `STATUS.md` only; never edit old progress notes. Each note adds roughly 600–900 tokens to the next session instead of tens of thousands spent re-reading code.

---

## Day 1

### §T1 Scaffold, config, DB (budget ~50k)
Steps: monorepo (`pnpm-workspace.yaml`: `apps/*`, `packages/*`); `nest new api --skip-git --package-manager pnpm`; `pnpm create vite web --template react-ts`; `packages/shared` built with tsup; root `tsconfig.base.json`, ESLint+Prettier; ConfigModule with Zod env; DatabaseModule (Drizzle on `pg` Pool max 10); `GET /api/health` runs `select 1`; Vite proxy `/api` → `:8080`.
Accept: `pnpm --filter api start:dev` and `pnpm --filter web dev` run; `/api/health` → `{status:"ok"}` via web proxy; missing `DATABASE_URL` stops boot with a clear message.
If fails: `uuidv7()` missing (PG < 18) → `uuid` pkg `v7()` in app; shared import unresolved → consume `dist` via `main`/`types`.

### §T2 Full schema, migration, seed (budget ~90k)
Steps: write all §4 tables in `schema.ts`; `drizzle-kit generate` + `migrate`; SQL migration adds view `attendance_effective`, partial uniques, `REVOKE UPDATE, DELETE` on append-only tables from role `sms_app` (create role; app connects as it); seed script: permissions, Clerk/Principal roles, demo school (prefix D1), year 2026-27 current, classes 1–5 × sections A,B, heads TUI/EXM/ADV, structures (TUI Rs 3,000 monthly, EXM Rs 500 yearly), users `principal`/`clerk` password `Admin@123` PIN `1234`.
Accept: seed runs twice with no duplicates (`onConflictDoNothing`); `UPDATE ledger_entry …` as `sms_app` fails.

### §T3 Auth, RBAC, PIN switch, audit (budget ~110k)
Steps: express-session + connect-pg-simple (cookie httpOnly, sameSite lax, secure false, 12 h); argon2 hashing; lock 5 min after 5 bad passwords; `@RequirePermission` + `@Public` + global guard (loads roles, honors scope & validity dates); `/auth/switch` by PIN (5 bad PINs/10 min → require password); `AuditService.record(tx, …)` + `withTx()` helper; audit every login.
Accept (jest e2e): clerk → 403 on `/api/approvals`; principal → 200; logout → `/auth/me` 401; PIN switch changes `/auth/me`.

### §T4 Setup, students, search (budget ~150k)
API: setup CRUD; `admit` in one tx with admission number from counter; `normalizeUrdu()` in shared (NFC; ي→ی, ك→ک, ه→ہ; strip U+064B–U+065F, U+0670; collapse spaces; lowercase) → `search_text`; `pg_trgm` GIN index; list with filters & paging; leave; promote (one tx).
Web: Shell + Login + i18n (en/ur, rtl) + Setup + Students list + Admission form + Student profile (fees/attendance tabs as placeholders).
Accept: admitting 1 student + 2 guardians creates exactly 3 persons, 2 links, 1 enrollment, audit rows; search by Arabic-keyboard spelling finds Urdu-keyboard name; 20 parallel admissions → unique numbers.

### §T5 Attendance (budget ~100k)
API: GET section day (effective statuses, default P), POST idempotent (`ON CONFLICT (id) DO NOTHING`, only changed statuses inserted, multi-row insert); past `attendanceLockDays` → create `approval_request` instead; month register endpoint.
Web: keyboard grid with localStorage draft; mobile layout; month register print CSS (A4 landscape, 8 pt).
Accept: same POST ×3 → events once; P then A → view shows A, both rows kept; 5-day-old edit → pending approval.

## Day 2

### §T6 Fees: setup, charges, statement, payments, receipts (budget ~200k)
API: fee CRUD; `postCharges(period)` for active enrollments with `joined_on ≤ period`, applying plan discounts, idempotent via unique index; run on boot + daily 07:00 (`@nestjs/schedule`) for current period; statement with running balance (window fn); payment allocation oldest period first then head.priority, leftover → `ADV`; receipt + entries in one tx; receipt number from counter.
Web: fee setup grid; fee collection screen (§7); receipt print page (80 mm: `@page{size:80mm auto;margin:0}`; A4: two copies + cut line; amount in words; Urdu names).
Accept (jest e2e): post-charges ×3 → once; pay Rs 7,000 vs 3 × Rs 3,000 → 2 months cleared, Rs 2,000 due; 20 parallel payments → unique receipt numbers.

### §T7 Discounts, approvals, reversal, cash close (budget ~120k)
API: discount → `adjust` entry if ≤ threshold else `approval_request`; approvals approve/reject executes stored action in the owning service in one tx and re-validates first; reversal (always approval) writes `reversal` entries with `reverses_id`; receipt shows CANCELLED; cash close (system cash total for date vs counted; once per date; blocks back-dated cash payments to closed dates).
Web: discount dialog on statement; Approvals inbox; reverse button on receipt; Cash close screen.
Accept: Blueprint §6.2 scenario reproduces exactly (charges +3,500 → payment −3,000 → waiver −500 → reversal +3,000 → balance 3,000); second reversal of same payment fails; second close of same date fails.

### §T8 Principal dashboard, users, audit, settings (budget ~90k)
API: `/dashboard` returns today collection by method, month collected vs expected, collection % by class, today attendance % by class, absentees, defaulters count+amount, pending approvals, last cash close diff — cached 60 s, invalidated on payment/attendance save; users CRUD + roles + reset (disable kills sessions); audit search with readable summaries; settings edit (audited).
Web: Dashboard (cards row; bars by class; 30-day attendance line; approvals list; mobile single column; charts lazy-loaded); Users & roles; Audit; Settings; Defaulters list (print).
Accept: dashboard < 300 ms with seed-demo data; disabling a user logs them out at once.

### §T9 UI polish and Urdu pass (budget ~80k)
Steps: consistent shadcn styling (one theme file), empty states, loading skeletons, toasts (sonner), form errors from Zod, all labels in en/ur JSON (no hard-coded strings), RTL check on every page, print pages in Urdu.
Accept: switching to Urdu mirrors every page with no overflow; no untranslated string found by `grep` for raw text in JSX.

### §T10 Demo seed, production build, backup script (budget ~70k)
Steps: `seed-demo`: 300 students over classes 1–5, 2 months charges, ~70% paid, 10 days attendance, 2 pending approvals; production: `nest build` + `vite build`, API serves `apps/web/dist` via serve-static (exclude `/api`, SPA fallback to `index.html`), listen `0.0.0.0:8080`; `scripts/backup.ps1` (`pg_dump -Fc` to `backups/` with date, keep 14) + `scripts/start.ps1`.
Accept: `pnpm build && pnpm --filter api start:prod` → phone on same Wi-Fi opens `http://<pc-ip>:8080`, logs in, marks attendance; backup file restores with `pg_restore --list`.

---

### §T11 One-click Windows installer (added 2026-10-26, human decision Z8)
Steps: Inno Setup installer bundling Node (LTS), PostgreSQL 18 binaries, the built app (production deps, no symlinks) and WinSW; setup script creates the cluster (own port, random passwords, settings readable only by Administrators/SYSTEM), DB + app Windows services (auto start, restart on crash), firewall rule, daily backup task (keep 14, optional USB copy), desktop icon (Edge app window), first-login sheet; upgrade keeps data; uninstall keeps data. GitHub Actions builds the .exe and smoke-tests it on Windows; CI runs `pnpm verify` on every push.
Accept: on a clean Windows machine a silent install with demo data serves the app and API, both services Automatic, killing the app restarts it, a backup file exists and lists with pg_restore, upgrade keeps the data, uninstall removes services and keeps data.

## §X Not in the 2-day build (do not start)
Inno Setup installer and Windows services, restore wizard, status page, licensing, Excel import, exams/results, teacher accounts, parent notifications, sync/hosted mode, old-PC power-cut test, field visits, pilot. These follow `School Management System — Build Runbook` Days 11–13 and 44–85.

## §Y Day schedule (human)
- Day 1: T1 (1 h) · T2 (1.5 h) · T3 (2 h) · T4 (3 h) · T5 (2 h) · human review of screens (1 h)
- Day 2: T6 (3.5 h) · T7 (2 h) · T8 (2 h) · T9 (1.5 h) · T10 (1 h) · full demo run-through (1 h)
- Total agent budget ≈ 1.06M tokens (approximate). Human checks each Accept block and the new `docs/progress/T<n>.md` before starting the next task.
- Starting fresh after a break: open a new session and say `Continue.` — the agent reads `docs/STATUS.md` and picks up the next task.

## §Z Human decisions (binding; added after T6, 2026-10-25)
- Z1 Principal's own discounts/reversals apply immediately (no approval request); still audited. Clerk's still need approval. → T7
- Z2 Fee plans above `discountThresholdPaisa` (per month) go to approval like one-off discounts (`fees.discount` approval action, same inbox and approve/reject flow); principal's apply directly (Z1). → T7
- Z3 Admission form: "find existing guardian" (search name/phone/CNIC) links the new student to that guardian so siblings work. → T7
- Z4 Student profile Attendance tab: year attendance % + P/A/L/V counts + per-month list. → T8
- Z5 Promote page: from-section → to-section, students listed and all ticked; untick to keep behind; one tx via POST /enrollments/promote. → T9 (no exams module, so pass/fail is chosen by hand)
- Z6 Promotion with unpaid fees: students with balance > 0 need approval (`students.promote`) when the clerk promotes; others move at once; principal's promotions apply directly (Z1). On every promotion the old enrollment's open (period, head) amounts move to the new enrollment as paired `adjust` entries (−X old "Carried forward to …", +X new "Carried forward from …"), so arrears show and are paid oldest-first. → T7
- Z7 Dashboard enrollment summary: active students total, per class and section, boys/girls (gender not set counted apart), joined this month (first-ever enrollment only, so promotions don't count) and left this month. → T8
- Z8 Schools get a one-click Windows installer (double-click → icon, starts with Windows, automatic backups); no commands on school PCs. Code lives in a private GitHub repo that builds the installer. → T11
