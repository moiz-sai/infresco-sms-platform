# STATUS
Updated: 2026-10-24 20:00 · Last task: T3 Auth, RBAC, PIN switch, audit · Result: DONE
## Done
- T1 ✔  T2 ✔  T3 ✔
## Next
- Task: T4 Setup, students, search
- Before starting: none
## Read next
- docs/progress/T3.md
- docs/progress/T2.md
## Open issues
- Yearly/once fee charge period undecided → T6
- Windows test round 1 due after T5 → docs/WINDOWS_TEST.md (refine Round 1 list at end of T5)
## How to run
- api: pnpm --filter api start:dev · web: pnpm --filter web dev
- db: pnpm --filter api db:migrate · seed: pnpm --filter api db:seed
- gate: pnpm verify (must pass before every commit)
- login: principal / clerk · password Admin@123 · PIN 1234
