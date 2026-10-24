# Manual checks

Things `pnpm verify` cannot test automatically (screens, printing, phones, Windows).
How to use:
- After each task, the agent adds the new task's items here, unticked.
- At each human review you do every unticked item and tick it: `- [ ]` → `- [x]`.
- If an item fails, leave it unticked and add ` ✗ <what you saw>`. Then tell the agent, or add it under "Open issues" in docs/STATUS.md.
- If a later task changes an area, the agent unticks that area's items so you check them again.

## T1–T3 (API only, no screens yet)
- [ ] `pnpm dev:api` and `pnpm dev:web` both start without errors
- [ ] Browser: http://localhost:5173/api/health shows `{"status":"ok"}`
- [ ] Browser: http://localhost:5173/api/auth/me shows `{"code":"UNAUTHENTICATED",...}`

## Windows PC (before the demo)
- [ ] `pnpm install` succeeds (incl. `@node-rs/argon2` prebuilt binary)
- [ ] Create `apps/api/.env` and `.env.test` from the `.example` files, then `pnpm verify` passes
