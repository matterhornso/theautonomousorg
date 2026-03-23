"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Recommendation {
  role: string;
  impact: string;
  reason: string;
  example: string;
}

interface Analysis {
  company: {
    name: string;
    industry: string;
    description: string;
    stage: string;
  };
  recommendations: Recommendation[];
  summary: string;
}

import { AgentIcon } from "./agent-icons";

export function WebsiteForm({
  variant = "light",
}: {
  variant?: "light" | "dark";
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || loading) return;

    // Auto-prepend https:// if user didn't include a protocol
    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
      setUrl(normalizedUrl);
    }

    setLoading(true);
    setError("");
    setAnalysis(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setAnalysis(data);
      // Pre-select high-impact recommendations
      setSelectedRoles(
        data.recommendations
          .filter((r: Recommendation) => r.impact === "high")
          .map((r: Recommendation) => r.role)
      );
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const isDark = variant === "dark";

  // ─── Results view ──────────────────────────────────────
  if (analysis) {
    return (
      <div
        className={`rounded-2xl border overflow-hidden ${
          isDark
            ? "bg-neutral-800/50 border-neutral-700"
            : "bg-white border-neutral-200 shadow-lg"
        }`}
      >
        {/* Company header */}
        <div
          className={`px-6 py-5 border-b ${
            isDark ? "border-neutral-700" : "border-neutral-100"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3
              className={`text-lg font-semibold ${
                isDark ? "text-surface" : "text-primary"
              }`}
            >
              {analysis.company.name}
            </h3>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                isDark
                  ? "bg-neutral-700 text-neutral-300"
                  : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {analysis.company.stage}
            </span>
          </div>
          <p
            className={`text-sm ${
              isDark ? "text-neutral-400" : "text-neutral-500"
            }`}
          >
            {analysis.company.industry} &middot;{" "}
            {analysis.company.description}
          </p>
        </div>

        {/* Recommendations */}
        <div className="px-6 py-5">
          <p
            className={`text-xs uppercase tracking-wider font-medium mb-4 ${
              isDark ? "text-neutral-500" : "text-neutral-400"
            }`}
          >
            Recommended agents
          </p>
          <div className="space-y-3">
            {analysis.recommendations.map((rec) => {
              const isSelected = selectedRoles.includes(rec.role);
              return (
              <button
                key={rec.role}
                type="button"
                onClick={() =>
                  setSelectedRoles((prev) =>
                    prev.includes(rec.role)
                      ? prev.filter((r) => r !== rec.role)
                      : [...prev, rec.role]
                  )
                }
                className={`flex gap-4 p-4 rounded-xl text-left transition-all ${
                  isSelected
                    ? isDark
                      ? "bg-neutral-800 ring-2 ring-accent"
                      : "bg-accent/5 ring-2 ring-accent"
                    : isDark
                      ? "bg-neutral-800 opacity-60 hover:opacity-80"
                      : "bg-neutral-50 opacity-60 hover:opacity-80"
                }`}
              >
                <AgentIcon role={rec.role} size="md" variant={isSelected ? "accent" : "dark"} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p
                      className={`font-medium text-sm ${
                        isDark ? "text-surface" : "text-primary"
                      }`}
                    >
                      {rec.role} Agent
                    </p>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        rec.impact === "high"
                          ? "bg-accent/20 text-accent"
                          : isDark
                            ? "bg-neutral-700 text-neutral-400"
                            : "bg-neutral-200 text-neutral-500"
                      }`}
                    >
                      {rec.impact} impact
                    </span>
                  </div>
                  <p
                    className={`text-sm leading-relaxed ${
                      isDark ? "text-neutral-400" : "text-neutral-600"
                    }`}
                  >
                    {rec.reason}
                  </p>
                  <p
                    className={`text-xs mt-1.5 italic ${
                      isDark ? "text-neutral-500" : "text-neutral-400"
                    }`}
                  >
                    e.g. {rec.example}
                  </p>
                </div>
              </button>
              );
            })}
          </div>
        </div>

        {/* Summary + actions */}
        <div
          className={`px-6 py-4 border-t ${
            isDark ? "border-neutral-700" : "border-neutral-100"
          }`}
        >
          <p
            className={`text-sm mb-4 ${
              isDark ? "text-neutral-400" : "text-neutral-500"
            }`}
          >
            {analysis.summary}
          </p>
          <div className="flex gap-3">
            <button
              disabled={provisioning || selectedRoles.length === 0}
              onClick={async () => {
                if (!analysis || selectedRoles.length === 0) return;
                setProvisioning(true);
                try {
                  const res = await fetch("/api/provision", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ analysis, selectedRoles }),
                  });
                  const data = await res.json();
                  if (res.ok && data.companyId) {
                    router.push(`/provisioning/${data.companyId}`);
                  } else {
                    setError(data.error || "Failed to provision agents");
                    setProvisioning(false);
                  }
                } catch {
                  setError("Network error. Please try again.");
                  setProvisioning(false);
                }
              }}
              className="flex-1 py-3 bg-accent text-primary font-medium rounded-xl text-sm hover:bg-accent-hover transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {provisioning ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Provisioning agents...
                </>
              ) : (
                `Launch ${selectedRoles.length} agent${selectedRoles.length !== 1 ? "s" : ""}`
              )}
            </button>
            <button
              onClick={() => {
                setAnalysis(null);
                setUrl("");
              }}
              className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isDark
                  ? "bg-neutral-800 text-neutral-400 hover:text-surface"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              Try another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Form view ─────────────────────────────────────────
  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            type="url"
            placeholder="Enter your company website..."
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError("");
            }}
            required
            disabled={loading}
            className={`w-full px-5 py-4 rounded-xl text-base transition-all focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent disabled:opacity-60 ${
              isDark
                ? "bg-neutral-800 border border-neutral-700 text-surface placeholder:text-neutral-500"
                : "bg-white border border-neutral-200 placeholder:text-neutral-400"
            }`}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className={`px-8 py-4 font-medium rounded-xl transition-all hover:shadow-lg active:scale-[0.98] whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
            isDark
              ? "bg-accent text-primary hover:bg-accent-hover hover:shadow-accent/10"
              : "bg-accent text-primary hover:bg-accent-hover hover:shadow-accent/10"
          }`}
        >
          {loading ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
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
              Analyzing...
            </>
          ) : isDark ? (
            "Get started free"
          ) : (
            "Get recommendations"
          )}
        </button>
      </form>

      {error && (
        <p
          className={`text-sm mt-3 ${
            isDark ? "text-red-400" : "text-[#B33A3A]"
          }`}
        >
          {error}
        </p>
      )}
    </div>
  );
}
