"use client";

import {
  buildCron,
  parseCron,
  humanizeCron,
  DAY_LABELS,
  type CronFrequency,
  type CronParts,
} from "@/lib/cron-human";

interface CronBuilderProps {
  /** Current cron expression (controlled by the parent). */
  value: string;
  onChange: (cron: string) => void;
}

const FREQUENCIES: Array<{ key: CronFrequency; label: string }> = [
  { key: "daily", label: "Every day" },
  { key: "weekdays", label: "Weekdays" },
  { key: "weekends", label: "Weekends" },
  { key: "custom", label: "Custom days" },
];

// Minute options on a 5-minute grid; the current minute is spliced in if it
// sits off-grid so we never silently round someone's existing schedule.
const MINUTE_GRID = Array.from({ length: 12 }, (_, i) => i * 5);

const DEFAULT_PARTS: CronParts = {
  minute: 0,
  hour: 17,
  frequency: "daily",
  days: [0, 1, 2, 3, 4, 5, 6],
};

function to12h(hour24: number): { h12: number; ampm: "AM" | "PM" } {
  const ampm = hour24 < 12 ? "AM" : "PM";
  const h12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { h12, ampm };
}

function to24h(h12: number, ampm: "AM" | "PM"): number {
  const base = h12 % 12;
  return ampm === "PM" ? base + 12 : base;
}

const pill = (active: boolean) =>
  `text-[12px] px-3 py-1.5 rounded-full border transition-colors ${
    active
      ? "bg-primary text-surface border-primary"
      : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400"
  }`;

export function CronBuilder({ value, onChange }: CronBuilderProps) {
  const parsed = parseCron(value);
  const parts = parsed ?? DEFAULT_PARTS;
  const { h12, ampm } = to12h(parts.hour);

  function emit(patch: Partial<CronParts>) {
    onChange(buildCron({ ...parts, ...patch }));
  }

  function selectFrequency(freq: CronFrequency) {
    // Switching into custom seeds from the days already implied by the current
    // selection so the toggles start populated rather than empty.
    if (freq === "custom") {
      const seed = parts.days.length ? parts.days : [1, 2, 3, 4, 5];
      emit({ frequency: "custom", days: seed });
    } else {
      emit({ frequency: freq });
    }
  }

  function toggleDay(day: number) {
    const has = parts.days.includes(day);
    const next = has
      ? parts.days.filter((d) => d !== day)
      : [...parts.days, day];
    // Never allow an empty custom selection.
    if (next.length === 0) return;
    emit({ frequency: "custom", days: next });
  }

  const minuteOptions = MINUTE_GRID.includes(parts.minute)
    ? MINUTE_GRID
    : [...MINUTE_GRID, parts.minute].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-4">
      {!parsed && (
        <p className="text-[12px] text-[#7a5212] bg-[#C4891A]/10 border border-[#C4891A]/20 rounded-md px-3 py-2">
          This expression is too advanced for the visual builder. Changing
          anything here replaces it — or edit it directly under Advanced below.
        </p>
      )}

      {/* Frequency */}
      <div className="flex flex-wrap gap-2">
        {FREQUENCIES.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => selectFrequency(f.key)}
            className={pill(parsed?.frequency === f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Day-of-week toggles (custom only) */}
      {parts.frequency === "custom" && (
        <div className="flex flex-wrap gap-1.5">
          {DAY_LABELS.map((label, day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              aria-pressed={parts.days.includes(day)}
              title={label}
              className={`w-9 h-9 rounded-md text-[12px] font-medium border transition-colors ${
                parts.days.includes(day)
                  ? "bg-primary text-surface border-primary"
                  : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
              }`}
            >
              {label[0]}
            </button>
          ))}
        </div>
      )}

      {/* Time of day */}
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-neutral-500">at</span>
        <select
          value={h12}
          onChange={(e) => emit({ hour: to24h(Number(e.target.value), ampm) })}
          className="px-2.5 py-1.5 text-[13px] border border-neutral-200 rounded focus:outline-none focus:border-accent bg-white tabular"
          aria-label="Hour"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="text-neutral-400">:</span>
        <select
          value={parts.minute}
          onChange={(e) => emit({ minute: Number(e.target.value) })}
          className="px-2.5 py-1.5 text-[13px] border border-neutral-200 rounded focus:outline-none focus:border-accent bg-white tabular"
          aria-label="Minute"
        >
          {minuteOptions.map((m) => (
            <option key={m} value={m}>
              {String(m).padStart(2, "0")}
            </option>
          ))}
        </select>
        <div className="flex rounded-md border border-neutral-200 overflow-hidden">
          {(["AM", "PM"] as const).map((mer) => (
            <button
              key={mer}
              type="button"
              onClick={() => emit({ hour: to24h(h12, mer) })}
              className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${
                ampm === mer
                  ? "bg-primary text-surface"
                  : "bg-white text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {mer}
            </button>
          ))}
        </div>
      </div>

      {/* Live summary */}
      <div className="flex items-center gap-2 text-[12px] text-neutral-500">
        <span className="text-primary">{humanizeCron(value)}</span>
        <span className="font-[family-name:var(--font-mono)] text-neutral-400">
          {value}
        </span>
      </div>
    </div>
  );
}
