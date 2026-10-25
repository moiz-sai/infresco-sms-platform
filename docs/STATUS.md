# STATUS
Updated: 2026-10-26 00:45 · Last task: T9 UI polish and Urdu pass (+ Z5 promote page) · Result: DONE
## Done
- T1 ✔  T2 ✔  T3 ✔  T4 ✔  T5 ✔  T6 ✔  T7 ✔  T8 ✔  T9 ✔  (+ SPEC §Z1–Z7)
## Next
- Task: T10 Demo seed, production build, backup script (then Windows round 2)
- Before starting: none
## Read next
- docs/progress/T9.md
- docs/progress/T8.md
## Open issues
- Windows test round 1 due (covers T4–T9) → docs/WINDOWS_TEST.md
- Checklist: 2 items need a real phone / print dialog → docs/CHECKLIST.md
## How to run
- api: pnpm dev:api · web: pnpm dev:web (phones: pnpm dev:web --host) → http://localhost:5173
- db: pnpm --filter api db:migrate · seed: pnpm --filter api db:seed (T9 adds no migration)
- gate: pnpm verify (must pass before every commit; includes the i18n check)
- login: principal / clerk · password Admin@123 · PIN 1234
