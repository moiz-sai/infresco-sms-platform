# STATUS
Updated: 2026-10-25 13:00 · Last task: T4 Setup, students, search · Result: DONE
## Done
- T1 ✔  T2 ✔  T3 ✔  T4 ✔
## Next
- Task: T5 Attendance
- Before starting: human ticks the T4 section of docs/CHECKLIST.md
## Read next
- docs/progress/T4.md
- docs/progress/T3.md
## Open issues
- Yearly/once fee charge period undecided → T6
- Windows test round 1 due after T5 → docs/WINDOWS_TEST.md (refine Round 1 list at end of T5)
## How to run
- api: pnpm dev:api · web: pnpm dev:web → http://localhost:5173
- db: pnpm --filter api db:migrate · seed: pnpm --filter api db:seed
- gate: pnpm verify (must pass before every commit)
- login: principal / clerk · password Admin@123 · PIN 1234
