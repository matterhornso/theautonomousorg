"use client";

import { useState } from "react";
import { Section, Button, Pill, Code } from "../../_components/primitives";
import {
  SparkleIcon,
  PlayIcon,
  CheckIcon,
  AlertIcon,
  SpinnerIcon,
} from "../../_components/icons";
import { useSendBurst } from "../../_components/send-burst";
import { InsightsPanel } from "./insights-panel";

interface PlanOperation {
  kind: "update_product" | "update_variant_prices";
  productId: string;
  productTitle: string;
  rationale: string;
  changes?: {
    title?: string;
    descriptionHtml?: string;
    tags?: string[];
    status?: "ACTIVE" | "ARCHIVED" | "DRAFT";
    vendor?: string;
    productType?: string;
  };
  variants?: Array<{
    variantId: string;
    variantTitle: string;
    currentPrice: string;
    newPrice: string;
    compareAtPrice?: string | null;
  }>;
}

interface Plan {
  summary: string;
  operations: PlanOperation[];
  warnings: string[];
}

interface ToolCall {
  name: string;
  input: unknown;
  summary: string;
}

interface PlanResponse {
  plan: Plan;
  toolCalls: ToolCall[];
  usage: { modelStops: number; inputTokens: number; outputTokens: number };
}

interface OperationResult {
  index: number;
  kind: PlanOperation["kind"];
  productTitle: string;
  ok: boolean;
  error?: string;
  details?: string;
}

interface ApplyResponse {
  results: OperationResult[];
  successCount: number;
  failureCount: number;
}

const EXAMPLE_PROMPTS = [
  "Add the tag 'summer-2026' to every product in the SOMA Essentials collection.",
  "Drop the price of every product tagged 'clearance' by 20%, with no compareAtPrice.",
  "Set status to DRAFT on every product whose title contains 'sample'.",
];

