"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AgentIcon } from "@/app/components/agent-icons";

interface AgentSkillData {
  id: string;
  role: string;
  builtInSkills: string[];
  capabilities: string[];
  customSkills: string[];
}

export default function SkillsPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;
  const [agents, setAgents] = useState<AgentSkillData[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [newSkill, setNewSkill] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch agents
    fetch(`/api/agents?companyId=${companyId}`)
      .then((r) => r.json())
      .then(async (agentList) => {
        if (!Array.isArray(agentList)) return;

        // Fetch skills for each agent
        const withSkills = await Promise.all(
          agentList.map(async (a: { id: string; role: string }) => {
            const skillRes = await fetch(
              `/api/agents/skills?agentId=${a.id}`
            );
            const skillData = await skillRes.json();
            return {
              id: a.id,
              role: a.role,
              builtInSkills: skillData.builtInSkills || [],
              capabilities: skillData.capabilities || [],
              customSkills: skillData.customSkills || [],
            };
          })
        );

        setAgents(withSkills);
        if (withSkills.length > 0) setSelectedAgent(withSkills[0].id);
        setLoading(false);
      });
  }, [companyId]);

  const active = agents.find((a) => a.id === selectedAgent);

  const addSkill = async () => {
    if (!newSkill.trim() || !selectedAgent) return;

    await fetch("/api/agents/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: selectedAgent, skill: newSkill.trim() }),
    });

    setAgents((prev) =>
      prev.map((a) =>
        a.id === selectedAgent
          ? { ...a, customSkills: [...a.customSkills, newSkill.trim()] }
          : a
      )
    );
    setNewSkill("");
  };

  const removeSkill = async (skill: string) => {
    if (!selectedAgent) return;

    await fetch("/api/agents/skills", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: selectedAgent, skill }),
    });

    setAgents((prev) =>
      prev.map((a) =>
        a.id === selectedAgent
          ? { ...a, customSkills: a.customSkills.filter((s) => s !== skill) }
          : a
      )
    );
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
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => router.push(`/dashboard/${companyId}`)}
          className="text-sm text-neutral-500 hover:text-primary transition-colors mb-6"
        >
          &larr; Back to dashboard
        </button>

        <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight mb-2">
          Agent Skills
        </h1>
        <p className="text-neutral-500 text-sm mb-8">
          View and customize the skills each agent has. Built-in skills come
          from our research — custom skills are yours.
        </p>

        <div className="grid lg:grid-cols-[240px,1fr] gap-8">
          {/* Agent selector */}
          <div className="space-y-2">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                  selectedAgent === agent.id
                    ? "bg-white border border-accent/30 shadow-sm"
                    : "hover:bg-white border border-transparent"
                }`}
              >
                <AgentIcon
                  role={agent.role}
                  size="sm"
                  variant={selectedAgent === agent.id ? "accent" : "dark"}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{agent.role}</p>
                  <p className="text-xs text-neutral-400">
                    {agent.builtInSkills.length + agent.customSkills.length}{" "}
                    skills
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Skills detail */}
          {active && (
            <div>
              {/* Agent header */}
              <div className="flex items-center gap-4 mb-6">
                <AgentIcon role={active.role} size="lg" />
                <div>
                  <h2 className="text-xl font-semibold">{active.role} Agent</h2>
                  <p className="text-sm text-neutral-500">
                    {active.builtInSkills.length} built-in skills &middot;{" "}
                    {active.customSkills.length} custom skills &middot;{" "}
                    {active.capabilities.length} capabilities
                  </p>
                </div>
              </div>

              {/* Built-in Skills */}
              <section className="mb-8">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
                  Built-in Skills
                </h3>
                <div className="grid sm:grid-cols-2 gap-2">
                  {active.builtInSkills.map((skill) => (
                    <div
                      key={skill}
                      className="flex items-start gap-2.5 p-3 bg-white border border-neutral-200 rounded-lg"
                    >
                      <svg
                        className="w-4 h-4 text-secondary mt-0.5 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-sm text-neutral-700">{skill}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Capabilities */}
              <section className="mb-8">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
                  What this agent can produce
                </h3>
                <div className="space-y-2">
                  {active.capabilities.map((cap) => (
                    <div
                      key={cap}
                      className="flex items-start gap-2.5 p-3 bg-neutral-50 border border-neutral-100 rounded-lg"
                    >
                      <svg
                        className="w-4 h-4 text-accent mt-0.5 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                        />
                      </svg>
                      <span className="text-sm text-neutral-600">{cap}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Custom Skills */}
              <section className="mb-8">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
                  Custom Skills
                  <span className="text-neutral-300 ml-1 normal-case font-normal">
                    — added by you
                  </span>
                </h3>

                {active.customSkills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {active.customSkills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-full text-sm text-accent"
                      >
                        {skill}
                        <button
                          onClick={() => removeSkill(skill)}
                          className="hover:text-red-500 transition-colors"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSkill()}
                    placeholder="Add a custom skill..."
                    className="flex-1 px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                  />
                  <button
                    onClick={addSkill}
                    disabled={!newSkill.trim()}
                    className="px-4 py-2.5 bg-accent text-primary text-sm font-medium rounded-xl hover:bg-accent-hover disabled:opacity-40 transition-all"
                  >
                    Add
                  </button>
                </div>
                <p className="text-xs text-neutral-400 mt-2">
                  Custom skills are included in the agent&apos;s system prompt.
                  Add skills specific to your business that the built-in list
                  doesn&apos;t cover.
                </p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
