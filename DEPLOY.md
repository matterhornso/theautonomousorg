# Production deploy runbook

Target stack: **Next.js 16 + Clerk + Supabase + Railway**. This is the path from
"demo-ready" to a stable production URL. Do the steps in order; each has a
verification you must see pass before moving on.

> Companion docs: secret rotation → [SECURITY.md](SECURITY.md) · multi-tenant
> credentials → [docs/integrations-design.md](docs/integrations-design.md).

## 0. Prerequisites

- [ ] `chore/clerk-security-bump` merged to `main` (it's the integration branch;
      `main` is the deploy source). Confirm `tsc --noEmit` and `bun run test`
      are green on `main`.
- [ ] Secrets **rotated** (see SECURITY.md) — anything pasted into a chat/log.
- [ ] You can reach the Clerk, Supabase, Railway, and @BotFather dashboards.

## 1. Database — Supabase

The free tier **auto-pauses after ~7 days of inactivity** (it's paused right now),
which will 503 a live product. For production:

- [ ] Upgrade the project to **Pro** (removes auto-pause).
- [ ] Use the **transaction pooler** for the app connection — host
      `…pooler.supabase.com`, **port 6543**. Transaction mode is the right mode
      for serverless/short-lived connections and **does not support prepared
      statements** (append `?pgbouncer=true` if your client prepares).
      Use the **session pooler / direct** connection only for migrations.
- [ ] Apply migrations `001` → `010` against the prod DB, in order.
- [ ] Set `DATABASE_URL` to the pooler URL in Railway.

Verify: `curl https://<prod>/api/health` → `database: ok`.

## 2. Auth — Clerk dev → prod cutover

This is the **most common deploy miss**. Production keys (`pk_live_/sk_live_`)
behave differently from dev keys:

- [ ] Create the **production instance** in Clerk; set the production domain +
      DNS (CNAME records Clerk gives you).
- [ ] Swap env to `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_…` and
      `CLERK_SECRET_KEY=sk_live_…`.
- [ ] **Re-create what does NOT copy from dev:** SSO/social connections,
      integrations, and the sign-in/up/after-sign paths
      (`NEXT_PUBLIC_CLERK_SIGN_IN_URL`, etc.).
- [ ] Note: **live keys reject `localhost`** — you can only exercise them on the
      deployed domain.

Verify: sign in on the prod domain; confirm `/admin` loads for a real user.

## 3. Railway services

Run **three** services off the same repo/`main`:

1. **Web** (Next.js): build `bun run build`, start `bun run start` (binds
   `$PORT`). Add a health check on `/api/health`.
2. **Worker** (always-on): `bunx tsx src/worker.ts` (or the project's worker
   entry). This process **must not exit**.
3. **Cron** (separate service that **exits** when done): hits the reminder
   endpoint. Railway crons **start → run → exit**, have a **5-minute minimum
   interval**, and are evaluated in **UTC**.
   - 17:00 IST → **`30 11 * * *`** (UTC).
   - Command (Bearer header, not query — see SECURITY.md):
     ```bash
     curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
       "$APP_BASE_URL/api/cron/timesheet-reminders"
     ```
   - A non-exiting cron process causes Railway to **skip subsequent runs** — make
     sure the command terminates.

Verify: trigger the cron service manually once; watch logs for the JSON run
summary; confirm `worker` stays up.

## 4. Env / secrets on Railway

- [ ] Paste every key from `.env.example` into Railway variables (use it as the
      checklist). Required: `ANTHROPIC_API_KEY`, `CLERK_SECRET_KEY` +
      `NEXT_PUBLIC_CLERK_*`, `DATABASE_URL`, `ENCRYPTION_KEY`, `RESEND_API_KEY`,
      `SHOPIFY_*`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`,
      `BROADCAST_*`.
- [ ] Set `NEXT_PUBLIC_APP_URL` and `APP_BASE_URL` to `https://theautonomous.org`.
- [ ] Use Railway **shared variables** for values reused across the 3 services.

## 5. Telegram webhook (against the prod URL)

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://theautonomous.org/api/messaging/telegram\",\"secret_token\":\"$TELEGRAM_WEBHOOK_SECRET\"}"
```

Verify: `getWebhookInfo` shows the prod URL and `pending_update_count: 0`; send
`/start` to the bot.

## 6. Observability

- [ ] **Error tracking:** add Sentry (`@sentry/nextjs`) for the web + worker.
- [ ] **Uptime:** point a monitor (BetterStack/UptimeRobot/etc.) at
      `/api/health` — it already reports DB status, so a pause/outage pages you,
      not a prospect.
- [ ] Keep an eye on Railway logs during the first live cron + webhook events.

## 7. Post-deploy smoke (against prod)

```bash
curl https://theautonomous.org/api/health | jq        # status: ok
bun run scripts/shopify-smoke.ts                       # token + product read
bun run scripts/telegram-webhook-e2e.ts                # link / DONE / HELP paths
```

- [ ] Walk the two demo flows on the live domain: `/admin/timesheets`
      (mark-submitted, schedule, **history**) and `/admin/shopify`
      (plan → apply → confirm).

## Rollback

Railway keeps prior deploys — **redeploy the last green build** from the service's
Deployments tab. If a migration is the problem, restore from the Supabase Pro
daily backup. Keep the previous Clerk secret key active until the new deploy is
verified (zero-downtime overlap, SECURITY.md).
