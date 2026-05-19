import {
  PageHeader,
  Section,
  Pill,
  StatusDot,
  Code,
  Button,
  RelativeTime,
} from "../_components/primitives";
import {
  ProvisionIcon,
  CheckIcon,
  AlertIcon,
  PlayIcon,
  XIcon,
} from "../_components/icons";
import {
  provisioningRoster,
  type ProvisioningStep,
  type FirmProvisioning,
} from "../_data/mock";

const STEPS: { key: ProvisioningStep; label: string; description: string }[] = [
  {
    key: "created",
    label: "Created",
    description: "companies row exists",
  },
  {
    key: "schema_applied",
    label: "Schema applied",
    description: "RLS migrations confirmed",
  },
  {
    key: "kms_provisioned",
    label: "KMS provisioned",
    description: "per-firm CMK alias set",
  },
  {
    key: "langfuse_provisioned",
    label: "Langfuse",
    description: "trace project recorded",
  },
  {
    key: "vault_initialized",
    label: "Vault",
    description: "index & RLS verified",
  },
  {
    key: "ready",
    label: "Ready",
    description: "agents can run for this firm",
  },
];

function stepIndex(state: ProvisioningStep): number {
  if (state === "failed") return -1;
  return STEPS.findIndex((s) => s.key === state);
}

export default function ProvisioningPage() {
  const ready = provisioningRoster.filter((f) => f.state === "ready").length;
  const inFlight = provisioningRoster.filter(
    (f) => f.state !== "ready" && f.state !== "failed"
  ).length;
  const failed = provisioningRoster.filter((f) => f.state === "failed").length;

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <ProvisionIcon className="w-3.5 h-3.5" />
            Provisioning
          </span>
        }
        title="Tenant state machine."
        description="Each firm walks through six states. The runner is idempotent — re-applying picks up from wherever the row currently is. Self-serve onboarding stays gated until ≥5 tenants have completed without error."
        rail={
          <Button variant="outline" size="sm">
            Self-serve · gated
          </Button>
        }
      />

      {/* ── Stats ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 -mx-6 px-6 py-6 border-y border-neutral-200/80">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            Ready
          </span>
          <div className="flex items-baseline gap-3">
            <span className="font-[family-name:var(--font-serif)] text-[44px] tabular leading-none text-primary">
              {ready}
            </span>
            <Pill tone="success">live</Pill>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            In flight
          </span>
          <div className="flex items-baseline gap-3">
            <span className="font-[family-name:var(--font-serif)] text-[44px] tabular leading-none text-primary">
              {inFlight}
            </span>
            <Pill tone="warning">running</Pill>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            Failed
          </span>
          <div className="flex items-baseline gap-3">
            <span className="font-[family-name:var(--font-serif)] text-[44px] tabular leading-none text-primary">
              {failed}
            </span>
            <Pill tone="danger">attention</Pill>
          </div>
        </div>
      </div>

      {/* ── Per-firm rows ────────────────────────────────────────── */}
      <Section title="Roster">
        <ul className="flex flex-col gap-8">
          {provisioningRoster.map((f) => (
            <li key={f.id}>
              <FirmRow firm={f} />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function FirmRow({ firm }: { firm: FirmProvisioning }) {
  const idx = stepIndex(firm.state);
  const isFailed = firm.state === "failed";

  return (
    <article className="border-t border-neutral-200/60 pt-6">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h3 className="font-[family-name:var(--font-serif)] text-[26px] tracking-tight text-primary">
              {firm.name}
            </h3>
            <Code>{firm.id}</Code>
          </div>
          <div className="flex items-center gap-4 mt-2 text-[12.5px] text-neutral-500">
            <span>{firm.spocPhone}</span>
            {firm.provisionedAt && (
              <>
                <span className="text-neutral-300">·</span>
                <span>
                  Live <RelativeTime ts={firm.provisionedAt} />
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isFailed ? (
            <>
              <Pill tone="danger">failed</Pill>
              <Button variant="outline" size="sm">
                <PlayIcon className="w-4 h-4" />
                Resume
              </Button>
            </>
          ) : firm.state === "ready" ? (
            <Pill tone="success">ready</Pill>
          ) : (
            <>
              <Pill tone="warning">in flight</Pill>
              <Button variant="outline" size="sm">
                <PlayIcon className="w-4 h-4" />
                Advance
              </Button>
            </>
          )}
        </div>
      </header>

      {/* ── Step rail ──────────────────────────────────────────── */}
      <ol className="grid grid-cols-6 gap-3 mt-6">
        {STEPS.map((step, i) => {
          const isDone = !isFailed && i < idx;
          const isCurrent = !isFailed && i === idx;
          const isFailedHere = isFailed && i === 1; // visualize at schema_applied for resume
          return (
            <li key={step.key} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                    isDone
                      ? "bg-[#2D5A3D] border-[#2D5A3D] text-surface"
                      : isCurrent
                        ? "border-accent bg-accent/10 text-accent"
                        : isFailedHere
                          ? "bg-[#B33A3A] border-[#B33A3A] text-surface"
                          : "border-neutral-300 text-neutral-300"
                  }`}
                >
                  {isDone ? (
                    <CheckIcon className="w-3 h-3" />
                  ) : isFailedHere ? (
                    <XIcon className="w-3 h-3" />
                  ) : (
                    <span className="text-[10px] tabular">{i + 1}</span>
                  )}
                </span>
                <span
                  className={`h-px flex-1 ${
                    isDone ? "bg-[#2D5A3D]/40" : "bg-neutral-200"
                  } ${i === STEPS.length - 1 ? "hidden" : ""}`}
                />
              </div>
              <div className="flex flex-col">
                <span
                  className={`text-[12px] font-medium ${
                    isDone || isCurrent ? "text-primary" : "text-neutral-400"
                  }`}
                >
                  {step.label}
                </span>
                <span className="text-[11px] text-neutral-500 leading-snug">
                  {step.description}
                </span>
                {isCurrent && (
                  <span className="text-[10.5px] text-accent uppercase tracking-[0.12em] mt-1 flex items-center gap-1">
                    <StatusDot tone="accent" live />
                    next step
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* ── Detail strip ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6 mt-6 pt-5 border-t border-neutral-200/40">
        <div className="flex flex-col gap-1">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            KMS alias
          </span>
          {firm.kmsKeyAlias ? (
            <Code>{firm.kmsKeyAlias}</Code>
          ) : (
            <span className="text-[12.5px] text-neutral-400 italic">not provisioned</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            Langfuse project
          </span>
          {firm.langfuseProjectId ? (
            <Code>{firm.langfuseProjectId}</Code>
          ) : (
            <span className="text-[12.5px] text-neutral-400 italic">pending</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            Schema
          </span>
          <span className="text-[13px] text-primary">migrations 001–004</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            Vault
          </span>
          <span className="text-[13px] text-primary">
            shared index · RLS-isolated
          </span>
        </div>
      </div>

      {firm.lastError && (
        <div className="flex items-start gap-3 mt-5 p-4 rounded-md bg-[#B33A3A]/5 border border-[#B33A3A]/20">
          <AlertIcon className="w-4 h-4 text-[#B33A3A] shrink-0 mt-0.5" />
          <p className="text-[13px] text-[#7a2424] leading-relaxed">
            <span className="font-medium">Last error: </span>
            {firm.lastError}
          </p>
        </div>
      )}
    </article>
  );
}
