"use client";

import { useState } from "react";
import { Section, Button, Pill, type PillTone } from "../../_components/primitives";
import {
  SparkleIcon,
  SpinnerIcon,
  ArrowUpRight,
  CheckIcon,
} from "../../_components/icons";
import { useToast } from "../../_components/toast";

type SuggestionCategory =
  | "positioning"
  | "pricing"
  | "copy"
  | "product"
  | "seo"
  | "operations";

type SuggestionPriority = "high" | "medium" | "low";

type SuggestionAction = "apply" | "review" | "external";

interface Suggestion {
  title: string;
  category: SuggestionCategory;
  priority: SuggestionPriority;
  rationale: string;
  suggestedPrompt: string | null;
  suggestedAction: SuggestionAction;
}

interface InsightsResponse {
  insights: {
    category: string;
    marketSummary: string;
    competitiveLandscape: string;
    differentiationGap: string;
    suggestions: Suggestion[];
  };
  inputTokens: number;
  outputTokens: number;
  productCount: number;
  shopName: string;
}

const CATEGORY_LABELS: Record<SuggestionCategory, string> = {
  positioning: "Positioning",
  pricing: "Pricing",
  copy: "Copy",
  product: "Product",
  seo: "SEO",
  operations: "Operations",
};

const CATEGORY_TONES: Record<SuggestionCategory, PillTone> = {
  positioning: "accent",
  pricing: "warning",
  copy: "info",
  product: "success",
  seo: "neutral",
  operations: "neutral",
};

const PRIORITY_TONES: Record<SuggestionPriority, PillTone> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

interface InsightsPanelProps {
  /** Provided by the parent so a "Use this prompt" click pre-fills the editor. */
  onUsePrompt: (prompt: string) => void;
}

export function InsightsPanel({ onUsePrompt }: InsightsPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shopify/insights", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        toast({
          title: "Couldn't generate insights",
          body: json.error ?? `HTTP ${res.status}`,
          tone: "danger",
        });
      } else {
        setData(json);
        toast({
          title: `Insights ready · ${json.insights.suggestions.length} recommendations`,
          body: `Analysed ${json.productCount} product${json.productCount === 1 ? "" : "s"} against the ${json.insights.category} category.`,
          tone: "success",
          durationMs: 6000,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast({ title: "Network error", body: msg, tone: "danger" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section
      title="Competitor insights"
      description="Run a category-aware audit. We'll diagnose your positioning gap and propose prioritised changes — applicable ones come with a one-click prompt for the editor."
      rail={
        <Button
          onClick={handleAnalyze}
          disabled={loading}
          className={loading ? "admin-cta-progress" : "admin-cta-idle"}
        >
          {loading ? (
            <SpinnerIcon className="w-4 h-4 admin-spinner" />
          ) : (
            <SparkleIcon className="w-4 h-4 admin-cta-icon-sparkle" />
          )}
          {loading
            ? "Analysing…"
            : data
            ? "Re-run analysis"
            : "Get competitor insights"}
        </Button>
      }
    >
      {!data && !loading && !error && (
        <p className="text-[14px] text-neutral-600 leading-relaxed max-w-[60ch]">
          Click <span className="text-primary font-medium">Get competitor insights</span> to have the agent
          read your live catalog, identify your category, scan the competitive
          landscape, and return 5 prioritised, actionable suggestions.
        </p>
      )}

      {loading && (
        <div className="py-8 flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-start gap-4"
              style={{ animation: `fadeUp 0.4s ${i * 80}ms both` }}
            >
              <div className="w-2 h-2 rounded-full bg-accent admin-pulse mt-2 shrink-0" />
              <div className="flex-1">
                <div className="h-3 w-1/3 rounded bg-neutral-100 animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-neutral-100 mt-2 animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-neutral-100 mt-2 animate-pulse" />
              </div>
            </div>
          ))}
          <p className="text-[12px] text-neutral-500 mt-2 italic">
            Reading your catalog, scanning competitors, ranking opportunities…
          </p>
        </div>
      )}

      {error && (
        <div className="text-[13px] text-[#7a2424] bg-[#B33A3A]/10 px-4 py-3 rounded-md border border-[#B33A3A]/20">
          {error}
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-8">
          {/* Market overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <OverviewCard
              label="Category"
              body={data.insights.category}
              accent
              delay={0}
            />
            <OverviewCard
              label="Competitive landscape"
              body={data.insights.competitiveLandscape}
              delay={80}
            />
            <OverviewCard
              label="Your gap"
              body={data.insights.differentiationGap}
              delay={160}
            />
          </div>

          {/* Suggestions list */}
          <div className="flex flex-col gap-4">
            <h3 className="text-[13px] uppercase tracking-[0.16em] text-neutral-500 font-medium">
              Recommended changes
            </h3>
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.insights.suggestions.map((s, i) => (
                <SuggestionCard
                  key={i}
                  suggestion={s}
                  delay={i * 90}
                  onUsePrompt={(p) => {
                    onUsePrompt(p);
                    toast({
                      title: "Prompt pasted into the editor",
                      body: "Scroll up to Plan changes — review and Apply.",
                      tone: "info",
                    });
                  }}
                />
              ))}
            </ul>
          </div>

          <div className="text-[11px] text-neutral-500 tabular">
            Tokens used: {data.inputTokens.toLocaleString()} in · {data.outputTokens.toLocaleString()} out · {data.productCount} product{data.productCount === 1 ? "" : "s"} analysed
          </div>
        </div>
      )}
    </Section>
  );
}

