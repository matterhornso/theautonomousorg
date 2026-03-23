"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  suggestedPlatforms,
  type SuggestedPlatform,
} from "@/lib/suggested-platforms";

// ─── Types ──────────────────────────────────────────────

interface ApiKeyInfo {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

interface ConnectedService {
  id: string;
  service_name: string;
  display_name: string;
  is_active: number;
  last_used_at: string | null;
  created_at: string;
  key_hint: string;
}

// ─── Component ──────────────────────────────────────────

export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;

  // TA API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Connected services state
  const [connectedServices, setConnectedServices] = useState<
    ConnectedService[]
  >([]);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [savingService, setSavingService] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // Custom API state
  const [customName, setCustomName] = useState("");
  const [customServiceName, setCustomServiceName] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [savingCustom, setSavingCustom] = useState(false);

  // ─── Data fetching ──────────────────────────────────────

  const fetchApiKeys = useCallback(() => {
    fetch(`/api/keys?companyId=${companyId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setApiKeys(data);
      });
  }, [companyId]);

  const fetchConnectedServices = useCallback(() => {
    fetch(`/api/user-keys?companyId=${companyId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setConnectedServices(data);
      });
  }, [companyId]);

  useEffect(() => {
    fetchApiKeys();
    fetchConnectedServices();
  }, [fetchApiKeys, fetchConnectedServices]);

  // ─── TA API Key handlers ────────────────────────────────

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
      fetchApiKeys();
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

  // ─── Connected service handlers ─────────────────────────

