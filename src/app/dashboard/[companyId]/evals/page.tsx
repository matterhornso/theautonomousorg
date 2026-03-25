import {
  getCompany,
  getAgentsByCompany,
  getAverageScores,
  getUserFeedbackSummary,
  getFlaggedEvals,
  getEvalsByCompany,
  getEvalRuns,
} from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AgentIcon } from "@/app/components/agent-icons";
import { EvalsClient } from "./evals-client";

export const dynamic = "force-dynamic";

export default async function EvalsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await getCompany(companyId);
  if (!company) notFound();

  const agents = await getAgentsByCompany(companyId);

  // Gather per-agent scores (current 7 days vs previous 7 days)
  const agentScores = await Promise.all(
    agents.map(async (a) => {
      const current = await getAverageScores(a.id, 7);
      const previous = await getAverageScores(a.id, 14);
      return {
        agentId: a.id,
        role: a.role,
        currentScores: current,
        previousScores: previous,
      };
    })
  );

  const feedbackSummary = await getUserFeedbackSummary(companyId);
  const flaggedEvals = await getFlaggedEvals(companyId, 10);
  const recentEvals = await getEvalsByCompany(companyId, 20);
  const runs = await getEvalRuns(companyId, 5);

  // Company-wide average
  const activeAgents = agentScores.filter((a) => a.currentScores.count > 0);
  const companyAvg =
    activeAgents.length > 0
      ? Math.round(
          (activeAgents.reduce((s, a) => s + a.currentScores.overall, 0) /
            activeAgents.length) *
            10
        ) / 10
      : 0;

  return (
    <div className="min-h-screen bg-surface pt-8 pb-16 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href={`/dashboard/${companyId}`}
              className="text-sm text-neutral-500 hover:text-primary transition-colors mb-2 inline-block"
            >
              &larr; Back to dashboard
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight">
                  Agent Quality
                </h1>
                <p className="text-sm text-neutral-500">{company.name}</p>
              </div>
            </div>
          </div>
          <EvalsClient companyId={companyId} />
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {/* Overall score */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">
              Overall Score
            </p>
            <p className="font-[family-name:var(--font-serif)] text-4xl text-accent">
              {companyAvg > 0 ? companyAvg.toFixed(1) : "--"}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">out of 5.0</p>
          </div>

          {/* Active agents */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">
              Agents Evaluated
            </p>
            <p className="font-[family-name:var(--font-serif)] text-4xl">
              {activeAgents.length}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              of {agents.length} total
            </p>
          </div>

          {/* Feedback */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">
              User Satisfaction
            </p>
            <p className="font-[family-name:var(--font-serif)] text-4xl">
              {feedbackSummary.thumbs_up + feedbackSummary.thumbs_down > 0
                ? `${Math.round(
                    (feedbackSummary.thumbs_up /
                      (feedbackSummary.thumbs_up + feedbackSummary.thumbs_down)) *
                      100
                  )}%`
                : "--"}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {feedbackSummary.thumbs_up} up / {feedbackSummary.thumbs_down} down
            </p>
          </div>

          {/* Total evals */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">
              Total Evaluations
            </p>
            <p className="font-[family-name:var(--font-serif)] text-4xl">
              {recentEvals.length > 0 ? feedbackSummary.total : 0}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">last 7 days</p>
          </div>
        </div>

        {/* Per-agent scores */}
        <div className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4">
            Agent Scores
          </h2>
          <div className="space-y-3">
            {agentScores.map((agent) => {
              const s = agent.currentScores;
              const trend =
                agent.previousScores.count > 0 && s.count > 0
                  ? s.overall - agent.previousScores.overall
                  : null;

              return (
                <div
                  key={agent.agentId}
                  className="bg-white border border-neutral-200 rounded-xl p-5 flex items-center gap-5"
                >
                  <AgentIcon role={agent.role} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{agent.role} Agent</p>
                    <p className="text-xs text-neutral-500">
                      {s.count} evaluations
                      {trend !== null && (
                        <span
                          className={`ml-2 ${
                            trend > 0
                              ? "text-secondary"
                              : trend < 0
                                ? "text-red-400"
                                : "text-neutral-400"
                          }`}
                        >
                          {trend > 0 ? "+" : ""}
                          {trend.toFixed(1)} vs prev 7d
                        </span>
                      )}
                    </p>
                  </div>

                  {s.count > 0 ? (
                    <div className="flex items-center gap-4 text-center shrink-0">
                      <ScoreChip label="Relevance" value={s.relevance} />
                      <ScoreChip label="Complete" value={s.completeness} />
                      <ScoreChip label="Action" value={s.actionability} />
                      <ScoreChip label="Role Fit" value={s.role_specificity} />
                      <div className="pl-2 border-l border-neutral-200">
                        <p className="font-[family-name:var(--font-serif)] text-xl text-accent">
                          {s.overall.toFixed(1)}
                        </p>
                        <p className="text-[10px] text-neutral-400">Overall</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-400">No evals yet</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Flagged responses */}
        {flaggedEvals.length > 0 && (
          <div className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-red-400 mb-4">
              Flagged Responses (Below 3/5)
            </h2>
            <div className="space-y-3">
              {flaggedEvals.map((ev) => {
                let scores = { overall: 0, relevance: 0, completeness: 0, actionability: 0, role_specificity: 0 };
                try { scores = JSON.parse(ev.scores); } catch { /* skip */ }
                const agent = agents.find((a) => a.id === ev.agent_id);

                return (
                  <div
                    key={ev.id}
                    className="bg-red-50 border border-red-200 rounded-xl p-5"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {agent && <AgentIcon role={agent.role} size="sm" />}
                      <div>
                        <p className="text-sm font-medium">
                          {agent?.role || "Unknown"} Agent
                        </p>
                        <p className="text-xs text-red-400">
                          Overall: {scores.overall}/5
                        </p>
                      </div>
                    </div>
                    {ev.prompt_used && (
                      <p className="text-xs text-neutral-600 mb-1">
                        <span className="font-medium">Prompt:</span>{" "}
                        {ev.prompt_used.slice(0, 200)}
                      </p>
                    )}
                    {ev.response_evaluated && (
                      <p className="text-xs text-neutral-500 mb-1">
                        <span className="font-medium">Response:</span>{" "}
                        {ev.response_evaluated.slice(0, 200)}...
                      </p>
                    )}
                    {ev.judge_reasoning && (
                      <p className="text-xs text-red-500 italic">
                        {ev.judge_reasoning}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent eval results */}
        {recentEvals.length > 0 && (
          <div className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4">
              Latest Evaluations
            </h2>
            <div className="space-y-2">
              {recentEvals.slice(0, 15).map((ev) => {
                let scores = { overall: 0, relevance: 0, completeness: 0, actionability: 0, role_specificity: 0 };
                try { scores = JSON.parse(ev.scores); } catch { /* skip */ }
                const agent = agents.find((a) => a.id === ev.agent_id);

                return (
                  <div
                    key={ev.id}
                    className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center gap-4"
                  >
                    {agent && <AgentIcon role={agent.role} size="sm" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {agent?.role || "Unknown"} — {ev.eval_type}
                      </p>
                      {ev.prompt_used && (
                        <p className="text-xs text-neutral-500 truncate">
                          {ev.prompt_used.slice(0, 100)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {scores.overall > 0 && (
                        <span
                          className={`font-[family-name:var(--font-serif)] text-lg ${
                            scores.overall >= 4
                              ? "text-secondary"
                              : scores.overall >= 3
                                ? "text-accent"
                                : "text-red-400"
                          }`}
                        >
                          {scores.overall}/5
                        </span>
                      )}
                      {ev.user_feedback && (
                        <span className="text-sm">
                          {ev.user_feedback === "thumbs_up" ? (
                            <span className="text-secondary" title="Thumbs up">&#x1F44D;</span>
                          ) : (
                            <span className="text-red-400" title="Thumbs down">&#x1F44E;</span>
                          )}
                        </span>
                      )}
                      <span className="text-xs text-neutral-400">
                        {new Date(ev.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Eval runs */}
        {runs.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4">
              Test Suite Runs
            </h2>
            <div className="space-y-2">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center gap-4"
                >
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      run.status === "completed"
                        ? "bg-secondary"
                        : run.status === "failed"
                          ? "bg-red-400"
                          : "bg-accent animate-pulse"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {run.run_type === "daily_batch"
                        ? "Daily Batch"
                        : run.run_type === "manual"
                          ? "Manual Run"
                          : "Regression"}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {new Date(run.started_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      run.status === "completed"
                        ? "bg-secondary/10 text-secondary"
                        : run.status === "failed"
                          ? "bg-red-50 text-red-400"
                          : "bg-accent/10 text-accent"
                    }`}
                  >
                    {run.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreChip({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p
        className={`text-sm font-semibold ${
          value >= 4
            ? "text-secondary"
            : value >= 3
              ? "text-neutral-700"
              : "text-red-400"
        }`}
      >
        {value.toFixed(1)}
      </p>
      <p className="text-[10px] text-neutral-400">{label}</p>
    </div>
  );
}
