# Manual checks

Things `pnpm verify` cannot test automatically (screens, printing, phones, Windows).
How to use:
- After each task, the agent adds the new task's items here, unticked.
- At each human review you do every unticked item and tick it: `- [ ]` → `- [x]`.
- If an item fails, leave it unticked and add ` ✗ <what you saw>`. Then tell the agent, or add it under "Open issues" in docs/STATUS.md.
- If a later task changes an area, the agent unticks that area's items so you check them again.

## T1–T3 (API only, no screens yet)
- [x] `pnpm dev:api` and `pnpm dev:web` both start without errors
- [x] Browser: http://localhost:5173/api/health shows `{"status":"ok"}`
- [x] Browser: http://localhost:5173/api/auth/me shows `{"code":"UNAUTHENTICATED",...}`

## T4 Setup, students, search
Start: `pnpm dev:api` + `pnpm dev:web`, open http://localhost:5173
- [ ] Login as `principal`: sidebar shows Students, New admission, Setup. A wrong password shows an error message
- [ ] Urdu button: the whole page mirrors (sidebar on the right, Urdu labels, Naskh font). Reload the page: it stays Urdu
- [ ] Setup → School: change the Urdu name, save with Ctrl+Enter; the sidebar shows the new name in Urdu mode
- [ ] Setup → Academic years: add 2027-28; "Make current" moves the badge (move it back to 2026-27 afterwards)
- [ ] Setup → Classes: add a class and a section; deleting Class 1 shows an "in use" error
- [ ] New admission: student + 2 guardians, pick class and section, Ctrl+Enter → green toast with D1-… number → profile opens
- [ ] Students: type an Urdu name in search; the class/section/status filters work; ↓ from search, then ↓/↑ and Enter opens a profile
- [ ] Profile: Edit → change phone → Ctrl+Enter saves. "Mark as left" → student appears only under the "Left" status filter
- [ ] Switch user (header) → `clerk` / PIN `1234`: name in header changes, Setup disappears from the sidebar

## Windows PC
See docs/WINDOWS_TEST.md (separate guide for the Windows tester; round 1 after T5, round 2 after T10).
