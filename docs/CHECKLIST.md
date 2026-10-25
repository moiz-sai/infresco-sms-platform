# Manual checks

Things `pnpm verify` cannot test automatically (screens, printing, phones, Windows).
Status 2026-10-25: the agent ran every item below in headless Firefox and ticked what passed; the two unticked items need a real phone / print dialog.
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
- [x] Login as `principal`: sidebar shows Students, New admission, Setup. A wrong password shows an error message
- [x] Urdu button: the whole page mirrors (sidebar on the right, Urdu labels, Naskh font). Reload the page: it stays Urdu
- [x] Setup → School: change the Urdu name, save with Ctrl+Enter; the sidebar shows the new name in Urdu mode
- [x] Setup → Academic years: add 2027-28; "Make current" moves the badge (move it back to 2026-27 afterwards)
- [x] Setup → Classes: add a class and a section; deleting Class 1 shows an "in use" error
- [x] New admission: student + 2 guardians, pick class and section, Ctrl+Enter → green toast with D1-… number → profile opens
- [x] Students: type an Urdu name in search; the class/section/status filters work; ↓ from search, then ↓/↑ and Enter opens a profile
- [x] Profile: Edit → change phone → Ctrl+Enter saves. "Mark as left" → student appears only under the "Left" status filter
- [x] Switch user (header) → `clerk` / PIN `1234`: name in header changes, Setup disappears from the sidebar

## T5 Attendance
- [x] Attendance (sidebar): pick a section and today. Banner says "Not saved yet"; all show Present
- [x] Click the first row, then press A, L, Space: statuses change, "N unsaved changes" shows. Ctrl+S → "Attendance saved"; reload → still there
- [x] Press Ctrl+S again with no changes → "No changes to save"
- [x] Change one student, then reload WITHOUT saving → "Unsaved changes restored" and the change is still shown
- [x] Pick a date 5+ days ago: yellow "older than 3 days" banner. Change one and save → "Sent to the principal for approval". The grid keeps the old value; then as principal: Approvals → Approve → reload the grid → new value shown
- [x] Attendance register: this month's letters and P/A/L/V totals match what you saved; Print → A4 landscape, table only
- [x] Urdu: grid buttons show ح غ ر ت and the layout mirrors
- [ ] Phone on the same Wi-Fi: run `pnpm dev:web --host`, open the "Network" address it prints, log in, mark attendance with the big buttons (agent: phone-width layout and big buttons checked headless; a real phone is still needed)
- [x] Switch user to `clerk`: Attendance and register are visible, Setup is not

## T6 Fees
- [x] Fee setup: grid shows Tuition 3000 / Exam 500 per class. Change one amount, Ctrl+Enter, reload → kept
- [x] Fee setup: add a head (e.g. TRN Transport, priority 30) → new grid column; the ADV row has no delete button
- [x] Fee setup → Post charges for the current month → "N charges posted"; pressing again posts 0
- [x] Fee collection: type a name, ↓ then Enter → dues show, amount is filled in and focused
- [ ] Ctrl+Enter → print dialog opens with the receipt; after it, the cursor is back in the search box (agent: save, print() call and refocus checked headless; the real print dialog still needs a human)
- [x] Receipt 80 mm: one narrow page, English + Urdu names, amount in words, balance after. A4 (choose "A4 (2 copies)"): office + parent copy with a cut line
- [x] Pay more than the dues → the extra shows as "Advance (credit)"
- [x] Two students with the same guardian (admit the second one with "Find existing guardian", see T7) → siblings appear on the collection screen
- [x] Student profile → Fees tab: statement with running balance; receipt numbers open the receipt
- [x] Urdu: collection and setup screens mirror correctly

## T7 Approvals, discounts, cancellations, cash close
First run `pnpm --filter api db:migrate` (new migration).
- [x] As clerk: New admission → guardian row → "Find existing guardian" → search a father's name → pick → the new child shows that father's other children
- [x] Fee collection for that child: "Siblings" lists the brother/sister with their balance
- [x] As clerk: Discount ≤ Rs 1,000 → "Discount applied" at once; Discount > Rs 1,000 → "sent to the principal"
- [x] As clerk: open a receipt → "Cancel receipt" + reason → "Sent to the principal"
- [x] Clerk sidebar has no Approvals and no Setup
- [x] Switch to principal: sidebar "Approvals" shows a red count. Approve the discount → dues drop. Approve the cancellation → receipt shows CANCELLED, balance goes back up
- [x] Reject a request with a reason → it moves to the Rejected tab with the reason
- [x] As principal: Discount > Rs 1,000 applies at once (no request)
- [x] Cash close for YESTERDAY: system total shown → enter counted → difference shown; closing again is not possible. (Closing TODAY blocks cash payments for the rest of today — only do that at end of day)
- [x] Urdu: Approvals and Cash close mirror correctly

## T8 Dashboard, users, audit, settings
- [x] Log in as principal → lands on Dashboard: cards (collected today, this month, attendance, owing, approvals, cash close diff, students with boys/girls and joined/left)
- [x] Take a payment in Fee collection, go back to Dashboard → "Collected today" includes it at once
- [x] Charts: fee % and attendance % by class, 30-day attendance line. Urdu: mirrored, labels readable. Phone width: one column
- [x] Defaulters: class filter and "owing at least N months" work; click a name → fee collection; Print → table only with school name
- [x] Student profile → Attendance tab: % and P/A/L/V counts, one row per month
- [x] Users & roles → Add user (role Clerk) → log in as them in another browser/phone → as principal untick "Account active" + save → the other browser is logged out on its next click
- [x] Users: reset that user's password; your own account can't be disabled
- [x] Settings: change attendance lock days, Ctrl+Enter → Audit log (filter "School & settings") shows "Settings: lock days 3 → …". Change it back
- [x] Audit log: filters by user/area/date; click a line → details
- [x] As clerk: no Users, Audit, Settings in the sidebar; Dashboard and Defaulters visible

## T9 Urdu pass, polish, promote page (agent-checked headless, ticked)
- [x] Wrong password shows "Wrong username or password"; wrong PIN shows an error and keeps you logged in
- [x] Urdu: every page mirrors, nothing sticks out sideways (PC and phone width)
- [x] Urdu: form errors are Urdu (e.g. empty admission → "لازمی"); API errors are Urdu
- [x] Urdu: audit log lines and dates are Urdu
- [x] Urdu receipt: amount in Urdu words, Urdu class name, "-Rs" amounts read correctly
- [x] Urdu prints: register (A4 landscape) and defaulters list
- [ ] Promote: pick from-section and to-section → everyone ticked, owing amounts in red; untick → only ticked students move (clerk + owing students → Approvals is covered by the automated Z6 test; try it once by hand)

## T10 Demo data, production start, backups
- [x] `pnpm --filter api db:seed-demo` → 300 students, receipts, attendance, 2 pending approvals; a second run does nothing (agent, on the test DB)
- [x] Production build served by the API: phone-size browser at http://<PC IP>:<port> → login → attendance → Save (agent, headless)
- [x] Every page fits a 390 px phone screen with demo data, English and Urdu (agent; fixed attendance/promote overflow)
- [x] backup.ps1 → file in backups/, only the newest N kept; restore.ps1 lists it and restores into a new database; refuses the live one (agent, pwsh on Linux)
- [ ] On your PC: run `pnpm --filter api db:seed-demo` on sms_dev, then `pwsh scripts/start.ps1` or the Windows `start.cmd`, and click through the demo as principal

## Windows PC
See docs/WINDOWS_TEST.md (separate guide for the Windows tester; rounds 1 and 2 are both due now).
