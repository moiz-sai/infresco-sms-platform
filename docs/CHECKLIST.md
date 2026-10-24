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

## Windows PC (repeat after T5 and T10)
Setup, once (PowerShell):
1. Install Git, Node 26 LTS (or 24), PostgreSQL 18 (remember the `postgres` password; keep port 5432), then `npm i -g pnpm`
2. Create the databases: `& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE DATABASE sms_dev" -c "CREATE DATABASE sms_test"`
3. Get the repo (clone or unzip), `cd` into it, `pnpm install`
4. Copy `apps/api/.env.example` → `apps/api/.env` and `apps/api/.env.test.example` → `apps/api/.env.test`. In both files:
   - `DATABASE_ADMIN_URL` = `postgres://postgres:<postgres password>@localhost:5432/sms_dev` (`sms_test` in .env.test)
   - `DATABASE_URL` = `postgres://sms_app:<any new password>@localhost:5432/sms_dev` (`sms_test` in .env.test). Use the same password in both files
   - `SESSION_SECRET` = 32+ random characters: `-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | % {[char]$_})`
5. `pnpm --filter api db:migrate` then `pnpm --filter api db:seed`

Checks:
- [ ] `pnpm install` succeeds with no errors (incl. `@node-rs/argon2` prebuilt binary)
- [ ] `pnpm verify` ends with `verify passed`
- [ ] `pnpm dev:api` + `pnpm dev:web`; browser http://localhost:5173/api/health shows `{"status":"ok"}`
- [ ] Windows Firewall prompt for Node appears on first `dev:api` → allow on **Private** networks
- [ ] Phone on the same Wi-Fi opens `http://<PC IPv4 from ipconfig>:8080/api/health` and sees `{"status":"ok"}`
