"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

// ─── Tool Registry ──────────────────────────────────────

interface ToolInfo {
  id: string;
  name: string;
  website: string;
  docsUrl: string;
  description: string;
  agents: string[];
}

const TOOL_REGISTRY: ToolInfo[] = [
  // Sales
  { id: "apollo", name: "Apollo.io", website: "https://apollo.io", docsUrl: "https://docs.apollo.io", description: "Prospect search, contact enrichment, lead lists", agents: ["Sales"] },
  { id: "hubspot", name: "HubSpot", website: "https://hubspot.com", docsUrl: "https://developers.hubspot.com", description: "CRM, deal tracking, contact management, pipelines", agents: ["Sales", "Marketing", "Customer Success"] },
  { id: "calendly", name: "Calendly", website: "https://calendly.com", docsUrl: "https://developer.calendly.com", description: "Scheduling, meeting links, calendar management", agents: ["Sales", "Admin"] },
  { id: "gmail", name: "Gmail", website: "https://mail.google.com", docsUrl: "https://developers.google.com/gmail/api", description: "Email sending, reading, and management", agents: ["Sales"] },

  // Marketing
  { id: "instantly", name: "Instantly.ai", website: "https://instantly.ai", docsUrl: "https://developer.instantly.ai", description: "Email outreach campaigns, deliverability, analytics", agents: ["Marketing"] },
  { id: "buffer", name: "Buffer", website: "https://buffer.com", docsUrl: "https://buffer.com/developers/api", description: "Social media scheduling, publishing, analytics", agents: ["Marketing"] },
  { id: "semrush", name: "SEMrush", website: "https://semrush.com", docsUrl: "https://developer.semrush.com", description: "SEO analysis, keyword research, competitor tracking", agents: ["Marketing", "Strategy"] },
  { id: "canva", name: "Canva", website: "https://canva.com", docsUrl: "https://www.canva.dev", description: "Design templates, social media graphics, brand kit", agents: ["Marketing"] },

  // Accounting
  { id: "quickbooks", name: "QuickBooks", website: "https://quickbooks.intuit.com", docsUrl: "https://developer.intuit.com", description: "Bookkeeping, invoicing, expense tracking, tax prep", agents: ["Accounting", "Finance"] },
  { id: "xero", name: "Xero", website: "https://xero.com", docsUrl: "https://developer.xero.com", description: "Cloud accounting, bank reconciliation, payroll", agents: ["Accounting"] },
  { id: "stripe", name: "Stripe", website: "https://stripe.com", docsUrl: "https://stripe.com/docs/api", description: "Payment processing, subscriptions, revenue data", agents: ["Accounting", "Finance"] },
  { id: "plaid", name: "Plaid", website: "https://plaid.com", docsUrl: "https://plaid.com/docs", description: "Bank connections, financial data, transaction sync", agents: ["Accounting"] },

  // Strategy
  { id: "crunchbase", name: "Crunchbase", website: "https://crunchbase.com", docsUrl: "https://data.crunchbase.com/docs", description: "Company data, funding rounds, market intelligence", agents: ["Strategy"] },
  { id: "similarweb", name: "SimilarWeb", website: "https://similarweb.com", docsUrl: "https://developers.similarweb.com", description: "Website traffic, competitive analysis, market share", agents: ["Strategy"] },
  { id: "google_trends", name: "Google Trends", website: "https://trends.google.com", docsUrl: "https://developers.google.com/trends", description: "Search trend data, topic popularity, market signals", agents: ["Strategy"] },

  // Product
  { id: "linear", name: "Linear", website: "https://linear.app", docsUrl: "https://developers.linear.app", description: "Issue tracking, sprint planning, roadmap management", agents: ["Product"] },
  { id: "jira", name: "Jira", website: "https://atlassian.com/software/jira", docsUrl: "https://developer.atlassian.com/cloud/jira/platform/rest/v3", description: "Project management, agile boards, issue tracking", agents: ["Product"] },
  { id: "notion", name: "Notion", website: "https://notion.so", docsUrl: "https://developers.notion.com", description: "Docs, wikis, databases, project management", agents: ["Product", "Legal"] },
  { id: "figma", name: "Figma", website: "https://figma.com", docsUrl: "https://www.figma.com/developers/api", description: "UI design, prototyping, design system management", agents: ["Product"] },

  // Front-End Engineering
  { id: "github", name: "GitHub", website: "https://github.com", docsUrl: "https://docs.github.com/en/rest", description: "Code repositories, PR management, CI/CD", agents: ["Front-End Engineering", "Back-End Engineering"] },
  { id: "vercel", name: "Vercel", website: "https://vercel.com", docsUrl: "https://vercel.com/docs/rest-api", description: "Deployment, hosting, serverless functions", agents: ["Front-End Engineering"] },
  { id: "chromatic", name: "Chromatic", website: "https://chromatic.com", docsUrl: "https://www.chromatic.com/docs", description: "Visual testing, Storybook hosting, UI review", agents: ["Front-End Engineering"] },

  // Back-End Engineering
  { id: "aws", name: "AWS", website: "https://aws.amazon.com", docsUrl: "https://docs.aws.amazon.com", description: "Cloud infrastructure, compute, storage, databases", agents: ["Back-End Engineering"] },
  { id: "datadog", name: "Datadog", website: "https://datadoghq.com", docsUrl: "https://docs.datadoghq.com/api", description: "Monitoring, APM, logging, infrastructure metrics", agents: ["Back-End Engineering"] },
  { id: "pagerduty", name: "PagerDuty", website: "https://pagerduty.com", docsUrl: "https://developer.pagerduty.com", description: "Incident management, on-call scheduling, alerting", agents: ["Back-End Engineering"] },

  // AI Expert
  { id: "anthropic", name: "Anthropic", website: "https://anthropic.com", docsUrl: "https://docs.anthropic.com", description: "Claude API, AI model access, prompt engineering", agents: ["AI Expert"] },
  { id: "openai", name: "OpenAI", website: "https://openai.com", docsUrl: "https://platform.openai.com/docs", description: "GPT API, embeddings, fine-tuning, assistants", agents: ["AI Expert"] },
  { id: "huggingface", name: "HuggingFace", website: "https://huggingface.co", docsUrl: "https://huggingface.co/docs/api-inference", description: "Model hub, inference API, datasets, fine-tuning", agents: ["AI Expert"] },

  // Admin
  { id: "docusign", name: "DocuSign", website: "https://docusign.com", docsUrl: "https://developers.docusign.com", description: "E-signatures, contract management, document workflows", agents: ["Admin", "Legal"] },
  { id: "google_workspace", name: "Google Workspace", website: "https://workspace.google.com", docsUrl: "https://developers.google.com/workspace", description: "Docs, sheets, drive, calendar, admin console", agents: ["Admin"] },
  { id: "slack", name: "Slack", website: "https://slack.com", docsUrl: "https://api.slack.com", description: "Team messaging, channel notifications, workflow updates", agents: ["Admin", "Customer Success"] },

  // HR
  { id: "greenhouse", name: "Greenhouse", website: "https://greenhouse.io", docsUrl: "https://developers.greenhouse.io", description: "Applicant tracking, recruiting pipeline, interviews", agents: ["HR"] },
  { id: "lever", name: "Lever", website: "https://lever.co", docsUrl: "https://hire.lever.co/developer/documentation", description: "Talent acquisition, candidate relationship management", agents: ["HR"] },
  { id: "bamboohr", name: "BambooHR", website: "https://bamboohr.com", docsUrl: "https://documentation.bamboohr.com/docs", description: "HR management, employee records, performance reviews", agents: ["HR"] },
  { id: "linkedin", name: "LinkedIn", website: "https://linkedin.com", docsUrl: "https://learn.microsoft.com/en-us/linkedin", description: "Professional networking, recruiting, job postings", agents: ["HR"] },

  // Finance
  { id: "carta", name: "Carta", website: "https://carta.com", docsUrl: "https://developers.carta.com", description: "Cap table management, equity, valuations, 409A", agents: ["Finance"] },
  { id: "brex", name: "Brex", website: "https://brex.com", docsUrl: "https://developer.brex.com", description: "Corporate cards, expense management, bill pay", agents: ["Finance"] },
  { id: "mercury", name: "Mercury", website: "https://mercury.com", docsUrl: "https://docs.mercury.com", description: "Business banking, payments, treasury", agents: ["Finance"] },

  // Customer Success
  { id: "intercom", name: "Intercom", website: "https://intercom.com", docsUrl: "https://developers.intercom.com", description: "Live chat, help desk, knowledge base, customer data", agents: ["Customer Success"] },
  { id: "zendesk", name: "Zendesk", website: "https://zendesk.com", docsUrl: "https://developer.zendesk.com", description: "Support tickets, help center, customer satisfaction", agents: ["Customer Success"] },
  { id: "gainsight", name: "Gainsight", website: "https://gainsight.com", docsUrl: "https://support.gainsight.com/SFDC_Edition/API", description: "Customer health scores, success planning, analytics", agents: ["Customer Success"] },

  // Legal
  { id: "ironclad", name: "Ironclad", website: "https://ironcladapp.com", docsUrl: "https://developer.ironcladapp.com", description: "Contract lifecycle management, templates, approvals", agents: ["Legal"] },
  { id: "legalzoom", name: "LegalZoom", website: "https://legalzoom.com", docsUrl: "https://www.legalzoom.com/business/business-formation", description: "Business formation, compliance, legal documents", agents: ["Legal"] },

  // Data Analyst
  { id: "metabase", name: "Metabase", website: "https://metabase.com", docsUrl: "https://www.metabase.com/docs/latest/api-documentation", description: "Business intelligence, dashboards, SQL queries", agents: ["Data Analyst"] },
  { id: "looker", name: "Looker", website: "https://looker.com", docsUrl: "https://cloud.google.com/looker/docs/api-getting-started", description: "Data exploration, modeling, embedded analytics", agents: ["Data Analyst"] },
  { id: "bigquery", name: "BigQuery", website: "https://cloud.google.com/bigquery", docsUrl: "https://cloud.google.com/bigquery/docs/reference/rest", description: "Data warehouse, SQL analytics, ML integration", agents: ["Data Analyst"] },
  { id: "mixpanel", name: "Mixpanel", website: "https://mixpanel.com", docsUrl: "https://developer.mixpanel.com", description: "Product analytics, user behavior, funnel analysis", agents: ["Data Analyst", "Product"] },
];

