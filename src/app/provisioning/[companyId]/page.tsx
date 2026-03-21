"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { AgentIcon } from "@/app/components/agent-icons";

interface AgentStatus {
  id: string;
  role: string;
  status: "queued" | "configuring" | "online" | "failed";
}

export default function ProvisioningPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.companyId as string;
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [allOnline, setAllOnline] = useState(false);

  useEffect(() => {
    // Fetch agents for this company
    fetch(`/api/agents?companyId=${companyId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAgents(
            data.map((a: { id: string; role: string }) => ({
              id: a.id,
              role: a.role,
              status: "queued" as const,
            }))
          );
        }
      });
  }, [companyId]);

  // Animate agents coming online one by one
  useEffect(() => {
    if (agents.length === 0) return;

    let idx = 0;
    const configureNext = () => {
      if (idx >= agents.length) return;

      // Set current to "configuring"
      setAgents((prev) =>
        prev.map((a, i) => (i === idx ? { ...a, status: "configuring" } : a))
      );

      const currentIdx = idx;
      setTimeout(() => {
        // Set to "online"
        setAgents((prev) =>
          prev.map((a, i) =>
            i === currentIdx ? { ...a, status: "online" } : a
          )
        );
        idx++;

        if (idx < agents.length) {
          setTimeout(configureNext, 400);
        } else {
          // All online
          setTimeout(() => setAllOnline(true), 800);
        }
      }, 1000 + Math.random() * 500);
    };

    const timer = setTimeout(configureNext, 600);
    return () => clearTimeout(timer);
  }, [agents.length]);

  // Fetch company name
  useEffect(() => {
    fetch(`/api/agents?companyId=${companyId}`)
      .then((r) => r.json())
      .then(() => {
        // Company name comes from the dashboard page
        setCompanyName("your company");
      });
  }, [companyId]);

  // Redirect to dashboard when all online
  useEffect(() => {
    if (allOnline) {
      const timer = setTimeout(() => {
        router.push(`/dashboard/${companyId}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [allOnline, companyId, router]);

  const statusLabel = (status: AgentStatus["status"]) => {
    switch (status) {
      case "queued":
        return "Queued";
      case "configuring":
        return "Configuring...";
      case "online":
        return "Online";
      case "failed":
        return "Failed";
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-surface text-lg font-bold mx-auto mb-5">
            TA
          </div>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight mb-2">
            {allOnline
              ? "Your team is ready"
              : "Your team is coming online"}
          </h1>
          <p className="text-sm text-neutral-500">
            {allOnline
              ? `${agents.length} agents are configured and ready to work for ${companyName}.`
              : `Setting up ${agents.length} agents with skills, connectors, and company context...`}
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {agents.map((agent, i) => (
            <div
              key={agent.id}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-500 ${
                agent.status === "online"
                  ? "bg-white border-secondary/30 shadow-sm"
                  : agent.status === "configuring"
                    ? "bg-white border-accent/30 shadow-sm"
                    : agent.status === "failed"
                      ? "bg-red-50 border-red-200"
                      : "bg-neutral-50 border-neutral-200 opacity-50"
              }`}
              style={{
                transitionDelay: `${i * 100}ms`,
              }}
            >
              <AgentIcon
                role={agent.role}
                size="sm"
                variant={agent.status === "online" ? "accent" : "dark"}
              />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{agent.role} Agent</p>
                <p
                  className={`text-xs ${
                    agent.status === "online"
                      ? "text-secondary"
                      : agent.status === "configuring"
                        ? "text-accent"
                        : agent.status === "failed"
                          ? "text-red-500"
                          : "text-neutral-400"
                  }`}
                >
                  {statusLabel(agent.status)}
                </p>
              </div>
              <div className="shrink-0">
                {agent.status === "online" ? (
                  <svg
                    className="w-5 h-5 text-secondary"
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
                ) : agent.status === "configuring" ? (
                  <svg
                    className="w-5 h-5 text-accent animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : agent.status === "failed" ? (
                  <svg
                    className="w-5 h-5 text-red-500"
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
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-neutral-200" />
                )}
              </div>
            </div>
          ))}
        </div>

        {allOnline && (
          <div className="animate-fade-up">
            <p className="text-xs text-neutral-400 mb-3">
              Redirecting to your dashboard...
            </p>
            <button
              onClick={() => router.push(`/dashboard/${companyId}`)}
              className="px-6 py-3 bg-primary text-surface text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors"
            >
              Go to dashboard now
            </button>
          </div>
        )}

        {!allOnline && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
            <p className="text-xs text-neutral-400">
              Proactive tasks will begin automatically
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
