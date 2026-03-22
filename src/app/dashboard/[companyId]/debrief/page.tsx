"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

interface DebriefData {
  id: string;
  content: string;
  period_start: string;
  period_end: string;
  delivered_via: string | null;
  created_at: string;
}

export default function DebriefPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;

  const [debrief, setDebrief] = useState<DebriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch(`/api/debrief?companyId=${companyId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.id) setDebrief(data);
        setLoading(false);
      });
  }, [companyId]);

  const handleGenerate = async () => {
    setGenerating(true);
    const res = await fetch("/api/debrief/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    if (res.ok) {
      const data = await res.json();
      setDebrief(data);
    }
    setGenerating(false);
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

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight mb-1">
              Daily Debrief
            </h1>
            <p className="text-neutral-500 text-sm">
              A summary of what your agents accomplished. Auto-generated at 10am
              your local time.
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-5 py-2.5 bg-accent text-primary text-sm font-medium rounded-xl hover:bg-accent-hover disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {generating ? (
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
                Generating...
              </>
            ) : (
              "Generate now"
            )}
          </button>
        </div>

        {debrief ? (
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 uppercase tracking-wider">
                  Generated{" "}
                  {new Date(debrief.created_at).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  debrief.delivered_via === "dashboard"
                    ? "bg-secondary/10 text-secondary"
                    : "bg-accent/10 text-accent"
                }`}
              >
                {debrief.delivered_via || "dashboard"}
              </span>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <div className="prose prose-sm max-w-none text-neutral-700 leading-relaxed whitespace-pre-wrap">
                {debrief.content}
              </div>
            </div>

            {/* Period */}
            <div className="px-6 py-3 border-t border-neutral-100 bg-neutral-50">
              <p className="text-xs text-neutral-400">
                Covering:{" "}
                {new Date(debrief.period_start).toLocaleDateString()} —{" "}
                {new Date(debrief.period_end).toLocaleDateString()}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg
                className="w-8 h-8 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-2">No debrief yet</h3>
            <p className="text-sm text-neutral-500 mb-6 max-w-md mx-auto">
              Your daily debrief will be auto-generated at 10am your local time.
              Or click &quot;Generate now&quot; to create one instantly.
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-6 py-3 bg-primary text-surface text-sm font-medium rounded-xl hover:bg-neutral-800 disabled:opacity-50 transition-all"
            >
              {generating ? "Generating..." : "Generate your first debrief"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
