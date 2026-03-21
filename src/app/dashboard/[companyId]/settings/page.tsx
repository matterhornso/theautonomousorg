"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

interface ApiKeyInfo {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

interface ConnectorConfig {
  name: string;
  envVar: string;
  description: string;
  docsUrl: string;
  category: "sales" | "marketing" | "crm" | "finance" | "comms" | "dev" | "analytics";
  platformProvided: boolean;
}

const connectors: ConnectorConfig[] = [
  {
    name: "Apollo.io",
    envVar: "APOLLO_API_KEY",
    description: "Search 210M+ contacts, find prospects, enrich leads",
    docsUrl: "https://docs.apollo.io",
    category: "sales",
    platformProvided: true,
  },
  {
    name: "Instantly.ai",
    envVar: "INSTANTLY_API_KEY",
    description: "Email outreach campaigns, sequence automation, deliverability",
    docsUrl: "https://developer.instantly.ai",
    category: "marketing",
    platformProvided: true,
  },
  {
    name: "HubSpot",
    envVar: "HUBSPOT_API_KEY",
    description: "CRM, deal tracking, contact management",
    docsUrl: "https://developers.hubspot.com",
    category: "crm",
    platformProvided: false,
  },
  {
    name: "Slack",
    envVar: "SLACK_BOT_TOKEN",
    description: "Team messaging, channel notifications, workflow updates",
    docsUrl: "https://api.slack.com",
    category: "comms",
    platformProvided: false,
  },
  {
    name: "GitHub",
    envVar: "GITHUB_TOKEN",
    description: "Repository access, PR management, code review",
    docsUrl: "https://docs.github.com/en/rest",
    category: "dev",
    platformProvided: false,
  },
  {
    name: "Linear",
    envVar: "LINEAR_API_KEY",
    description: "Issue tracking, sprint planning, roadmap management",
    docsUrl: "https://developers.linear.app",
    category: "dev",
    platformProvided: false,
  },
  {
    name: "Stripe",
    envVar: "USER_STRIPE_API_KEY",
    description: "Payment processing, subscription management, revenue data",
    docsUrl: "https://stripe.com/docs/api",
    category: "finance",
    platformProvided: false,
  },
  {
    name: "Google Workspace",
    envVar: "GOOGLE_CLIENT_ID",
    description: "Docs, Sheets, Calendar, Gmail access",
    docsUrl: "https://developers.google.com/workspace",
    category: "comms",
    platformProvided: false,
  },
];

const categoryLabels: Record<string, string> = {
  sales: "Sales & Prospecting",
  marketing: "Marketing & Outreach",
  crm: "CRM",
  finance: "Finance",
  comms: "Communication",
  dev: "Development",
  analytics: "Analytics",
};

export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;

  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch(`/api/keys?companyId=${companyId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setApiKeys(data);
      });
  }, [companyId]);

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, name: newKeyName.trim() }),
    });
    const data = await res.json();
    if (data.key) {
      setCreatedKey(data.key);
      setNewKeyName("");
      // Refresh key list
      const list = await fetch(`/api/keys?companyId=${companyId}`).then((r) =>
        r.json()
      );
      if (Array.isArray(list)) setApiKeys(list);
    }
    setCreating(false);
  };

  const deleteKey = async (keyId: string) => {
    await fetch("/api/keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId, companyId }),
    });
    setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
  };

  const categories = [...new Set(connectors.map((c) => c.category))];

  return (
    <div className="min-h-screen bg-surface pt-8 pb-16 px-6">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => router.push(`/dashboard/${companyId}`)}
          className="text-sm text-neutral-500 hover:text-primary transition-colors mb-6"
        >
          &larr; Back to dashboard
        </button>

        <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight mb-2">
          Settings
        </h1>
        <p className="text-neutral-500 text-sm mb-10">
          Manage API keys, connectors, and integrations for your agents.
        </p>

        {/* ─── API Keys ──────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4">
            API Keys
          </h2>
          <p className="text-sm text-neutral-500 mb-4">
            Use API keys to access your agents programmatically via the REST
            API.
          </p>

          {/* Created key banner */}
          {createdKey && (
            <div className="mb-4 p-4 bg-accent/10 border border-accent/20 rounded-xl">
              <p className="text-sm font-medium mb-1">
                Your new API key (save it — won&apos;t be shown again):
              </p>
              <code className="text-xs bg-white px-3 py-1.5 rounded-lg border border-neutral-200 font-[family-name:var(--font-mono)] select-all block mt-1">
                {createdKey}
              </code>
              <button
                onClick={() => setCreatedKey(null)}
                className="text-xs text-neutral-500 mt-2 hover:text-primary"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Existing keys */}
          {apiKeys.length > 0 && (
            <div className="space-y-2 mb-4">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-3 bg-white border border-neutral-200 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium">{key.name}</p>
                    <p className="text-xs text-neutral-400 font-[family-name:var(--font-mono)]">
                      {key.key_prefix}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-neutral-400">
                      {key.last_used_at
                        ? `Used ${key.last_used_at}`
                        : "Never used"}
                    </span>
                    <button
                      onClick={() => deleteKey(key.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create new key */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. Production, CI/CD)"
              className="flex-1 px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <button
              onClick={createKey}
              disabled={creating || !newKeyName.trim()}
              className="px-4 py-2.5 bg-primary text-surface text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create key"}
            </button>
          </div>

          {/* API usage example */}
          <details className="mt-4">
            <summary className="text-xs text-neutral-400 cursor-pointer hover:text-neutral-600">
              API usage example
            </summary>
            <pre className="mt-2 p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-[family-name:var(--font-mono)] overflow-x-auto">
              {`curl -X POST https://theautonomous.org/api/v1/chat \\
  -H "Authorization: Bearer ta_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"agentId": "agent-id", "message": "Find me CTOs at SaaS companies"}'`}
            </pre>
          </details>
        </section>

        {/* ─── Connectors ────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-1">
            Connectors
          </h2>
          <p className="text-sm text-neutral-500 mb-6">
            Core tools (Apollo, Instantly) are provided by TheAutonomous —
            included in your plan. Connect your own accounts for additional
            integrations.
          </p>

          {categories.map((cat) => (
            <div key={cat} className="mb-8">
              <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">
                {categoryLabels[cat] || cat}
              </h3>
              <div className="space-y-2">
                {connectors
                  .filter((c) => c.category === cat)
                  .map((connector) => (
                    <div
                      key={connector.name}
                      className="flex items-center justify-between p-4 bg-white border border-neutral-200 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            connector.platformProvided
                              ? "bg-secondary"
                              : "bg-neutral-300"
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">
                              {connector.name}
                            </p>
                            {connector.platformProvided && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-secondary/10 text-secondary rounded font-medium">
                                Included
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-500">
                            {connector.description}
                          </p>
                        </div>
                      </div>
                      {connector.platformProvided ? (
                        <span className="text-xs text-secondary font-medium">
                          Active
                        </span>
                      ) : (
                        <a
                          href={connector.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-accent hover:underline"
                        >
                          Connect &rarr;
                        </a>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
