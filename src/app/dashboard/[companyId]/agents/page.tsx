"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { AgentIcon } from "@/app/components/agent-icons";

interface AgentStatus {
  id: string;
  role: string;
  status: string;
  system_prompt: string;
  created_at: string;
  memory: { key: string; value: string }[];
  skills: string[];
  customSkills: string[];
  tasks: {
    id: string;
    type: string;
    title: string;
    status: string;
    created_at: string;
    is_recurring: number;
    cron_expression: string | null;
  }[];
  actions: {
    title: string;
    action_type: string;
    created_at: string;
  }[];
  connectedServices: string[];
  conversationCount: number;
  messageCount: number;
}

export default function AgentStatusPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;

  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const fetchAgentStatuses = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/agents/status?companyId=${companyId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      } else {
        console.error(`[AgentStatus] fetch failed: ${res.status} ${res.statusText}`, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.error("[AgentStatus] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchAgentStatuses();
  }, [fetchAgentStatuses]);

  const toggleAgent = (id: string) => {
    setExpandedAgent((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-surface pt-8 pb-16 px-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push(`/dashboard/${companyId}`)}
          className="text-sm text-neutral-500 hover:text-primary transition-colors mb-6"
        >
          &larr; Back to dashboard
        </button>

        <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight mb-2">
          Agent Status
        </h1>
        <p className="text-neutral-500 text-sm mb-8">
          See what each agent has: memory, skills, tools, scheduled tasks, and
          recent activity.
        </p>

        {loading ? (
          <div className="text-sm text-neutral-400 py-12 text-center">
            Loading agent data...
          </div>
        ) : agents.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mb-3 flex justify-center">
              <svg className="w-10 h-10 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H9m6 0a5.98 5.98 0 00-.786-3.07M9 19.128A9.38 9.38 0 016.375 19.5a9.337 9.337 0 01-4.121-.952 4.125 4.125 0 017.533-2.493M9 19.128v-.003c0-1.113.285-2.16.786-3.07m0 0a5.96 5.96 0 014.428 0M12 9.75a3 3 0 100-6 3 3 0 000 6zm-1.5 3.75a5.96 5.96 0 013 0" />
              </svg>
            </div>
            <p className="text-sm font-medium text-neutral-600 mb-1">No agents yet</p>
            <p className="text-xs text-neutral-400 mb-4">Agents will appear here once your company is provisioned.</p>
            <button
              onClick={() => router.push(`/dashboard/${companyId}`)}
              className="text-xs text-accent hover:underline"
            >
              Go to dashboard
            </button>
          </div>
        ) : (
          <>
          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="double-bezel">
              <div className="double-bezel-inner p-4">
                <p className="text-lg font-semibold">{agents.length}</p>
                <p className="text-xs text-neutral-400">Active Agents</p>
              </div>
            </div>
            <div className="double-bezel">
              <div className="double-bezel-inner p-4">
                <p className="text-lg font-semibold">{agents.reduce((sum, a) => sum + a.tasks.filter(t => t.status === "done").length, 0)}</p>
                <p className="text-xs text-neutral-400">Tasks Done</p>
              </div>
            </div>
            <div className="double-bezel">
              <div className="double-bezel-inner p-4">
                <p className="text-lg font-semibold">{agents.reduce((sum, a) => sum + a.tasks.filter(t => t.status === "running" || t.status === "queued").length, 0)}</p>
                <p className="text-xs text-neutral-400">Active Tasks</p>
              </div>
            </div>
            <div className="double-bezel">
              <div className="double-bezel-inner p-4">
                <p className="text-lg font-semibold">{agents.reduce((sum, a) => sum + a.memory.length, 0)}</p>
                <p className="text-xs text-neutral-400">Total Memories</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {agents.map((agent) => {
              const isExpanded = expandedAgent === agent.id;
              const doneTasks = agent.tasks.filter(
                (t) => t.status === "done"
              ).length;
              const runningTasks = agent.tasks.filter(
                (t) => t.status === "running" || t.status === "queued"
              ).length;
              const recurringTasks = agent.tasks.filter(
                (t) => t.is_recurring
              ).length;

              return (
                <div
                  key={agent.id}
                  className={`bg-white border border-neutral-200/80 rounded-xl overflow-hidden shadow-sm shadow-neutral-900/[0.02] transition-all duration-300 ${
                    isExpanded ? "shadow-md shadow-neutral-900/[0.06]" : "hover:shadow-md hover:shadow-neutral-900/[0.05] hover:-translate-y-px"
                  }`}
                >
                  {/* Header row */}
                  <button
                    onClick={() => toggleAgent(agent.id)}
                    aria-expanded={isExpanded}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-neutral-50/60 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none"
                  >
                    <AgentIcon role={agent.role} size="md" variant="dark" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold truncate">
                          {agent.role}
                        </h3>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            agent.status === "active"
                              ? "bg-secondary/10 text-secondary"
                              : "bg-neutral-100 text-neutral-500"
                          }`}
                        >
                          {agent.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-0.5">
                        <span className="text-xs text-neutral-400">
                          {doneTasks} tasks done
                        </span>
                        <span className="text-xs text-neutral-400">
                          {agent.skills.length + agent.customSkills.length}{" "}
                          skills
                        </span>
                        <span className="hidden sm:inline text-xs text-neutral-400">
                          {agent.memory.length} memories
                        </span>
                        <span className="hidden sm:inline text-xs text-neutral-400">
                          {agent.messageCount} messages
                        </span>
                        {agent.connectedServices.length > 0 && (
                          <span className="text-xs text-accent">
                            {agent.connectedServices.length} connected
                          </span>
                        )}
                      </div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-neutral-400 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                      />
                    </svg>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-neutral-100 p-4 space-y-5">
                      {/* Memory */}
                      <div>
                        <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
                          Memory ({agent.memory.length})
                        </h4>
                        {agent.memory.length === 0 ? (
                          <div className="p-4 bg-neutral-50 rounded-lg text-center">
                            <p className="text-xs font-medium text-neutral-500 mb-1">This agent is ready to learn</p>
                            <p className="text-xs text-neutral-400 mb-2">Memory builds as you chat with the agent.</p>
                            <button onClick={() => router.push(`/dashboard/${companyId}`)} className="text-xs text-accent hover:underline">Start a conversation</button>
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {agent.memory.map((m, i) => (
                              <div
                                key={i}
                                className="p-2.5 bg-neutral-50 rounded-lg"
                              >
                                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-0.5">
                                  {m.key}
                                </p>
                                <p className="text-xs text-neutral-700 line-clamp-2">
                                  {m.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Skills */}
                      <div>
                        <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
                          Skills ({agent.skills.length + agent.customSkills.length})
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {agent.skills.map((skill) => (
                            <span
                              key={skill}
                              className="text-xs px-2 py-1 bg-neutral-100 text-neutral-600 rounded-md"
                            >
                              {skill}
                            </span>
                          ))}
                          {agent.customSkills.map((skill) => (
                            <span
                              key={skill}
                              className="text-xs px-2 py-1 bg-accent/10 text-accent rounded-md"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Connected Services */}
                      {agent.connectedServices.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
                            Connected Services
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {agent.connectedServices.map((svc) => (
                              <span
                                key={svc}
                                className="text-xs px-2 py-1 bg-secondary/10 text-secondary rounded-md flex items-center gap-1"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                                {svc}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tasks */}
                      <div>
                        <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
                          Tasks ({agent.tasks.length})
                          {runningTasks > 0 && (
                            <span className="text-secondary ml-1">
                              {runningTasks} active
                            </span>
                          )}
                          {recurringTasks > 0 && (
                            <span className="text-accent ml-1">
                              {recurringTasks} recurring
                            </span>
                          )}
                        </h4>
                        {agent.tasks.length === 0 ? (
                          <div className="p-4 bg-neutral-50 rounded-lg text-center">
                            <p className="text-xs font-medium text-neutral-500 mb-1">Give this agent work to do</p>
                            <p className="text-xs text-neutral-400 mb-2">Schedule tasks or ask the agent directly in chat.</p>
                            <button onClick={() => router.push(`/dashboard/${companyId}/schedule`)} className="text-xs text-accent hover:underline">Schedule a task</button>
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {agent.tasks.slice(0, 10).map((task) => (
                              <div
                                key={task.id}
                                className="flex items-center gap-3 p-2 bg-neutral-50 rounded-lg"
                              >
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    task.status === "done"
                                      ? "bg-secondary"
                                      : task.status === "running"
                                        ? "bg-accent animate-pulse"
                                        : task.status === "failed"
                                          ? "bg-red-400"
                                          : "bg-neutral-300"
                                  }`}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">
                                    {task.title}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-neutral-400">
                                      {task.status}
                                    </span>
                                    {task.is_recurring === 1 && (
                                      <span className="text-xs text-accent">
                                        ↻ {task.cron_expression || "recurring"}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="text-xs text-neutral-400 shrink-0">
                                  {new Date(
                                    task.created_at
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              </div>
                            ))}
                            {agent.tasks.length > 10 && (
                              <p className="text-xs text-neutral-400 text-center py-1">
                                +{agent.tasks.length - 10} more tasks
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Recent Actions */}
                      <div>
                        <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
                          Recent Actions
                        </h4>
                        {agent.actions.length === 0 ? (
                          <div className="p-4 bg-neutral-50 rounded-lg text-center">
                            <p className="text-xs text-neutral-400">Activity will appear here once the agent starts working.</p>
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-36 overflow-y-auto">
                            {agent.actions.slice(0, 5).map((action, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-3 p-2 bg-neutral-50 rounded-lg"
                              >
                                <span className="text-xs text-neutral-400 shrink-0 w-16">
                                  {new Date(
                                    action.created_at
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                                <p className="text-xs text-neutral-600 truncate">
                                  {action.title}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Stats bar */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-neutral-100">
                        <div>
                          <p className="text-lg font-semibold">
                            {agent.conversationCount}
                          </p>
                          <p className="text-xs text-neutral-400 uppercase tracking-wider">
                            Conversations
                          </p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold">
                            {agent.messageCount}
                          </p>
                          <p className="text-xs text-neutral-400 uppercase tracking-wider">
                            Messages
                          </p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{doneTasks}</p>
                          <p className="text-xs text-neutral-400 uppercase tracking-wider">
                            Tasks Done
                          </p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold">
                            {agent.memory.length}
                          </p>
                          <p className="text-xs text-neutral-400 uppercase tracking-wider">
                            Memories
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
