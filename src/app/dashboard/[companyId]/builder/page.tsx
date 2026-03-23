"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { AgentIcon } from "@/app/components/agent-icons";

const suggestedSkills = [
  "Research", "Writing", "Analysis", "Outreach", "Reporting",
  "Scheduling", "Data entry", "Communication", "Planning", "Design",
  "Code review", "Documentation", "Customer support", "Negotiations",
];

const availableConnectors = [
  "Google Workspace", "Slack", "Notion", "GitHub", "Linear",
  "HubSpot", "Salesforce", "Stripe", "Intercom", "Zendesk",
  "Apollo.io", "Instantly.ai", "Figma", "Jira",
];

export default function AgentBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.companyId as string;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState("");
  const [selectedConnectors, setSelectedConnectors] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-6");
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const addCustomSkill = () => {
    if (customSkill.trim() && !selectedSkills.includes(customSkill.trim())) {
      setSelectedSkills((prev) => [...prev, customSkill.trim()]);
      setCustomSkill("");
    }
  };

  const toggleConnector = (conn: string) => {
    setSelectedConnectors((prev) =>
      prev.includes(conn) ? prev.filter((c) => c !== conn) : [...prev, conn]
    );
  };

  const handleCreate = async () => {
    if (!name.trim() || !description.trim()) {
      setError("Name and description are required.");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/agents/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          name: name.trim(),
          description: description.trim(),
          instructions: instructions.trim(),
          skills: selectedSkills,
          connectors: selectedConnectors,
          model: selectedModel === "custom" ? customEndpoint : selectedModel,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push(`/dashboard/${companyId}`);
      } else {
        setError(data.error || "Failed to create agent.");
        setCreating(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface pt-8 pb-16 px-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push(`/dashboard/${companyId}`)}
          className="text-sm text-neutral-500 hover:text-primary transition-colors mb-6 flex items-center gap-1"
        >
          &larr; Back to dashboard
        </button>

        <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight mb-2">
          Create a custom agent
        </h1>
        <p className="text-neutral-500 text-sm mb-8">
          Define a new AI agent role with custom instructions, skills, and
          connectors tailored to your needs.
        </p>

        <div className="space-y-8">
          {/* Name + Description */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4">
              Agent Identity
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Agent name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Partnerships, BD, Support Ops"
                  className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="What does this agent do? e.g. Manages partner relationships, tracks deal flow, coordinates co-marketing"
                  className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all resize-none"
                />
              </div>
            </div>
          </section>

          {/* Instructions */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-1">
              Custom instructions
            </h2>
            <p className="text-xs text-neutral-400 mb-3">
              Give your agent specific methodology, personality, or guidelines.
              This becomes part of its system prompt.
            </p>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={5}
              placeholder="e.g. Always follow up within 24 hours. Use a friendly but professional tone. Prioritize enterprise partners over SMB. Track all deals in a pipeline..."
              className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all resize-none"
            />
          </section>

          {/* Skills */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-3">
              Skills
            </h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {suggestedSkills.map((skill) => (
                <button
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedSkills.includes(skill)
                      ? "bg-accent text-primary"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomSkill()}
                placeholder="Add custom skill..."
                className="flex-1 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <button
                onClick={addCustomSkill}
                className="px-3 py-2 bg-neutral-100 rounded-lg text-xs hover:bg-neutral-200 transition-colors"
              >
                Add
              </button>
            </div>
            {selectedSkills.length > 0 && (
              <p className="text-xs text-neutral-400 mt-2">
                {selectedSkills.length} skills selected
              </p>
            )}
          </section>

          {/* Connectors */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-3">
              Connectors
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableConnectors.map((conn) => (
                <button
                  key={conn}
                  onClick={() => toggleConnector(conn)}
                  className={`px-3 py-2.5 rounded-lg text-xs font-medium text-left transition-all ${
                    selectedConnectors.includes(conn)
                      ? "bg-accent/10 border border-accent/30 text-accent"
                      : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300"
                  }`}
                >
                  {conn}
                </button>
              ))}
            </div>
          </section>

          {/* Model */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-3">
              Model
            </h2>
            <div className="grid sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedModel("claude-sonnet-4-6")}
                className={`px-3 py-2.5 rounded-lg text-xs font-medium text-left transition-all ${
                  selectedModel === "claude-sonnet-4-6"
                    ? "bg-accent/10 border border-accent/30 text-accent"
                    : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300"
                }`}
              >
                Claude Sonnet 4.6 (default)
              </button>
              <button
                type="button"
                onClick={() => setSelectedModel("custom")}
                className={`px-3 py-2.5 rounded-lg text-xs font-medium text-left transition-all ${
                  selectedModel === "custom"
                    ? "bg-accent/10 border border-accent/30 text-accent"
                    : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300"
                }`}
              >
                Bring your own model
              </button>
            </div>
            {selectedModel === "custom" && (
              <div className="mt-3 space-y-2">
                <input
                  type="url"
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                  placeholder="OpenAI-compatible API endpoint (e.g. https://api.openai.com/v1)"
                  className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                />
                <p className="text-xs text-neutral-400">
                  Any OpenAI-compatible endpoint works — GPT-4o, Gemini, Llama, Mistral, or your own fine-tuned model. Add your API key in Settings.
                </p>
              </div>
            )}
          </section>

          {/* Preview */}
          {name && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-3">
                Preview
              </h2>
              <div className="p-5 bg-white border border-neutral-200 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <AgentIcon role={name} size="md" />
                  <div>
                    <p className="font-semibold text-sm">{name} Agent</p>
                    <p className="text-xs text-neutral-500">{description}</p>
                  </div>
                </div>
                {selectedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedSkills.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 bg-neutral-100 rounded text-xs text-neutral-600"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {selectedConnectors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedConnectors.map((c) => (
                      <span
                        key={c}
                        className="px-2 py-0.5 bg-accent/10 rounded text-xs text-accent"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Actions */}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex items-center gap-4">
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim() || !description.trim()}
              className="px-8 py-3 bg-primary text-surface font-medium rounded-xl text-sm hover:bg-neutral-800 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {creating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating...
                </>
              ) : (
                "Create agent"
              )}
            </button>
            <button
              onClick={() => router.push(`/dashboard/${companyId}`)}
              className="text-sm text-neutral-500 hover:text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
