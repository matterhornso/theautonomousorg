"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AgentIcon } from "@/app/components/agent-icons";

const AGENT_ROLES = [
  "Sales", "Marketing", "Accounting", "Strategy", "Product",
  "Front-End Engineering", "Back-End Engineering", "AI Expert",
  "Admin", "HR", "Finance", "Customer Success", "Legal", "Data Analyst", "CEO",
];

const TRIGGER_EVENTS = [
  { value: "task_completed", label: "Completes a task" },
  { value: "message_sent", label: "Sends a message" },
  { value: "deal_closed", label: "Closes a deal" },
  { value: "report_generated", label: "Generates a report" },
  { value: "content_created", label: "Creates content" },
  { value: "issue_detected", label: "Detects an issue" },
  { value: "review_completed", label: "Completes a review" },
  { value: "onboarding_done", label: "Finishes onboarding" },
];

interface WorkflowStep {
  agent_role: string;
  action_prompt: string;
}

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  trigger_agent_role: string;
  trigger_event: string;
  steps_json: string;
  is_active: number;
  trigger_count: number;
  last_triggered_at: string | null;
  created_at: string;
}

export default function WorkflowsPage() {
  const params = useParams();
  const companyId = params.companyId as string;
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [saving, setSaving] = useState(false);

  // Builder state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerRole, setTriggerRole] = useState(AGENT_ROLES[0]);
  const [triggerEvent, setTriggerEvent] = useState(TRIGGER_EVENTS[0].value);
  const [steps, setSteps] = useState<WorkflowStep[]>([
    { agent_role: AGENT_ROLES[1], action_prompt: "" },
  ]);

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch(`/api/workflows?companyId=${companyId}`);
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data.workflows);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetchWorkflows(); }, [fetchWorkflows]);

  const addStep = () => {
    setSteps(prev => [...prev, { agent_role: AGENT_ROLES[0], action_prompt: "" }]);
  };

  const removeStep = (index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: keyof WorkflowStep, value: string) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const createWorkflow = async () => {
    if (!name.trim() || steps.some(s => !s.action_prompt.trim())) return;
    setSaving(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          name: name.trim(),
          description: description.trim() || undefined,
          triggerAgentRole: triggerRole,
          triggerEvent: triggerEvent,
          steps,
        }),
      });
      if (res.ok) {
        setShowBuilder(false);
        setName("");
        setDescription("");
        setSteps([{ agent_role: AGENT_ROLES[1], action_prompt: "" }]);
        fetchWorkflows();
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const toggleWorkflow = async (id: string, currentActive: number) => {
    await fetch("/api/workflows", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId: id, isActive: currentActive ? false : true }),
    });
    fetchWorkflows();
  };

  const deleteWf = async (id: string) => {
    await fetch(`/api/workflows?workflowId=${id}`, { method: "DELETE" });
    fetchWorkflows();
  };

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
                <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </div>
              <div>
                <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight">
                  Workflow Chains
                </h1>
                <p className="text-sm text-neutral-500">
                  Automate multi-agent workflows across your team
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowBuilder(!showBuilder)}
            className="px-4 py-2 bg-accent text-primary text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
          >
            {showBuilder ? "Cancel" : "+ New Workflow"}
          </button>
        </div>

        {/* Workflow Builder */}
        {showBuilder && (
          <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-8 animate-fade-in-up">
            <h2 className="text-lg font-semibold mb-4">Create Workflow Chain</h2>

            {/* Name & Description */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-xs text-neutral-500 uppercase tracking-wider mb-1 block">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Deal Closed Pipeline"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500 uppercase tracking-wider mb-1 block">Description (optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What this workflow does..."
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
            </div>

            {/* Trigger */}
            <div className="bg-surface-mid rounded-lg p-4 mb-6">
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3">When this happens...</p>
              <div className="flex items-center gap-3">
                <select
                  value={triggerRole}
                  onChange={e => setTriggerRole(e.target.value)}
                  className="px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  {AGENT_ROLES.map(r => <option key={r} value={r}>{r} Agent</option>)}
                </select>
                <select
                  value={triggerEvent}
                  onChange={e => setTriggerEvent(e.target.value)}
                  className="px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  {TRIGGER_EVENTS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
            </div>

            {/* Steps */}
            <div className="mb-6">
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3">Then do these steps...</p>
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white border border-neutral-200 rounded-lg p-4">
                    <div className="flex items-center justify-center w-6 h-6 bg-accent/10 text-accent text-xs font-bold rounded-full shrink-0 mt-1">
                      {i + 1}
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <select
                        value={step.agent_role}
                        onChange={e => updateStep(i, "agent_role", e.target.value)}
                        className="px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
                      >
                        {AGENT_ROLES.map(r => <option key={r} value={r}>{r} Agent</option>)}
                      </select>
                      <input
                        type="text"
                        value={step.action_prompt}
                        onChange={e => updateStep(i, "action_prompt", e.target.value)}
                        placeholder="What should this agent do?"
                        className="col-span-2 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                      />
                    </div>
                    {steps.length > 1 && (
                      <button
                        onClick={() => removeStep(i)}
                        className="text-neutral-400 hover:text-red-400 transition-colors mt-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addStep}
                className="mt-3 text-sm text-accent hover:text-accent-hover transition-colors"
              >
                + Add step
              </button>
            </div>

            {/* Save */}
            <div className="flex justify-end">
              <button
                onClick={createWorkflow}
                disabled={saving || !name.trim() || steps.some(s => !s.action_prompt.trim())}
                className="px-6 py-2 bg-secondary text-white text-sm font-medium rounded-lg hover:bg-secondary/90 transition-colors disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Workflow"}
              </button>
            </div>
          </div>
        )}

        {/* Workflow List */}
        {loading ? (
          <div className="text-center py-12 text-neutral-400">Loading workflows...</div>
        ) : workflows.length === 0 && !showBuilder ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-serif)] text-xl mb-2">
              No workflows yet
            </h3>
            <p className="text-sm text-neutral-500 mb-4 max-w-md mx-auto">
              Create automated chains that trigger when agents complete work.
              For example: &ldquo;When Sales closes a deal, Marketing creates a case study, then Accounting generates an invoice.&rdquo;
            </p>
            <button
              onClick={() => setShowBuilder(true)}
              className="px-4 py-2 bg-accent text-primary text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
            >
              Create your first workflow
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {workflows.map(wf => {
              let steps: WorkflowStep[] = [];
              try { steps = JSON.parse(wf.steps_json); } catch { /* skip */ }

              return (
                <div key={wf.id} className="bg-white border border-neutral-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${wf.is_active ? "bg-secondary" : "bg-neutral-300"}`} />
                      <h3 className="font-semibold text-sm">{wf.name}</h3>
                      {wf.description && (
                        <span className="text-xs text-neutral-500">{wf.description}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-400">
                        {wf.trigger_count} runs
                      </span>
                      <button
                        onClick={() => toggleWorkflow(wf.id, wf.is_active)}
                        className={`px-3 py-1 text-xs rounded-full ${
                          wf.is_active
                            ? "bg-secondary/10 text-secondary"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {wf.is_active ? "Active" : "Paused"}
                      </button>
                      <button
                        onClick={() => deleteWf(wf.id)}
                        className="text-neutral-400 hover:text-red-400 transition-colors p-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Visual chain */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 bg-surface-mid rounded-lg px-3 py-1.5">
                      <AgentIcon role={wf.trigger_agent_role} size="xs" />
                      <span className="text-xs font-medium">{wf.trigger_agent_role}</span>
                      <span className="text-xs text-neutral-500">
                        {TRIGGER_EVENTS.find(e => e.value === wf.trigger_event)?.label || wf.trigger_event}
                      </span>
                    </div>
                    {steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                        <div className="flex items-center gap-2 bg-surface-mid rounded-lg px-3 py-1.5">
                          <AgentIcon role={step.agent_role} size="xs" />
                          <span className="text-xs font-medium">{step.agent_role}</span>
                          <span className="text-xs text-neutral-500 max-w-40 truncate">
                            {step.action_prompt}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
