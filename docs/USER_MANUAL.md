# Infresco SMS — User Manual

For everyone who will use, demo or support the school office system: principals, clerks, and team members who need to understand how it behaves. It describes the system as built (after T10, 2026-10-26).

**How to read this manual**
- Section 1 explains the two roles and what each can do.
- Sections 2–12 cover one area each: what it is for, the steps, and an **"If… then…"** table of rules and edge cases.
- Section 13 is a one-page daily and yearly routine. Section 14 lists what the system does **not** do yet.

---

## 1. Roles: who can do what

There are two built-in roles. A user can hold one or both.

| Area | Clerk | Principal |
|---|---|---|
| Dashboard | ✔ (sees the same numbers, money included) | ✔ |
| Students: list, profile, admission, edit, mark as left, promote | ✔ | ✔ |
| Attendance: mark, register | ✔ | ✔ |
| Fee setup (fee amounts, fee heads, post charges) | ✔ | ✔ |
| Fee collection, receipts, cash close, defaulters | ✔ | ✔ |
| Discounts | ✔ up to the limit (default Rs 1,000); bigger ones go for approval | ✔ any amount, applied at once |
| Cancel a receipt | Sends a request | ✔ applied at once |
| Change attendance older than 3 days | Sends a request | Sends a request too (the principal then approves it) |
| Promote students who owe fees | Those students go for approval; the rest move at once | ✔ all move at once |
| Approvals inbox | ✘ | ✔ |
| Setup (school details, years, classes, sections) | ✘ | ✔ |
| Settings (lock days, discount limit) | ✘ | ✔ |
| Users & roles | ✘ | ✔ |
| Audit log | ✘ | ✔ |

**The golden rule:** a clerk can do the daily work. Anything that reduces money owed (big discounts, cancelled receipts), rewrites old records (old attendance), or moves a student who still owes fees **waits for the principal**. Whatever the principal does directly is still recorded in the audit log.

> The sidebar shows only what your role allows. If you type the address of a page you are not allowed to see, it says "Page not found".

---

## 2. Signing in, switching user, language

### Sign in
1. On the office PC, double-click the **Infresco SMS** icon on the desktop. On a phone (same Wi-Fi), open the **Phones:** address from the first-login sheet; tip: "Add to Home screen" gives the phone an icon too.
2. Enter your username and password and press **Enter**.
3. The principal and clerk land on the **Dashboard**.

### Switch user (shared office PC)
Click **Switch user** at the top, type the other person's username and their **PIN** (4–6 digits). The screen continues as that person, and everything afterwards is recorded under their name.

### Language
The **اردو / English** button at the top switches the whole screen. Urdu mirrors the page right-to-left. The choice is remembered **per device**, so each PC or phone keeps its own.

### If… then…
| If… | Then… |
|---|---|
| The password is wrong | "Wrong username or password" |
| The password is wrong **5 times** | The account is locked for **5 minutes** ("Too many wrong passwords") |
| The PIN is wrong in Switch user | "Wrong username or PIN"; **you stay signed in** as yourself |
| The PIN is wrong **5 times within 10 minutes** | PIN switching is blocked for that user until they sign in with their **password** |
| The account was disabled by the principal | Sign-in says "This account is disabled"; anyone already signed in is logged out on their next click |
| **12 hours** have passed since you signed in | You must sign in again (even if you were using it) |
| You forget your password | Only the principal can reset it (Users & roles). There is no "forgot password" link |

---

## 3. Dashboard

What the cards mean:

| Card | Meaning |
|---|---|
| Collected today | Receipts taken today by method (cash/bank/online). Cancelled receipts are not counted |
| Collected in YYYY-MM | Fees paid **for this month's fees** out of what was billed for this month (discounts are subtracted from billed). Advance payments are not counted |
| Attendance today | Present ÷ (Present + Absent + Leave) for students marked today. Vacation is not counted. "—" means nobody has marked today |
| Students owing fees | Active students with a balance above zero, and the total they owe → click for the Defaulters list |
| Pending approvals | Requests waiting for the principal → click to open Approvals |
| Last cash close difference | Counted minus system for the most recently closed day. **Red** means it did not match |
| Students | Active students this year: boys/girls, joined this month (new admissions only, not promotions), left this month. Below it: students per class and section |

