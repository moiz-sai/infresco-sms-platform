# Windows test guide

For the person testing Infresco SMS on a Windows PC. Follow it top to bottom; you don't need to read any other project file.
Do **Part 1 once**. For each **test round**, do Part 2, then that round's checks in Part 3, then report back with Part 4.

| Round | When | What gets tested |
|---|---|---|
| 1 | Now (after T8) | Install, login, students, attendance from a phone, fee collection and receipts, approvals, dashboard |
| 2 | After T10 | Production build, receipt printing, backups (before the demo) |

---

## Part 1 — One-time setup (about 45 min)

1. Install (default options are fine):
   - Git: https://git-scm.com/download/win
   - Node.js 26 LTS (24 also works): https://nodejs.org
   - PostgreSQL 18: https://www.postgresql.org/download/windows/. Write down the password you set for the `postgres` user and keep port 5432. Skip Stack Builder at the end.
2. Open **PowerShell** (not as admin) and install pnpm:
   ```powershell
   npm i -g pnpm
   ```
3. Create the two databases (enter the `postgres` password when asked):
   ```powershell
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE DATABASE sms_dev" -c "CREATE DATABASE sms_test"
   ```
4. Get the code (the developer will tell you which one applies):
   ```powershell
   git clone <repo URL> infresco-sms      # GitHub
   git clone sms.bundle infresco-sms      # bundle file
   cd infresco-sms
   ```
5. Create the settings files:
   ```powershell
   Copy-Item apps\api\.env.example apps\api\.env
   Copy-Item apps\api\.env.test.example apps\api\.env.test
   ```
   Open both files in Notepad and change these lines (use `sms_dev` in `.env`, `sms_test` in `.env.test`):
   - `DATABASE_ADMIN_URL=postgres://postgres:<postgres password>@localhost:5432/sms_dev`
   - `DATABASE_URL=postgres://sms_app:<invent a password>@localhost:5432/sms_dev`. Use the **same** invented password in both files.
   - `SESSION_SECRET=` followed by 40 random characters. Generate them with:
     ```powershell
     -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | % {[char]$_})
     ```
   If a password contains `@ : / ? #`, choose another one. Those characters break the URL.

## Part 2 — Start of every round: get the latest code and set it up

```powershell
cd infresco-sms
git pull                                  # or re-clone from a new bundle
pnpm install
pnpm --filter api db:migrate
pnpm --filter api db:seed
pnpm verify
```
`pnpm verify` takes about 30 s. It must end with `verify passed`. If it shows `✗`, stop and report (Part 4).

Then start the app in **two** PowerShell windows, both inside `infresco-sms`:
```powershell
pnpm dev:api      # window 1 — wait for "Nest application successfully started"
pnpm dev:web --host   # window 2 — wait for "Local: http://localhost:5173/" and a "Network:" line
```
The first time, Windows Firewall asks about Node.js. Tick **Private networks** and click Allow.

Logins: `principal` or `clerk`, password `Admin@123`, PIN `1234`.

## Part 3 — Test rounds

### Round 1 (after T8)
Base
- [ ] `pnpm install` finishes without red errors
- [ ] `pnpm verify` ends with `verify passed`
- [ ] Browser http://localhost:5173/api/health shows `{"status":"ok"}`

Screens on the PC (browser: Edge or Chrome, http://localhost:5173)
- [ ] Log in as `principal`. Then type a wrong password 5× for `clerk`: the 6th try says the account is locked
- [ ] Urdu button: the page mirrors right-to-left and the Urdu text is readable (not boxes or question marks)
- [ ] New admission: student with an Urdu name + 2 guardians, choose class/section, press **Ctrl+Enter** → green message with an admission number
- [ ] Students: type part of that Urdu name in search → the student is found
- [ ] Attendance: click the first student row, then press **A**, **L**, **Space** on the keyboard → statuses change; **Ctrl+S** saves (the browser must NOT open a "Save page" dialog)
- [ ] Switch the Windows keyboard to Urdu (if installed) and repeat: the **P/A/L/V** keys still work
- [ ] Attendance register → **Print**: the print preview shows A4 **landscape** with only the table (no sidebar)

Fees and approvals on the PC
- [ ] Fee collection: type a student's name, press **↓** then **Enter** → dues show and the amount box is filled in
- [ ] Press **Ctrl+Enter** → the Windows print dialog opens with the receipt. In the preview, "Receipt 80 mm" is one narrow page; switch the receipt format to **A4 (2 copies)**, pay again → one A4 page with two copies and a cut line. (Cancel the dialog or "Microsoft Print to PDF" is fine; a real 80 mm printer is round 2)
- [ ] The Urdu name on the receipt is readable (not boxes)
- [ ] Switch user to `clerk` (PIN `1234`): give a discount above Rs 1,000 → "sent to the principal"
- [ ] Switch back to `principal`: **Approvals** shows a red count → Approve → the student's dues drop
- [ ] **Dashboard** opens after login with numbers and charts; **Defaulters → Print** shows an A4 table with no sidebar
- [ ] Phone: the Dashboard shows one card per row, no sideways scrolling

Phone (same Wi-Fi as the PC)
- [ ] Run `ipconfig` and note the PC's **IPv4 Address** (e.g. 192.168.1.20)
- [ ] Phone browser opens `http://<IPv4>:8080/api/health` → `{"status":"ok"}`
- [ ] Phone browser opens `http://<IPv4>:5173` → login page; log in as `clerk`
- [ ] Phone: Attendance → tap the big P/A buttons → **Save** at the bottom → "Attendance saved"
- [ ] The PC's Attendance page (same section and date, after reload) shows the phone's changes

### Round 2 (after T10, before the demo)
Filled in when T10 is done: production build + start script, phone access to the built app, 80 mm and A4 receipt printing, backup and restore script.

## Part 4 — Reporting

For every unticked or failing item, send the developer:
1. The round and the item text
2. What you did and what you saw instead (a screenshot of the screen or PowerShell window)
3. For command failures, the **last 40 lines** of output:
   ```powershell
   pnpm verify 2>&1 | Select-Object -Last 40
   ```
4. Your Windows version (`winver`) and `node --version`

When the round is done, send this file back with your ticks (`- [x]`) and notes.

### Common problems
| Symptom | Fix |
|---|---|
| `pnpm` is not recognized | Close and reopen PowerShell after `npm i -g pnpm` |
| `psql` is not recognized | Use the full path from Part 1 step 3 |
| `password authentication failed` | The password in `.env`/`.env.test` doesn't match. Check the `postgres` password in `DATABASE_ADMIN_URL` |
| `address already in use :8080` | An old window is still running the API. Close it, or restart the PC |
| Phone can't connect | Same Wi-Fi? Firewall allowed on Private? In Windows Settings, the Wi-Fi network must be set to **Private**, not Public |
