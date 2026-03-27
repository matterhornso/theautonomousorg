import Link from "next/link";

interface HealthWidgetProps {
  companyId: string;
  activeAgents: number;
  totalAgents: number;
  tasksDoneToday: number;
  tasksFailedToday: number;
  lastDebrief: string | null;
  nextDebriefHours: number | null;
}

export function HealthWidget({
  companyId,
  activeAgents,
  totalAgents,
  tasksDoneToday,
  tasksFailedToday,
  lastDebrief,
  nextDebriefHours,
}: HealthWidgetProps) {
  return (
    <div
      aria-label="Agent activity summary"
      className="flex flex-wrap gap-3 mb-6"
    >
      <Stat label="Active Agents" value={`${activeAgents}/${totalAgents}`} gold />
      <Stat label="Done Today" value={String(tasksDoneToday)} gold />
      <Stat
        label="Failed"
        value={String(tasksFailedToday)}
        color={tasksFailedToday > 0 ? "text-[#B33A3A]" : "text-[#2D5A3D]"}
      />
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-neutral-200 rounded-xl">
        <span className="text-xs text-neutral-400">Next Debrief</span>
        <span className="text-sm font-medium text-[#D4A853]">
          {nextDebriefHours !== null
            ? nextDebriefHours <= 0
              ? <Link href={`/dashboard/${companyId}/debrief`} className="hover:underline">Ready</Link>
              : `${nextDebriefHours}h`
            : "—"}
        </span>
      </div>
      {lastDebrief && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-neutral-200 rounded-xl">
          <span className="text-xs text-neutral-400">Last</span>
          <Link
            href={`/dashboard/${companyId}/debrief`}
            className="text-sm font-medium text-[#D4A853] hover:underline"
          >
            {new Date(lastDebrief).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  gold,
  color,
}: {
  label: string;
  value: string;
  gold?: boolean;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-neutral-200 rounded-xl">
      <span className="text-xs text-neutral-400">{label}</span>
      <span className={`text-lg font-semibold ${color || (gold ? "text-[#D4A853]" : "")}`}>
        {value}
      </span>
    </div>
  );
}