The charts show fee collection by class this month, attendance today by class, and the last 30 days of attendance.

### If… then…
| If… | Then… |
|---|---|
| Someone takes a payment or saves attendance | The dashboard shows it immediately (refresh, or wait up to 60 s) |
| No attendance was marked today (e.g. Sunday) | Attendance card shows "—" and the class chart is empty |
| More than 50 students are absent | The absent list shows the first 50; the count is the full number |

---

## 4. Students

### Admit a student (New admission)
1. Enter the **student** details. **Name (English)** and **Gender** are required; the Urdu name, father's name, date of birth, B-Form, phone and address are optional.
2. Add the **guardians**:
   - **New guardian:** type the name, phone and CNIC, and pick the relation.
   - **Brother or sister already in school:** click **Find existing guardian**, search by name, phone or CNIC, and pick the guardian. It shows "Children: …". This links the children as **siblings**, which show up at fee collection.
3. Choose the **class and section**, and optionally a roll number and joining date (default today).
4. Press **Ctrl+Enter** or **Save**. A green message gives the admission number (e.g. `D1-000301`) and the profile opens.

### Find a student (Students)
Type part of a name, the father's name, the admission number or the phone number. Urdu works too, whether typed with an Urdu or an Arabic keyboard. Filter by class, section and status (Active / Left / Promoted). Press **↓** to go into the list, and **Enter** to open a profile.

