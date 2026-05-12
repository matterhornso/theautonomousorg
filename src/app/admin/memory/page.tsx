import {
  PageHeader,
  Section,
  Pill,
  Code,
  RelativeTime,
  EmptyState,
} from "../_components/primitives";
import { BrainIcon, SearchIcon, ArrowUpRight } from "../_components/icons";
import { resolveTenant } from "../_lib/resolve-tenant";
import {
  queryCompanyMemory,
  summarizeCompanyMemory,
  type MemoryHit,
  type MemoryHitType,
} from "@/lib/memory";

const typeLabel: Record<MemoryHitType, string> = {
  memory: "Agent memory",
  lesson: "Lesson",
  vault: "Vault chunk",
  activity: "Activity",
  graph: "Graph entity",
};

const typeTone: Record<MemoryHitType, "neutral" | "accent" | "info" | "success"> =
  {
    memory: "neutral",
    lesson: "accent",
    vault: "info",
    activity: "success",
    graph: "accent",
  };

export default async function MemoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const tenant = await resolveTenant();
  const params = await searchParams;
  const query = params.q?.trim() || undefined;
  const typeFilter = params.type as MemoryHitType | undefined;

  const types = typeFilter ? [typeFilter] : undefined;

  const [hits, summary] = await Promise.all([
    queryCompanyMemory({
      companyId: tenant.firm.id,
      query,
      types,
      limit: 50,
    }),
    summarizeCompanyMemory(tenant.firm.id),
  ]);

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrainIcon className="w-3.5 h-3.5" />
            Memory
          </span>
        }
        title="One brain. Every agent. Every artifact."
        description="The shared memory every agent in this workspace reads from. Combines per-agent key-value memory, lessons from prior runs, vault documents, and recent activity into a single queryable surface. The closed loop made visible."
      />

      {/* ── Summary strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4 -mx-6 px-6 py-6 border-y border-neutral-200/80">
        <SummaryStat label="Memory entries" value={summary.memoryEntries} />
        <SummaryStat label="Lessons" value={summary.lessons} />
        <SummaryStat label="Vault docs" value={summary.vaultDocs} />
        <SummaryStat label="Recent activity" value={summary.recentActivity} />
      </div>

      {/* ── Search bar ────────────────────────────────────────────── */}
      <form
        action="/admin/memory"
        method="get"
        className="flex items-center gap-3 px-5 py-4 rounded-lg border border-neutral-200/80 bg-white"
      >
        <SearchIcon className="w-5 h-5 text-neutral-400" />
        <input
          type="search"
          name="q"
          defaultValue={query ?? ""}
          placeholder="Search the shared brain — try 'FinTech CTO', 'pricing decision', or 'MSA terms'"
          className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-neutral-400 text-primary"
        />
        {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
        <span className="text-[11px] text-neutral-400 font-[family-name:var(--font-mono)]">
          {query
            ? `query · vault is searched semantically`
            : `no query · recency-ranked`}
        </span>
      </form>

      {/* ── Type filter chips ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 -mt-6">
        <FilterChip href={pathWith(query, undefined)} active={!typeFilter}>
          All
        </FilterChip>
        <FilterChip href={pathWith(query, "memory")} active={typeFilter === "memory"}>
          Agent memory
        </FilterChip>
        <FilterChip href={pathWith(query, "lesson")} active={typeFilter === "lesson"}>
          Lessons
        </FilterChip>
        <FilterChip href={pathWith(query, "vault")} active={typeFilter === "vault"}>
          Vault
        </FilterChip>
        <FilterChip
          href={pathWith(query, "activity")}
          active={typeFilter === "activity"}
        >
          Activity
        </FilterChip>
        <FilterChip
          href={pathWith(query, "graph")}
          active={typeFilter === "graph"}
        >
          Graph
        </FilterChip>
      </div>

      {/* ── Results ───────────────────────────────────────────────── */}
      <Section
        title={
          query
            ? `Results for "${query}"`
            : typeFilter
              ? `All ${typeLabel[typeFilter].toLowerCase()}`
              : "Everything the workspace knows"
        }
        description={
          hits.length === 0
            ? undefined
            : `${hits.length} hit${hits.length === 1 ? "" : "s"} across the shared brain.`
        }
      >
        {hits.length === 0 ? (
          <EmptyState
            title={query ? "No matches" : "The brain is empty"}
            description={
              query
                ? "Try a different query, or remove the filter to see all sources."
                : "As agents run, write lessons, and ingest documents, the shared memory will populate here."
            }
          />
        ) : (
          <ul className="divide-y divide-neutral-200/50">
            {hits.map((hit, i) => (
              <li
                key={`${hit.type}-${i}`}
                className={`animate-fade-up delay-${((i % 5) + 1) as 1 | 2 | 3 | 4 | 5}`}
              >
                <MemoryRow hit={hit} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function pathWith(q: string | undefined, type: MemoryHitType | undefined): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (type) params.set("type", type);
  const qs = params.toString();
  return qs ? `/admin/memory?${qs}` : "/admin/memory";
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </span>
      <span className="font-[family-name:var(--font-serif)] text-[34px] tabular leading-none text-primary">
        {value}
      </span>
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={`px-3 py-1.5 rounded-full text-[12.5px] border transition-colors ${
        active
          ? "bg-primary text-surface border-primary"
          : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
      }`}
    >
      {children}
    </a>
  );
}

function MemoryRow({ hit }: { hit: MemoryHit }) {
  return (
    <article className="group grid grid-cols-[40px_minmax(0,1fr)_180px_140px] items-start gap-5 px-6 py-5 -mx-6 hover:bg-[rgba(212,168,83,0.04)] transition-colors">
      <BrainIcon className="w-6 h-6 text-neutral-400 mt-1 group-hover:text-accent transition-colors" />
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Pill tone={typeTone[hit.type]}>{typeLabel[hit.type]}</Pill>
          {hit.source.agentRole && (
            <Pill tone="neutral">{hit.source.agentRole}</Pill>
          )}
          {hit.score !== undefined && (
            <Pill tone="info">score {(hit.score * 100).toFixed(0)}%</Pill>
          )}
        </div>
        <h3 className="font-[family-name:var(--font-serif)] text-[20px] leading-tight tracking-tight text-primary mt-2.5">
          {hit.title}
        </h3>
        {hit.body && (
          <p className="text-[13.5px] text-neutral-600 mt-2 leading-relaxed line-clamp-2">
            {hit.body}
          </p>
        )}
        <div className="flex items-center gap-4 mt-3 text-[12px] text-neutral-500">
          {hit.source.docId && <Code>{hit.source.docId}</Code>}
          {hit.source.runId && <Code>{hit.source.runId}</Code>}
        </div>
      </div>
      <span className="text-[12.5px] text-neutral-500 pt-2">
        <RelativeTime ts={new Date(hit.createdAt)} />
      </span>
      <div className="flex justify-end pt-1">
        <ArrowUpRight className="w-4 h-4 text-neutral-300 group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
      </div>
    </article>
  );
}
