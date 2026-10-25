# STATUS
Updated: 2026-10-25 16:00 · Last task: T5 Attendance · Result: DONE
## Done
- T1 ✔  T2 ✔  T3 ✔  T4 ✔  T5 ✔
## Next
- Task: T6 Fees: setup, charges, statement, payments, receipts
- Before starting: human ticks T4 + T5 in docs/CHECKLIST.md; Windows round 1 can run now (docs/WINDOWS_TEST.md)
## Read next
- docs/progress/T5.md
- docs/progress/T4.md
## Open issues
- Yearly/once fee charge period undecided → T6
- Principal's own discounts/reversals: apply directly or create a request too? → ask human before T7
- Windows test round 1 due now → docs/WINDOWS_TEST.md
## How to run
- api: pnpm dev:api · web: pnpm dev:web (phones: pnpm dev:web --host) → http://localhost:5173
- db: pnpm --filter api db:migrate · seed: pnpm --filter api db:seed
- gate: pnpm verify (must pass before every commit)
- login: principal / clerk · password Admin@123 · PIN 1234
