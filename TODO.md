# TODO — Go-Live Checklist

> **Last updated:** 2026-05-07 · **Maintainer:** abhinav@chainflux.com
> Pair this with `HANDOFF.md` (what's been built) and `.env.example` (every env var).

---

## 🟢 STATUS SNAPSHOT (2026-05-07)

| Surface | State |
|---|---|
| Tests | ✅ 264/264 passing across 20 files |
| Type-check | ✅ `tsc --noEmit` exit 0 |
| Migrations 001–006 | ✅ Applied to Supabase project `znmerxpukimtugwtfysy` |
| `companies`, `agents`, `messaging_users`, base tables | ✅ Bootstrapped via `scripts/init-base-schema.ts` |
| `employees`, `timesheet_submissions`, `reminder_schedules` | ✅ Migration applied + JAA seeded |
| Shopify Editor (`/admin/shopify`) | ✅ Live-verified plan/apply/rollback against `zizrev-ej.myshopify.com` |
| Shopify Insights | ✅ Live (Claude returns category-aware suggestions in ~45s) |
| Telegram timesheet bot (`@timesheettrial_bot`) | ✅ Live, all 7 keyword paths verified |
| Telegram webhook handler | ✅ Verified end-to-end (link / DONE / HELP / start) |
| Reminder schedule UI + DB | ✅ Daily 5pm IST default, edit / pause / resume |
| Admin UI: toasts, send burst, button animations | ✅ Shipped |
| Onboarding bug (no companies row created) | ✅ Fixed via `POST /api/companies` |
| Workspace inline rename | ✅ `PATCH /api/companies/[id]` + sidebar inline edit |
| Working tree | ⚠ **Uncommitted since `74b2e50`** — task #6 below |
| Production deploy | ❌ Not started |
| Telegram webhook registration | ❌ Needs ngrok or production URL |
| Cron schedule (Railway / Vercel) | ❌ Not configured |

---

## 🚨 SECURITY — DO BEFORE PROD

These were exposed in the chat transcript during setup. Rotate before any production use.

- [ ] **Supabase database password** — Settings → Database → Reset password → update `DATABASE_URL` in `.env.local`. Pooler URL embeds the password, so all places that reference it need to be re-pasted. *(Original value is in `.env.local` only; rotate before any prod use.)*
- [ ] **Shopify API secret** (`shpss_***`) — Develop apps → custom app → API credentials → reset secret.
- [ ] **Shopify Client ID + Secret in `.env.local`** — both are still the originals; rotate after the rotate above.
- [ ] **Telegram bot token** — `@BotFather` → `/revoke` → get new token → update `.env.local` and re-register webhook with new token. *(Current token lives in `.env.local` and was exposed during setup; treat as compromised.)*
- [ ] **Decide whether to keep legacy password references** in any backups / docs / commit history. If you commit the working tree, scrub first.

---

## 🟦 PRE-DEMO (do before tomorrow's client meetings)

### Browser spot-check (10 min, must do)
- [ ] Open `http://localhost:3007/admin` in a regular Chrome window (no incognito needed)
- [ ] One-time: DevTools → Application → Service Workers → **Unregister** any worker for `localhost:3007`, then Application → Storage → **Clear site data**, then `Cmd+Shift+R`
- [ ] Confirm sidebar shows 9 nav items (Overview, Agents, Timesheets, Shopify Editor, Approvals, Notifications, Vault, Integrations, Provisioning)
- [ ] Confirm sidebar workspace pill says **"Abhinav's Workspace"** (or whatever you've renamed it to)
- [ ] `/admin/shopify` — header reads "shop.getsoma.store · Shopify Editor"
- [ ] Click **Get competitor insights** → confirm cards render after ~45s
- [ ] Click **Use this prompt** on a HIGH-priority suggestion → prompt fills the editor textarea → Plan → Apply → confirm SendBurst fires
- [ ] Open `https://admin.shopify.com/store/zizrev-ej/products` → confirm change landed (or run `bun run scripts/shopify-tags.ts`)
- [ ] `/admin/timesheets` — confirm Schedule card shows "Daily at 5:00 PM" + roster shows Girish + 🗑 / 🔄 icons on row
- [ ] Click **Mark submitted** on Girish → confirm toast + status pill flips green
- [ ] Click 🔄 reset on Girish → confirm pill flips back to Outstanding

### Tabs to pre-open before each client meeting
- `http://localhost:3007/admin/shopify` (for getsoma)
- `http://localhost:3007/admin/timesheets` (for JAA)
- `https://admin.shopify.com/store/zizrev-ej/products` (Shopify side proof)
- Telegram desktop with `@timesheettrial_bot` chat ready (for JAA)
- A terminal running `tail -f /tmp/admin-dev.log` (catch 500s instantly if anything errors mid-demo)

### Optional but high-impact
- [ ] Rename workspace via the inline edit to match the audience: "Soma Pilot" for getsoma meeting, "JAA Pilot" for JAA meeting
- [ ] Re-run `bun run scripts/shopify-e2e.ts` once before each demo to confirm token still valid (24h expiry on the cached `shpat_…`)

---

## 🟧 POST-DEMO / GO-LIVE

### From you · 5–10 min each

- [ ] **Commit the working tree** (264-test diff has been sitting since `74b2e50`). Recommend ~6–8 logical commits:
  1. `feat(db): bootstrap base schema script + migrations 005-006`
  2. `feat(timesheets): Telegram reminder vertical (DB + cron + webhook + admin UI)`
  3. `feat(shopify): editor + planner + apply + insights against live store`
  4. `feat(admin): toast system + send burst + workspace rename + sidebar polish`
  5. `fix(onboarding): create companies row on final step (was orphaning users at /admin)`
  6. `chore(dev): service-worker disable on localhost + extension-error filter`
- [ ] **Rotate all secrets** (security section above)
- [ ] **Deploy to Railway**:
  - Connect repo → main branch
  - Paste every `.env.local` key into Railway env (use `.env.example` as the checklist)
  - Flip Clerk to production keys (`pk_live_…` / `sk_live_…`)
  - Set `NEXT_PUBLIC_APP_URL` and `APP_BASE_URL` to `https://theautonomous.org`
- [ ] **Register Telegram webhook against production URL** (one-shot curl):
  ```bash
  TOKEN="<TELEGRAM_BOT_TOKEN>"
  SECRET="<TELEGRAM_WEBHOOK_SECRET>"
  curl -X POST "https://api.telegram.org/bot$TOKEN/setWebhook" \
    -H "Content-Type: application/json" \
    -d "{\"url\":\"https://theautonomous.org/api/messaging/telegram\",\"secret_token\":\"$SECRET\"}"
  ```
- [ ] **Set up Railway cron** for `/api/cron/timesheet-reminders`:
  - Schedule: `0 17 * * *` (daily 17:00 UTC; use `30 11 * * *` for 17:00 IST since Railway crons run UTC)
  - Command: `curl "$APP_BASE_URL/api/cron/timesheet-reminders?token=$CRON_SECRET"`
  - First-run smoke: trigger manually from Railway UI, watch the logs for the run summary

### Open code work (defer if not blocking)

- [ ] **Tighten the topbar** — remove any leftover mock data, ensure user info is real
- [ ] **Mobile responsive sweep** of `/admin/*` (sidebar is `hidden lg:flex` — would 404 visual on tablet)
- [ ] **Telegram: per-firm bot tokens** — current code uses one global bot. When a second firm signs up, they'll share `@timesheettrial_bot` which is the wrong UX. Move `TELEGRAM_BOT_TOKEN` to the `integrations` table per-firm.
- [ ] **Shopify: per-firm credentials** — same comment. `SHOPIFY_CLIENT_ID/SECRET` are global env right now.
- [ ] **Schedule editor: visual cron builder** — many users don't know cron syntax; the preset chips help but a dedicated wheel/picker would be nicer.
- [ ] **Vector search via Vault** for the Shopify insights — currently the planner sees the catalog raw; with vault you could also feed past edits, brand voice docs, and competitor research the merchant uploads.
- [ ] **Webhook auto-registration** on first deploy — there's a TS helper at `src/lib/telegram.ts:setWebhook` already; wire it into a deploy hook or admin button.
- [ ] **Replace the manual `confirm()` dialogs** in `RowActions` and `MarkSubmittedButton` with the new Toast system's confirm modal (TBD — not yet built).
- [ ] **A `/admin/timesheets/history`** drilldown — the `timesheet_submissions` table has all the data; a simple page showing past periods + per-employee compliance would be a good v2.
- [ ] **Render-test admin pages with a Clerk session** — I couldn't fully test these without auth. Confirm `/admin/agents`, `/admin/approvals`, `/admin/notifications`, `/admin/vault`, `/admin/integrations`, `/admin/provisioning` all render cleanly.

### Out of scope for now (intentionally deferred)

- WhatsApp via Gupshup — code exists but BSP signup never started; merchant pivot to Telegram makes this lower priority
- Old `/dashboard/[companyId]/*` subtree — files on disk but unreachable; safe to delete in a follow-up
- Memory product (`autonomous-memory`) — separate repo, separate `TODO.md`
- Shopify: variant-creation, image upload, smart-collection creation (deliberately excluded from v1; can add per merchant request)
- Multi-tenant Telegram bots (one bot per firm) — covered above as code-work item

---

## 📜 TL;DR — Tomorrow's order

1. **Right before the demo:** browser spot-check (above), pre-open tabs, tail dev log
2. **In each demo:** rename workspace to match audience → walk through the relevant vertical
3. **After the demo:** rotate secrets → commit working tree → deploy to Railway → register Telegram webhook → set up cron

---

## 🗂 Helper scripts you can lean on

```bash
# Live Shopify smoke — catalog read, no mutations
bun run scripts/shopify-smoke.ts

# Print current tags for verification before/after Apply
bun run scripts/shopify-tags.ts

# Full Shopify e2e: token → plan → apply → verify → rollback → verify clean
bun run scripts/shopify-e2e.ts

# Live Claude insights run (no Clerk)
bun run scripts/shopify-insights-test.ts

# Telegram webhook handler dry-run (link → DONE → HELP → reset)
bun run scripts/telegram-webhook-e2e.ts

# Timesheet domain dry-run (DB roster + cron pass)
bun run scripts/timesheet-e2e.ts

# Bootstrap base schema on a fresh Supabase
DATABASE_URL='postgresql://…' bun run scripts/init-base-schema.ts
```

---

## File-level diff since `74b2e50` (current uncommitted work)

See `HANDOFF.md` for the full file-by-file breakdown — that's the source of truth for the diff state.
