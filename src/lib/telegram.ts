const TELEGRAM_API = "https://api.telegram.org";

function getToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }
  return token;
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

async function callApi(method: string, body: Record<string, unknown>): Promise<unknown> {
  const token = getToken();
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
 * Send a text message to a Telegram chat.
 * Automatically splits messages that exceed Telegram's 4096 character limit.
 */
export async function sendMessage(
  chatId: number | string,
  text: string
): Promise<void> {
  const MAX_LENGTH = 4096;

  if (text.length <= MAX_LENGTH) {
    await callApi("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    });
    return;
  }

  // Split long messages at line boundaries
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }
    // Find last newline within limit
    let splitAt = remaining.lastIndexOf("\n", MAX_LENGTH);
    if (splitAt <= 0) {
      // No newline found, split at space
      splitAt = remaining.lastIndexOf(" ", MAX_LENGTH);
    }
    if (splitAt <= 0) {
      // No space found, hard split
      splitAt = MAX_LENGTH;
    }
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  for (const chunk of chunks) {
    await callApi("sendMessage", {
      chat_id: chatId,
      text: chunk,
      parse_mode: "Markdown",
    });
  }
}

/**
 * Register a webhook URL with Telegram.
 * The secret_token is sent in the X-Telegram-Bot-Api-Secret-Token header on every update.
 */
export async function setWebhook(url: string): Promise<unknown> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  return callApi("setWebhook", {
    url,
    ...(secret ? { secret_token: secret } : {}),
  });
}

/**
 * Remove the current webhook.
 */
export async function deleteWebhook(): Promise<unknown> {
  return callApi("deleteWebhook", {});
}

/**
 * Get current webhook info (useful for debugging).
 */
export async function getWebhookInfo(): Promise<unknown> {
  const token = getToken();
  const res = await fetch(`${TELEGRAM_API}/bot${token}/getWebhookInfo`);
  return res.json();
}
