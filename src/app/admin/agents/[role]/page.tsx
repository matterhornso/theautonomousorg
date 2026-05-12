import Link from "next/link";
import { notFound } from "next/navigation";
import {
  PageHeader,
  Section,
  Pill,
  StatusDot,
  Code,
  RelativeTime,
  Button,
  KeyValue,
} from "../../_components/primitives";
import {
  ArrowUpRight,
  ClockIcon,
  PlayIcon,
  MessageIcon,
  SparkleIcon,
  AgentsIcon,
} from "../../_components/icons";
import {
  recentRuns,
  roleAgents,
  slugify,
  type RunStatus,
} from "../../_data/mock";
import { loadAgentRunsByRole } from "../../_lib/admin-data";
import { resolveTenant } from "../../_lib/resolve-tenant";

const statusMap: Record<
  RunStatus,
  { tone: "success" | "danger" | "accent" | "warning"; label: string }
> = {
  succeeded: { tone: "success", label: "Succeeded" },
  failed: { tone: "danger", label: "Failed" },
  running: { tone: "accent", label: "Running" },
  needs_approval: { tone: "warning", label: "Approval" },
};

const triggerLabel: Record<string, string> = {
  schedule: "Schedule",
  messaging: "Messaging",
  manual: "Manual",
  webhook: "Webhook",
  orchestrator: "Orchestrator",
};

