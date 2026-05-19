"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { AgentIcon } from "@/app/components/agent-icons";
import { Logo } from "@/app/components/logo";

type ProvisioningState =
  | "created"
  | "schema_applied"
  | "kms_provisioned"
  | "langfuse_provisioned"
  | "vault_initialized"
  | "ready"
  | "failed";

interface ProvisioningSnapshot {
  companyId: string;
  name: string;
  state: ProvisioningState;
  error: string | null;
  progressIndex: number;
  progressTotal: number;
  agents: { id: string; role: string; status: string }[];
}

const STEP_LABEL: Record<ProvisioningState, string> = {
  created: "Tenant record created",
  schema_applied: "Database schema applied",
  kms_provisioned: "Encryption keys provisioned",
  langfuse_provisioned: "Telemetry workspace ready",
  vault_initialized: "Vault initialised",
  ready: "Workspace ready",
  failed: "Provisioning failed",
};

export default function ProvisioningPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.companyId as string;

  const [snap, setSnap] = useState<ProvisioningSnapshot | null>(null);
  const [polling, setPolling] = useState(true);

  // Poll the provisioning state every 1.5s until ready / failed.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetch(`/api/provisioning/${companyId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("fetch failed");
        const data: ProvisioningSnapshot = await res.json();
        if (cancelled) return;
        setSnap(data);
        if (data.state === "ready" || data.state === "failed") {
          setPolling(false);
          return;
        }
      } catch {
        // Network blip — retry next tick.
      }
      if (!cancelled) timer = setTimeout(tick, 1500);
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [companyId]);

  // Auto-redirect to /admin once ready.
  useEffect(() => {
    if (snap?.state === "ready") {
      const t = setTimeout(() => router.push("/admin"), 1200);
      return () => clearTimeout(t);
    }
  }, [snap?.state, router]);

  const allOnline = snap?.state === "ready";
  const failed = snap?.state === "failed";
  const stepsTotal = snap?.progressTotal ?? 6;
  const stepsDone = Math.max(0, snap?.progressIndex ?? 0);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="mx-auto mb-5">
            <Logo size="large" />
          </div>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight mb-2">
            {failed
              ? "Provisioning ran into trouble"
              : allOnline
                ? "Your workspace is ready"
                : "Setting up your workspace"}
          </h1>
          <p className="text-sm text-neutral-500">
            {failed
              ? snap?.error ?? "We've logged the failure and the team is on it."
              : allOnline
                ? `${snap?.name ?? "Your company"} is live on The Autonomous.`
                : `Provisioning ${snap?.name ?? "your tenant"} — ${stepsDone}/${stepsTotal} steps complete.`}
          </p>
        </div>

        {/* Provisioning step progress */}
        {!failed && snap && (
          <div className="space-y-2 mb-8 text-left">
            {(
              [
                "created",
                "schema_applied",
                "kms_provisioned",
                "langfuse_provisioned",
                "vault_initialized",
                "ready",
              ] as ProvisioningState[]
            ).map((step, i) => {
              const done = i <= stepsDone - 1 || allOnline;
              const inProgress = !allOnline && i === stepsDone;
              return (
                <div
                  key={step}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    done
                      ? "bg-white border-secondary/30"
                      : inProgress
                        ? "bg-white border-accent/30"
                        : "bg-neutral-50 border-neutral-200 opacity-60"
                  }`}
                >
                  <span
                    className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-medium ${
                      done
                        ? "bg-secondary/15 text-secondary"
                        : inProgress
                          ? "bg-accent/15 text-accent animate-pulse"
                          : "bg-neutral-200 text-neutral-500"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span className="text-sm text-neutral-700">
                    {STEP_LABEL[step]}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Agent roster preview */}
        {snap && snap.agents.length > 0 && (
          <div className="space-y-2 mb-8">
            {snap.agents.slice(0, 5).map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-3 p-3 rounded-xl border bg-white border-neutral-200/80"
              >
                <AgentIcon role={agent.role} size="sm" variant="dark" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{agent.role} agent</p>
                  <p className="text-xs text-neutral-500">{agent.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {allOnline && (
          <div className="animate-fade-up">
            <p className="text-xs text-neutral-400 mb-3">
              Redirecting to your workspace…
            </p>
            <button
              onClick={() => router.push("/admin")}
              className="px-6 py-3 bg-primary text-surface text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors"
            >
              Open workspace
            </button>
          </div>
        )}

        {failed && (
          <button
            onClick={() => location.reload()}
            className="px-6 py-3 bg-primary text-surface text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors"
          >
            Retry
          </button>
        )}

        {polling && !allOnline && !failed && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
            <p className="text-xs text-neutral-400">
              Polling provisioning state…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
