import {
  PageHeader,
  Section,
  Pill,
  Code,
  Button,
  RelativeTime,
} from "../_components/primitives";
import {
  VaultIcon,
  SearchIcon,
  FileIcon,
  ArrowUpRight,
} from "../_components/icons";
import { loadVaultDocs } from "../_lib/admin-data";
import { resolveTenant } from "../_lib/resolve-tenant";

const docTypeLabel: Record<string, string> = {
  brand_guidelines: "Brand",
  sop: "SOP",
  contract: "Contract",
  customer_data: "Customer data",
  user_input: "User input",
  vendor_master: "Vendor",
  compliance: "Compliance",
};

export default async function VaultPage() {
  const tenant = await resolveTenant();
  const vaultDocs = await loadVaultDocs(tenant.firm.id);
  const totalChunks = vaultDocs.reduce((s, d) => s + d.chunkCount, 0);

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <VaultIcon className="w-3.5 h-3.5" />
            Vault
          </span>
        }
        title="One store. Every agent. Every input."
        description="Universal knowledge base for the workspace. Anything an agent reads, anything you feed in — voice memos, contracts, customer data, brand guides. Tenant-isolated via Postgres RLS; agents query a pgvector index over Cohere multilingual embeddings."
        rail={
          <>
            <Button variant="outline" size="sm">
              Re-embed
            </Button>
            <Button size="sm">
              <FileIcon className="w-4 h-4" />
              Ingest
            </Button>
          </>
        }
      />

      {/* ── Stats strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4 -mx-6 px-6 py-6 border-y border-neutral-200/80">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            Documents
          </span>
          <span className="font-[family-name:var(--font-serif)] text-[34px] tabular leading-none text-primary">
            {vaultDocs.length}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            Chunks
          </span>
          <span className="font-[family-name:var(--font-serif)] text-[34px] tabular leading-none text-primary">
            {totalChunks}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            Provider
          </span>
          <span className="text-[14px] text-primary">embed-multilingual-v3.0</span>
          <span className="text-[11px] text-neutral-500 font-[family-name:var(--font-mono)]">
            cohere · 1024 dim
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            Index
          </span>
          <span className="text-[14px] text-primary">HNSW · cosine</span>
          <span className="text-[11px] text-neutral-500 font-[family-name:var(--font-mono)]">
            m=16 · ef_construction=64
          </span>
        </div>
      </div>

      {/* ── Search bar ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-4 rounded-lg border border-neutral-200/80 bg-white">
        <SearchIcon className="w-5 h-5 text-neutral-400" />
        <input
          type="search"
          placeholder="Semantic search across the vault — try 'sales playbook' or 'AWS contract terms'"
          className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-neutral-400 text-primary"
        />
        <span className="text-[11px] text-neutral-400 font-[family-name:var(--font-mono)]">
          embeds query · returns top 5
        </span>
      </div>

      {/* ── Doc list ────────────────────────────────────────────── */}
      <Section title="All documents">
        <ul className="divide-y divide-neutral-200/50">
          {vaultDocs.map((d, i) => (
            <li
              key={d.id}
              className={`animate-fade-up delay-${((i % 5) + 1) as 1 | 2 | 3 | 4 | 5}`}
            >
              <article className="group grid grid-cols-[40px_minmax(0,1fr)_180px_140px] items-start gap-5 px-6 py-5 -mx-6 hover:bg-[rgba(212,168,83,0.04)] transition-colors">
                <FileIcon className="w-6 h-6 text-neutral-400 mt-1 group-hover:text-accent transition-colors" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Pill tone="neutral">
                      {docTypeLabel[d.docType] ?? d.docType}
                    </Pill>
                    <Pill tone="accent">ingested by {d.ingestedBy}</Pill>
                    {d.entities.map((e) => (
                      <Pill key={e.value} tone="info">
                        {e.kind}: {e.value}
                      </Pill>
                    ))}
                  </div>
                  <h3 className="font-[family-name:var(--font-serif)] text-[22px] leading-tight tracking-tight text-primary mt-2.5">
                    {d.title}
                  </h3>
                  <p className="text-[13.5px] text-neutral-600 mt-2 leading-relaxed line-clamp-2">
                    {d.excerpt}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-[12px] text-neutral-500">
                    <Code>{d.id}</Code>
                    <span className="tabular">{d.chunkCount} chunks</span>
                    {d.pages && <span className="tabular">{d.pages} pages</span>}
                  </div>
                </div>
                <span className="text-[12.5px] text-neutral-500 pt-2">
                  <RelativeTime ts={d.createdAt} />
                </span>
                <div className="flex justify-end pt-1">
                  <ArrowUpRight className="w-4 h-4 text-neutral-300 group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>
              </article>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── Re-embed activity ───────────────────────────────────── */}
      <Section
        title="Re-embed activity"
        description="Selective re-embedding when source docs change. Skipped if content_hash matches."
      >
        <div className="grid grid-cols-3 gap-4 -mx-6 px-6 py-5 border-y border-neutral-200/60">
          <div className="flex flex-col gap-1">
            <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
              Skipped (dedup)
            </span>
            <span className="font-[family-name:var(--font-serif)] text-[24px] tabular text-primary">
              17
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
              Re-embedded
            </span>
            <span className="font-[family-name:var(--font-serif)] text-[24px] tabular text-primary">
              3
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
              Failed
            </span>
            <span className="font-[family-name:var(--font-serif)] text-[24px] tabular text-primary">
              0
            </span>
          </div>
        </div>
      </Section>
    </div>
  );
}