### Profile
The tabs are Details, Guardians, History (enrollments over the years), **Attendance** (this year's %, P/A/L/V counts, one row per month) and **Fees** (statement with running balance, discount button, collect button).

- **Edit:** change the student's own details and press Ctrl+Enter.
- **Mark as left:** choose the **first day the student is away** and a reason.

### If… then…
| If… | Then… |
|---|---|
| Name or gender is missing | "Required" under the field; nothing is saved |
| A student is marked as left | They disappear from Active lists, attendance from that date, and future fee charges. **What they owe stays owed** (visible on their profile) |
| A left student comes back | There is no "re-join" button: admit them again (they get a new admission number) |
| Two children share a guardian | Both show each other as **siblings** at fee collection, with each one's balance |
| You need to change a guardian's phone after admission | Not possible on screen yet (see Section 14) |
| Two people admit at the same moment | Each still gets a unique admission number |

---

## 5. Attendance

### Mark the day (Attendance)
1. Pick the **class & section** and the **date** (default today). Unmarked days show everyone as **Present** with a "Not saved yet" banner.
2. **PC keyboard:** click the first row, then press **P / A / L / V** (Present/Absent/Leave/Vacation). The cursor moves to the next student by itself. **Space** toggles Present/Absent; **↑ ↓** move.
3. **Phone:** tap the big **P / A** buttons.
4. **Ctrl+S** or **Save**. Only changed students are saved; the banner disappears.

### Monthly register
Pick a section and month: it shows every day's letter and P/A/L/V totals per student. **Print** gives A4 landscape with only the table.

### If… then…
| If… | Then… |
|---|---|
| You press Save with no changes | "No changes to save" |
| The page is closed or reloaded before saving | The changes are kept **on that device**; next time you get "Unsaved changes restored" |
| The date is in the future | Not allowed |
| The date is **older than 3 days** (Setting) | Yellow banner. Saving sends the changes **to the principal** — for **everyone, including the principal**. The grid keeps the old value until it is approved |
| The old-date request is approved | The new statuses apply; the record shows who asked and who approved |
| Two people mark the same section at once (PC and phone) | Both are kept; the **later** save wins per student. Nothing is lost or duplicated |
| A student joined after that date, or left before it | They are not on that day's list |
| An Urdu keyboard is active on the PC | P/A/L/V keys still work |

---

## 6. Fee setup

The principal or clerk can use this page.

- **Fee heads:** Tuition (TUI), Exam (EXM) and Advance (ADV) come built in. Add others (e.g. Transport, code TRN). The **priority** decides which fee a payment clears first within the same month (a lower number is cleared first).
- **Class grid:** the amount for each class × head, and how often it is charged (**monthly**, **yearly** = once per year, **once** = only on first admission). Change cells and press Ctrl+Enter. An empty cell means no fee.
- **Post charges:** creates the fee charges for a month. **This also happens automatically** when the app starts and every morning at 07:00 for the current month, so you normally do not need it.

### If… then…
| If… | Then… |
|---|---|
| Post charges is pressed twice (or the automatic run repeats) | Nothing is charged twice; it says "0 charges posted" |
| A fee amount is changed mid-month | Charges already posted keep the old amount; the next months use the new amount |
| You try to delete or rename ADV | Not allowed (it holds advance payments) |
| You delete a head or class that is already used | "In use — it cannot be deleted" |
| A student joins mid-year | They get charges from the month they joined; yearly heads once, the first time |
| A student has a fee plan (fixed discount every month) | The plan is applied inside each charge. **Plans can only be set by the developer for now** (no screen) |

---

## 7. Fee collection and receipts

### Take a payment (fastest flow)
1. **Fee collection**: the cursor is already in the search box. Type a name or admission number, press **↓**, then **Enter**.
2. Dues are listed month by month, with **siblings** and their balances below. The amount is filled in with the total due, and the cursor is in it.
3. Change the amount if the parent pays less or more. Pick **Cash / Bank / Online** and the receipt size (**80 mm** or **A4 (2 copies)**, remembered per PC).
4. Press **Ctrl+Enter**. It saves, prints the receipt, and puts the cursor back in search for the next parent.

### How a payment is split
The **oldest month is paid first**; within a month, fees are paid by head priority (Tuition, then Exam…). Anything paid **beyond all dues** becomes **Advance (credit)**.

### The receipt
It shows the school name in English and Urdu, the receipt number (`D1-2026-000123`), date, student (both names), class, father, the lines paid, the total, the **amount in words** (Urdu words when the screen is in Urdu), the method, the **balance after this payment**, and who received it. A4 prints an office copy and a parent copy with a cut line. Open any old receipt from the student's Fees tab to **reprint** it.

### If… then…
| If… | Then… |
|---|---|
| The parent pays less than the dues | The oldest fees are cleared first; the rest stays due |
| The parent pays more than the dues | The extra is shown as **Advance (credit)** and lowers the total balance. It is **not automatically** used for next month's charge; next month shows the charge and the credit side by side |
| Today's cash is already closed | **Cash** payments are refused ("Today's cash is closed — record it as bank/online or tomorrow"); bank/online still work |
| Two clerks take payments at the same second | Each gets a unique receipt number |
| A payment was taken by mistake | It cannot be edited or deleted. **Cancel the receipt** (Section 9) and take it again |
| The printer is off | The payment is still saved; reprint later from the student's Fees tab |

---

## 8. Discounts

Open **Discount** from fee collection or the profile's Fees tab. Choose the fee line (month + head), the amount and a reason (required).

### If… then…
| If… | Then… |
|---|---|
| The clerk gives a discount **≤ the limit** (default Rs 1,000) | Applied at once: "Discount applied" |
| The clerk gives a discount **above the limit** | "Sent to the principal for approval"; nothing changes until approved |
| The principal gives any discount | Applied at once (recorded in the audit log) |
| The discount is more than that fee line's due | Refused: "Discount is more than the amount due" |
| The parent paid that fee before the principal approved | Approval fails with "The amount due has changed"; reject the request and give a new one if still needed |
| The same request is sent twice while pending | Only one request is kept |

---

## 9. Cancelling a receipt

Open the receipt (Fees tab → receipt number) → **Cancel receipt** → reason.

| If… | Then… |
|---|---|
| A clerk cancels | "Sent to the principal"; the receipt stays valid until approved |
| The principal cancels (or approves) | The receipt shows a red **CANCELLED** stamp, the money goes back onto the student's dues, and it is removed from cash totals |
| Someone tries to cancel it again | "This receipt is already cancelled" |
| The receipt's day was already cash-closed | It can still be cancelled; the closed figure for that day does not change (the close is final) |

---

## 10. Cash close (end of day)

**Cash close** → pick the date (default today). It shows the **system cash total** (cash receipts that day, minus cancelled ones) and the number of receipts. Count the drawer, type the amount, and press **Close cash**. The **difference** (counted − system) is shown, in red if it is not zero.

| If… | Then… |
|---|---|
| You close **today** | No more **cash** payments can be taken today. Do it at the very end of the day |
| You try to close the same date again | Not possible; it shows who closed it and when |
| The date is in the future | Not allowed |
| You forgot to close yesterday | Pick yesterday's date and close it now |

---

## 11. Approvals (principal only)

The sidebar **Approvals** shows a red number when requests are waiting. The tabs are Pending / Approved / Rejected. Each card shows what was asked, by whom, when, and the reason.

Request types:
- **Discount** above the limit;
- **Cancel receipt**;
- **Old attendance change**;
- **Promotion** of students who owe fees.

| If… | Then… |
|---|---|
| **Approve** | The action is done now, exactly as requested, after re-checking it still makes sense |
| The situation changed since the request (fee already paid, receipt already cancelled…) | Approval fails with a message; nothing half-done. Reject it instead |
| **Reject** | A reason is required; the clerk can see it in the Rejected tab |
| Someone already decided it (e.g. on another PC) | "This request was already decided" |

---

## 12. Other principal tools

### Defaulters
Active students of this year who owe money. Filter by class and by **owing at least N months**. Click a name to go to fee collection; **Print** gives a clean A4 list.
*Note: students who have left are not on this list, even if they still owe.*

### Promote students (end of year)
1. **Before promoting:** in **Setup**, create the new academic year and its sections (e.g. 2027-28, Class 2 A/B…).
2. **Promote**: pick **From** (this year's section), the **target year**, and the **target section**.
3. Everyone is ticked. Untick students who **stay in the same class**. Students owing fees show "owes Rs …" in red.
4. Press **Promote** (Ctrl+Enter).

| If… | Then… |
|---|---|
| The principal promotes | All ticked students move at once |
| The clerk promotes and some ticked students owe fees | Students with no dues move at once; the owing ones go to the principal as **one** request ("3 promoted · 2 waiting for approval") |
| A student owes fees when promoted | Their unpaid fees are **carried forward** to the new class, still in the original months, so they are paid first |
| From and To are the same section | "Choose a different section" |
| A student was already moved or left | That student is refused; nothing is half-done |

After promoting everyone: **Setup → Academic years → Make current** on the new year, then fill in the **Fee setup** grid for the new year.

### Users & roles
- **Add user:** username (3–32 lowercase letters/digits), name, password (8+ characters), PIN (4–6 digits), and at least one role.
- **Edit:** name, roles, **Account active**, reset the password and/or PIN, delete.

| If… | Then… |
|---|---|
| You untick **Account active** | That person is logged out **immediately** on every device |
| You delete a user | They cannot log in again; their name stays on old records; the username cannot be reused |
| You try to disable or delete **yourself**, or remove your own user-management role | Not allowed (so the school is never locked out) |
| You change someone's role | It applies on their next click |
| A user is locked after wrong passwords | Reset their password, which also unlocks them |

### Audit log
Every change is listed: who, when, and a readable line, e.g. "Payment Rs 3,500 (cash), receipt D1-2026-000045" or "Discount Rs 1,500 for 2026-10: …". It also records sign-ins, failed sign-ins and wrong PINs. Filter by user, area (Students, Receipts, Fee entries, Approvals, Users…) and dates. Click a line to see the exact before/after values. **Nothing in the audit log can be changed or deleted, not even by the principal.**

### Settings
- **Attendance lock (days)**, default 3: attendance older than this needs approval.
- **Discount limit for the clerk (Rs)**, default 1,000: bigger discounts and fee plans need approval.

Every change is recorded in the audit log.

### Setup
- **School:** names (English/Urdu), address and phone, as printed on receipts.
- **Academic years:** add a year; exactly one is **current**.
- **Classes & sections:** used items cannot be deleted.

---

## 13. Routines

**Every morning**
1. Turn on the office PC. The system starts by itself in the background (nothing to click). Double-click the desktop icon when you need it.
2. Teachers or the clerk mark attendance (phone or PC).

**During the day:** admissions, fee collection, discounts.

**End of day**
1. **Cash close** for today.
2. The principal clears **Approvals**.
3. Backups are automatic every day at 2 pm (or later if the PC was off), kept 14 days in `C:\ProgramData\InfrescoSMS\backups`. For an off-PC copy, keep a USB stick with a folder named `InfrescoSMS-Backups` plugged in: each backup is copied there too.

**Month start:** charges post themselves at 07:00. Check **Defaulters** and print the list if needed.

**Year end**
1. Create next year + sections.
2. Promote each section.
3. Make the new year current.
4. Set the fee grid for the new year.

**If the PC breaks:** install Infresco SMS on the new PC with the installer, then ask support to restore the newest backup from the USB stick.

---

## 13a. Installing on a school PC (support team)

1. Run `InfrescoSMS-Setup-<version>.exe` on the office PC (Windows 10/11, 64-bit). Click **Yes** to the Windows permission prompt; if a blue "Windows protected your PC" box appears, **More info → Run anyway**.
2. Leave **Load demo data** **unticked** for a real school.
3. At the end, the **first-login sheet** opens. It has the principal and clerk passwords and PINs (random for a real school) and the phone address. Log in, change the passwords (Users & roles), then delete the sheet (`C:\ProgramData\InfrescoSMS\first-login.txt`).
4. **Setup:** school name and address, classes and sections, then **Fee setup**.

| What the installer sets up | Where / how |
|---|---|
| Program | `C:\Program Files\Infresco SMS` (Node and PostgreSQL included; no internet needed) |
| Data, settings, backups, logs | `C:\ProgramData\InfrescoSMS` |
| Two Windows services | "Infresco SMS" + "InfrescoSMS-DB": start with Windows, restart themselves if they crash |
| Firewall | Port 8080 opened for phones |
| Daily backup | Task "Infresco SMS daily backup", 2 pm, keeps 14 |

| If… | Then… |
|---|---|
| You run the installer again (a newer version) | It updates the program; data, passwords and settings are kept |
| You uninstall | The program and services are removed; **the school's data stays** in `C:\ProgramData\InfrescoSMS`, and reinstalling picks it up again |
| Port 8080 is already used by something else on that PC | The installer picks the next free port; the desktop icon and first-login sheet use the right one |
| The desktop icon says "not answering yet" | The PC has just started: wait a minute. Still failing → restart the PC → still failing → send `C:\ProgramData\InfrescoSMS\logs` to support |

---

## 14. Not available yet (known limits)

| Missing | Workaround today |
|---|---|
| Editing a guardian (phone/CNIC) after admission | Ask the developer |
| Fee plan screen (permanent monthly discount for a student) | Developer sets it; or give a discount each month |
| Users changing their own password; "forgot password" | Principal resets it |
| Re-joining a student who left | New admission |
| Using advance credit against new charges automatically | It shows as credit and lowers the balance; nothing to do |
| Back-dated payments (money collected while the PC was off) | Enter it now; the receipt date is today |
| Clerk restrictions on fee amounts | The clerk **can** change fee amounts and post charges (as specified). Every change is in the audit log |
| Teacher accounts limited to their own section | Roles are school-wide only on screen |
| Exams/results, timetable, staff salaries, SMS/WhatsApp to parents, Excel export, importing existing student lists | Not part of this version |
| Internet/cloud access | Works on the school's Wi-Fi only (by design, offline) |
