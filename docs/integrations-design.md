# Per-tenant integrations — design

**Status:** proposed (migration `010_integrations.sql` lands the schema; app layer
is the next build). **Don't build the app layer until a 2nd paying customer is
imminent** — but the schema is cheap to land now so we avoid a flag day.

## Problem

v1 is single-tenant by env var: `TELEGRAM_BOT_TOKEN`, `SHOPIFY_CLIENT_ID/SECRET`,
etc. are global. A 2nd customer can't bring their own bot or store. We need
per-tenant credentials, encrypted at rest, with a clean path for inbound
webhooks (which arrive with no tenant context) to find the right tenant.

## Schema (`integrations`)

One row per `(company_id, provider, external_id)`. See `migrations/010_integrations.sql`.

| Column | Why |
|--------|-----|
| `provider` | `telegram` / `shopify` / `whatsapp` / `anthropic` / `resend` / `custom` |
| `external_id` | provider-side id for **webhook routing without decrypting** — Telegram bot username, Shopify shop domain, WhatsApp phone-number id. Globally unique per provider. |
| `credentials_ciphertext` / `_iv` / `_auth_tag` | AES-256-GCM; DB never sees plaintext |
| `key_alias` | which key encrypted the row → enables rotation (`app:v1` → `app:v2` → per-firm KMS) |
| `status`, `last_verified_at`, `last_error` | health surfacing in the admin UI |

`UNIQUE (company_id, provider, external_id)` lets one firm hold several accounts
of a provider (e.g. two Shopify stores). A partial unique on
`(provider, external_id)` guarantees an inbound webhook resolves to exactly one
tenant.

## Encryption model

- **Now:** app-level **AES-256-GCM** with the global `ENCRYPTION_KEY` (32 bytes).
  Encrypt a JSON credential blob; store ciphertext + iv + auth tag. Fine for the
  first handful of tenants (corroborated by [WorkOS on multi-tenant key isolation](https://workos.com/blog/cryptographic-key-isolation-multi-tenant-saas)).
- **`key_alias`** records the encrypting key (`app:v1`). To rotate
  `ENCRYPTION_KEY`: add `app:v2`, decrypt-with-v1/re-encrypt-with-v2 lazily on
  read or in a backfill, then retire v1. No flag day.
- **Later:** per-firm envelope encryption via AWS KMS. `companies.kms_key_alias`
  already exists (migration 004) for exactly this; `key_alias` would point at the
  per-firm CMK and store a wrapped data key.

```ts
// src/lib/integrations.ts (sketch)
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, "base64"); // 32 bytes

export function seal(plaintext: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return {
    ciphertext: ct.toString("base64"),
    iv: iv.toString("base64"),
    authTag: c.getAuthTag().toString("base64"),
    keyAlias: "app:v1",
  };
}

export function open(row: { ciphertext: string; iv: string; authTag: string }) {
  const d = createDecipheriv("aes-256-gcm", KEY, Buffer.from(row.iv, "base64"));
  d.setAuthTag(Buffer.from(row.authTag, "base64"));
  return Buffer.concat([
    d.update(Buffer.from(row.ciphertext, "base64")),
    d.final(),
  ]).toString("utf8");
}

// getIntegration(companyId, provider, externalId?) → decrypted creds (RLS-scoped)
// putIntegration(companyId, provider, creds, { label, externalId }) → seals + upserts
// verifyIntegration(...) → exercises the credential, updates status/last_verified_at
```

## Webhook routing (the tricky part)

Inbound Telegram/Shopify webhooks have **no Clerk session and no tenant**. Flow:

1. Webhook hits the public route. Verify the provider signature first
   (Telegram `secret_token` header; Shopify HMAC) — see SECURITY.md.
2. Extract the `external_id` from the payload (bot username / shop domain).
3. Call `public.resolve_integration_company(provider, external_id)` — a
   `SECURITY DEFINER` function that bypasses RLS and returns **only** the
   `company_id` (never ciphertext).
4. Set `app.current_company_id` to that id, then read the integration row +
   decrypt under normal RLS.

This keeps the credential-bearing table behind RLS while still letting an
unauthenticated entrypoint find its tenant.

## Provider-specific notes

- **Telegram:** keep the **single shared bot + per-chat routing** for now (cheap,
  one webhook). Move to **per-tenant bots** only if a client wants their own
  branded bot — then `external_id` = bot username and each bot registers its own
  `secret_token`. A single shared bot can't be multiplexed by domain, so
  per-tenant bots are the only true isolation path.
- **Shopify:** use a **custom app per merchant** (token stored as an integration)
  for now. Custom apps are **exempt** from the expiring-offline-token mandate
  that hits **new public apps Apr 1 2026 and all public apps Jan 1 2027**
  ([Shopify changelog](https://shopify.dev/changelog/expiring-offline-access-tokens-required-for-all-public-apps-as-of-january-1-2027)),
  and skip app review. Move to a distributed/public OAuth app only once merchant
  volume justifies token-refresh machinery + review.

## Migration path from today's globals

1. Land `010_integrations.sql`.
2. Build `src/lib/integrations.ts` with `seal/open/get/put/verify`.
3. Add a resolver: `getIntegration(companyId, 'telegram')` → fall back to
   `process.env.TELEGRAM_BOT_TOKEN` when no row exists (keeps the JAA demo
   working during cutover).
4. Backfill the existing two tenants into rows; flip the verticals to read from
   `integrations` first.
5. Remove the env-var fallback once both tenants are migrated.

## RLS

Standard pattern (`migrations/001_rls_policies.sql`): `ENABLE` + `FORCE` RLS,
`integrations_tenant_isolation` policy on `company_id = public.current_company_id()`.
Clerk **Organizations** are the tenant unit; map the active org → `company_id`
and set the GUC per request. Don't trust the session cookie in cron/webhook
paths — set the GUC explicitly from the resolved tenant.