export function ShopifyEditor() {
  const { fire: fireBurst, burst } = useSendBurst();
  const [prompt, setPrompt] = useState("");
  const [planning, setPlanning] = useState(false);
  const [planResp, setPlanResp] = useState<PlanResponse | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyResp, setApplyResp] = useState<ApplyResponse | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  async function handlePlan() {
    setPlanning(true);
    setPlanError(null);
    setPlanResp(null);
    setApplyResp(null);
    setApplyError(null);
    try {
      const res = await fetch("/api/shopify/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPlanError(json.error ?? `Planner failed (HTTP ${res.status})`);
      } else {
        setPlanResp(json);
      }
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : String(err));
    } finally {
      setPlanning(false);
    }
  }

  async function handleApply() {
    if (!planResp) return;
    if (
      !confirm(
        `Apply ${planResp.plan.operations.length} operation(s) to your live Shopify store? This cannot be undone automatically.`
      )
    ) {
      return;
    }
    setApplying(true);
    setApplyError(null);
    setApplyResp(null);
    try {
      const res = await fetch("/api/shopify/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planResp.plan }),
      });
      const json = await res.json();
      if (!res.ok) {
        setApplyError(json.error ?? `Apply failed (HTTP ${res.status})`);
      } else {
        setApplyResp(json);
        // Celebrate when every op succeeded.
        if (json.failureCount === 0 && json.successCount > 0) {
          fireBurst({
            eyebrow: "Live on Shopify",
            headline:
              json.successCount === 1
                ? "1 change applied"
                : `${json.successCount} changes applied`,
            detail:
              json.successCount === 1
                ? "Your storefront reflects it now."
                : `All ${json.successCount} mutations landed on the live catalog.`,
          });
        }
      }
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      {burst}
      <InsightsPanel onUsePrompt={(p) => setPrompt(p)} />
      <Section
        title="Describe the change"
        description="One sentence. The planner will search your catalog, draft the operations, and wait for your sign-off."
      >
        <div className="flex flex-col gap-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Add the tag &quot;summer-2026&quot; to every product in the SOMA Essentials collection."
            rows={3}
            disabled={planning}
            className="w-full px-4 py-3 text-[15px] leading-relaxed bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-accent placeholder:text-neutral-400 disabled:opacity-60"
          />
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrompt(p)}
                  disabled={planning}
                  className="text-[12px] text-neutral-600 hover:text-primary px-2.5 py-1 rounded-full border border-neutral-200 hover:border-neutral-300 transition-colors"
                >
                  {p.length > 60 ? p.slice(0, 57) + "…" : p}
                </button>
              ))}
            </div>
            <Button
              onClick={handlePlan}
              disabled={planning || prompt.trim().length === 0}
              className={
                planning
                  ? "admin-cta-progress"
                  : prompt.trim().length > 0
                  ? "admin-cta-idle"
                  : ""
              }
            >
              {planning ? (
                <SpinnerIcon className="w-4 h-4 admin-spinner" />
              ) : (
                <SparkleIcon className="w-4 h-4 admin-cta-icon-sparkle" />
              )}
              {planning ? "Planning…" : "Plan changes"}
            </Button>
          </div>
          {planError && (
            <div className="text-[13px] text-[#7a2424] bg-[#B33A3A]/10 px-4 py-3 rounded-md border border-[#B33A3A]/20">
              {planError}
            </div>
          )}
        </div>
      </Section>

      {planResp && (
        <Section
          title="Planned operations"
          description={planResp.plan.summary}
          rail={
            <Button
              onClick={handleApply}
              disabled={
                applying ||
                planResp.plan.operations.length === 0 ||
                Boolean(applyResp)
              }
              className={
                applying
                  ? "admin-cta-progress"
                  : !applyResp && planResp.plan.operations.length > 0
                  ? "admin-cta-idle"
                  : ""
              }
            >
              {applying ? (
                <SpinnerIcon className="w-4 h-4 admin-spinner" />
              ) : applyResp ? (
                <CheckIcon className="w-4 h-4" />
              ) : (
                <PlayIcon className="w-4 h-4 admin-cta-icon-nudge" />
              )}
              {applying
                ? "Applying…"
                : applyResp
                ? "Applied"
                : `Apply ${planResp.plan.operations.length} change${planResp.plan.operations.length === 1 ? "" : "s"}`}
            </Button>
          }
        >
          {planResp.plan.warnings.length > 0 && (
            <div className="mb-6 flex flex-col gap-2">
              {planResp.plan.warnings.map((w, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 px-4 py-3 bg-[#C4891A]/10 border border-[#C4891A]/20 rounded-md"
                >
                  <AlertIcon className="w-4 h-4 text-[#C4891A] shrink-0 mt-0.5" />
                  <span className="text-[13px] text-[#7a5212]">{w}</span>
                </div>
              ))}
            </div>
          )}

          {planResp.plan.operations.length === 0 ? (
            <p className="text-[14px] text-neutral-600 italic">
              The planner produced no operations. Try rephrasing.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-200/60">
              {planResp.plan.operations.map((op, i) => (
                <li key={i} className="py-5 flex flex-col gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 tabular">
                      #{i + 1}
                    </span>
                    <Pill tone={op.kind === "update_variant_prices" ? "warning" : "accent"}>
                      {op.kind.replace(/_/g, " ")}
                    </Pill>
                    <span className="text-[15px] text-primary font-medium">
                      {op.productTitle}
                    </span>
                  </div>
                  <p className="text-[13px] text-neutral-600 leading-relaxed">
                    {op.rationale}
                  </p>
                  {op.changes && (
                    <div className="text-[13px]">
                      <Code block>{JSON.stringify(op.changes, null, 2)}</Code>
                    </div>
                  )}
                  {op.variants && (
                    <ul className="text-[13px] flex flex-col gap-1.5">
                      {op.variants.map((v) => (
                        <li
                          key={v.variantId}
                          className="flex items-center gap-3 px-3 py-2 bg-neutral-50 rounded"
                        >
                          <span className="text-neutral-700 min-w-[160px]">
                            {v.variantTitle}
                          </span>
                          <span className="text-neutral-400 line-through tabular">
                            {v.currentPrice}
                          </span>
                          <span className="text-primary font-medium tabular">
                            → {v.newPrice}
                          </span>
                          {v.compareAtPrice !== undefined && (
                            <span className="text-[11px] text-neutral-500 ml-auto">
                              compareAt: {v.compareAtPrice ?? "null"}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}

          <details className="mt-8 text-[12px] text-neutral-500">
            <summary className="cursor-pointer hover:text-neutral-700">
              Planner trace · {planResp.toolCalls.length} tool call
              {planResp.toolCalls.length === 1 ? "" : "s"} · {planResp.usage.inputTokens}+{planResp.usage.outputTokens} tokens
            </summary>
            <ul className="mt-3 space-y-1 pl-4 border-l border-neutral-200">
              {planResp.toolCalls.map((tc, i) => (
                <li key={i}>
                  <Code>{tc.name}</Code> {tc.summary}
                </li>
              ))}
            </ul>
          </details>
        </Section>
      )}

      {(applyResp || applyError) && (
        <Section title="Apply results">
          {applyError && (
            <div className="text-[13px] text-[#7a2424] bg-[#B33A3A]/10 px-4 py-3 rounded-md border border-[#B33A3A]/20">
              {applyError}
            </div>
          )}
          {applyResp && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <Pill tone={applyResp.failureCount === 0 ? "success" : "warning"}>
                  {applyResp.successCount} succeeded · {applyResp.failureCount}{" "}
                  failed
                </Pill>
              </div>
              <ul className="divide-y divide-neutral-200/60">
                {applyResp.results.map((r) => (
                  <li
                    key={r.index}
                    className="py-3 flex items-center gap-4"
                  >
                    {r.ok ? (
                      <CheckIcon className="w-4 h-4 text-[#2D5A3D]" />
                    ) : (
                      <AlertIcon className="w-4 h-4 text-[#B33A3A]" />
                    )}
                    <span className="text-[14px] text-primary min-w-[200px]">
                      {r.productTitle}
                    </span>
                    <span className="text-[13px] text-neutral-600 flex-1">
                      {r.ok ? r.details : r.error}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      )}
    </div>
  );
}
