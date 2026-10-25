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

## T5 Attendance
- [ ] Attendance (sidebar): pick a section and today. Banner says "Not saved yet"; all show Present
- [ ] Click the first row, then press A, L, Space: statuses change, "N unsaved changes" shows. Ctrl+S → "Attendance saved"; reload → still there
- [ ] Press Ctrl+S again with no changes → "No changes to save"
- [ ] Change one student, then reload WITHOUT saving → "Unsaved changes restored" and the change is still shown
- [ ] Pick a date 5+ days ago: yellow "older than 3 days" banner. Change one and save → "Sent to the principal for approval". The grid keeps the old value; then as principal: Approvals → Approve → reload the grid → new value shown
- [ ] Attendance register: this month's letters and P/A/L/V totals match what you saved; Print → A4 landscape, table only
- [ ] Urdu: grid buttons show ح غ ر ت and the layout mirrors
- [ ] Phone on the same Wi-Fi: run `pnpm dev:web --host`, open the "Network" address it prints, log in, mark attendance with the big buttons
- [ ] Switch user to `clerk`: Attendance and register are visible, Setup is not

## T6 Fees
- [ ] Fee setup: grid shows Tuition 3000 / Exam 500 per class. Change one amount, Ctrl+Enter, reload → kept
- [ ] Fee setup: add a head (e.g. TRN Transport, priority 30) → new grid column; the ADV row has no delete button
- [ ] Fee setup → Post charges for the current month → "N charges posted"; pressing again posts 0
- [ ] Fee collection: type a name, ↓ then Enter → dues show, amount is filled in and focused
- [ ] Ctrl+Enter → print dialog opens with the receipt; after it, the cursor is back in the search box
- [ ] Receipt 80 mm: one narrow page, English + Urdu names, amount in words, balance after. A4 (choose "A4 (2 copies)"): office + parent copy with a cut line
- [ ] Pay more than the dues → the extra shows as "Advance (credit)"
- [ ] Two students with the same guardian (admit the second one with "Find existing guardian", see T7) → siblings appear on the collection screen
- [ ] Student profile → Fees tab: statement with running balance; receipt numbers open the receipt
- [ ] Urdu: collection and setup screens mirror correctly

## T7 Approvals, discounts, cancellations, cash close
First run `pnpm --filter api db:migrate` (new migration).
- [ ] As clerk: New admission → guardian row → "Find existing guardian" → search a father's name → pick → the new child shows that father's other children
- [ ] Fee collection for that child: "Siblings" lists the brother/sister with their balance
- [ ] As clerk: Discount ≤ Rs 1,000 → "Discount applied" at once; Discount > Rs 1,000 → "sent to the principal"
- [ ] As clerk: open a receipt → "Cancel receipt" + reason → "Sent to the principal"
- [ ] Clerk sidebar has no Approvals and no Setup
- [ ] Switch to principal: sidebar "Approvals" shows a red count. Approve the discount → dues drop. Approve the cancellation → receipt shows CANCELLED, balance goes back up
- [ ] Reject a request with a reason → it moves to the Rejected tab with the reason
- [ ] As principal: Discount > Rs 1,000 applies at once (no request)
- [ ] Cash close for YESTERDAY: system total shown → enter counted → difference shown; closing again is not possible. (Closing TODAY blocks cash payments for the rest of today — only do that at end of day)
- [ ] Urdu: Approvals and Cash close mirror correctly

## T8 Dashboard, users, audit, settings
- [ ] Log in as principal → lands on Dashboard: cards (collected today, this month, attendance, owing, approvals, cash close diff, students with boys/girls and joined/left)
- [ ] Take a payment in Fee collection, go back to Dashboard → "Collected today" includes it at once
- [ ] Charts: fee % and attendance % by class, 30-day attendance line. Urdu: mirrored, labels readable. Phone width: one column
- [ ] Defaulters: class filter and "owing at least N months" work; click a name → fee collection; Print → table only with school name
- [ ] Student profile → Attendance tab: % and P/A/L/V counts, one row per month
- [ ] Users & roles → Add user (role Clerk) → log in as them in another browser/phone → as principal untick "Account active" + save → the other browser is logged out on its next click
- [ ] Users: reset that user's password; your own account can't be disabled
- [ ] Settings: change attendance lock days, Ctrl+Enter → Audit log (filter "School & settings") shows "Settings: lock days 3 → …". Change it back
- [ ] Audit log: filters by user/area/date; click a line → details
- [ ] As clerk: no Users, Audit, Settings in the sidebar; Dashboard and Defaulters visible

## Windows PC
See docs/WINDOWS_TEST.md (separate guide for the Windows tester; round 1 now (covers T4–T8), round 2 after T10).
