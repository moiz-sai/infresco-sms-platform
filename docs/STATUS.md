# STATUS
Updated: 2026-10-25 23:30 · Last task: T8 Principal dashboard, users, audit, settings · Result: DONE
## Done
- T1 ✔  T2 ✔  T3 ✔  T4 ✔  T5 ✔  T6 ✔  T7 ✔  T8 ✔  (+ SPEC §Z1–Z4, Z6, Z7)
## Next
- Task: T9 UI polish and Urdu pass (+ SPEC §Z5 promote page)
- Before starting: human ticks T8 in docs/CHECKLIST.md
## Read next
- docs/progress/T8.md
- docs/progress/T7.md
## Open issues
- Windows test round 1 due (covers T4–T8) → docs/WINDOWS_TEST.md
## How to run
- api: pnpm dev:api · web: pnpm dev:web (phones: pnpm dev:web --host) → http://localhost:5173
- db: pnpm --filter api db:migrate · seed: pnpm --filter api db:seed (T8 adds no migration)
- gate: pnpm verify (must pass before every commit)
- login: principal / clerk · password Admin@123 · PIN 1234
