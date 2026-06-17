# Security

This repository is **public**. No real secret has ever been committed (verified
against full git history); only placeholders live in `.env.example`. The rules
below keep it that way and define how we rotate credentials.

## Reporting

Email **security@theautonomous.org** (or hello@theautonomous.org). Please don't
open public issues for vulnerabilities.

## Secret-scanning (two layers)

1. **GitHub push protection** — blocks commits containing known provider secret
   patterns at push time. Enable once per repo (admin):
   - Repo → **Settings → Code security and analysis**
   - Enable **Secret scanning** and **Push protection**.
   - Org-wide: Organization → Settings → Code security, "Enable all" + "Enable
     by default for new repositories."
   - Push protection is on by default for public repos created recently, but
     verify — older repos may need it toggled.
2. **gitleaks in CI** — [`.github/workflows/security.yml`](.github/workflows/security.yml)
   runs gitleaks on every push/PR over **full history**, catching entropy-based
   and custom-rule matches that push protection misses.

Run it locally before a risky commit:

```bash
brew install gitleaks            # or: go install github.com/gitleaks/gitleaks/v8@latest
gitleaks detect --source . -v    # working tree + history
```

## What is and isn't a secret here

| Lives in | Examples | Committed? |
|----------|----------|------------|
| `.env.local` (gitignored) | `ANTHROPIC_API_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL`, `ENCRYPTION_KEY`, `RESEND_API_KEY`, `SHOPIFY_CLIENT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`, `BROADCAST_ADMIN_CODE` | **never** |
| `.env.example` | placeholder shapes only | yes (safe) |
| Committed docs | Supabase **project ref** (`znmerxpukimtugwtfysy`) | yes — an identifier, not a credential, but avoid adding more infra IDs |

## Rotation runbook (zero-downtime overlap)

Rotate any credential that was ever pasted into a chat, screen-share, log, or
shared doc — even if it never hit git. Industry data: **64% of credentials
leaked in 2022 were still valid in Jan 2026** ([GitGuardian 2026](https://blog.gitguardian.com/the-state-of-secrets-sprawl-2026/)) —
exposure is a *rotation* failure, not just a leak.

**Never delete the old credential until the new one is deployed and verified.**

| Secret | Where to rotate | Overlap supported? |
|--------|-----------------|--------------------|
| `CLERK_SECRET_KEY` | Clerk Dashboard → API keys → add a new secret key, deploy, then revoke old | **Yes** — Clerk allows multiple active secret keys ([docs](https://clerk.com/docs/guides/secure/rotate-api-keys)) |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys → create new, deploy, delete old | Yes (keep both briefly) |
| `TELEGRAM_BOT_TOKEN` | @BotFather → `/revoke` → new token → update env → **re-register webhook** | No overlap (revoke is immediate) — do in a maintenance minute |
| `TELEGRAM_WEBHOOK_SECRET` | pick a new random value → update env → re-call `setWebhook` with new `secret_token` | Brief gap during redeploy |
| `SHOPIFY_CLIENT_SECRET` | Shopify admin → app → API credentials → reset | Coordinate with the 24h token cache |
| `DATABASE_URL` | Supabase → Database → reset password → update env everywhere referencing the pooler URL | No overlap |
| `CRON_SECRET`, `BROADCAST_ADMIN_CODE`, `ENCRYPTION_KEY` | generate new random; **`ENCRYPTION_KEY` requires re-encrypting stored ciphertext** (see [docs/integrations-design.md](docs/integrations-design.md) key-version plan) | n/a |

Generate strong values: `openssl rand -base64 32`.

## Endpoint secret practices (already implemented)

- **Telegram webhook** verifies the `x-telegram-bot-api-secret-token` header
  against `TELEGRAM_WEBHOOK_SECRET` before processing
  ([route](src/app/api/messaging/telegram/route.ts)).
- **Cron** requires `CRON_SECRET` via `Authorization: Bearer` (preferred) or a
  `?token=` fallback, compared in **constant time**
  ([route](src/app/api/cron/timesheet-reminders/route.ts)). Prefer the header —
  query strings leak into logs.
- If Shopify **inbound webhooks** are added later, verify the **HMAC** signature
  (`X-Shopify-Hmac-Sha256`) with a constant-time compare before trusting the
  body.

## Tenant isolation

Every tenant-scoped table enforces Postgres **RLS** keyed on the
`app.current_company_id` session GUC via `public.current_company_id()` (see
`migrations/001_rls_policies.sql`). App code sets the GUC per request from the
resolved tenant; cron/webhook paths must set it explicitly rather than trusting
a session cookie.
