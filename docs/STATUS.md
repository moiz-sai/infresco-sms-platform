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
- Windows PC run not done yet → docs/CHECKLIST.md "Windows PC"
- Duplicate old specs: requirements/SMS_AGENT_SPEC.md, docs/SMS_AGENT_SPEC (1).md → delete (docs/SPEC.md is canonical)
## How to run
- api: pnpm --filter api start:dev · web: pnpm --filter web dev
- db: pnpm --filter api db:migrate · seed: pnpm --filter api db:seed
- gate: pnpm verify (must pass before every commit)
- login: principal / clerk · password Admin@123 · PIN 1234