  const connectService = async (platform: SuggestedPlatform) => {
    const apiKey = keyInputs[platform.serviceName];
    if (!apiKey?.trim()) return;

    setSavingService(platform.serviceName);
    try {
      await fetch("/api/user-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          serviceName: platform.serviceName,
          displayName: platform.displayName,
          apiKey: apiKey.trim(),
        }),
      });
      setKeyInputs((prev) => ({ ...prev, [platform.serviceName]: "" }));
      setExpandedService(null);
      fetchConnectedServices();
    } finally {
      setSavingService(null);
    }
  };

  const disconnectService = async (serviceName: string) => {
    setDisconnecting(serviceName);
    try {
      await fetch("/api/user-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, serviceName }),
      });
      fetchConnectedServices();
    } finally {
      setDisconnecting(null);
    }
  };

  const connectCustom = async () => {
    if (!customName.trim() || !customKey.trim()) return;
    setSavingCustom(true);
    const svcName = customServiceName.trim()
      ? customServiceName.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_")
      : customName.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    try {
      await fetch("/api/user-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          serviceName: svcName,
          displayName: customName.trim(),
          apiKey: customKey.trim(),
        }),
      });
      setCustomName("");
      setCustomServiceName("");
      setCustomKey("");
      fetchConnectedServices();
    } finally {
      setSavingCustom(false);
    }
  };

  // ─── Derived data ───────────────────────────────────────

  const connectedServiceNames = new Set(
    connectedServices.map((s) => s.service_name)
  );

  // Group suggested platforms by category (excluding "Custom" and already-connected ones for the suggestion list)
  const categories = [
    ...new Set(
      suggestedPlatforms
        .filter((p) => p.category !== "Custom")
        .map((p) => p.category)
    ),
  ];

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "Never";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // ─── Render ─────────────────────────────────────────────

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
                Your new API key (save it &mdash; won&apos;t be shown again):
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
                    <span className="text-xs text-neutral-400">
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

        {/* ─── Connected Services ────────────────────────── */}
        <section>
          <h2 className="font-[family-name:var(--font-serif)] text-xl tracking-tight mb-1">
            Connected Services
          </h2>
          <p className="text-sm text-neutral-500 mb-6">
            Connect your accounts so agents can take action on your behalf.
            Keys are stored securely and only used when agents need them.
          </p>

          {/* Currently connected */}
          {connectedServices.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">
                Active Connections
              </h3>
              <div className="space-y-2">
                {connectedServices.map((svc) => (
                  <div
                    key={svc.id}
                    className="flex items-center justify-between p-4 bg-white border border-secondary/30 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-secondary" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            {svc.display_name}
                          </p>
                          <span className="text-xs px-1.5 py-0.5 bg-secondary/10 text-secondary rounded font-medium">
                            Connected
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 font-[family-name:var(--font-mono)]">
                          {svc.key_hint}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-neutral-400">
                        {svc.last_used_at
                          ? `Last used ${formatDate(svc.last_used_at)}`
                          : "Never used"}
                      </span>
                      <button
                        onClick={() => disconnectService(svc.service_name)}
                        disabled={disconnecting === svc.service_name}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {disconnecting === svc.service_name
                          ? "Removing..."
                          : "Disconnect"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested services by category */}
          {categories.map((category) => {
            const platforms = suggestedPlatforms.filter(
              (p) =>
                p.category === category &&
                !connectedServiceNames.has(p.serviceName)
            );
            if (platforms.length === 0) return null;

            return (
              <div key={category} className="mb-8">
                <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {platforms.map((platform) => {
                    const isExpanded =
                      expandedService === platform.serviceName;
                    const isSaving =
                      savingService === platform.serviceName;

                    return (
                      <div
                        key={platform.serviceName}
                        className="bg-white border border-neutral-200 rounded-xl overflow-hidden"
                      >
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-neutral-300" />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">
                                  {platform.displayName}
                                </p>
                              </div>
                              <p className="text-xs text-neutral-500">
                                {platform.description}
                              </p>
                              <p className="text-xs text-neutral-400 mt-0.5">
                                Used by:{" "}
                                {platform.relevantAgents.join(", ")}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              setExpandedService(
                                isExpanded
                                  ? null
                                  : platform.serviceName
                              )
                            }
                            className="text-xs text-accent hover:underline shrink-0"
                          >
                            {isExpanded
                              ? "Cancel"
                              : "Connect \u2192"}
                          </button>
                        </div>

                        {/* Expanded connect form */}
                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-neutral-100 pt-3 space-y-3">
                            <div className="p-3 bg-neutral-50 rounded-lg">
                              <p className="text-xs font-medium text-neutral-600 mb-1">
                                How to get your API key:
                              </p>
                              <p className="text-xs text-neutral-500">
                                {platform.keyInstructions}
                              </p>
                              {platform.docsUrl && (
                                <a
                                  href={platform.docsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-accent hover:underline mt-1 inline-block"
                                >
                                  View documentation &rarr;
                                </a>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="password"
                                value={
                                  keyInputs[platform.serviceName] || ""
                                }
                                onChange={(e) =>
                                  setKeyInputs((prev) => ({
                                    ...prev,
                                    [platform.serviceName]:
                                      e.target.value,
                                  }))
                                }
                                placeholder={`Paste your ${platform.displayName} API key`}
                                className="flex-1 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm font-[family-name:var(--font-mono)] focus:outline-none focus:ring-2 focus:ring-accent/50"
                              />
                              <button
                                onClick={() =>
                                  connectService(platform)
                                }
                                disabled={
                                  isSaving ||
                                  !keyInputs[
                                    platform.serviceName
                                  ]?.trim()
                                }
                                className="px-4 py-2 bg-primary text-surface text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50"
                              >
                                {isSaving ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Custom API */}
          <div className="mb-8">
            <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">
              Custom Integration
            </h3>
            <div className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-sm font-medium">Custom API</p>
                <p className="text-xs text-neutral-500">
                  Connect any service not listed above. Your agents will use
                  the key when interacting with this API.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Display name (e.g. Airtable)"
                  className="px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <input
                  type="text"
                  value={customServiceName}
                  onChange={(e) => setCustomServiceName(e.target.value)}
                  placeholder="Service ID (e.g. airtable) — optional"
                  className="px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm font-[family-name:var(--font-mono)] focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  placeholder="Paste your API key"
                  className="flex-1 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm font-[family-name:var(--font-mono)] focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <button
                  onClick={connectCustom}
                  disabled={
                    savingCustom ||
                    !customName.trim() ||
                    !customKey.trim()
                  }
                  className="px-4 py-2 bg-primary text-surface text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50"
                >
                  {savingCustom ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
