# Infresco developer profile

A hidden maintenance console for the **Infresco team only**. The school never sees it: no menu
link, no user account, not in Users or Audit. It is reached only by its address and opened only
with a code signed by Infresco's private key.

Use it for: **license**, **branding** (school name, logo, footer, address, phone), and — from T14 —
**backups, restore and data reset**.

---

## How access works (why it is safe)

It is a two-device handshake. The app shows a one-time **code**; only a holder of Infresco's
**private key** can turn that code into a valid **signature**. The school PC never holds the private
key, so school staff can open the page but can never unlock it.

- The code is **single-use** and expires in **10 minutes**.
- A successful unlock lasts **4 hours**, then you unlock again.
- Every action (unlock, license, branding, backup, restore, reset) is written to `developer_log`.
- The trust anchor is the Ed25519 **public key** compiled into the app
  (`apps/api/src/developer/keys.ts`). The matching **private key is never in the repo**.

---

## Where the private key lives

`scripts/dev-sign.mjs` signs with the private key stored at:

```
~/.config/infresco/dev-key.json        # or the path in $INFRESCO_DEV_KEY
```

The file is `{ "alg": "Ed25519", "x": "...", "d": "..." }` (JWK). **Keep it secret and off every
school PC.** Anyone with it can unlock developer mode; anyone without it cannot.

Rotate or create a key pair:

```
node scripts/dev-sign.mjs keygen
```

It prints the new **public** key (add it to `BUILT_IN` in `keys.ts` and rebuild) and the **private**
key (save it to the path above). Extra public keys can also be trusted at runtime without a rebuild
via the `SMS_DEV_PUBLIC_KEYS` env var (comma-separated), which is how the tests inject a key.

---

## Getting in — step by step

**1. Open the hidden page.** Add `/_infresco` to the app address:

| Where | Address |
| --- | --- |
| Dev (`pnpm dev:web` running) | `http://localhost:5173/_infresco` |
| Production build on this PC | `http://localhost:8080/_infresco` |
| Installed Windows app | the address the desktop icon opens, with `/_infresco` added |

**2. Click "Get an unlock code"** and copy the code it shows.

**3. Sign it** on the machine that has the private key:

```
node scripts/dev-sign.mjs unlock "<paste the code>"
```

**4. Paste the signature** back into the page and click **Unlock**. You are in for 4 hours.
"Lock now" ends the session immediately.

---

## License

The installation starts on a **14-day trial**. After that, or after an expired/invalid license, the
system is **hard-locked**: nobody can log in (HTTP 423) until a valid license is entered. Only the
login page, branding and the developer console stay reachable so you can fix it. Admins see an
"expiring soon" banner for the last 30 days.

Issue a license (the install ID is shown on the developer page):

```
node scripts/dev-sign.mjs license <installId> "School Name" 2027-12-31
# optional 4th arg: comma-separated optional modules, e.g. staff,payroll,expenses
```

Paste the printed `license` and `signature` into the **License** panel → **Apply**. A license is
bound to one install ID; a license for another install is refused.

---

## Branding

In the **Branding** panel set the school **name** (English + Urdu), **logo** (PNG/JPEG/WebP ≤ 300 KB),
**footer** (English + Urdu), **address** and **phone**. These are **developer-only**: the principal's
Setup → School tab is read-only.

They appear automatically on the **login page, the sidebar, and every printout** (receipt,
attendance register, defaulters list), and the footer shows on **every screen and every print**.

---

## Backups, restore, reset

Columns for the backup location and schedule already exist on the `installation` row. The in-app
automatic backup, the restore picker and the module/whole data reset land in **T14**; until then the
Windows installer's daily backup task is what runs.

---

## Quick reference

| Action | Command / place |
| --- | --- |
| Open console | browser → `…/_infresco` |
| Sign unlock code | `node scripts/dev-sign.mjs unlock "<code>"` |
| New key pair | `node scripts/dev-sign.mjs keygen` |
| Issue license | `node scripts/dev-sign.mjs license <installId> "<school>" <YYYY-MM-DD> [mods]` |
| Private key | `~/.config/infresco/dev-key.json` (never commit) |
| Public key(s) | `apps/api/src/developer/keys.ts`, or `SMS_DEV_PUBLIC_KEYS` env |
| Audit trail | `developer_log` table |
