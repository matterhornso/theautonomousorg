"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AgentIcon } from "@/app/components/agent-icons";

interface ScheduledTask {
  id: string;
  agent_id: string;
  type: string;
  title: string;
  status: string;
  cron_expression: string | null;
  scheduled_at: string | null;
  is_recurring: number;
  created_at: string;
}

interface AgentBasic {
  id: string;
  role: string;
}

const cronPresets = [
  { label: "Every day at 9am", cron: "0 9 * * *" },
  { label: "Every Monday at 9am", cron: "0 9 * * 1" },
  { label: "Every weekday at 9am", cron: "0 9 * * 1-5" },
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Every 6 hours", cron: "0 */6 * * *" },
  { label: "First of month at 10am", cron: "0 10 1 * *" },
];

export default function SchedulePage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;

  const [schedules, setSchedules] = useState<ScheduledTask[]>([]);
  const [agents, setAgents] = useState<AgentBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    agentId: "",
    title: "",
    prompt: "",
    cronExpression: "",
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/tasks/schedule?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/agents?companyId=${companyId}`).then((r) => r.json()),
    ]).then(([tasks, agentList]) => {
      if (Array.isArray(tasks)) setSchedules(tasks);
      if (Array.isArray(agentList))
        setAgents(agentList.map((a: AgentBasic) => ({ id: a.id, role: a.role })));
      setLoading(false);
    });
  }, [companyId]);

  const handleCreate = async () => {
    if (!form.agentId || !form.title || !form.cronExpression) return;
    setCreating(true);
    const res = await fetch("/api/tasks/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: form.agentId,
        type: "scheduled",
        title: form.title,
        prompt: form.prompt,
        cronExpression: form.cronExpression,
      }),
    });
    if (res.ok) {
      const task = await res.json();
      setSchedules((prev) => [task, ...prev]);
      setForm({ agentId: "", title: "", prompt: "", cronExpression: "" });
    }
    setCreating(false);
  };

  const handleCancel = async (taskId: string) => {
    await fetch("/api/tasks/schedule", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    setSchedules((prev) => prev.filter((s) => s.id !== taskId));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
          Scheduled Tasks
        </h1>
        <p className="text-neutral-500 text-sm mb-8">
          Set up recurring jobs for your agents. They&apos;ll run automatically
          on the schedule you define — like a cron job, but for AI.
        </p>

        {/* Create new schedule */}
        <section className="mb-10 p-6 bg-white border border-neutral-200 rounded-2xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4">
            New scheduled task
          </h2>

          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Agent</label>
                <select
                  value={form.agentId}
                  onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 appearance-none"
                >
                  <option value="">Select an agent</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.role} Agent
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Task name</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Weekly pipeline report"
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                What should the agent do?
              </label>
              <textarea
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                rows={3}
                placeholder="e.g. Generate a weekly sales pipeline report with deal-by-deal status, conversion rates, and forecast..."
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Schedule</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {cronPresets.map((preset) => (
                  <button
                    key={preset.cron}
                    type="button"
                    onClick={() =>
                      setForm({ ...form, cronExpression: preset.cron })
                    }
                    className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                      form.cronExpression === preset.cron
                        ? "bg-accent text-primary font-medium"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={form.cronExpression}
                onChange={(e) =>
                  setForm({ ...form, cronExpression: e.target.value })
                }
                placeholder="Or enter cron expression: 0 9 * * 1"
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-[family-name:var(--font-mono)] focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={creating || !form.agentId || !form.title || !form.cronExpression}
              className="px-6 py-3 bg-accent text-primary font-medium rounded-xl text-sm hover:bg-accent-hover disabled:opacity-40 transition-all"
            >
              {creating ? "Creating..." : "Create schedule"}
            </button>
          </div>
        </section>

        {/* Existing schedules */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4">
            Active schedules
          </h2>
          {schedules.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 text-sm">
              No scheduled tasks yet. Create one above.
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((task) => {
                const agent = agents.find((a) => a.id === task.agent_id);
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-4 p-4 bg-white border border-neutral-200 rounded-xl"
                  >
                    {agent && <AgentIcon role={agent.role} size="sm" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {task.cron_expression && (
                          <span className="text-xs font-[family-name:var(--font-mono)] text-neutral-400">
                            {task.cron_expression}
                          </span>
                        )}
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            task.status === "queued"
                              ? "bg-accent/10 text-accent"
                              : task.status === "done"
                                ? "bg-secondary/10 text-secondary"
                                : "bg-red-50 text-red-600"
                          }`}
                        >
                          {task.is_recurring ? "recurring" : task.status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCancel(task.id)}
                      className="text-xs text-[#B33A3A] hover:text-red-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
