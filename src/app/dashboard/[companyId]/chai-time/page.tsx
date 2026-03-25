"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

interface AgentSummary {
  agentId: string;
  role: string;
  summary: string;
}

interface CrossUpdate {
  fromRole: string;
  toRole: string;
  update: string;
}

interface ChaiTimeSession {
  id: string;
  company_id: string;
  started_at: string;
  completed_at: string | null;
  agent_summaries: string | null;
  cross_updates: string | null;
  status: string;
}

interface ChaiTimeConfig {
  company_id: string;
  enabled: number;
  time_hour: number;
  time_minute: number;
  timezone: string;
  last_run_at: string | null;
}

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export default function ChaiTimePage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;

  const [config, setConfig] = useState<ChaiTimeConfig | null>(null);
  const [latest, setLatest] = useState<ChaiTimeSession | null>(null);
  const [sessions, setSessions] = useState<ChaiTimeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Local config state for editing
  const [editHour, setEditHour] = useState(17);
  const [editMinute, setEditMinute] = useState(0);
  const [editTimezone, setEditTimezone] = useState("UTC");
  const [editEnabled, setEditEnabled] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/chai-time?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/chai-time?companyId=${companyId}&sessions=true`).then((r) =>
        r.json()
      ),
    ]).then(([data, historyData]) => {
      if (data.config) {
        setConfig(data.config);
        setEditHour(data.config.time_hour);
        setEditMinute(data.config.time_minute);
        setEditTimezone(data.config.timezone);
        setEditEnabled(!!data.config.enabled);
      }
      if (data.latest) setLatest(data.latest);
      if (historyData.sessions) setSessions(historyData.sessions);
      setLoading(false);
    });
  }, [companyId]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/chai-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, action: "run" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          setLatest({
            ...data.session,
            agent_summaries: JSON.stringify(data.summaries),
            cross_updates: JSON.stringify(data.crossUpdates),
          });
          setSessions((prev) => [
            {
              ...data.session,
              agent_summaries: JSON.stringify(data.summaries),
              cross_updates: JSON.stringify(data.crossUpdates),
            },
            ...prev,
          ]);
        }
      }
    } catch {
      // Silently handle
    }
    setRunning(false);
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/chai-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          action: "configure",
          hour: editHour,
          minute: editMinute,
          timezone: editTimezone,
          enabled: editEnabled,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.config) setConfig(data.config);
      }
    } catch {
      // Silently handle
    }
    setSaving(false);
  };

  const parseSummaries = (json: string | null): AgentSummary[] => {
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  };

  const parseCrossUpdates = (json: string | null): CrossUpdate[] => {
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  };

  const formatTime = (hour: number, minute: number) => {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? "AM" : "PM";
    return `${h}:${String(minute).padStart(2, "0")} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const latestSummaries = parseSummaries(latest?.agent_summaries ?? null);
  const latestCrossUpdates = parseCrossUpdates(latest?.cross_updates ?? null);

  return (
    <div className="min-h-screen bg-surface pt-8 pb-16 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => router.push(`/dashboard/${companyId}`)}
          className="text-sm text-neutral-500 hover:text-primary transition-colors mb-6"
        >
          &larr; Back to dashboard
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight mb-1 flex items-center gap-3">
              <span
                className="text-4xl"
                role="img"
                aria-label="tea"
                style={{ color: "#D4A853" }}
              >
                &#9749;
              </span>
              Chai Time
            </h1>
            <p className="text-neutral-500 text-sm max-w-lg">
              Your agents sync up daily at{" "}
              <span className="font-medium text-neutral-700">
                {config
                  ? formatTime(config.time_hour, config.time_minute)
                  : "5:00 PM"}
              </span>
              . They share what they&apos;ve learned so everyone stays on the
              same page.
            </p>
          </div>
          <button
            onClick={handleRun}
            disabled={running}
            className="px-5 py-2.5 bg-accent text-primary text-sm font-medium rounded-xl hover:bg-accent-hover disabled:opacity-50 transition-all flex items-center gap-2 shrink-0"
          >
            {running ? (
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
                Running...
              </>
            ) : (
              "Run Chai Time Now"
            )}
          </button>
        </div>

        {/* Config Section */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 mb-8">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-neutral-400 mb-4">
            Configuration
          </h2>

          <div className="flex flex-wrap items-end gap-6">
            {/* Enabled toggle */}
            <div>
              <label className="text-xs text-neutral-500 block mb-1.5">
                Status
              </label>
              <button
                onClick={() => setEditEnabled(!editEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  editEnabled ? "bg-secondary" : "bg-neutral-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    editEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <p className="text-[10px] text-neutral-400 mt-1">
                {editEnabled ? "Enabled" : "Disabled"}
              </p>
            </div>

            {/* Time picker */}
            <div>
              <label className="text-xs text-neutral-500 block mb-1.5">
                Time
              </label>
              <div className="flex items-center gap-1">
                <select
                  value={editHour}
                  onChange={(e) => setEditHour(Number(e.target.value))}
                  className="bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 text-sm"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}
                    </option>
                  ))}
                </select>
                <span className="text-neutral-400 font-medium">:</span>
                <select
                  value={editMinute}
                  onChange={(e) => setEditMinute(Number(e.target.value))}
                  className="bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 text-sm"
                >
                  {[0, 15, 30, 45].map((m) => (
                    <option key={m} value={m}>
                      {String(m).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label className="text-xs text-neutral-500 block mb-1.5">
                Timezone
              </label>
              <select
                value={editTimezone}
                onChange={(e) => setEditTimezone(e.target.value)}
                className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-sm min-w-[180px]"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            {/* Save button */}
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="px-4 py-1.5 bg-primary text-surface text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-all"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>

          {/* Next run indicator */}
          {config && (
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <p className="text-xs text-neutral-400">
                {config.enabled
                  ? `Next scheduled run: ${formatTime(config.time_hour, config.time_minute)} ${config.timezone}`
                  : "Chai Time is currently disabled."}
                {config.last_run_at && (
                  <span className="ml-3">
                    Last run:{" "}
                    {new Date(config.last_run_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Latest Session */}
        {latest && latest.status === "completed" ? (
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-sm">Latest Session</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {new Date(latest.started_at).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-secondary/10 text-secondary">
                {latest.status}
              </span>
            </div>

            {/* Agent Summaries */}
            {latestSummaries.length > 0 && (
              <div className="px-6 py-4 border-b border-neutral-100">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
                  Agent Summaries
                </h3>
                <div className="space-y-2">
                  {latestSummaries.map((s) => (
                    <div key={s.agentId} className="border border-neutral-100 rounded-xl overflow-hidden">
                      <button
                        onClick={() =>
                          setExpandedAgent(
                            expandedAgent === s.agentId ? null : s.agentId
                          )
                        }
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-accent rounded-full" />
                          <span className="font-medium text-sm">{s.role}</span>
                        </div>
                        <svg
                          className={`w-4 h-4 text-neutral-400 transition-transform ${
                            expandedAgent === s.agentId ? "rotate-180" : ""
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      {expandedAgent === s.agentId && (
                        <div className="px-4 pb-3 text-sm text-neutral-600 leading-relaxed border-t border-neutral-100 pt-3">
                          {s.summary}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cross Updates */}
            {latestCrossUpdates.length > 0 && (
              <div className="px-6 py-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
                  Cross-Updates
                </h3>
                <div className="space-y-2">
                  {latestCrossUpdates.map((cu, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 bg-neutral-50 rounded-xl"
                    >
                      <div className="shrink-0 mt-0.5">
                        <svg
                          className="w-4 h-4 text-accent"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-400 mb-0.5">
                          <span className="font-medium text-neutral-600">
                            {cu.fromRole}
                          </span>{" "}
                          &rarr;{" "}
                          <span className="font-medium text-neutral-600">
                            {cu.toRole}
                          </span>
                        </p>
                        <p className="text-sm text-neutral-700">{cu.update}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : !latest ? (
          <div className="text-center py-20 mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ backgroundColor: "rgba(212, 168, 83, 0.1)" }}
            >
              <span className="text-3xl" style={{ color: "#D4A853" }}>
                &#9749;
              </span>
            </div>
            <h3 className="font-semibold text-lg mb-2">
              No Chai Time session yet
            </h3>
            <p className="text-sm text-neutral-500 mb-6 max-w-md mx-auto">
              Your agents haven&apos;t had their first Chai Time. Click
              &quot;Run Chai Time Now&quot; to kick off the first sync, or wait
              for the scheduled time.
            </p>
            <button
              onClick={handleRun}
              disabled={running}
              className="px-6 py-3 bg-primary text-surface text-sm font-medium rounded-xl hover:bg-neutral-800 disabled:opacity-50 transition-all"
            >
              {running ? "Running..." : "Start your first Chai Time"}
            </button>
          </div>
        ) : null}

        {/* History */}
        {sessions.length > 1 && (
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100">
              <h2 className="font-semibold text-sm">History (Last 7 days)</h2>
            </div>
            <div className="divide-y divide-neutral-100">
              {sessions.slice(1).map((session) => {
                const summaries = parseSummaries(session.agent_summaries);
                const crossUpdates = parseCrossUpdates(session.cross_updates);
                const isExpanded = expandedSession === session.id;

                return (
                  <div key={session.id}>
                    <button
                      onClick={() =>
                        setExpandedSession(isExpanded ? null : session.id)
                      }
                      className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-neutral-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(session.started_at).toLocaleDateString(
                            "en-US",
                            {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            }
                          )}
                        </p>
                        <p className="text-xs text-neutral-400">
                          {summaries.length} agents synced
                          {crossUpdates.length > 0 &&
                            ` | ${crossUpdates.length} cross-updates`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            session.status === "completed"
                              ? "bg-secondary/10 text-secondary"
                              : session.status === "failed"
                                ? "bg-red-50 text-red-600"
                                : "bg-neutral-100 text-neutral-500"
                          }`}
                        >
                          {session.status}
                        </span>
                        <svg
                          className={`w-4 h-4 text-neutral-400 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-6 pb-4 space-y-3">
                        {summaries.map((s) => (
                          <div
                            key={s.agentId}
                            className="p-3 bg-neutral-50 rounded-xl"
                          >
                            <p className="text-xs font-medium text-neutral-500 mb-1">
                              {s.role}
                            </p>
                            <p className="text-sm text-neutral-700">
                              {s.summary}
                            </p>
                          </div>
                        ))}
                        {crossUpdates.length > 0 && (
                          <div className="pt-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                              Cross-Updates
                            </p>
                            {crossUpdates.map((cu, i) => (
                              <div
                                key={i}
                                className="text-sm text-neutral-600 mb-1"
                              >
                                <span className="font-medium">
                                  {cu.fromRole}
                                </span>{" "}
                                &rarr;{" "}
                                <span className="font-medium">
                                  {cu.toRole}
                                </span>
                                : {cu.update}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
