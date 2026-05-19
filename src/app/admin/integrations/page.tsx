import {
  PageHeader,
  Section,
  Pill,
  StatusDot,
  Button,
  RelativeTime,
  Code,
} from "../_components/primitives";
import { FlowIcon, ArrowUpRight, BrainIcon } from "../_components/icons";
import { integrations, type IntegrationStatus } from "../_data/mock";
import { resolveTenant } from "../_lib/resolve-tenant";
import { getLLMConfigForCompany } from "@/lib/llm-router";

const statusMap: Record<
  IntegrationStatus,
  { tone: "success" | "warning" | "danger" | "neutral"; label: string }
> = {
  connected: { tone: "success", label: "Connected" },
  needs_auth: { tone: "warning", label: "Re-auth" },
  stale: { tone: "warning", label: "Stale" },
  off: { tone: "neutral", label: "Off" },
};

const categoryLabel: Record<string, string> = {
  messaging: "Messaging",
  crm: "CRM",
  storage: "Storage",
  comms: "Comms",
  finance: "Finance",
  custom: "Custom",
};

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  openai_compat: "OpenAI-compatible",
};

export default async function IntegrationsPage() {
  const tenant = await resolveTenant();
  const llm = await getLLMConfigForCompany(tenant.firm.id);
  const connected = integrations.filter((i) => i.status === "connected").length;
  const needsAttention = integrations.filter(
    (i) => i.status === "needs_auth" || i.status === "stale"
  ).length;
  const totalActivity = integrations.reduce((s, i) => s + i.activity24h, 0);

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <FlowIcon className="w-3.5 h-3.5" />
            Integrations
          </span>
        }
        title="Connectors that feed the agents."
        description="Every external system the role agents read from or write to. Custom webhooks, CRMs, messaging, storage, finance — all tenant-isolated, all logged."
        rail={
          <Button size="sm">
            <FlowIcon className="w-4 h-4" />
            Add connector
          </Button>
        }
      />

      {/* ── Stats strip ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4 -mx-6 px-6 py-6 border-y border-neutral-200/80">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            Connected
          </span>
          <span className="font-[family-name:var(--font-serif)] text-[34px] tabular leading-none text-primary">
            {connected}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            Needs attention
          </span>
          <div className="flex items-baseline gap-3">
            <span className="font-[family-name:var(--font-serif)] text-[34px] tabular leading-none text-primary">
              {needsAttention}
            </span>
            {needsAttention > 0 && <Pill tone="warning">re-auth</Pill>}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            Activity · 24h
          </span>
          <span className="font-[family-name:var(--font-serif)] text-[34px] tabular leading-none text-primary">
            {totalActivity.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            Mode
          </span>
          <span className="text-[14px] text-primary">Tenant-isolated</span>
          <span className="text-[11px] text-neutral-500 font-[family-name:var(--font-mono)]">
            per-firm credentials · RLS
          </span>
        </div>
      </div>

      {/* ── Connector grid ────────────────────────────────────────── */}
      {/* ── Models (BYOM) ─────────────────────────────────────────── */}
      <Section
        title="Models"
        description="The brain every agent in this workspace runs on. Default is Claude Sonnet 4.6; bring your own Anthropic key, an OpenAI key, or any OpenAI-compatible endpoint (Groq, Together, Anyscale, vLLM, Ollama) by adding a credential via the API."
      >
        <div className="-mx-6 px-6 py-5 border-y border-neutral-200/60">
          <div className="grid md:grid-cols-3 gap-y-4 gap-x-6">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
                Active provider
              </span>
              <span className="inline-flex items-center gap-2">
                <BrainIcon className="w-4 h-4 text-accent" />
                <span className="text-[15px] text-primary">
                  {PROVIDER_LABEL[llm.provider] ?? llm.provider}
                </span>
                {llm.byom ? (
                  <Pill tone="accent">BYOM</Pill>
                ) : (
                  <Pill tone="neutral">Platform default</Pill>
                )}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
                Model
              </span>
              <Code>{llm.model}</Code>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
                Endpoint
              </span>
              <Code>{llm.baseURL ?? "anthropic.com"}</Code>
            </div>
          </div>
          <p className="text-[12.5px] text-neutral-500 mt-5 leading-relaxed">
            <strong className="text-neutral-700">Scope note:</strong> chat
            paths route through this provider. Agent runs that use tool-use
            (Apollo, CEO orchestrator, Shopify planner) continue to use
            Anthropic so tool semantics stay consistent. The memory and the
            agents stay the same — only the brain changes.
          </p>
          <p className="text-[12.5px] text-neutral-500 mt-3 leading-relaxed">
            To switch: <Code>POST /api/user-keys</Code> with{" "}
            <Code>{`{ companyId, serviceName, displayName, apiKey }`}</Code>{" "}
            where <Code>serviceName</Code> is{" "}
            <Code>anthropic</Code>, <Code>openai</Code>, or{" "}
            <Code>openai_compat</Code>. For{" "}
            <Code>openai_compat</Code>, supply{" "}
            <Code>{`apiKey`}</Code> as JSON{" "}
            <Code>{`{ apiKey, baseURL, model }`}</Code>.
          </p>
        </div>
      </Section>

      <Section title="Connectors">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {integrations.map((i, idx) => {
            const s = statusMap[i.status];
            return (
              <article
                key={i.id}
                className={`group relative flex flex-col gap-4 p-6 rounded-lg border transition-all hover-lift animate-fade-up delay-${
                  ((idx % 5) + 1) as 1 | 2 | 3 | 4 | 5
                } ${
                  i.status === "off"
                    ? "bg-neutral-50 border-neutral-200/60 opacity-70"
                    : "bg-white border-neutral-200/80"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
                      {categoryLabel[i.category] ?? i.category}
                    </span>
                    <h3 className="font-[family-name:var(--font-serif)] text-[22px] tracking-tight leading-none text-primary mt-1.5">
                      {i.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusDot
                      tone={s.tone}
                      live={i.status === "connected"}
                    />
                  </div>
                </div>

                <p className="text-[13px] text-neutral-600 leading-relaxed">
                  {i.description}
                </p>

                <div className="flex items-center justify-between gap-3 pt-4 mt-auto border-t border-neutral-200/60">
                  <div className="flex flex-col">
                    <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
                      24h activity
                    </span>
                    <span className="font-[family-name:var(--font-serif)] text-[18px] tabular text-primary">
                      {i.activity24h.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
                      Last event
                    </span>
                    <span className="text-[12.5px] text-neutral-700">
                      {i.lastEventAt ? <RelativeTime ts={i.lastEventAt} /> : "—"}
                    </span>
                  </div>
                </div>

                {i.usedBy.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 -mt-1">
                    {i.usedBy.map((role) => (
                      <Pill key={role} tone="neutral">
                        {role}
                      </Pill>
                    ))}
                  </div>
                )}

                {i.status === "needs_auth" && (
                  <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#C4891A]/20">
                    <span className="text-[12px] text-[#7a5212]">
                      Token expired or revoked
                    </span>
                    <Button size="sm">Re-auth</Button>
                  </div>
                )}

                <ArrowUpRight className="w-4 h-4 text-neutral-300 group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all absolute top-6 right-6" />
              </article>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
