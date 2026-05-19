const TELEGRAM_API = "https://api.telegram.org";

/**
 * Service name in user_api_keys for a tenant's own Telegram bot token.
 * When present, the tenant brings its own bot (own @username, own webhook
 * registration) and outbound replies use that token. When absent, we fall
 * back to the global env TELEGRAM_BOT_TOKEN (the platform trial bot).
 */
const TELEGRAM_TOKEN_SERVICE = "telegram_bot_token";

function envToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN;
}

function getToken(): string {
  const token = envToken();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }
  return token;
}

/**
 * Resolve the Telegram bot token for a specific company.
 *
 * Order of preference:
 *   1. user_api_keys row with service_name='telegram_bot_token' for this company
 *   2. env TELEGRAM_BOT_TOKEN (platform trial bot)
 *
 * Returns null if neither is configured (caller decides how to surface).
 */
export async function getTelegramTokenForCompany(
  companyId: string
): Promise<string | null> {
  try {
    const { getUserApiKey } = await import("./db");
    const tenantToken = await getUserApiKey(companyId, TELEGRAM_TOKEN_SERVICE);
    if (tenantToken) return tenantToken;
  } catch {
    // db unavailable in this context — fall through to env
  }
  return envToken() ?? null;
}

export function isTelegramConfigured(): boolean {
  return Boolean(envToken());
}

/**
 * True if the company has its own Telegram bot configured (BYOK).
 * Cheap helper for surfaces that want to show "Using your bot" vs
 * "Using the platform trial bot".
 */
export async function isTelegramBYOK(companyId: string): Promise<boolean> {
  try {
    const { getUserApiKey } = await import("./db");
    return Boolean(await getUserApiKey(companyId, TELEGRAM_TOKEN_SERVICE));
  } catch {
    return false;
  }
}

async function callApi(
  method: string,
  body: Record<string, unknown>,
  tokenOverride?: string
): Promise<unknown> {
  const token = tokenOverride ?? getToken();
  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Telegram API error (${method}): ${res.status} ${text}`);
  }

  const data = await res.json();
  return data;
}

/**
 * Split a long message at line/space boundaries to stay within Telegram's
 * 4096-character per-message limit. Pulled out so sendMessage +
 * sendMessageForCompany share one chunker.
 */
function chunkForTelegram(text: string): string[] {
  const MAX_LENGTH = 4096;
  if (text.length <= MAX_LENGTH) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf("\n", MAX_LENGTH);
    if (splitAt <= 0) splitAt = remaining.lastIndexOf(" ", MAX_LENGTH);
    if (splitAt <= 0) splitAt = MAX_LENGTH;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  return chunks;
}

async function sendChunks(
  chatId: number | string,
  text: string,
  tokenOverride?: string
): Promise<void> {
  for (const chunk of chunkForTelegram(text)) {
    await callApi(
      "sendMessage",
      {
        chat_id: chatId,
        text: chunk,
        parse_mode: "Markdown",
      },
      tokenOverride
    );
  }
}

/**
 * Send a text message to a Telegram chat using the env-level platform bot.
 * Automatically splits messages that exceed Telegram's 4096-char limit.
 */
export async function sendMessage(
  chatId: number | string,
  text: string
): Promise<void> {
  await sendChunks(chatId, text);
}

/**
 * Send a Telegram message using the company's BYO bot token (when present)
 * or the env-level platform bot (fallback). Use this anywhere we know the
 * companyId so per-tenant bots get used automatically.
 */
export async function sendMessageForCompany(
  companyId: string,
  chatId: number | string,
  text: string
): Promise<void> {
  const token = await getTelegramTokenForCompany(companyId);
  if (!token) {
    throw new Error("No Telegram token available (per-tenant or env)");
  }
  await sendChunks(chatId, text, token);
}

/**
 * Register a webhook URL with Telegram.
 * The secret_token is sent in the X-Telegram-Bot-Api-Secret-Token header on every update.
 * Optional tokenOverride lets a tenant register their own bot.
 */
export async function setWebhook(
  url: string,
  tokenOverride?: string
): Promise<unknown> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  return callApi(
    "setWebhook",
    {
      url,
      ...(secret ? { secret_token: secret } : {}),
    },
    tokenOverride
  );
}

/** Register a webhook for a specific company's BYO bot. */
export async function setWebhookForCompany(
  companyId: string,
  url: string
): Promise<unknown> {
  const token = await getTelegramTokenForCompany(companyId);
  if (!token) {
    throw new Error("No Telegram token available for setWebhookForCompany");
  }
  return setWebhook(url, token);
}

/**
 * Remove the current webhook (env bot, or pass tokenOverride for BYO).
 */
export async function deleteWebhook(tokenOverride?: string): Promise<unknown> {
  return callApi("deleteWebhook", {}, tokenOverride);
}

/**
 * Get current webhook info (useful for debugging).
 * tokenOverride lets a tenant introspect their own bot.
 */
export async function getWebhookInfo(
  tokenOverride?: string
): Promise<unknown> {
  const token = tokenOverride ?? getToken();
  const res = await fetch(`${TELEGRAM_API}/bot${token}/getWebhookInfo`);
  return res.json();
}
