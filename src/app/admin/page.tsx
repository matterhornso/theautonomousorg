import Link from "next/link";
import {
  Pill,
  StatusDot,
  Stat,
  PageHeader,
  Section,
  Code,
  RelativeTime,
  Button,
  KeyValue,
} from "./_components/primitives";
import {
  ArrowUpRight,
  ClockIcon,
  AlertIcon,
  ApprovalsIcon,
  PlayIcon,
} from "./_components/icons";
import { slugify, type RunStatus } from "./_data/mock";
import { loadAdminBootstrap } from "./_lib/admin-data";

export default async function AdminOverviewPage() {
  const { firm, roleAgents, recentRuns, pendingApprovals, notifications } =
    await loadAdminBootstrap();
  const enabledAgents = roleAgents.filter((a) => a.enabled).length;
  const totalRuns7d = roleAgents.reduce((sum, a) => sum + a.runs7d, 0);
  const openP1P2 = notifications.filter(
    (n) => !n.acknowledgedAt && (n.severity === "P1" || n.severity === "P2")
  ).length;
  const openApprovals = pendingApprovals.length;
  const liveRun = recentRuns.find((r) => r.status === "running");

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow={`${firm.name} · Workspace`}
        title="Today, the company ran on autopilot."
        description={`${enabledAgents} agents active across roles. ${totalRuns7d} runs in the last seven days. The CEO agent is surfacing ${openApprovals} decisions that need a human.`}
        rail={
          <>
            <Button variant="outline" size="sm">
              Pause all agents
            </Button>
            <Button size="sm">
              <PlayIcon className="w-4 h-4" />
              New run
            </Button>
          </>
        }
      />

      {/* ── Live run strip ───────────────────────────────────────────── */}
      {liveRun && (
        <div className="-mx-6 px-6 py-4 bg-[rgba(212,168,83,0.08)] border-y border-accent/20 flex items-center gap-4 animate-fade-up">
          <StatusDot tone="accent" live />
          <span className="text-[12px] uppercase tracking-[0.16em] text-accent font-medium">
            Live
          </span>
          <span className="text-[14px] text-primary flex-1 truncate">
            <span className="font-medium">{liveRun.agentRole} agent</span>
            <span className="text-neutral-500"> · </span>
            {liveRun.summary}
          </span>
          <Link
            href={`/admin/agents/${slugify(liveRun.agentRole)}/${liveRun.id}`}
            className="text-[13px] text-primary hover:text-accent transition-colors flex items-center gap-1.5"
          >
            View trace
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* ── Hero stats — asymmetric grid ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] divide-y md:divide-y-0 md:divide-x divide-neutral-200/80 -mx-6">
        <div className="px-6">
          <Stat
            label="Tasks completed today"
            value="184"
            delta={{ value: "+18% vs Mon", tone: "success" }}
            hint={`across ${enabledAgents} active agents`}
          />
        </div>
        <div className="px-6">
          <Stat label="Hours saved" value="127" hint="last 7 days" />
        </div>
        <div className="px-6">
          <Stat
            label="Open approvals"
            value={openApprovals}
            delta={{ value: "from CEO agent", tone: "warning" }}
          />
        </div>
        <div className="px-6">
          <Stat
            label="Alerts"
            value={openP1P2}
            delta={{ value: "P1 / P2", tone: "danger" }}
          />
        </div>
      </div>

      {/* ── Recent runs (left) + right rail ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-12">
        <div className="flex flex-col">
          <Section
            title="Recent runs"
            description="Across every role agent. The CEO orchestrator's runs show first when active."
            rail={
              <Link
                href="/admin/agents"
                className="text-[13px] text-neutral-600 hover:text-primary flex items-center gap-1.5 transition-colors"
              >
                View all
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            }
          >
            <ul className="divide-y divide-neutral-200/60">
              {recentRuns.slice(0, 6).map((run, i) => (
                <li
                  key={run.id}
                  className={`animate-fade-up delay-${((i % 5) + 1) as 1 | 2 | 3 | 4 | 5}`}
                >
                  <Link
                    href={`/admin/agents/${slugify(run.agentRole)}/${run.id}`}
                    className="group flex items-start gap-5 py-5 -mx-3 px-3 rounded-md hover:bg-[rgba(212,168,83,0.05)] transition-colors"
                  >
                    <RunStatusBadge status={run.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span className="text-[15px] font-medium text-primary">
                          {run.agentRole} agent
                        </span>
                        <Code>{run.id}</Code>
                      </div>
                      <p className="text-[14px] text-neutral-700 leading-relaxed mt-1.5 line-clamp-2">
                        {run.summary}
                      </p>
                      <div className="flex items-center gap-4 mt-2.5 text-[12.5px] text-neutral-500">
                        <span className="flex items-center gap-1.5">
                          <ClockIcon className="w-3.5 h-3.5" />
                          <RelativeTime ts={run.startedAt} />
                        </span>
                        {run.durationMs > 0 && (
                          <span className="tabular">
                            {(run.durationMs / 1000).toFixed(1)}s
                          </span>
                        )}
                        {run.tokensUsed > 0 && (
                          <span className="tabular">
                            {run.tokensUsed.toLocaleString("en-IN")} tok
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-neutral-300 group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 mt-1" />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <aside className="flex flex-col gap-10">
          <Section
            title="From the CEO agent"
            description="Decisions the orchestrator is escalating to a human."
            rail={
              <Link
                href="/admin/approvals"
                className="text-[12.5px] text-neutral-500 hover:text-primary flex items-center gap-1 transition-colors"
              >
                <span>{openApprovals}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            }
          >
            <ul className="flex flex-col gap-4">
              {pendingApprovals.slice(0, 3).map((a) => (
                <li
                  key={a.cardId}
                  className="flex flex-col gap-1.5 py-3 border-l-2 border-accent/40 pl-4 hover:border-accent transition-colors"
                >
                  <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-neutral-500">
                    <ApprovalsIcon className="w-3.5 h-3.5" />
                    via {a.escalatedFromRole}
                  </span>
                  <span className="text-[14px] text-primary leading-snug">
                    {a.title}
                  </span>
                  <span className="text-[12px] text-neutral-500">
                    To {a.toName}
                    <span className="text-neutral-300"> · </span>
                    <RelativeTime ts={a.sentAt} />
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title="Recent alerts"
            rail={
              <Link
                href="/admin/notifications"
                className="text-[12.5px] text-neutral-500 hover:text-primary flex items-center gap-1 transition-colors"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            }
          >
            <ul className="flex flex-col gap-4">
              {notifications
                .filter((n) => !n.acknowledgedAt)
                .slice(0, 3)
                .map((n) => (
                  <li key={n.id} className="flex gap-3 py-2">
                    <div className="pt-1">
                      <AlertIcon
                        className={`w-4 h-4 ${
                          n.severity === "P1"
                            ? "text-[#B33A3A]"
                            : n.severity === "P2"
                              ? "text-[#C4891A]"
                              : "text-neutral-400"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Pill
                          tone={
                            n.severity === "P1"
                              ? "danger"
                              : n.severity === "P2"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {n.severity}
                        </Pill>
                        <span className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">
                          via {n.fromRole}
                        </span>
                      </div>
                      <p className="text-[14px] text-primary leading-snug mt-1.5">
                        {n.subject}
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
          </Section>

          <div className="grid grid-cols-2 gap-y-5 gap-x-6 pt-5 border-t border-neutral-200/60">
            <KeyValue label="Active agents">{enabledAgents}</KeyValue>
            <KeyValue label="Lessons logged">
              {roleAgents.reduce((s, a) => s + a.lessons, 0)}
            </KeyValue>
            <KeyValue label="Customers">{firm.customers}</KeyValue>
            <KeyValue label="Workspace">{firm.name}</KeyValue>
          </div>
        </aside>
      </div>
    </div>
  );
}

function RunStatusBadge({ status }: { status: RunStatus }) {
  const map = {
    succeeded: { tone: "success" as const, label: "Done" },
    failed: { tone: "danger" as const, label: "Failed" },
    running: { tone: "accent" as const, label: "Live" },
    needs_approval: { tone: "warning" as const, label: "Approve" },
  };
  const { tone, label } = map[status];
  return (
    <div className="flex flex-col items-center gap-1.5 pt-0.5 w-[68px]">
      <StatusDot tone={tone} live={status === "running"} />
      <span className="text-[10.5px] uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </span>
    </div>
  );
}
