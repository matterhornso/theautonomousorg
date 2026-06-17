"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Pill } from "../../_components/primitives";
import { useToast } from "../../_components/toast";
import { ClockIcon } from "../../_components/icons";
import { CronBuilder } from "./cron-builder";

interface Schedule {
  cron: string;
  timezone: string;
  paused: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

interface ScheduleCardProps {
  schedule: Schedule;
  description: string;
}

const TIME_PRESETS: Array<{ label: string; cron: string }> = [
  { label: "Daily at 9:00 AM", cron: "0 9 * * *" },
  { label: "Daily at 5:00 PM (default)", cron: "0 17 * * *" },
  { label: "Daily at 6:30 PM", cron: "30 18 * * *" },
  { label: "Weekdays at 5:00 PM", cron: "0 17 * * 1-5" },
  { label: "Fridays at 5:00 PM", cron: "0 17 * * 5" },
];

const TIMEZONE_PRESETS = [
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Dubai",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
];

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = d.getTime() - now;
  const abs = Math.abs(diffMs);
  const past = diffMs < 0;
  const min = Math.round(abs / 60000);
  const hr = Math.round(abs / 3600000);
  const day = Math.round(abs / 86400000);
  if (min < 1) return past ? "just now" : "in <1 min";
  if (hr < 1) return past ? `${min}m ago` : `in ${min}m`;
  if (hr < 24) return past ? `${hr}h ago` : `in ${hr}h`;
  if (day < 7) return past ? `${day}d ago` : `in ${day}d`;
  return d.toLocaleString("en-IN", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ScheduleCard({
  schedule: initial,
  description: initialDesc,
}: ScheduleCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<Schedule>(initial);
  const [description, setDescription] = useState(initialDesc);
  const [editing, setEditing] = useState(false);
  const [cron, setCron] = useState(initial.cron);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function applyPatch(patch: Partial<Schedule>) {
    setSaving(true);
    try {
      const res = await fetch("/api/timesheets/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({
          title: "Couldn't update schedule",
          body: json.error ?? `HTTP ${res.status}`,
          tone: "danger",
        });
      } else {
        setSchedule(json.schedule);
        setDescription(json.description);
        setEditing(false);
        toast({
          title: patch.paused
            ? "Reminders paused"
            : patch.paused === false
            ? "Reminders resumed"
            : "Schedule updated",
          body: patch.paused
            ? "No automatic reminders will fire until you resume."
            : json.description,
          tone: "success",
        });
        router.refresh();
      }
    } catch (err) {
      toast({
        title: "Network error",
        body: err instanceof Error ? err.message : String(err),
        tone: "danger",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-neutral-200/70 rounded-lg bg-white">
      <div className="flex items-center justify-between gap-6 px-6 py-5 border-b border-neutral-200/60">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-md bg-accent/15 flex items-center justify-center shrink-0">
            <ClockIcon className="w-5 h-5 text-[#7a5d1f]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[16px] text-primary font-medium">
                {description}
              </span>
              {schedule.paused ? (
                <Pill tone="neutral">Paused</Pill>
              ) : (
                <Pill tone="success">Active</Pill>
              )}
              <span className="text-[12px] text-neutral-500">
                · {schedule.timezone}
              </span>
            </div>
            <div className="text-[13px] text-neutral-600 mt-1.5 flex items-center gap-4 flex-wrap">
              <span>
                Next:{" "}
                <span className="text-primary tabular">
                  {schedule.paused ? "—" : formatRelative(schedule.nextRunAt)}
                </span>
              </span>
              <span>
                Last:{" "}
                <span className="text-primary tabular">
                  {formatRelative(schedule.lastRunAt)}
                </span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {schedule.paused ? (
            <Button
              size="sm"
              onClick={() => applyPatch({ paused: false })}
              disabled={saving}
            >
              Resume
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPatch({ paused: true })}
              disabled={saving}
            >
              Pause
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCron(schedule.cron);
              setTimezone(schedule.timezone);
              setEditing((s) => !s);
            }}
            disabled={saving}
          >
            {editing ? "Close" : "Edit"}
          </Button>
        </div>
      </div>

      {editing && (
        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 font-medium">
              Cadence
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {TIME_PRESETS.map((p) => (
                <button
                  key={p.cron}
                  type="button"
                  onClick={() => setCron(p.cron)}
                  className={`text-[12px] px-3 py-1.5 rounded-full border transition-colors ${
                    cron === p.cron
                      ? "bg-primary text-surface border-primary"
                      : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <CronBuilder value={cron} onChange={setCron} />
            </div>
            <button
              type="button"
              onClick={() => setShowAdvanced((s) => !s)}
              className="mt-3 text-[12px] text-neutral-500 hover:text-primary transition-colors"
            >
              {showAdvanced ? "Hide advanced" : "Advanced — edit raw cron"}
            </button>
            {showAdvanced && (
              <>
                <input
                  value={cron}
                  onChange={(e) => setCron(e.target.value)}
                  placeholder="cron expression — e.g. 0 17 * * *"
                  className="mt-2 w-full px-3 py-2 text-[13px] font-mono border border-neutral-200 rounded focus:outline-none focus:border-accent"
                />
                <p className="text-[11px] text-neutral-500 mt-1.5">
                  5-field cron: minute · hour · day-of-month · month ·
                  day-of-week. Use <code className="font-mono">*</code> as
                  wildcard, <code className="font-mono">1-5</code> for weekdays,{" "}
                  <code className="font-mono">5</code> for Friday.
                </p>
              </>
            )}
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 font-medium">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-2 w-full px-3 py-2 text-[13px] border border-neutral-200 rounded focus:outline-none focus:border-accent bg-white"
            >
              {TIMEZONE_PRESETS.includes(timezone) ? null : (
                <option value={timezone}>{timezone}</option>
              )}
              {TIMEZONE_PRESETS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => applyPatch({ cron, timezone })}
              disabled={saving || !cron}
              className={!saving ? "admin-cta-idle" : "admin-cta-progress"}
            >
              {saving ? "Saving…" : "Save schedule"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
