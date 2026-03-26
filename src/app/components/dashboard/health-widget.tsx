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
      className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6"
    >
      <div className="bg-white border border-neutral-200 rounded-xl p-4">
        <p className="text-xs text-neutral-400 mb-1">Active Agents</p>
        <p className="text-2xl font-semibold text-[#D4A853]">
          {activeAgents}
          <span className="text-sm text-neutral-400 font-normal">
            /{totalAgents}
          </span>
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-4">
        <p className="text-xs text-neutral-400 mb-1">Tasks Done Today</p>
        <p className="text-2xl font-semibold text-[#D4A853]">
          {tasksDoneToday}
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-4">
        <p className="text-xs text-neutral-400 mb-1">Failed Today</p>
        <p
          className={`text-2xl font-semibold ${
            tasksFailedToday > 0 ? "text-[#B33A3A]" : "text-[#2D5A3D]"
          }`}
        >
          {tasksFailedToday}
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-4">
        <p className="text-xs text-neutral-400 mb-1">Next Debrief</p>
        <p className="text-sm font-medium">
          {nextDebriefHours !== null ? (
            nextDebriefHours <= 0 ? (
              <Link
                href={`/dashboard/${companyId}/debrief`}
                className="text-[#D4A853] hover:underline"
              >
                Debrief ready
              </Link>
            ) : (
              <span className="text-[#D4A853]">
                In {nextDebriefHours}h
              </span>
            )
          ) : (
            <span className="text-neutral-400">Not configured</span>
          )}
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-4 col-span-2 sm:col-span-1">
        <p className="text-xs text-neutral-400 mb-1">Last Debrief</p>
        <p className="text-sm font-medium">
          {lastDebrief ? (
            <Link
              href={`/dashboard/${companyId}/debrief`}
              className="text-[#D4A853] hover:underline"
            >
              {new Date(lastDebrief).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </Link>
          ) : (
            <span className="text-neutral-400">None yet</span>
          )}
        </p>
      </div>
    </div>
  );
}