export default async function AgentRoleRunsPage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  const agent = roleAgents.find((r) => slugify(r.role) === role);
  if (!agent) notFound();

  // Try real agent_runs first; fall back to filtered mock when empty so the
  // UI keeps rendering before any real runs exist.
  const tenant = await resolveTenant();
  const realRuns = await loadAgentRunsByRole(tenant.firm.id, agent.role, 30);
  const roleRuns =
    realRuns.length > 0
      ? realRuns
      : recentRuns.filter((r) => r.agentRole === agent.role);
  const lessonsSample = mockLessons(agent.role);

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <AgentsIcon className="w-3.5 h-3.5" />
            <span>{agent.orchestrator ? "Orchestrator" : "Role agent"}</span>
            <span className="text-neutral-400">·</span>
            <Code>{agent.id}</Code>
          </span>
        }
        title={`${agent.role} agent.`}
        description={agent.description}
        rail={
          <>
            <Button variant="outline" size="sm">
              Configure
            </Button>
            <Button size="sm">
              <PlayIcon className="w-4 h-4" />
              Run now
            </Button>
          </>
        }
      />

      {/* ── Agent header strip ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-y-6 gap-x-4 -mx-6 px-6 py-6 border-y border-neutral-200/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary text-surface flex items-center justify-center font-[family-name:var(--font-serif)] text-[14px]">
            {agent.monogram}
          </div>
          <div className="flex flex-col">
            <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
              Status
            </span>
            <span className="text-[14px] text-primary flex items-center gap-2">
              <StatusDot tone={agent.enabled ? "success" : "neutral"} live={agent.enabled} />
              {agent.enabled ? "Active" : "Off"}
            </span>
          </div>
        </div>
        <KeyValue label="Runs · 7d">
          <span className="tabular">{agent.runs7d}</span>
        </KeyValue>
        <KeyValue label="Avg run">
          <span className="tabular">
            {agent.avgRunMs > 0 ? `${(agent.avgRunMs / 1000).toFixed(1)}s` : "—"}
          </span>
        </KeyValue>
        <KeyValue label="Acceptance">
          <span className="tabular">
            {agent.enabled ? `${Math.round(agent.acceptance * 100)}%` : "—"}
          </span>
        </KeyValue>
        <KeyValue label="Lessons">
          <span className="tabular">{agent.lessons}</span>
        </KeyValue>
      </div>

      {/* ── Two-col: runs (8) + side panel (4) ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-12">
        <Section title="Recent runs" description="Most recent first.">
          {roleRuns.length === 0 ? (
            <div className="text-[14px] text-neutral-500 italic py-8 text-center">
              No runs yet for this agent.
            </div>
          ) : (
            <ul className="divide-y divide-neutral-200/50">
              {roleRuns.map((run, i) => {
                const s = statusMap[run.status];
                return (
                  <li
                    key={run.id}
                    className={`animate-fade-up delay-${((i % 5) + 1) as 1 | 2 | 3 | 4 | 5}`}
                  >
                    <Link
                      href={`/admin/agents/${role}/${run.id}`}
                      className="grid grid-cols-[100px_minmax(0,1fr)_120px_120px_40px] items-start gap-4 px-3 py-4 -mx-3 rounded-md hover:bg-[rgba(212,168,83,0.05)] transition-colors group"
                    >
                      <div className="flex items-center gap-2 pt-0.5">
                        <StatusDot tone={s.tone} live={run.status === "running"} />
                        <span className="text-[12.5px] text-neutral-700">{s.label}</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <p className="text-[14px] text-primary leading-relaxed">
                          {run.summary}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[11.5px] text-neutral-500">
                          <Code>{run.id}</Code>
                          {run.tokensUsed > 0 && (
                            <span className="tabular">
                              {run.tokensUsed.toLocaleString("en-IN")} tok
                            </span>
                          )}
                          {run.toolCallsUsed > 0 && (
                            <span className="tabular">
                              {run.toolCallsUsed} tools
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[12.5px] text-neutral-600">
                        {run.triggeredBy === "messaging" && (
                          <MessageIcon className="w-3.5 h-3.5 text-[#2D5A3D]" />
                        )}
                        <span>{triggerLabel[run.triggeredBy]}</span>
                      </div>
                      <span className="text-[12.5px]">
                        <ClockIcon className="w-3.5 h-3.5 inline-block mr-1 text-neutral-400" />
                        <RelativeTime ts={run.startedAt} />
                      </span>
                      <ArrowUpRight className="w-4 h-4 text-neutral-300 group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <aside className="flex flex-col gap-10">
          <Section title="Lessons learned">
            <ul className="flex flex-col gap-3">
              {lessonsSample.map((l, i) => (
                <li
                  key={i}
                  className="flex gap-3 py-2 border-l-2 border-neutral-200 pl-3"
                >
                  <SparkleIcon className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[13px] text-primary leading-snug">{l.text}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Pill tone={lessonTone(l.status)}>{l.status}</Pill>
                      <span className="text-[11px] text-neutral-500">{l.when}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Triggers">
            <ul className="flex flex-col gap-3 text-[13.5px] text-neutral-700">
              <li className="flex justify-between gap-3">
                <span>Schedule</span>
                <span className="text-neutral-500 font-[family-name:var(--font-mono)] text-[12px]">
                  {triggerCron(agent.role)}
                </span>
              </li>
              <li className="flex justify-between gap-3">
                <span>Messaging intent</span>
                <span className="text-neutral-500">on inbound match</span>
              </li>
              <li className="flex justify-between gap-3">
                <span>Manual</span>
                <span className="text-neutral-500">from this page</span>
              </li>
            </ul>
          </Section>

          <Link
            href="/admin/agents"
            className="text-[13px] text-neutral-600 hover:text-primary transition-colors flex items-center gap-1.5 self-start"
          >
            <ArrowUpRight className="w-3.5 h-3.5 rotate-180" />
            Back to all agents
          </Link>
        </aside>
      </div>
    </div>
  );
}

// ─── Local helpers ─────────────────────────────────────────────────────────

interface MockLesson {
  text: string;
  status: "approved" | "modified" | "rejected" | "unknown";
  when: string;
}

function mockLessons(role: string): MockLesson[] {
  const generic: Record<string, MockLesson[]> = {
    Sales: [
      {
        text: "Series-B fintech reply rate is 3.4x — narrow ICP weighting accordingly.",
        status: "approved",
        when: "5d ago",
      },
      {
        text: "Outbound between 10-11 AM IST gets 28% better open rates than 4-5 PM.",
        status: "approved",
        when: "11d ago",
      },
      {
        text: "Founder asked to drop 'unleash' from openers — too AI-sounding.",
        status: "modified",
        when: "16d ago",
      },
    ],
    Marketing: [
      {
        text: "Long-form retention deep-dives outperform listicle posts 4:1 on time-on-page.",
        status: "approved",
        when: "8d ago",
      },
      {
        text: "Twitter/X threads between 7-9 tweets convert best to newsletter signups.",
        status: "approved",
        when: "13d ago",
      },
    ],
    Legal: [
      {
        text: "Auto-renewal clauses always need a 90-day notice carve-out — partner standard.",
        status: "approved",
        when: "3d ago",
      },
      {
        text: "Counsel preferred indemnity caps at 12 months over 18 — adjusted recommendation.",
        status: "modified",
        when: "9d ago",
      },
    ],
    "Customer Success": [
      {
        text: "NPS drops below 40 → trigger save-by-team playbook within 48h.",
        status: "approved",
        when: "6d ago",
      },
      {
        text: "Auto-reply on inbound 'cancel' tickets felt cold — switched to human-first routing.",
        status: "rejected",
        when: "10d ago",
      },
    ],
    Finance: [
      {
        text: "Monthly close: variance threshold raised to ±15% from ±10% — too noisy at 10%.",
        status: "modified",
        when: "4d ago",
      },
    ],
    HR: [
      {
        text: "Senior PM screen — pass-through rate for non-MBA candidates is +24%; remove the filter.",
        status: "approved",
        when: "7d ago",
      },
    ],
    CEO: [
      {
        text: "Daily summary: lead with the one decision needed today, then context.",
        status: "approved",
        when: "2d ago",
      },
      {
        text: "Approval cards above ₹10L need both founder + counsel — auto-fan-out.",
        status: "approved",
        when: "12d ago",
      },
    ],
    Strategy: [
      {
        text: "Competitive scans every 2 weeks (was weekly) — signal density too low at weekly.",
        status: "approved",
        when: "14d ago",
      },
    ],
    Operations: [
      {
        text: "Slack 401: rotate the bot token monthly, not on-incident.",
        status: "approved",
        when: "1d ago",
      },
    ],
  };
  return (
    generic[role] ?? [
      {
        text: "No lessons recorded yet — runs will start populating this list.",
        status: "unknown",
        when: "—",
      },
    ]
  );
}

function lessonTone(
  status: MockLesson["status"]
): "success" | "warning" | "danger" | "neutral" {
  if (status === "approved") return "success";
  if (status === "modified") return "warning";
  if (status === "rejected") return "danger";
  return "neutral";
}

function triggerCron(role: string): string {
  const map: Record<string, string> = {
    Sales: "0 9 * * 1-5",
    Marketing: "0 10 * * 1",
    Legal: "manual",
    "Customer Success": "*/5 * * * *",
    Finance: "0 0 1 * *",
    HR: "0 */12 * * *",
    CEO: "0 7 * * *",
    Strategy: "0 9 * * 1",
    Operations: "0 9 * * 1",
  };
  return map[role] ?? "manual";
}
