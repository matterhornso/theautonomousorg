import { getCompany, getAgentsByCompany, getTasksByCompany, getUsage, getSubscription, getActivityFeed } from "@/lib/db";
import { notFound } from "next/navigation";
import { AgentIcon } from "@/app/components/agent-icons";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = getCompany(companyId);
  if (!company) notFound();

  const agents = getAgentsByCompany(companyId);
  const allTasks = getTasksByCompany(companyId);
  const usage = getUsage(companyId);
  const subscription = getSubscription(companyId);
  const activity = getActivityFeed(companyId, 50);

  const tasksDone = allTasks.filter((t) => t.status === "done").length;
  const tasksFailed = allTasks.filter((t) => t.status === "failed").length;
  const tasksRunning = allTasks.filter((t) => t.status === "running" || t.status === "queued").length;
  const successRate = allTasks.length > 0
    ? Math.round((tasksDone / allTasks.length) * 100)
    : 0;

  // Per-agent stats
  const agentStats = agents.map((a) => {
    const agentTasks = allTasks.filter((t) => t.agent_id === a.id);
    const done = agentTasks.filter((t) => t.status === "done").length;
    const failed = agentTasks.filter((t) => t.status === "failed").length;
    const agentActivity = activity.filter((act) => act.agent_id === a.id);

    return {
      id: a.id,
      role: a.role,
      totalTasks: agentTasks.length,
      completed: done,
      failed,
      successRate: agentTasks.length > 0 ? Math.round((done / agentTasks.length) * 100) : 0,
      lastActivity: agentActivity[0]?.created_at || null,
    };
  });

  return (
    <div className="min-h-screen bg-surface pt-8 pb-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href={`/dashboard/${companyId}`}
              className="text-sm text-neutral-500 hover:text-primary transition-colors mb-2 inline-block"
            >
              &larr; Back to dashboard
            </Link>
            <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight">
              Analytics
            </h1>
            <p className="text-sm text-neutral-500">{company.name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-neutral-400 uppercase tracking-wider">
              Plan
            </p>
            <p className="text-sm font-medium capitalize">
              {subscription?.plan || "Free"}
            </p>
          </div>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">
              Total Agents
            </p>
            <p className="font-[family-name:var(--font-serif)] text-3xl">
              {agents.length}
            </p>
          </div>
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">
              Tasks Completed
            </p>
            <p className="font-[family-name:var(--font-serif)] text-3xl text-secondary">
              {tasksDone}
            </p>
          </div>
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">
              Success Rate
            </p>
            <p className="font-[family-name:var(--font-serif)] text-3xl">
              {successRate}%
            </p>
          </div>
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">
              This Month
            </p>
            <p className="font-[family-name:var(--font-serif)] text-3xl">
              {usage.task_count + usage.message_count}
            </p>
            <p className="text-[10px] text-neutral-400 mt-0.5">
              {usage.task_count} tasks &middot; {usage.message_count} messages
            </p>
          </div>
        </div>

        {/* Status breakdown */}
        <div className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4">
            Task Pipeline
          </h2>
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <div className="flex items-center gap-6 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-secondary rounded-full" />
                <span className="text-sm">Done ({tasksDone})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-accent rounded-full animate-pulse" />
                <span className="text-sm">In progress ({tasksRunning})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-400 rounded-full" />
                <span className="text-sm">Failed ({tasksFailed})</span>
              </div>
            </div>
            {/* Simple bar chart */}
            {allTasks.length > 0 && (
              <div className="h-4 bg-neutral-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-secondary h-full transition-all"
                  style={{
                    width: `${(tasksDone / allTasks.length) * 100}%`,
                  }}
                />
                <div
                  className="bg-accent h-full transition-all"
                  style={{
                    width: `${(tasksRunning / allTasks.length) * 100}%`,
                  }}
                />
                <div
                  className="bg-red-400 h-full transition-all"
                  style={{
                    width: `${(tasksFailed / allTasks.length) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Per-agent performance */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4">
            Agent Performance
          </h2>
          <div className="space-y-3">
            {agentStats.map((stat) => (
              <div
                key={stat.id}
                className="bg-white border border-neutral-200 rounded-xl p-5 flex items-center gap-5"
              >
                <AgentIcon role={stat.role} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{stat.role} Agent</p>
                  <p className="text-xs text-neutral-500">
                    {stat.totalTasks} tasks &middot;{" "}
                    {stat.lastActivity
                      ? `Last active ${stat.lastActivity}`
                      : "No activity yet"}
                  </p>
                </div>
                <div className="flex items-center gap-6 text-center shrink-0">
                  <div>
                    <p className="text-lg font-semibold text-secondary">
                      {stat.completed}
                    </p>
                    <p className="text-[10px] text-neutral-400">Done</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-red-400">
                      {stat.failed}
                    </p>
                    <p className="text-[10px] text-neutral-400">Failed</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">
                      {stat.successRate}%
                    </p>
                    <p className="text-[10px] text-neutral-400">Success</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
