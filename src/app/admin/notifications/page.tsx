import Link from "next/link";
import {
  PageHeader,
  Section,
  Pill,
  Code,
  Button,
  RelativeTime,
} from "../_components/primitives";
import {
  AlertIcon,
  CheckIcon,
  ArrowUpRight,
  FilterIcon,
  SparkleIcon,
} from "../_components/icons";
import { slugify, type Severity } from "../_data/mock";
import { loadNotifications } from "../_lib/admin-data";
import { resolveTenant } from "../_lib/resolve-tenant";

const severityTone: Record<Severity, "danger" | "warning" | "neutral" | "info"> = {
  P1: "danger",
  P2: "warning",
  P3: "neutral",
  INFO: "info",
};

const kindLabel: Record<string, string> = {
  alert: "Alert",
  escalation: "Escalation",
  handoff: "Handoff",
  system: "System",
};

export default async function NotificationsPage() {
  const tenant = await resolveTenant();
  const notifications = await loadNotifications(tenant.firm.id);
  const open = notifications.filter((n) => !n.acknowledgedAt);
  const acked = notifications.filter((n) => n.acknowledgedAt);

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <SparkleIcon className="w-3.5 h-3.5" />
            From the CEO agent · Notifications
          </span>
        }
        title={open.length > 0 ? `${open.length} unread.` : "Inbox zero."}
        description="The CEO agent forwards alerts from every role agent — connector outages, threshold breaches, system events. Each row links back to the originating run."
        rail={
          <>
            <Button variant="outline" size="sm">
              <FilterIcon className="w-4 h-4" />
              Severity
            </Button>
            <Button variant="ghost" size="sm">
              Mark all read
            </Button>
          </>
        }
      />

      <Section title="Unread" description={`${open.length} open`}>
        <ul className="divide-y divide-neutral-200/50">
          {open.map((n, i) => (
            <li
              key={n.id}
              className={`animate-fade-up delay-${((i % 5) + 1) as 1 | 2 | 3 | 4 | 5}`}
            >
              <article className="grid grid-cols-[60px_minmax(0,1fr)_180px_120px] items-start gap-4 px-6 py-5 -mx-6 hover:bg-[rgba(212,168,83,0.04)] transition-colors group">
                <div className="pt-0.5">
                  <AlertIcon
                    className={`w-5 h-5 ${
                      n.severity === "P1"
                        ? "text-[#B33A3A]"
                        : n.severity === "P2"
                          ? "text-[#C4891A]"
                          : n.severity === "INFO"
                            ? "text-[#3A6B9B]"
                            : "text-neutral-400"
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Pill tone={severityTone[n.severity]}>{n.severity}</Pill>
                    <span className="text-[10.5px] uppercase tracking-[0.12em] text-neutral-500">
                      {kindLabel[n.kind] ?? n.kind}
                    </span>
                    <span className="text-[10.5px] uppercase tracking-[0.12em] text-accent">
                      via {n.fromRole}
                    </span>
                    {n.roleHint && (
                      <span className="text-[10.5px] uppercase tracking-[0.12em] text-neutral-500">
                        → {n.roleHint}
                      </span>
                    )}
                  </div>
                  <h3 className="text-[15px] font-medium text-primary mt-1.5 leading-snug">
                    {n.subject}
                  </h3>
                  <p className="text-[13.5px] text-neutral-600 mt-1.5 leading-relaxed line-clamp-2">
                    {n.detail}
                  </p>
                  {n.runId && n.fromRole !== "system" && (
                    <Link
                      href={`/admin/agents/${slugify(n.fromRole)}/${n.runId}`}
                      className="text-[12px] text-neutral-500 hover:text-accent inline-flex items-center gap-1 mt-2 transition-colors"
                    >
                      <span>From</span>
                      <Code>{n.runId}</Code>
                      <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
                <span className="text-[12.5px] text-neutral-500 pt-0.5">
                  <RelativeTime ts={n.createdAt} />
                </span>
                <div className="flex justify-end gap-2 pt-0.5">
                  <Button variant="ghost" size="sm">
                    <CheckIcon className="w-3.5 h-3.5" />
                    Ack
                  </Button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </Section>

      {acked.length > 0 && (
        <Section title="Resolved" description="Acknowledged in the last 30 days">
          <ul className="divide-y divide-neutral-200/40">
            {acked.map((n) => (
              <li
                key={n.id}
                className="grid grid-cols-[60px_minmax(0,1fr)_180px] items-center gap-4 px-6 py-3 -mx-6 opacity-70"
              >
                <div className="pt-0.5">
                  <CheckIcon className="w-4 h-4 text-[#2D5A3D]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Pill tone={severityTone[n.severity]}>{n.severity}</Pill>
                    <span className="text-[14px] text-primary truncate">
                      {n.subject}
                    </span>
                  </div>
                </div>
                <span className="text-[12px] text-neutral-500 text-right">
                  acked <RelativeTime ts={n.acknowledgedAt!} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
