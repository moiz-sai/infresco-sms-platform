# STATUS
Updated: 2026-10-26 01:00 · Last task: T11 One-click Windows installer · Result: DONE
## Done
- T1 ✔  T2 ✔  T3 ✔  T4 ✔  T5 ✔  T6 ✔  T7 ✔  T8 ✔  T9 ✔  T10 ✔  T11 ✔  (+ SPEC §Z1–Z8)
## Next
- Task: Windows test on a real PC with the installer → docs/WINDOWS_TEST.md; then the demo run-through
- Before starting: download InfrescoSMS-Setup .exe (GitHub Actions artifact or v* Release) and send it to the tester
## Read next
- docs/progress/T11.md
- docs/progress/T10.md
## Open issues
- Real-PC Windows test not run yet (CI Windows smoke test passes) → docs/WINDOWS_TEST.md
- Installer unsigned (SmartScreen warning) → buy a code-signing certificate before selling
- Checklist: 4 items need a real phone / print dialog / clerk promote / your own click-through → docs/CHECKLIST.md
- docs/USER_MANUAL.md: staff manual (added on request, beyond SPEC §1.8); keep it updated when behaviour changes
## How to run
- dev: pnpm dev:api + pnpm dev:web (phones: --host) → http://localhost:5173 · prod on this PC: pnpm build; cd apps/api; node dist/main.js → :8080
- Windows/school: InfrescoSMS-Setup .exe → desktop icon (no commands)
- CI: GitHub Actions on every push (CI = pnpm verify; Windows installer = build + install test)
- gate: pnpm verify (must pass before every commit)
- login (dev/demo): principal / clerk · password Admin@123 · PIN 1234
