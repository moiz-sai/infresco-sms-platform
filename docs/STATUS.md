# STATUS
Updated: 2026-11-01 20:30 · Last task: T14 Backups, restore, reset · Result: DONE
## Done
- T1–T11 ✔  T12 ✔ (roles editor)  T13 ✔ (developer/license/branding)  T14 ✔ (backups/restore/reset)  (+ SPEC §Z1–Z16)
## Next
- Task: T15 Staff (staff_profile, employee numbers, profiles)
- Before starting: none
## Read next
- docs/progress/T14.md
- docs/progress/T13.md
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
