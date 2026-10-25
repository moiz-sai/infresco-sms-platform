# STATUS
Updated: 2026-10-25 18:00 · Last task: T6 Fees · Result: DONE
## Done
- T1 ✔  T2 ✔  T3 ✔  T4 ✔  T5 ✔  T6 ✔
## Next
- Task: T7 Discounts, approvals, reversal, cash close
- Before starting: human answers the open "principal's own actions" question below; ticks T6 in docs/CHECKLIST.md
## Read next
- docs/progress/T6.md
- docs/progress/T5.md
## Open issues
- Principal's own discounts/reversals: apply directly or create a request too? → human decides before T7
- Fee plans bypass the discount threshold → decide in T7
- Windows test round 1 due → docs/WINDOWS_TEST.md
## How to run
- api: pnpm dev:api · web: pnpm dev:web (phones: pnpm dev:web --host) → http://localhost:5173
- db: pnpm --filter api db:migrate · seed: pnpm --filter api db:seed
- gate: pnpm verify (must pass before every commit)
- login: principal / clerk · password Admin@123 · PIN 1234
