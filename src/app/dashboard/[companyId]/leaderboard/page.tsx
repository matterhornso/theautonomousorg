import { getCompany, getAgentLeaderboard } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AgentIcon } from "@/app/components/agent-icons";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await getCompany(companyId);
  if (!company) notFound();

  const leaderboard = await getAgentLeaderboard(companyId);

  // Calculate totals
  const totalMessages = leaderboard.reduce((s, a) => s + Number(a.message_count), 0);
  const totalTasks = leaderboard.reduce((s, a) => s + Number(a.task_count), 0);
  const totalCompleted = leaderboard.reduce((s, a) => s + Number(a.tasks_completed), 0);
  const activeAgents = leaderboard.filter(a => Number(a.message_count) > 0 || Number(a.task_count) > 0);
  const avgScore = activeAgents.length > 0
    ? activeAgents.reduce((s, a) => s + Number(a.avg_score), 0) / activeAgents.length
    : 0;

  return (
    <div className="min-h-screen bg-surface pt-8 pb-16 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/dashboard/${companyId}`}
            className="text-sm text-neutral-500 hover:text-primary transition-colors mb-2 inline-block"
          >
            &larr; Back to dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0 1 16.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 0 1-3.52 1.122 6.023 6.023 0 0 1-3.52-1.122" />
              </svg>
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight">
                Agent Leaderboard
              </h1>
              <p className="text-sm text-neutral-500">{company.name}</p>
            </div>
          </div>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">
              Total Messages
            </p>
            <p className="font-[family-name:var(--font-serif)] text-4xl">
              {totalMessages.toLocaleString()}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">across all agents</p>
          </div>
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">
              Tasks Completed
            </p>
            <p className="font-[family-name:var(--font-serif)] text-4xl text-secondary">
              {totalCompleted.toLocaleString()}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">of {totalTasks} total</p>
          </div>
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">
              Avg Quality Score
            </p>
            <p className="font-[family-name:var(--font-serif)] text-4xl text-accent">
              {avgScore > 0 ? avgScore.toFixed(1) : "--"}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">out of 5.0</p>
          </div>
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">
              Active Agents
            </p>
            <p className="font-[family-name:var(--font-serif)] text-4xl">
              {activeAgents.length}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">of {leaderboard.length} total</p>
          </div>
        </div>

        {/* Leaderboard table */}
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-200">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
              Rankings
            </h2>
          </div>
          <div className="divide-y divide-neutral-100">
            {leaderboard.map((agent, index) => {
              const score = Number(agent.avg_score);
              const messages = Number(agent.message_count);
              const completed = Number(agent.tasks_completed);
              const tasks = Number(agent.task_count);
              const thumbsUp = Number(agent.thumbs_up);
              const thumbsDown = Number(agent.thumbs_down);
              const satisfaction = thumbsUp + thumbsDown > 0
                ? Math.round((thumbsUp / (thumbsUp + thumbsDown)) * 100)
                : null;

              return (
                <div
                  key={agent.agent_id}
                  className={`px-5 py-4 flex items-center gap-5 ${
                    index === 0 ? "bg-accent/5" : ""
                  }`}
                >
                  {/* Rank */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    index === 0
                      ? "bg-accent text-primary"
                      : index === 1
                        ? "bg-neutral-200 text-neutral-700"
                        : index === 2
                          ? "bg-neutral-100 text-neutral-600"
                          : "text-neutral-400"
                  }`}>
                    {index + 1}
                  </div>

                  {/* Agent */}
                  <AgentIcon role={agent.role} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{agent.role} Agent</p>
                    <p className="text-xs text-neutral-500">
                      {messages} messages &middot; {completed}/{tasks} tasks
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 shrink-0">
                    {/* Quality score */}
                    <div className="text-center">
                      <p className={`text-sm font-semibold ${
                        score >= 4 ? "text-secondary"
                          : score >= 3 ? "text-neutral-700"
                            : score > 0 ? "text-red-400"
                              : "text-neutral-300"
                      }`}>
                        {score > 0 ? score.toFixed(1) : "--"}
                      </p>
                      <p className="text-[10px] text-neutral-400">Quality</p>
                    </div>

                    {/* Satisfaction */}
                    <div className="text-center">
                      <p className={`text-sm font-semibold ${
                        satisfaction !== null && satisfaction >= 80 ? "text-secondary"
                          : satisfaction !== null && satisfaction >= 50 ? "text-accent"
                            : satisfaction !== null ? "text-red-400"
                              : "text-neutral-300"
                      }`}>
                        {satisfaction !== null ? `${satisfaction}%` : "--"}
                      </p>
                      <p className="text-[10px] text-neutral-400">Satisfaction</p>
                    </div>

                    {/* Thumbs */}
                    <div className="text-center min-w-[60px]">
                      <div className="flex items-center justify-center gap-1.5 text-xs">
                        <span className="text-secondary">{thumbsUp}</span>
                        <span className="text-neutral-300">/</span>
                        <span className="text-red-400">{thumbsDown}</span>
                      </div>
                      <p className="text-[10px] text-neutral-400">Up / Down</p>
                    </div>

                    {/* Productivity bar */}
                    <div className="w-24">
                      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all"
                          style={{
                            width: `${totalMessages > 0 ? Math.min((messages / totalMessages) * 100, 100) : 0}%`,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-0.5 text-center">Activity</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