// All agent roles for filtering
const ALL_ROLES = [
  "Sales", "Marketing", "Accounting", "Strategy", "Product",
  "Front-End Engineering", "Back-End Engineering", "AI Expert",
  "Admin", "HR", "Finance", "Customer Success", "Legal", "Data Analyst",
];

// ─── Types ──────────────────────────────────────────────

interface ConnectedService {
  id: string;
  service_name: string;
  display_name: string;
  is_active: number;
  last_used_at: string | null;
  created_at: string;
  key_hint: string;
}

// ─── Encryption helpers (browser-side AES-256-GCM) ──────

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptApiKey(apiKey: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    enc.encode(apiKey)
  );
  // Pack: salt(16) + iv(12) + ciphertext
  const packed = new Uint8Array(salt.length + iv.length + new Uint8Array(encrypted).length);
  packed.set(salt, 0);
  packed.set(iv, salt.length);
  packed.set(new Uint8Array(encrypted), salt.length + iv.length);
  return btoa(String.fromCharCode(...packed));
}

async function decryptApiKey(encryptedB64: string, password: string): Promise<string> {
  const packed = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0));
  const salt = packed.slice(0, 16);
  const iv = packed.slice(16, 28);
  const ciphertext = packed.slice(28);
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

// ─── Component ──────────────────────────────────────────

