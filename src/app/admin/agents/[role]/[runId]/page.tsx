import Link from "next/link";
import { notFound } from "next/navigation";
import {
  PageHeader,
  Section,
  Pill,
  StatusDot,
  Code,
  KeyValue,
  Button,
  RelativeTime,
} from "../../../_components/primitives";
import {
  AgentsIcon,
  ArrowUpRight,
  CheckIcon,
  XIcon,
  SparkleIcon,
  ClockIcon,
} from "../../../_components/icons";
import { recentRuns, roleAgents, slugify, type RunStatus } from "../../../_data/mock";

interface TraceEvent {
  ts: number;
  kind: "lifecycle" | "model_call" | "tool_call" | "log" | "error";
  level: "debug" | "info" | "warn" | "error";
  message: string;
  meta?: string;
}

const statusMap: Record<
  RunStatus,
  { tone: "success" | "danger" | "accent" | "warning"; label: string }
> = {
  succeeded: { tone: "success", label: "Succeeded" },
  failed: { tone: "danger", label: "Failed" },
  running: { tone: "accent", label: "Running" },
  needs_approval: { tone: "warning", label: "Needs approval" },
};

export default async function AgentRunDetailPage({
  params,
}: {
  params: Promise<{ role: string; runId: string }>;
}) {
  const { role, runId } = await params;
  const agent = roleAgents.find((r) => slugify(r.role) === role);
  const run = recentRuns.find((r) => r.id === runId);
  if (!agent || !run) notFound();

  const s = statusMap[run.status];

  // Synthetic trace mirroring AgentTrace from agent-runner.ts
  const trace: TraceEvent[] = [
    {
      ts: 0,
      kind: "lifecycle",
      level: "info",
      message: "beforeRun",
      meta: `agent ${agent.id}`,
    },
    {
      ts: 240,
      kind: "log",
      level: "debug",
      message: "loaded prior lessons",
      meta: "count: 5",
    },
    {
      ts: 1_120,
      kind: "model_call",
      level: "debug",
      message: "model_call iteration 0",
      meta: "claude-sonnet-4-6 · 1240 in / 380 out",
    },
    {
      ts: 11_840,
      kind: "tool_call",
      level: "debug",
      message: traceToolName(agent.role, 0),
      meta: traceToolMeta(agent.role, 0),
    },
    {
      ts: 18_200,
      kind: "tool_call",
      level: "debug",
      message: traceToolName(agent.role, 1),
      meta: traceToolMeta(agent.role, 1),
    },
    {
      ts: 29_400,
      kind: "model_call",
      level: "debug",
      message: "model_call iteration 1",
      meta: "claude-sonnet-4-6 · 4910 in / 1182 out",
    },
    {
      ts: 38_900,
      kind: "lifecycle",
      level: "info",
      message: "afterRun",
      meta: "wrote 1 lesson · escalated to CEO agent",
    },
    {
      ts: 41_200,
      kind: "lifecycle",
      level: "info",
      message: "run complete",
      meta: `tokens ${run.tokensUsed.toLocaleString()} · tools ${run.toolCallsUsed}`,
    },
  ];

  if (run.status === "failed") {
    trace.splice(2, trace.length, {
      ts: 11_800,
      kind: "error",
      level: "error",
      message: traceFailureMessage(agent.role),
      meta: "phase: run · onError fired graceful degradation",
    });
  }

  if (run.status === "running") {
    trace.splice(3, trace.length, {
      ts: 600,
      kind: "model_call",
      level: "debug",
      message: "model_call iteration 0 …",
      meta: "streaming",
    });
  }

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <AgentsIcon className="w-3.5 h-3.5" />
            <Link
              href={`/admin/agents/${role}`}
              className="hover:text-accent transition-colors"
            >
              {agent.role} agent
            </Link>
            <span className="text-neutral-400">·</span>
            <Code>{run.id}</Code>
          </span>
        }
        title={run.summary}
        rail={
          <>
            <Button variant="outline" size="sm">
              Re-run
            </Button>
            {run.status === "needs_approval" && (
              <>
                <Button variant="outline" size="sm">
                  <XIcon className="w-4 h-4" />
                  Reject
                </Button>
                <Button size="sm">
                  <CheckIcon className="w-4 h-4" />
                  Approve
                </Button>
              </>
            )}
          </>
        }
      />

      {/* ── Run header strip ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-y-6 gap-x-4 -mx-6 px-6 py-6 border-y border-neutral-200/80">
        <div className="flex items-center gap-3">
          <StatusDot tone={s.tone} live={run.status === "running"} />
          <div className="flex flex-col">
            <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
              Status
            </span>
            <span className="text-[15px] text-primary">{s.label}</span>
          </div>
        </div>
        <KeyValue label="Run ID">
          <Code>{run.id}</Code>
        </KeyValue>
        <KeyValue label="Started">
          <RelativeTime ts={run.startedAt} />
        </KeyValue>
        <KeyValue label="Duration">
          <span className="tabular">
            {run.durationMs > 0 ? `${(run.durationMs / 1000).toFixed(2)}s` : "—"}
          </span>
        </KeyValue>
        <KeyValue label="Cost">
          <span className="tabular">
            {run.tokensUsed > 0 ? `$${(run.tokensUsed * 0.0000118).toFixed(3)}` : "—"}
          </span>
        </KeyValue>
      </div>

      {/* ── Trace timeline + side panel ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-12">
        <Section title="Trace timeline" description="Every lifecycle event, model call, and tool invocation in order.">
          <ol className="relative pl-8">
            <span aria-hidden className="absolute left-2 top-2 bottom-2 w-px bg-neutral-200" />
            {trace.map((ev, i) => (
              <li key={i} className="relative pb-7 last:pb-0">
                <span
                  className={`absolute -left-[26px] top-2 w-3 h-3 rounded-full border-2 border-surface ${dotColor(ev)}`}
                />
                <div className="flex items-baseline justify-between gap-4">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
                      {ev.kind.replace("_", " ")}
                    </span>
                    <span className="text-[14px] text-primary truncate">
                      {ev.message}
                    </span>
                  </div>
                  <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-neutral-400 shrink-0 tabular">
                    +{(ev.ts / 1000).toFixed(2)}s
                  </span>
                </div>
                {ev.meta && (
                  <p className="text-[12.5px] text-neutral-500 mt-1 font-[family-name:var(--font-mono)] leading-relaxed">
                    {ev.meta}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Section>

        <aside className="flex flex-col gap-10">
          <Section title="Output">
            {run.status === "running" ? (
              <div className="text-[14px] text-neutral-500 italic">
                Streaming response… <span className="animate-cursor-blink">▍</span>
              </div>
            ) : run.status === "failed" ? (
              <div className="text-[14px] text-[#7a2424] bg-[#B33A3A]/5 border border-[#B33A3A]/15 rounded-md p-4">
                Run terminated. Surfaced as a notification through the CEO agent.
              </div>
            ) : (
              <Code block>{traceOutput(agent.role)}</Code>
            )}
          </Section>

          <Section title="Lessons read">
            <ul className="flex flex-col gap-3">
              {[
                {
                  text: "Prior lesson #1 from the agent's recent runs.",
                  status: "approved" as const,
                },
                {
                  text: "Prior lesson #2 — modified by reviewer.",
                  status: "modified" as const,
                },
                {
                  text: "Prior lesson #3 — rejected, marked for re-learning.",
                  status: "rejected" as const,
                },
              ].map((l, i) => (
                <li
                  key={i}
                  className="flex gap-3 py-2 border-l-2 border-neutral-200 pl-3"
                >
                  <SparkleIcon className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[13px] text-primary leading-snug">{l.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Pill
                        tone={
                          l.status === "approved"
                            ? "success"
                            : l.status === "modified"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {l.status}
                      </Pill>
                      <span className="text-[11px] text-neutral-500 flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" />
                        prior run
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Link
            href={`/admin/agents/${role}`}
            className="text-[13px] text-neutral-600 hover:text-primary transition-colors flex items-center gap-1.5 self-start"
          >
            <ArrowUpRight className="w-3.5 h-3.5 rotate-180" />
            Back to {agent.role} runs
          </Link>
        </aside>
      </div>
    </div>
  );
}

// ─── Local helpers ─────────────────────────────────────────────────────────

function dotColor(ev: TraceEvent): string {
  if (ev.kind === "error" || ev.level === "error") return "bg-[#B33A3A]";
  if (ev.kind === "tool_call") return "bg-[#3A6B9B]";
  if (ev.kind === "model_call") return "bg-accent";
  if (ev.kind === "lifecycle") return "bg-[#2D5A3D]";
  return "bg-neutral-400";
}

function traceToolName(role: string, idx: number): string {
  const tools: Record<string, [string, string]> = {
    Sales: ["tool fetch_prospects", "tool send_outbound"],
    Marketing: ["tool draft_post", "tool fetch_seo_signals"],
    Legal: ["tool fetch_contract", "tool diff_redlines"],
    "Customer Success": ["tool fetch_tickets", "tool score_churn_risk"],
    Finance: ["tool fetch_ledger", "tool compute_runway"],
    HR: ["tool fetch_applicants", "tool screen_against_jd"],
    CEO: ["tool aggregate_escalations", "tool draft_brief"],
    Strategy: ["tool fetch_competitor_signals", "tool synthesize_brief"],
    Operations: ["tool fetch_vendor_state", "tool reconcile_renewals"],
  };
  return tools[role]?.[idx] ?? "tool generic";
}

function traceToolMeta(role: string, idx: number): string {
  const metas: Record<string, [string, string]> = {
    Sales: ["rows: 14", "delivered: 14, queued: 0"],
    Marketing: ["draft: 1, words: 1420", "competitors: 6"],
    Legal: ["clauses: 38", "redlines: 3"],
    "Customer Success": ["tickets: 23", "high-risk: 4"],
    Finance: ["entries: 1842", "runway months: 18"],
    HR: ["applicants: 38", "advanced: 7"],
    CEO: ["escalations: 11", "decisions queued: 4"],
    Strategy: ["sources: 9", "themes: 4"],
    Operations: ["vendors: 12", "stale: 3"],
  };
  return metas[role]?.[idx] ?? "—";
}

function traceFailureMessage(role: string): string {
  const map: Record<string, string> = {
    Operations: "Slack connector returned 401 (token rotated)",
    Sales: "HubSpot rate limit exceeded — backing off",
    Legal: "Document store timeout — Vault query > 30s",
    "Customer Success": "Inbound queue connector unreachable",
    Finance: "Stripe API 5xx during reforecast pull",
    HR: "Applicant tracking system timeout",
    CEO: "Cross-agent aggregation failed — one role agent did not respond",
    Strategy: "Competitor signal source unreachable",
    Marketing: "CMS publish endpoint returned 502",
  };
  return map[role] ?? "Run failed — see error trace";
}

function traceOutput(role: string): string {
  const map: Record<string, string> = {
    Sales: `{
  "qualifiedProspects": 14,
  "icpFitDistribution": { "high": 6, "medium": 5, "low": 3 },
  "topReply": "We're hiring an in-house team but happy to learn more — circle back in Q3."
}`,
    Marketing: `{
  "postsDrafted": 3,
  "estimatedReadTimeMin": [6, 8, 7],
  "seoGaps": ["retention loops", "AI in MSME ops"]
}`,
    Legal: `{
  "clausesReviewed": 38,
  "redlines": [
    { "section": "12.3 Auto-renewal", "severity": "high" },
    { "section": "18.1 Indemnity cap", "severity": "high" },
    { "section": "Annex C — Data residency", "severity": "medium" }
  ]
}`,
    "Customer Success": `{
  "ticketsTriaged": 23,
  "routedToHuman": 4,
  "autoResolved": 12,
  "highRiskAccounts": ["Acct A", "Acct B", "Acct C"]
}`,
    Finance: `{
  "runwayMonths": 18,
  "burnUsdMonthly": 182000,
  "varianceAlerts": ["AWS spend +18%", "Contractor +22%", "Events -16%"]
}`,
    HR: `{
  "applicantsScreened": 38,
  "advancedToInterview": 7,
  "rejectedWithReason": 31
}`,
    CEO: `{
  "escalationsAggregated": 11,
  "decisionsQueued": 4,
  "summary": "Three operational alerts plus one strategic ask. Recommend a 15-min huddle with founder + counsel."
}`,
    Strategy: `{
  "competitorMoves": 4,
  "themesSurfaced": ["pricing test", "EU launch", "vertical AI", "API platform"]
}`,
    Operations: `{
  "vendorsTouched": 12,
  "renewalsThisMonth": 3,
  "anomalies": ["Slack 401", "Notion duplicate workspace"]
}`,
  };
  return map[role] ?? "{ \"summary\": \"—\" }";
}
