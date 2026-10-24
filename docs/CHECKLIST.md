# Manual checks

Things `pnpm verify` cannot automate. Tick at each human review; untick if a later task touches the area.

## T1–T2
- [ ] `pnpm dev:api` + `pnpm dev:web` start; `http://localhost:5173/api/health` shows `{"status":"ok"}`

## Windows PC (before demo)
- [ ] `pnpm install` succeeds (incl. `@node-rs/argon2` prebuilt binary)
- [ ] `pnpm verify` passes