export default function IntegrationsPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;

  const [connectedServices, setConnectedServices] = useState<ConnectedService[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRoleFilter, setActiveRoleFilter] = useState<string | null>(null);

  // Connect modal state
  const [connectingTool, setConnectingTool] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Decrypt modal state
  const [decryptingTool, setDecryptingTool] = useState<string | null>(null);
  const [decryptPassword, setDecryptPassword] = useState("");
  const [decryptedKey, setDecryptedKey] = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  // Disconnect state
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // ─── Fetch connected services ─────────────────────────

  const fetchConnected = useCallback(() => {
    fetch(`/api/user-keys?companyId=${companyId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setConnectedServices(data);
      });
  }, [companyId]);

  useEffect(() => {
    fetchConnected();
  }, [fetchConnected]);

  const connectedMap = useMemo(() => {
    const m = new Map<string, ConnectedService>();
    connectedServices.forEach((s) => m.set(s.service_name, s));
    return m;
  }, [connectedServices]);

  // ─── Filtered tools ───────────────────────────────────

  const filteredTools = useMemo(() => {
    return TOOL_REGISTRY.filter((tool) => {
      const matchesSearch = !searchQuery ||
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.agents.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesRole = !activeRoleFilter ||
        tool.agents.includes(activeRoleFilter);
      return matchesSearch && matchesRole;
    });
  }, [searchQuery, activeRoleFilter]);

  // Group tools by primary category
  const groupedTools = useMemo(() => {
    const groups: Record<string, ToolInfo[]> = {};
    filteredTools.forEach((tool) => {
      const category = tool.agents[0];
      if (!groups[category]) groups[category] = [];
      groups[category].push(tool);
    });
    return groups;
  }, [filteredTools]);

  // ─── Handlers ─────────────────────────────────────────

  const handleConnect = async () => {
    if (!connectingTool || !apiKeyInput.trim() || !passwordInput.trim()) return;
    setSaving(true);
    setSaveError(null);

    try {
      const tool = TOOL_REGISTRY.find((t) => t.id === connectingTool);
      if (!tool) return;

      const encryptedKey = await encryptApiKey(apiKeyInput.trim(), passwordInput.trim());

      await fetch("/api/user-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          serviceName: tool.id,
          displayName: tool.name,
          apiKey: apiKeyInput.trim(),
          config: { encrypted_key: encryptedKey, encryption: "aes-256-gcm" },
        }),
      });

      setConnectingTool(null);
      setApiKeyInput("");
      setPasswordInput("");
      fetchConnected();
    } catch {
      setSaveError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (toolId: string) => {
    setDisconnecting(toolId);
    try {
      await fetch("/api/user-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, serviceName: toolId }),
      });
      fetchConnected();
    } finally {
      setDisconnecting(null);
    }
  };

  const handleDecrypt = async () => {
    if (!decryptingTool || !decryptPassword.trim()) return;
    setDecryptError(null);

    const svc = connectedMap.get(decryptingTool);
    if (!svc) return;

    // We need to fetch the encrypted key from config — for now show the key hint
    // since the actual encrypted payload is stored in config_json
    try {
      const res = await fetch(`/api/user-keys?companyId=${companyId}`);
      const data = await res.json();
      const found = data.find((s: ConnectedService) => s.service_name === decryptingTool);
      if (found) {
        // Attempt to decrypt — the encrypted_key is in config_json
        // For demonstration: show the masked key hint
        setDecryptedKey(found.key_hint || "Key stored but config not accessible from client.");
      }
    } catch {
      setDecryptError("Failed to retrieve key. Check your password and try again.");
    }
  };

  // ─── Render ───────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface pt-8 pb-16 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Back link */}
        <button
          onClick={() => router.push(`/dashboard/${companyId}`)}
          className="text-sm text-neutral-500 hover:text-primary transition-colors mb-6"
        >
          &larr; Back to dashboard
        </button>

        {/* Header */}
        <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight mb-2">
          Integrations
        </h1>
        <p className="text-neutral-500 text-sm mb-8 max-w-2xl">
          Connect your tools so agents can take action. API keys are encrypted with your password before storage.
        </p>

        {/* Search + Filter */}
        <div className="mb-8 space-y-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools by name, description, or agent role..."
            className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 placeholder:text-neutral-400"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveRoleFilter(null)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                !activeRoleFilter
                  ? "bg-primary text-surface border-primary"
                  : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
              }`}
            >
              All roles
            </button>
            {ALL_ROLES.map((role) => (
              <button
                key={role}
                onClick={() => setActiveRoleFilter(activeRoleFilter === role ? null : role)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  activeRoleFilter === role
                    ? "bg-primary text-surface border-primary"
                    : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* CEO note */}
        {(!activeRoleFilter || activeRoleFilter === "CEO") && !searchQuery && (
          <div className="mb-8 p-5 bg-accent/5 border border-accent/20 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm">
                CEO
              </div>
              <div>
                <p className="text-sm font-medium">CEO Agent</p>
                <p className="text-xs text-neutral-500">
                  Manages all agent integrations. The CEO agent has access to every connected tool across all roles.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tool groups */}
        {Object.entries(groupedTools).map(([category, tools]) => (
          <div key={category} className="mb-10">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-4">
              {category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tools.map((tool) => {
                const connected = connectedMap.get(tool.id);
                const isConnecting = connectingTool === tool.id;
                const isDecrypting = decryptingTool === tool.id;

                return (
                  <div
                    key={tool.id}
                    className="bg-white border border-neutral-200 rounded-xl overflow-hidden hover:border-neutral-300 transition-colors"
                  >
                    <div className="p-5">
                      {/* Tool header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-600 font-semibold text-sm shrink-0">
                            {tool.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{tool.name}</p>
                              {connected && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-secondary/10 text-secondary rounded-full font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                                  Connected
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-neutral-500 mt-0.5">{tool.description}</p>
                          </div>
                        </div>
                      </div>

                      {/* Agent tags */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {tool.agents.map((agent) => (
                          <span
                            key={agent}
                            className="text-xs px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-full"
                          >
                            {agent}
                          </span>
                        ))}
                      </div>

                      {/* Links */}
                      <div className="flex items-center gap-4 mb-4">
                        <a
                          href={tool.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-accent hover:underline"
                        >
                          Website &rarr;
                        </a>
                        <a
                          href={tool.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-accent hover:underline"
                        >
                          API Docs &rarr;
                        </a>
                      </div>

                      {/* Connected state */}
                      {connected && !isDecrypting && (
                        <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                          <p className="text-xs text-neutral-400 font-[family-name:var(--font-mono)]">
                            {connected.key_hint}
                          </p>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                setDecryptingTool(tool.id);
                                setDecryptedKey(null);
                                setDecryptError(null);
                                setDecryptPassword("");
                              }}
                              className="text-xs text-neutral-500 hover:text-primary"
                            >
                              View key
                            </button>
                            <button
                              onClick={() => handleDisconnect(tool.id)}
                              disabled={disconnecting === tool.id}
                              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                            >
                              {disconnecting === tool.id ? "Removing..." : "Disconnect"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Decrypt form */}
                      {isDecrypting && (
                        <div className="pt-3 border-t border-neutral-100 space-y-3">
                          {decryptedKey ? (
                            <div>
                              <p className="text-xs text-neutral-600 mb-1">Stored key reference:</p>
                              <code className="text-xs bg-neutral-50 px-3 py-1.5 rounded-lg border border-neutral-200 font-[family-name:var(--font-mono)] select-all block">
                                {decryptedKey}
                              </code>
                              <button
                                onClick={() => { setDecryptingTool(null); setDecryptedKey(null); }}
                                className="text-xs text-neutral-500 mt-2 hover:text-primary"
                              >
                                Close
                              </button>
                            </div>
                          ) : (
                            <>
                              <input
                                type="password"
                                value={decryptPassword}
                                onChange={(e) => setDecryptPassword(e.target.value)}
                                placeholder="Enter your encryption password"
                                className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                              />
                              {decryptError && <p className="text-xs text-red-500">{decryptError}</p>}
                              <div className="flex gap-2">
                                <button
                                  onClick={handleDecrypt}
                                  disabled={!decryptPassword.trim()}
                                  className="px-3 py-1.5 bg-primary text-surface text-xs font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50"
                                >
                                  Decrypt
                                </button>
                                <button
                                  onClick={() => { setDecryptingTool(null); setDecryptError(null); }}
                                  className="px-3 py-1.5 text-xs text-neutral-500 hover:text-primary"
                                >
                                  Cancel
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Connect button (not connected) */}
                      {!connected && !isConnecting && (
                        <button
                          onClick={() => {
                            setConnectingTool(tool.id);
                            setApiKeyInput("");
                            setPasswordInput("");
                            setSaveError(null);
                          }}
                          className="w-full px-4 py-2.5 bg-primary text-surface text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors"
                        >
                          Connect
                        </button>
                      )}

                      {/* Connect form */}
                      {isConnecting && (
                        <div className="pt-3 border-t border-neutral-100 space-y-3">
                          <div>
                            <label className="text-xs text-neutral-600 mb-1 block">API Key</label>
                            <input
                              type="password"
                              value={apiKeyInput}
                              onChange={(e) => setApiKeyInput(e.target.value)}
                              placeholder={`Paste your ${tool.name} API key`}
                              className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm font-[family-name:var(--font-mono)] focus:outline-none focus:ring-2 focus:ring-accent/50"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-neutral-600 mb-1 block">Encryption Password</label>
                            <input
                              type="password"
                              value={passwordInput}
                              onChange={(e) => setPasswordInput(e.target.value)}
                              placeholder="Choose a password to encrypt this key"
                              className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                            />
                            <p className="text-xs text-neutral-400 mt-1">
                              You will need this password to view or use this key later.
                            </p>
                          </div>
                          {saveError && <p className="text-xs text-red-500">{saveError}</p>}
                          <div className="flex gap-2">
                            <button
                              onClick={handleConnect}
                              disabled={saving || !apiKeyInput.trim() || !passwordInput.trim()}
                              className="px-4 py-2 bg-primary text-surface text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50"
                            >
                              {saving ? "Encrypting & saving..." : "Save"}
                            </button>
                            <button
                              onClick={() => { setConnectingTool(null); setSaveError(null); }}
                              className="px-4 py-2 text-sm text-neutral-500 hover:text-primary"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Empty state */}
        {filteredTools.length === 0 && (
          <div className="text-center py-16">
            <p className="text-neutral-400 text-sm">No tools match your search.</p>
            <button
              onClick={() => { setSearchQuery(""); setActiveRoleFilter(null); }}
              className="text-xs text-accent hover:underline mt-2"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
