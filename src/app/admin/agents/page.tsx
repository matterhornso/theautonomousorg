import Link from "next/link";
import {
  PageHeader,
  Section,
  Pill,
  StatusDot,
  Button,
} from "../_components/primitives";
import { ArrowUpRight, FilterIcon, PlayIcon } from "../_components/icons";
import { roleAgents, slugify } from "../_data/mock";

export default function AgentsRolesPage() {
  const ceo = roleAgents.find((r) => r.orchestrator);
  const others = roleAgents.filter((r) => !r.orchestrator);
  const enabled = roleAgents.filter((r) => r.enabled).length;

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow="Workforce"
        title="Your AI workforce."
        description={`${enabled} agents active across roles. Each role is a custom agent — same SDK, same Vault, same lessons loop. Click into a role to see runs, lessons, and config.`}
        rail={
          <>
            <Button variant="outline" size="sm">
              <FilterIcon className="w-4 h-4" />
              Filter
            </Button>
            <Button size="sm">
              <PlayIcon className="w-4 h-4" />
              Add agent
            </Button>
          </>
        }
      />

      {/* CEO orchestrator — full-width feature */}
      {ceo && (
        <Section
          title="Orchestrator"
          description="The CEO agent receives every escalation from role agents and routes to a human."
        >
          <Link
            href={`/admin/agents/${slugify(ceo.role)}`}
            className="group relative flex flex-col md:flex-row gap-8 p-8 rounded-xl border border-neutral-200/80 bg-white hover-lift overflow-hidden"
          >
            <span className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-accent via-accent/70 to-transparent" />
            <div className="md:w-[280px] shrink-0 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary text-surface flex items-center justify-center font-[family-name:var(--font-serif)] text-[18px]">
                  {ceo.monogram}
                </div>
                <Pill tone="accent">orchestrator</Pill>
              </div>
              <h3 className="font-[family-name:var(--font-serif)] text-[32px] tracking-tight leading-none text-primary">
                {ceo.role}
              </h3>
              <div className="flex items-center gap-2 text-[13px] text-neutral-600">
                <StatusDot tone="success" live />
                <span>{ceo.runs7d} runs · last 7 days</span>
              </div>
            </div>
            <div className="flex-1 flex flex-col">
              <p className="text-[15px] text-neutral-700 leading-relaxed max-w-[60ch]">
                {ceo.description}
              </p>
              <div className="grid grid-cols-3 gap-6 mt-6 pt-6 border-t border-neutral-200/60">
                <div className="flex flex-col">
                  <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
                    Open approvals
                  </span>
                  <span className="font-[family-name:var(--font-serif)] text-[28px] tabular text-primary">
                    {ceo.openApprovals}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
                    Acceptance
                  </span>
                  <span className="font-[family-name:var(--font-serif)] text-[28px] tabular text-primary">
                    {Math.round(ceo.acceptance * 100)}%
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
                    Lessons
                  </span>
                  <span className="font-[family-name:var(--font-serif)] text-[28px] tabular text-primary">
                    {ceo.lessons}
                  </span>
                </div>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-neutral-300 group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all absolute top-8 right-8" />
          </Link>
        </Section>
      )}

      {/* Role agents — bento grid (1 col mobile, 2 md, 3 lg) */}
      <Section title="Role agents">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {others.map((r, i) => (
            <Link
              key={r.id}
              href={`/admin/agents/${slugify(r.role)}`}
              className={`group relative flex flex-col gap-4 p-6 rounded-lg border transition-all hover-lift animate-fade-up delay-${
                ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5
              } ${
                r.enabled
                  ? "bg-white border-neutral-200/80"
                  : "bg-neutral-50 border-neutral-200/60 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center font-[family-name:var(--font-serif)] text-[14px] ${
                      r.enabled
                        ? "bg-primary text-surface"
                        : "bg-neutral-200 text-neutral-500"
                    }`}
                  >
                    {r.monogram}
                  </div>
                  <div className="flex flex-col">
                    <h3 className="font-[family-name:var(--font-serif)] text-[22px] tracking-tight leading-none text-primary">
                      {r.role}
                    </h3>
                    <span className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mt-1">
                      {r.enabled ? "Active" : "Off"}
                    </span>
                  </div>
                </div>
                <StatusDot tone={r.enabled ? "success" : "neutral"} live={r.enabled} />
              </div>

              <p className="text-[13.5px] text-neutral-600 leading-relaxed line-clamp-3">
                {r.description}
              </p>

              <div className="flex items-center justify-between gap-3 pt-4 mt-auto border-t border-neutral-200/60">
                <div className="flex items-center gap-4 text-[12px] text-neutral-600">
                  <span className="tabular">
                    <span className="text-neutral-400">7d</span> {r.runs7d}
                  </span>
                  <span className="tabular">
                    <span className="text-neutral-400">accept</span>{" "}
                    {r.enabled ? `${Math.round(r.acceptance * 100)}%` : "—"}
                  </span>
                  <span className="tabular">
                    <span className="text-neutral-400">lessons</span> {r.lessons}
                  </span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-neutral-300 group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
