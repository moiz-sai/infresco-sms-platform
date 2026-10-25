# STATUS
Updated: 2026-10-25 22:00 · Last task: T7 Discounts, approvals, reversal, cash close · Result: DONE
## Done
- T1 ✔  T2 ✔  T3 ✔  T4 ✔  T5 ✔  T6 ✔  T7 ✔  (+ SPEC §Z1, Z2, Z3, Z6)
## Next
- Task: T8 Principal dashboard, users, audit, settings (+ SPEC §Z4 attendance % on profile)
- Before starting: human ticks T7 in docs/CHECKLIST.md; decide Z7 (enrollment summary on dashboard) — see Open issues
## Read next
- docs/progress/T7.md
- docs/progress/T6.md
## Open issues
- Enrollment summary on the dashboard (totals by class/section, boys/girls, joined/left this month) proposed as Z7 → human to confirm before T8
- Windows test round 1 due (now covers T4–T7: students, attendance, fees, receipts, approvals) → docs/WINDOWS_TEST.md
## How to run
- api: pnpm dev:api · web: pnpm dev:web (phones: pnpm dev:web --host) → http://localhost:5173
- db: pnpm --filter api db:migrate (needed after pulling T7: migration 0003) · seed: pnpm --filter api db:seed
- gate: pnpm verify (must pass before every commit)
- login: principal / clerk · password Admin@123 · PIN 1234