function OverviewCard({
  label,
  body,
  accent,
  delay,
}: {
  label: string;
  body: string;
  accent?: boolean;
  delay: number;
}) {
  return (
    <div
      className={`rounded-lg p-5 border ${accent ? "border-accent/30 bg-accent/[0.05]" : "border-neutral-200/70 bg-white"}`}
      style={{ animation: `fadeUp 0.5s ${delay}ms both` }}
    >
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500 font-medium">
        {label}
      </div>
      <p className="text-[14px] text-primary mt-2 leading-relaxed">{body}</p>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  delay,
  onUsePrompt,
}: {
  suggestion: Suggestion;
  delay: number;
  onUsePrompt: (prompt: string) => void;
}) {
  const [used, setUsed] = useState(false);
  return (
    <li
      className="rounded-lg border border-neutral-200/70 bg-white p-5 flex flex-col gap-3"
      style={{ animation: `fadeUp 0.5s ${delay}ms both` }}
    >
      <div className="flex items-start gap-3 flex-wrap">
        <Pill tone={PRIORITY_TONES[suggestion.priority]}>
          {suggestion.priority}
        </Pill>
        <Pill tone={CATEGORY_TONES[suggestion.category]}>
          {CATEGORY_LABELS[suggestion.category]}
        </Pill>
      </div>
      <h4 className="font-[family-name:var(--font-serif)] text-[20px] leading-tight text-primary">
        {suggestion.title}
      </h4>
      <p className="text-[13.5px] text-neutral-600 leading-relaxed">
        {suggestion.rationale}
      </p>
      {suggestion.suggestedAction === "apply" && suggestion.suggestedPrompt && (
        <div className="flex flex-col gap-2 pt-2 border-t border-neutral-200/60 mt-1">
          <code className="text-[12px] font-mono bg-neutral-50 border border-neutral-200/60 rounded p-2.5 text-neutral-700 leading-relaxed">
            {suggestion.suggestedPrompt}
          </code>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onUsePrompt(suggestion.suggestedPrompt!);
              setUsed(true);
              setTimeout(() => setUsed(false), 2200);
            }}
            className={used ? "" : "admin-cta-idle"}
          >
            {used ? (
              <>
                <CheckIcon className="w-4 h-4" />
                Pasted
              </>
            ) : (
              <>
                <ArrowUpRight className="w-4 h-4" />
                Use this prompt
              </>
            )}
          </Button>
        </div>
      )}
      {suggestion.suggestedAction === "review" && (
        <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-400 font-medium pt-2 border-t border-neutral-200/60 mt-1">
          Human review needed
        </div>
      )}
      {suggestion.suggestedAction === "external" && (
        <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-400 font-medium pt-2 border-t border-neutral-200/60 mt-1">
          Outside Shopify
        </div>
      )}
    </li>
  );
}
