# UNIFICATION — One Platform, One Company Brain

> **Goal:** A single platform where a company spins up agents, every agent does a
> task, and that task — plus every meeting, call, and decision — is logged into a
> shared **company brain** that all agents read from and write to. Memory is
> company-shared by default, private-by-opt-in.
>
> **Status of this doc:** architecture + migration plan. Read before any code.
> Decisions locked (2026-06-06): _fold memory into main app_ · _company-shared by
> default, private opt-in_ · _produce this plan first_.

---

## TL;DR — the merge is mostly already done

The two repos are **not symmetric**, and the gap is far smaller than "merge two
apps" implies:

- **`theautonomousorg` already _is_ the company brain.** It has the full
  multi-tenant spine (companies → agents → tasks → messaging, all RLS-isolated)
  **and** it has already re-implemented the memory product natively in Postgres:
  - `migrations/007_knowledge_graph.sql` — `persons`, `conversations`,
    `decisions`, `commitments`, `events_log`, `artifacts`, `knowledge_edges`,
    each with **company-scoped RLS** and `vector(1024)` embeddings on
    conversations.
  - `src/lib/entity-extractor.ts` — Claude **tool-use** extraction (strictly
    better than the memory product's JSON-parse approach).
  - `src/lib/brief.ts` — pre-meeting brief synthesis over the graph.
  - `src/lib/deepgram.ts` + `src/app/api/memory/ingest/audio/route.ts` — voice
    ingestion. The route comment already anticipates
    `source: 'deepgram' | 'zoom' | 'fireflies'`.
  - `src/app/api/calendar/ingest`, `src/app/api/cron/pre-meeting-briefs`,
    `src/lib/debrief.ts` (daily "chai time" debrief), `src/app/memory/page.tsx`.
  - `src/lib/memory.ts::queryCompanyMemory()` already folds the graph in as a
    **5th memory source** behind one interface that `AgentRunner.beforeRun`
    consumes.

- **`autonomous-memory` (rowboat fork) is a thin pipeline on a heavy fork it
  doesn't use.** It is **not deployed and holds no production data.** Its only
  pieces not already present in the main app are: Fireflies GraphQL import, a
  more polished recording/library/brief UI, and standalone Stripe billing.

**Therefore the "combine" is not a port — it's a _consolidation + decommission_:**
close a handful of real gaps in the main app, then archive the rowboat fork.
No data migration. No MongoDB. No rowboat runtime.

---

## Target architecture (already the shape of the main app)

```
                         ┌─────────────────────────────┐
                         │        COMPANY (tenant)      │
                         │   RLS: app.current_company_id│
                         └─────────────┬───────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                               │
   ┌────▼─────┐                  ┌─────▼──────┐                  ┌──────▼──────┐
   │  AGENTS  │  write task ───► │  COMPANY   │ ◄─── ingest ─────│  INGESTION  │
   │ (15 roles│  artifacts +     │   BRAIN    │   meetings/calls │  voice ·    │
   │ + custom)│  lessons         │            │   decisions      │  calendar · │
   │          │ ◄── read ────────│            │                  │  fireflies ·│
   └──────────┘  beforeRun       └─────┬──────┘                  │  manual     │
                                       │                         └─────────────┘
                                       │ queryCompanyMemory()
                       ┌───────────────┴────────────────┐
                       │  5 unified sources (memory.ts)  │
                       │  1. agent KV memory             │
                       │  2. lessons (agent self-improve)│
                       │  3. vault (pgvector RAG/docs)   │
                       │  4. activity feed (tasks/relays)│
                       │  5. knowledge graph (entities)  │  ◄── migration 007/008
                       └─────────────────────────────────┘
```

Every agent task already logs to the brain (artifacts + lessons + activity).
Every meeting/call now logs to the brain (conversations + extracted entities).
**One brain, many writers, all agents read it.** That is the whole product.

---

## Gap analysis — HAVE vs NEED

| Capability | Main app today | Gap to close |
|---|---|---|
| Multi-tenant company isolation (RLS) | ✅ `migrations/001`, `tenant-context.ts` | — |
| Knowledge-graph schema + RLS | ✅ `migrations/007`, `008` | — |
| Entity extraction (Claude tool-use) | ✅ `entity-extractor.ts` | — |
| Pre-meeting briefs | ✅ `brief.ts` + cron | — |
| Voice ingestion (Deepgram) | ✅ `deepgram.ts` + audio route | wire a record→upload UI |
| Calendar ingestion | ✅ `calendar/ingest` | — |
| Unified memory query (5 sources) | ✅ `queryCompanyMemory()` | — |
| Agents read brain before run | ✅ `AgentRunner.beforeRun` | confirm graph is in the read set |
| **Memory visibility / privacy** | ❌ no `visibility`/`owner_user_id` | **build (the real net-new work)** |
| **Fireflies transcript import** | ❌ (only deepgram/calendar) | **port from memory product** |
| **Polished recording/library/brief UI** | 🟡 `/memory/page.tsx` stub | port UI from memory product |
| Memory product as separate app | 🔴 rowboat fork, MongoDB, undeployed | **decommission** |
| Memory billing/packaging | 🟡 two pricing models exist | **product decision** (below) |

The only **engineering** net-new is the visibility layer + Fireflies import + UI
polish. Everything else is consolidation and deletion.

---

## The one genuinely new design: visibility / privacy

Decision: **company-shared by default, private opt-in.** The current graph tables
have **no** visibility column — today every graph row is company-visible via RLS.
We add an opt-in private lane without weakening the default-shared behavior.

### Schema (new migration `010_memory_visibility.sql`)

Add to the human-sourced tables where privacy matters most — `conversations`,
`decisions`, `commitments`, `events_log`, `artifacts` (agent-authored rows stay
shared; the column still lets a user lock one down):

```sql
ALTER TABLE conversations
  ADD COLUMN visibility   TEXT NOT NULL DEFAULT 'company'
    CHECK (visibility IN ('company','private')),
  ADD COLUMN owner_user_id TEXT;          -- Clerk user id; required when private

-- repeat for decisions, commitments, events_log, artifacts
```

### RLS update (the important part)

Replace the pure `company_id = current_company_id()` read policy with:

```sql
CREATE POLICY conversations_read ON conversations
  FOR SELECT USING (
    company_id = current_company_id()
    AND (
      visibility = 'company'
      OR owner_user_id = current_user_id()      -- private rows: owner only
    )
  );
```

- `current_company_id()` and `current_user_id()` GUCs already exist
  (`tenant-context.ts`), so this is a policy edit, not new plumbing.
- **Agents act as the company**, not as a user → an agent's tenant context has no
  `current_user_id`, so private rows are invisible to agents by construction.
  This is the correct default: a CEO's private 1:1 should not leak into the Sales
  agent's context unless the user shares it.

### App-layer — the PRIMARY enforcement (corrected during Phase 0)

> ⚠️ **Phase 0 finding:** the running app connects to Postgres as the
> `postgres` **superuser** (pooler user `postgres.<project>`) and
> `knowledge-graph.ts` reads/writes through the **global pooled client without
> setting the tenant GUCs** — isolation today is the explicit
> `WHERE company_id = $1` filter in each query, **not** RLS. Superusers bypass
> RLS entirely (even `FORCE`). Therefore **RLS policies are defense-in-depth
> only; the visibility rule must be enforced in application SQL** or it does
> nothing at runtime.

- Thread an optional **viewer** identity through `queryCompanyMemory({ …, viewerUserId? })`
  and the knowledge-graph read functions. The filter every graph read applies:

  ```sql
  WHERE company_id = ${companyId}
    AND (visibility = 'company' OR owner_user_id = ${viewerUserId})
  ```

  When `viewerUserId` is absent (the **agent** path — agents act as the company,
  not a user), the predicate collapses to `visibility = 'company'`, so private
  rows are excluded by construction.
- **Agent reads** (`AgentRunner.beforeRun → queryCompanyMemory`) pass no viewer →
  company-shared only. **Human reads** (`/admin/memory`) pass the Clerk
  `userId` → company + that user's own private rows.
- Ingestion routes set `visibility: 'company'` by default; the record/upload UI
  exposes a "Keep private to me" toggle that sets `visibility:'private'` +
  `owner_user_id = <clerk user id>`.
- RLS policies are still updated to mirror this predicate, so a future move to a
  non-superuser/`authenticated` role keeps the same guarantee.

---

## Phased plan

### Phase 0 — Verify the existing pipeline (no new code)
1. Apply migrations 007/008 on the dev Supabase project; run `test/knowledge-graph.test.ts`, `test/entity-extractor.test.ts`, `test/brief.test.ts`.
2. End-to-end: POST a transcript to `/api/memory/ingest` → confirm `persons/decisions/commitments` rows + edges → `queryCompanyMemory({types:['graph']})` returns them → `generateBrief()` synthesizes.
3. Confirm `AgentRunner.beforeRun` includes graph hits in agent context (a Sales agent should be able to "remember" a logged meeting). **This is the proof the brain works end-to-end.**

_Exit:_ a meeting logged by one path is visible to an agent on another path.

### Phase 1 — Visibility layer (the real net-new work)
1. Write `migrations/010_memory_visibility.sql` (columns + RLS read policies above).
2. Update writers in `entity-extractor.ts` / ingestion routes to set `visibility` + `owner_user_id`.
3. Add `test/memory-visibility.test.ts`: private row invisible to (a) other users, (b) agents; visible to owner. Company rows visible to all + agents.
4. Add the "private to me" toggle to the ingest UI.

_Exit:_ company-shared by default, private opt-in, enforced at the DB layer.

### Phase 2 — Close ingestion + UI gaps from the memory product
1. **Fireflies import:** port `autonomous-memory/.../app/lib/fireflies.ts` (GraphQL client) → main app `src/lib/fireflies.ts`; add `/api/memory/ingest/fireflies` that fetches transcripts and feeds the **existing** `entity-extractor` (dedupe via `conversations.source_ref`, already indexed). Store the per-firm Fireflies key in the `integrations`/connectors table, not a global env.
2. **Recording/library/brief UI:** port the polished record client + library + brief views from the memory product into `src/app/memory/` (and `/admin/memory`), wired to the existing routes. Respect `DESIGN.md`.
3. Wire the record→`/api/memory/ingest/audio` upload flow (the backend exists; it needs a front door).

_Exit:_ every ingestion source the memory product had now lands in the one brain.

### Phase 3 — Decommission the rowboat fork
1. Confirm `autonomous-memory` has no production data (it doesn't — undeployed). No migration.
2. Point `memory.theautonomous.org` → main app `/memory` (301), or retire the subdomain.
3. Archive `matterhornso/rowboat-web3`; update `CONTEXT.md` (remove the "two products" framing → one platform with a Memory surface).
4. Delete the sister-repo references from `CLAUDE.md` / handoff docs.

_Exit:_ one repo, one app, one brain. No MongoDB, no rowboat runtime.

### Phase 4 — Product packaging (needs your call — see Open Questions)
Reconcile the two pricing models: main app credits ($19/1k, Growth $49/mo) vs
memory product subscriptions (Early Access $99, Executive $299). Recommended:
Memory is a **surface of the one platform** — meeting ingestion + briefs consume
**credits** like any agent action, with a higher-tier "Executive Memory" plan for
heavy transcription users. One billing system (the main app's), not two.

---

## What we explicitly drop

- The entire **rowboat fork** (agent-builder runtime, Composio, projects UI) — the
  main app has its own agent runtime.
- **MongoDB + Redis** from the memory product — Postgres is the single store.
- The memory product's **JSON-parse entity extraction** — the main app's tool-use
  extractor supersedes it.
- The **separate Stripe integration** — fold into the main app's billing.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| RLS visibility policy regression leaks private rows | Dedicated test matrix (owner / other-user / agent) in Phase 1 before any UI. |
| Embedding/transcription cost on bulk Fireflies import | Cap + queue imports; dedupe on `source_ref`; charge credits per import. |
| `/memory` UI port drags in rowboat/HeroUI deps | Re-implement against existing main-app primitives (no framer-motion/lucide per repo convention), not a copy-paste. |
| "Two products" still in marketing/SEO/docs | Phase 3 doc sweep; redirect subdomain; update `CONTEXT.md`. |
| Agents over-reading sensitive context | Private-by-opt-in + agent context carries no `current_user_id` → private rows excluded by construction. |

## Open questions (your call)

1. **Packaging:** Memory as a credit-consuming surface of every plan (recommended)
   vs a separate premium tier? Determines Phase 4.
2. **Subdomain:** Keep `memory.theautonomous.org` as a marketing entry that deep-links
   into the app, or retire it entirely?
3. **Private scope:** Is "private" strictly per-user, or do you also want
   per-team/per-department visibility later? (We can ship per-user now and add a
   `visibility:'team'` lane without reworking the model.)

---

## Phase 1 — shipped (2026-06-06)

Enforcement core landed + security-reviewed:
- `migrations/010_memory_visibility.sql` — columns + RLS (USING **and** WITH CHECK carry the visibility predicate).
- `knowledge-graph.ts` — writes set the lane; the 4 graph reads filter by viewer.
- `entity-extractor.ts` — extracted entities inherit the conversation's lane.
- `memory.ts` / `brief.ts` — thread `viewerUserId`; agents/cron pass none → company-only.
- ingest + audio + brief routes — accept/forward a private opt-in; private requires a known owner.
- `test/memory-visibility.test.ts` — write + read + propagation matrix (12 tests). Full suite 361/361, 0 TS errors.

**Confirmed invariant:** `owner_user_id = NULL` (no viewer) excludes private rows → agents never see private memory.

### Known follow-ups (SAFE-GAPs — private data is under-surfaced, never leaked)
- ✅ **summary counts** (`summarizeKnowledgeGraph`) — FIXED (2026-06-09). Threads a
  viewer; conversations/decisions/commitments/artifacts/events counts now apply the
  visibility predicate. `summarizeCompanyMemory` + `/admin/memory` pass the viewer.
- ✅ **events_log** reads (`getUpcomingEvents`/`getEventsBetween`) — FIXED (2026-06-09).
  Both accept an optional viewer and apply the predicate (defensive — `createEventLog`
  still writes company-only, so no behavior change today).
- **knowledge_edges** have no visibility lane — a `person → attended → <private conv>` edge exposes the *linkage/ID* (not content) to any future graph-traversal path. No agent-facing caller today. **Still open** (no caller traverses edges into private rows yet).
- ✅ **persons** — FIXED (2026-06-09, migration 011). Persons now carry the
  visibility lane and inherit it from the source conversation, so a private
  capture no longer leaks the *identity* (name/email/role) of people mentioned.
  Persons are never deduped across conversations, so there's no promotion edge
  case — a genuinely shared contact still gets a company-lane row from any shared
  conversation they appear in. Summary persons count is now viewer-filtered too.
- These are fail-closed: every one under-includes private data rather than leaking it.

## Phase 2 — shipped (2026-06-09)

Ingestion + UI gaps from the memory product closed natively:
- **Fireflies import:** `src/lib/fireflies.ts` (GraphQL client, ported; key via global
  `FIREFLIES_API_KEY` env — single-tenant v1) + `POST /api/memory/ingest/fireflies`
  feeds the existing `ingestConversation`. Idempotent via
  `existingConversationSourceRefs()` (new helper in `knowledge-graph.ts` —
  `createConversation` does not dedupe). Default visibility `company`. Tests in
  `test/memory-fireflies.test.ts`.
- **In-app voice front door:** `POST /api/memory/ingest/audio-upload`
  (multipart) — `MediaRecorder` blobs have no public URL, so this runs Deepgram's
  `transcribeAudioFromBuffer` path (the existing `/ingest/audio` route stays for
  webhook URLs). Owner = Clerk session user.
- **Record / brief UI:** `src/app/admin/memory/_components/{record-card,brief-composer}.tsx`,
  mounted in a "Capture" section on `/admin/memory`. Re-implemented on main-app
  primitives (no framer-motion/lucide/HeroUI), per DESIGN.md. The library view is
  the page's existing graph-backed results list.
- **"Keep private to me" toggle:** on the record card → sends `visibility:'private'`
  → route derives owner from the Clerk session → `ingestConversation` propagates the
  lane to the conversation + every extracted entity. The UI front door for Phase 1.

## Post-review hardening — shipped (2026-06-09)

Self-review of the full merge surfaced no critical issues; these follow-ups landed:
- **Private-persons lane** — migration 011 (above). The privacy model is now
  "everything from a private capture is private," not just its content.
- **Fireflies import won't run unbounded** — the route hard-caps each call at
  `MAX_SYNC_IMPORT` (8) with `maxDuration = 300`, NaN-safe `limit`, and returns
  `capped`/`nextSkip` for pagination. `scripts/fireflies-import.ts` drains a full
  history offline via the same idempotent pipeline.
- **`audio-upload`** got `maxDuration = 300`; **`record-card`** guards setState
  after unmount and releases the mic/timer on teardown.
- Removed dead `oneShot`/`sqlIdent`/`sqlRaw` helpers in `knowledge-graph.ts`.

Full suite green: **374 tests**. 0 TS errors.

**Decision (2026-06-09):** leave the `rowboat-web3` repo **in place, as-is** — it's
already dormant (undeployed, no data) and everything is integrated here, so a
formal archive isn't worth the churn. Not a pending task.

**Still TODO (not code — needs you):** apply `migrations/010` + `011` to the live
DB + run the deferred live E2E (blocked on a working `DATABASE_URL`); optionally
retire/redirect the `memory.theautonomous.org` subdomain; Phase 4 packaging decision.

## Pre-go-live follow-ups (3-lens code review, 2026-06-10)

Security + TypeScript + Database reviews ran on the full diff. **Fixed before ship:**
- `recall()` now try/catches so a brain-read failure can't abort an agent run (`agent-runner.ts`).
- Timing-safe `INTERNAL_SECRET` comparison via `safeSecretEqual` (`src/lib/request-guards.ts`) across the ingest/audio/fireflies/brief routes.
- SSRF guard `isPubliclyFetchableHttpUrl` on every caller-supplied `audioUrl` (Deepgram fetches it server-side) — audio + recorder routes.
- Content-Length pre-check + `recordingId` length cap on the multipart routes (cheap DoS guard).
- Minor: Fireflies default→cap, `FirefliesTranscript.date: string|number`, `MemoryRecallHit.body` non-optional, recorder-key stamp logs on failure, brief-composer clipboard try/catch. Tests: `test/request-guards.test.ts`.

**Deferred — track before/just-after go-live (not blockers for merge):**
- **Clerk CVE (out of scope of this diff):** `@clerk/nextjs ^7.0.6` is in the vulnerable range (middleware bypass GHSA-vqx2-fgx2-5wq9). Bump to ≥7.2.4 — separate dependency PR, may have breaking changes.
- **Rate limiting** on `POST /api/recorder/ingest` (public+key) — needs Upstash/Redis infra. Key brute-force is infeasible (256-bit keys); the DoS angle is mitigated by the Content-Length cap, but add a real limiter pre-scale.
- **`revokeRecorderKey` tenant guard** — CLI-only today (no HTTP caller), so not web-reachable; add `company_id` predicate when an admin UI exposes revoke.
- **RLS `(SELECT current_company_id())` wrapping** — per-row vs per-statement perf; app bypasses RLS as superuser so it's defense-in-depth only. Follow-up migration.
- **`createEventLog` TOCTOU** (pre-existing, calendar path) — add `UNIQUE(company_id, source, source_ref)` on `events_log` + `ON CONFLICT`.
- **`knowledge_edges` visibility lane** — documented SAFE-GAP; edges carry IDs not content today; revisit when edge `properties` gain semantic data.
- **`RETURNING visibility/owner_user_id`** in the KG insert helpers — latent (no reader today).
- Dismissed: a reviewer flagged `/** */` SQL comments in 007 as "invalid" — **false**; PG17 parses them and 007 applied cleanly. No change.

## File map (where the work lands)

- **New:** `migrations/010_memory_visibility.sql`, `src/lib/fireflies.ts`,
  `src/app/api/memory/ingest/fireflies/route.ts`, `test/memory-visibility.test.ts`.
- **Edit:** `src/lib/entity-extractor.ts` + ingest routes (set visibility),
  `migrations/007` policies superseded by 010, `src/app/memory/*` (UI),
  `CONTEXT.md` / `CLAUDE.md` (drop two-product framing).
- **Unchanged (already correct):** `src/lib/memory.ts`, `src/lib/brief.ts`,
  `src/lib/knowledge-graph.ts`, `src/lib/deepgram.ts`, `AgentRunner`.
- **Archive:** entire `autonomous-memory` repo.
```
