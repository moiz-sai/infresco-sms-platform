# Windows test guide

For the person testing Infresco SMS on a Windows PC. You need **one file** (`InfrescoSMS-Setup-….exe`) and about 30 minutes. No programming tools and no typing of commands.

What you are testing is exactly what a school will get: double-click the installer, then use the desktop icon.

---

## Before you start

- **PC:** Windows 10 or 11, 64-bit, with about 2 GB free disk space.
- **Phone:** any phone on the **same Wi-Fi** as the PC (for the phone checks).
- **Printers:** if available, an 80 mm receipt printer and/or an A4 printer.
- **Installer:** the developer sends `InfrescoSMS-Setup-<version>.exe` (about 85 MB) by link or USB. Save it in Downloads.

---

## Part 1: Install (about 5 minutes)

1. Double-click `InfrescoSMS-Setup-….exe`.
2. **"Windows protected your PC"** (blue box): click **More info → Run anyway**. This appears because the installer is not code-signed yet.
3. **"Do you want to allow this app to make changes?"**: **Yes**.
4. **Next**, keep the folder, **Next**.
5. On **Select Additional Tasks**, tick **Load demo data (300 sample students)**. This is for testing only; a real school leaves it unticked.
6. **Install**. Wait 1–4 minutes while it says "Setting up the database and services…". Don't close it.
7. At the end, keep both boxes ticked and click **Finish**:
   - **Open Infresco SMS now**: the system opens in its own window.
   - **Show the first-login sheet**: Notepad opens with the usernames, passwords and phone address.

**Logins with demo data:** `principal` or `clerk`, password `Admin@123`, PIN `1234`.

### Install checks
- [ ] The installer finished without an error message
- [ ] A blue **Infresco SMS** icon (graduation cap) is on the desktop
- [ ] The system opened by itself in its own window (no browser tabs), on the login screen
- [ ] The first-login sheet opened in Notepad and shows a **Phones:** address like `http://192.168.x.x:8080`

If the installer shows **"Setup could not finish"**: send the developer the file it names, `C:\ProgramData\InfrescoSMS\logs\install.log`.

---

## Part 2: Use it (about 15 minutes)

### On the PC
- [ ] Close the window. Double-click the desktop icon → it opens again within a few seconds
- [ ] Log in as `principal`. The Dashboard shows about 298 students, numbers and charts
- [ ] **اردو** button: the whole page mirrors right-to-left and the Urdu is readable (no boxes or ?)
- [ ] **New admission**: a student with an Urdu name and a guardian → **Ctrl+Enter** → green message with an admission number
- [ ] **Students**: type part of that Urdu name → found
- [ ] **Attendance**: pick a class, click the first row, press **A**, **L**, **Space** → statuses change; **Ctrl+S** → "Attendance saved" (no "Save page" dialog)
- [ ] If an Urdu keyboard is installed, switch to it: the **P/A/L/V** keys still work
- [ ] **Switch user** → `clerk`, PIN `1234` → the name at the top changes
- [ ] As clerk, **Fee collection**: type a name, **↓**, **Enter** → **Ctrl+Enter** → the Windows print dialog opens with the receipt
- [ ] As clerk, give a **Discount** of Rs 1,500 → "sent to the principal"
- [ ] Switch to `principal` → **Approvals** shows a red number → **Approve**

### Printing (with real printers if you have them)
- [ ] **80 mm receipt printer**: one narrow receipt, nothing cut off, Urdu name readable
- [ ] Receipt format **A4 (2 copies)**, pay again → one A4 page with office copy + parent copy and a cut line
- [ ] In Urdu mode, print a receipt → labels and the amount in words are Urdu
- [ ] **Attendance register → Print** → A4 landscape, table only. **Defaulters → Print** → table only

### Phone (same Wi-Fi)
- [ ] Open the **Phones:** address from the first-login sheet (`C:\ProgramData\InfrescoSMS\first-login.txt`) → login page
- [ ] Log in as `clerk` → **Attendance** → choose a class → tap the big **P/A** buttons → **Save** → "Attendance saved". Nothing is cut off at the sides
- [ ] Switch to **اردو** on the phone → page mirrors and fits the screen
- [ ] On the PC, the same class and date (reload) shows the phone's changes

If the phone can't connect: the PC and phone must be on the same Wi-Fi. Some routers block devices from seeing each other ("AP/client isolation"); try a home router or phone hotspot.

---

## Part 3: Restart and backups (about 10 minutes)

- [ ] **Restart the PC.** After logging into Windows, **don't open anything**, wait 1 minute, double-click the icon → the system opens and everything you entered is still there
- [ ] Open the folder `C:\ProgramData\InfrescoSMS\backups` → there is at least one `sms-<date>.dump` file (one is made at install, then every day at 2 pm, or later if the PC was off)
- [ ] Optional USB copy: on a USB stick create a folder named `InfrescoSMS-Backups`, leave it plugged in. Next daily backup also appears there
- [ ] Run the installer **again** (as if updating), untick demo data → Finish → the system still has all the data
- [ ] **Settings → Apps → Infresco SMS → Uninstall** → the icon disappears. Then install again (demo box unticked) → your earlier data is still there (the data is kept on purpose)

---

## Part 4: Reporting

For every unticked or failing item, send the developer:
1. The item text
2. What you did and what you saw (a photo or screenshot)
3. These files from `C:\ProgramData\InfrescoSMS\logs`: `install.log`, `InfrescoSMS-App.err.log`, `InfrescoSMS-App.out.log`
4. Your Windows version (press **Win+R**, type `winver`, Enter)

When done, send this file back with your ticks (`- [x]`) and notes.

### Common problems
| Symptom | What to do |
|---|---|
| "Windows protected your PC" | **More info → Run anyway** (unsigned installer) |
| Antivirus blocks or deletes the installer | Allow it once in the antivirus, or temporarily pause it during install. Tell the developer which antivirus |
| Icon says "Infresco SMS is not answering yet" | Right after starting Windows, wait one minute and try again. Still failing → restart the PC; still failing → send the logs |
| The window opens in a normal browser tab | Microsoft Edge is missing or blocked; it still works in the browser |
| Phone can't connect | Same Wi-Fi? Router client isolation? Try a phone hotspot |
| Forgot a password | Log in as `principal` → **Users & roles** → Edit → reset |
