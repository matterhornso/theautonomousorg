"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function TelegramSetupPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;

  const [botToken, setBotToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const saveToken = async () => {
    if (!botToken.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/user-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          serviceName: "telegram_bot",
          displayName: "Telegram Bot",
          apiKey: botToken.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      setBotToken("");
    } catch {
      setError("Failed to save bot token. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface pt-8 pb-16 px-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push(`/dashboard/${companyId}`)}
          className="text-sm text-neutral-500 hover:text-primary transition-colors mb-6"
        >
          &larr; Back to dashboard
        </button>

        <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight mb-2">
          Connect Telegram
        </h1>
        <p className="text-neutral-500 text-sm mb-10">
          Let your team talk to agents directly from Telegram. Follow the steps
          below to create a bot and connect it.
        </p>

        {saved && (
          <div className="mb-8 p-4 bg-secondary/10 border border-secondary/30 rounded-xl">
            <p className="text-sm font-medium text-secondary">
              Bot connected successfully!
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Your team can now message your agents on Telegram. Send{" "}
              <code className="px-1 py-0.5 bg-neutral-100 rounded text-xs">
                /start
              </code>{" "}
              to your bot to begin.
            </p>
          </div>
        )}

        {/* Step-by-step guide */}
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-surface text-sm font-semibold flex items-center justify-center">
              1
            </div>
            <div className="flex-1 pt-1">
              <h3 className="text-sm font-semibold mb-1">
                Open Telegram and find @BotFather
              </h3>
              <p className="text-sm text-neutral-500 mb-3">
                Search for{" "}
                <code className="px-1.5 py-0.5 bg-neutral-100 rounded text-xs font-medium">
                  @BotFather
                </code>{" "}
                in Telegram, or tap the link below. BotFather is Telegram&apos;s
                official tool for creating bots.
              </p>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0088cc] text-white text-sm font-medium rounded-lg hover:bg-[#006da3] transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                </svg>
                Open @BotFather
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-surface text-sm font-semibold flex items-center justify-center">
              2
            </div>
            <div className="flex-1 pt-1">
              <h3 className="text-sm font-semibold mb-1">Create a new bot</h3>
              <p className="text-sm text-neutral-500 mb-3">
                Send the command below to BotFather. It will ask you to choose a
                name and username for your bot.
              </p>
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <code className="text-sm font-[family-name:var(--font-mono)]">
                    /newbot
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText("/newbot")}
                    className="text-xs text-accent hover:underline"
                  >
                    Copy
                  </button>
                </div>
                <div className="text-xs text-neutral-500 space-y-1.5">
                  <p>
                    <span className="font-medium">Name:</span> Something like
                    &ldquo;My Company Agents&rdquo; &mdash; this is the display
                    name users see.
                  </p>
                  <p>
                    <span className="font-medium">Username:</span> Must end in
                    &ldquo;bot&rdquo; &mdash; e.g.{" "}
                    <code className="px-1 bg-neutral-100 rounded">
                      mycompany_agents_bot
                    </code>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-surface text-sm font-semibold flex items-center justify-center">
              3
            </div>
            <div className="flex-1 pt-1">
              <h3 className="text-sm font-semibold mb-1">
                Copy the bot token
              </h3>
              <p className="text-sm text-neutral-500 mb-3">
                BotFather will give you a token that looks like{" "}
                <code className="px-1.5 py-0.5 bg-neutral-100 rounded text-xs">
                  123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
                </code>
                . Copy the full token and paste it below.
              </p>
            </div>
          </div>

          {/* Step 4 — Token input */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent text-primary text-sm font-semibold flex items-center justify-center">
              4
            </div>
            <div className="flex-1 pt-1">
              <h3 className="text-sm font-semibold mb-1">
                Paste your bot token here
              </h3>
              <p className="text-sm text-neutral-500 mb-3">
                We&apos;ll use this to receive messages from your team and route
                them to the right agent.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="Paste your bot token from BotFather"
                  className="flex-1 px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm font-[family-name:var(--font-mono)] focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <button
                  onClick={saveToken}
                  disabled={saving || !botToken.trim()}
                  className="px-5 py-2.5 bg-primary text-surface text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Connecting..." : "Connect Bot"}
                </button>
              </div>
              {error && (
                <p className="text-xs text-red-500 mt-2">{error}</p>
              )}
            </div>
          </div>
        </div>

        {/* How it works section */}
        <div className="mt-12 border-t border-neutral-200 pt-8">
          <h2 className="font-[family-name:var(--font-serif)] text-xl tracking-tight mb-4">
            How Telegram agents work
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-neutral-200 rounded-xl">
              <div className="text-lg mb-2">💬</div>
              <h3 className="text-sm font-semibold mb-1">Message any agent</h3>
              <p className="text-xs text-neutral-500">
                Send <code className="bg-neutral-100 px-1 rounded">@Sales</code>{" "}
                or <code className="bg-neutral-100 px-1 rounded">@Marketing</code>{" "}
                followed by your message to route it to the right agent.
              </p>
            </div>
            <div className="p-4 bg-white border border-neutral-200 rounded-xl">
              <div className="text-lg mb-2">🤖</div>
              <h3 className="text-sm font-semibold mb-1">Auto-responses</h3>
              <p className="text-xs text-neutral-500">
                Agents reply directly in the chat. They remember context from
                previous conversations and have access to your company data.
              </p>
            </div>
            <div className="p-4 bg-white border border-neutral-200 rounded-xl">
              <div className="text-lg mb-2">👥</div>
              <h3 className="text-sm font-semibold mb-1">Team access</h3>
              <p className="text-xs text-neutral-500">
                Send <code className="bg-neutral-100 px-1 rounded">/agents</code>{" "}
                to see available agents. Any team member can connect by messaging
                the bot.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
