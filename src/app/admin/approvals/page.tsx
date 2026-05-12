import Link from "next/link";
import {
  PageHeader,
  Section,
  Pill,
  Code,
  KeyValue,
  Button,
  RelativeTime,
  EmptyState,
} from "../_components/primitives";
import {
  ApprovalsIcon,
  CheckIcon,
  XIcon,
  MessageIcon,
  ClockIcon,
  SparkleIcon,
} from "../_components/icons";
import { slugify, type PendingApproval } from "../_data/mock";
import { loadPendingApprovals } from "../_lib/admin-data";
import { resolveTenant } from "../_lib/resolve-tenant";

function formatInr(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function timeUntilExpiry(expiry: number): string {
  const ms = expiry * 1000 - Date.now();
  if (ms <= 0) return "expired";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms / 3_600_000) % 24);
  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h left`;
}

export default async function ApprovalsPage() {
  const tenant = await resolveTenant();
  const pendingApprovals = await loadPendingApprovals(tenant.firm.id);
  if (pendingApprovals.length === 0) {
    return (
      <div className="flex flex-col gap-12">
        <PageHeader
          eyebrow={
            <span className="inline-flex items-center gap-2">
              <SparkleIcon className="w-3.5 h-3.5" />
              From the CEO agent · Approvals
            </span>
          }
          title="The queue is empty."
          description="The CEO agent has nothing escalated. Every approval card the role agents have raised is resolved."
        />
        <EmptyState
          title="Nothing waiting on a human"
          description="When a role agent escalates a decision, the CEO agent surfaces it here as an approval card."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <SparkleIcon className="w-3.5 h-3.5" />
            From the CEO agent · Approvals
          </span>
        }
        title={`${pendingApprovals.length} cards await a human.`}
        description="The CEO agent receives escalations from every role agent and surfaces them here. Each card was also sent to WhatsApp; resolving here or in WhatsApp is idempotent."
        rail={
          <Button variant="outline" size="sm">
            Bulk approve…
          </Button>
        }
      />

      {/* ── Cards split: top urgent (large) + remaining (compact) ────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8">
        {pendingApprovals[0] && <FeaturedApprovalCard a={pendingApprovals[0]} />}

        <ul className="flex flex-col gap-4">
          {pendingApprovals.slice(1).map((a) => (
            <li key={a.cardId}>
              <article className="flex flex-col gap-3 p-5 border border-neutral-200/80 rounded-lg bg-white hover-lift">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
                    <SparkleIcon className="w-3.5 h-3.5 text-accent" />
                    via {a.escalatedFromRole}
                  </span>
                  <Pill tone="warning">{timeUntilExpiry(a.expiry)}</Pill>
                </div>
                <h3 className="font-[family-name:var(--font-serif)] text-[20px] leading-tight tracking-tight text-primary">
                  {a.title}
                </h3>
                <p className="text-[13.5px] text-neutral-700 leading-relaxed">
                  {a.body}
                </p>
                <div className="flex items-center justify-between gap-3 pt-2 mt-1 border-t border-neutral-200/60">
                  <div className="flex items-center gap-2 text-[12px] text-neutral-500 min-w-0">
                    <MessageIcon className="w-3.5 h-3.5 text-[#2D5A3D] shrink-0" />
                    <span className="truncate">{a.toName}</span>
                    <span className="text-neutral-300">·</span>
                    <RelativeTime ts={a.sentAt} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <XIcon className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm">
                      <CheckIcon className="w-3.5 h-3.5" />
                      Approve
                    </Button>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Resolved (last 7 days) ─────────────────────────────────── */}
      <Section
        title="Resolved · last 7 days"
        description="Audit trail of every CEO-agent callback the platform recorded."
      >
        <ul className="divide-y divide-neutral-200/50">
          {[
            {
              when: new Date(Date.now() - 60 * 60 * 1000),
              role: "Sales",
              card: "card_91d4e2",
              by: "Founder",
              action: "approve" as const,
            },
            {
              when: new Date(Date.now() - 4 * 60 * 60 * 1000),
              role: "Operations",
              card: "card_b3a017",
              by: "Founder",
              action: "reject" as const,
            },
            {
              when: new Date(Date.now() - 26 * 60 * 60 * 1000),
              role: "Marketing",
              card: "card_44c8e9",
              by: "Head of Marketing",
              action: "approve" as const,
            },
            {
              when: new Date(Date.now() - 30 * 60 * 60 * 1000),
              role: "Legal",
              card: "card_7e1f2a",
              by: "Counsel",
              action: "approve" as const,
            },
          ].map((r, i) => (
            <li
              key={i}
              className="grid grid-cols-[100px_minmax(0,1fr)_180px_140px] items-center gap-4 px-6 py-3 -mx-6 hover:bg-[rgba(212,168,83,0.04)] transition-colors"
            >
              <Pill tone={r.action === "approve" ? "success" : "danger"}>
                {r.action}
              </Pill>
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-[14px] text-primary truncate">
                  via {r.role}
                </span>
                <Code>{r.card}</Code>
              </div>
              <span className="text-[13px] text-neutral-600">by {r.by}</span>
              <span className="text-[12.5px] text-right">
                <ClockIcon className="w-3.5 h-3.5 inline-block mr-1 text-neutral-400" />
                <RelativeTime ts={r.when} />
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function FeaturedApprovalCard({ a }: { a: PendingApproval }) {
  return (
    <article className="flex flex-col p-8 border border-neutral-200/80 rounded-xl bg-white relative overflow-hidden">
      <span className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-accent via-accent/70 to-transparent" />

      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-accent font-medium">
          <SparkleIcon className="w-3.5 h-3.5" />
          Most urgent · escalated by {a.escalatedFromRole}
        </span>
        <Pill tone="warning">{timeUntilExpiry(a.expiry)}</Pill>
      </div>

      <h2 className="font-[family-name:var(--font-serif)] text-[34px] leading-[1.1] tracking-tight text-primary mt-5">
        {a.title}
      </h2>

      <p className="text-[15px] text-neutral-700 leading-relaxed mt-4 max-w-[60ch]">
        {a.body}
      </p>

      {a.amountInr && (
        <div className="mt-6 inline-flex items-baseline gap-2">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            Amount
          </span>
          <span className="font-[family-name:var(--font-serif)] text-[28px] text-primary tabular">
            ₹{formatInr(a.amountInr)}
          </span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6 mt-8 pt-6 border-t border-neutral-200/60">
        <KeyValue label="Sent to">
          <span className="flex items-center gap-1.5">
            <MessageIcon className="w-3.5 h-3.5 text-[#2D5A3D]" />
            {a.toName}
          </span>
        </KeyValue>
        <KeyValue label="Card ID">
          <Code>{a.cardId}</Code>
        </KeyValue>
        <KeyValue label="Originating run">
          <Link
            href={`/admin/agents/${slugify(a.escalatedFromRole)}/${a.runId}`}
            className="hover:text-accent transition-colors"
          >
            <Code>{a.runId}</Code>
          </Link>
        </KeyValue>
      </div>

      <div className="flex items-center gap-3 mt-8 pt-6 border-t border-neutral-200/60">
        <Button variant="outline" size="md">
          <XIcon className="w-4 h-4" />
          Reject
        </Button>
        <Button size="md">
          <CheckIcon className="w-4 h-4" />
          Approve
        </Button>
        <span className="ml-auto text-[12px] text-neutral-500">
          Sent <RelativeTime ts={a.sentAt} />
        </span>
      </div>
    </article>
  );
}
