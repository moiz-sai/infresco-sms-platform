# STATUS
Updated: 2026-10-26 01:30 · Last task: T10 Demo seed, production build, backup script · Result: DONE
## Done
- T1 ✔  T2 ✔  T3 ✔  T4 ✔  T5 ✔  T6 ✔  T7 ✔  T8 ✔  T9 ✔  T10 ✔  (+ SPEC §Z1–Z7)
## Next
- Task: none left in SPEC. Windows test rounds 1+2 → docs/WINDOWS_TEST.md, then the demo run-through (SPEC §Y)
- Before starting: human runs the Windows rounds; reports go to docs/STATUS.md Open issues
## Read next
- docs/progress/T10.md
- docs/progress/T9.md
## Open issues
- docs/USER_MANUAL.md: user manual for staff (added on request, beyond SPEC §1.8); update it when behaviour changes
- Windows rounds 1 and 2 not run yet → docs/WINDOWS_TEST.md
- Checklist: 3 items need a real phone / print dialog / clerk promote by hand → docs/CHECKLIST.md
## How to run
- dev: pnpm dev:api + pnpm dev:web (phones: --host) → http://localhost:5173
- school PC: scripts\start.cmd (or scripts/start.ps1) → http://localhost:8080 and the printed phone address
- db: pnpm --filter api db:migrate · seed: db:seed · demo data: db:seed-demo · backup: scripts\backup.cmd
- gate: pnpm verify (must pass before every commit)
- login: principal / clerk · password Admin@123 · PIN 1234
