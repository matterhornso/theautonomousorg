"use client";

import { useState } from "react";

export function EvalsClient({ companyId }: { companyId: string }) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const runSuite = async () => {
    setRunning(true);
    setStatus("Starting...");
    try {
      const res = await fetch("/api/evals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_suite", companyId }),
      });
      const data = await res.json();
      if (data.runId) {
        setStatus("Running test suite in background. Refresh to see results.");
      } else {
        setStatus(data.error || "Failed to start");
      }
    } catch {
      setStatus("Failed to start eval suite");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {status && (
        <p className="text-xs text-neutral-500 max-w-[200px] text-right">
          {status}
        </p>
      )}
      <button
        onClick={runSuite}
        disabled={running}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          running
            ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
            : "bg-accent text-primary hover:bg-accent/90"
        }`}
      >
        {running ? (
          <span className="flex items-center gap-2">
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
            Running...
          </span>
        ) : (
          "Run Eval Suite"
        )}
      </button>
    </div>
  );
}
