/**
 * Company-agnostic admin-portal fixture.
 *
 * The platform is horizontal — any MSME runs custom agents across Sales,
 * Marketing, Legal, Operations, Finance, etc. Mocks reflect that:
 *   - Placeholder firm copy ({{firmName}} etc.) reads as a template, not a
 *     specific customer.
 *   - Agent roles draw from src/app/data.ts (Sales, Marketing, Legal,
 *     Customer Success, Finance, HR, Strategy, Product, Engineering, Admin,
 *     AI Expert, Data Analyst, Accounting, CEO).
 *   - The CEO agent is the orchestrator: every approval card and admin
 *     notification surfaces through it (the role agents escalate up to CEO,
 *     which then routes to the human SPOC). Source rows still link the
 *     originating role agent for audit.
 *
 * Once the read APIs land, pages swap import paths from this file to a real
 * loader in src/lib/admin-data.ts that hits Postgres.
 */

// ─── Firm (placeholder) ────────────────────────────────────────────────────

export const firm = {
  id: "firm_demo",
  /** Company-agnostic copy. Real UI substitutes firm name from session. */
  name: "Your company",
  initials: "YC",
  city: "—",
  spocName: "SPOC",
  spocPhone: "+91 ••••• •••••",
  partners: 4,
  staff: 22,
  customers: 168,
  signedSubAt: new Date("2026-04-29T11:32:00+05:30"),
  provisioningState: "ready" as const,
};

// ─── Role agents ───────────────────────────────────────────────────────────
// Each row maps onto one role from src/app/data.ts. The CEO row is the
// orchestrator — `orchestrator: true` flips the UI badge.

export interface RoleAgent {
  id: string;
  role: string;
  /** 2-3 letter monogram from data.ts */
  monogram: string;
  description: string;
  enabled: boolean;
  orchestrator?: boolean;
  /** Runs in last 7 days */
  runs7d: number;
  /** Avg wall-clock per run in ms */
  avgRunMs: number;
  /** Approval acceptance rate (0-1). For CEO: human-acceptance of escalations. */
  acceptance: number;
  /** Lessons recorded (cross-run learning loop) */
  lessons: number;
  /** Open approvals raised by this role this week */
  openApprovals: number;
}

export const roleAgents: RoleAgent[] = [
  {
    id: "agent_ceo",
    role: "CEO",
    monogram: "CEO",
    description:
      "Cross-agent orchestration, board reporting, and company-wide decisions. Receives every escalation; routes to the human SPOC.",
    enabled: true,
    orchestrator: true,
    runs7d: 21,
    avgRunMs: 142_000,
    acceptance: 0.93,
    lessons: 64,
    openApprovals: 4,
  },
  {
    id: "agent_sales",
    role: "Sales",
    monogram: "S",
    description:
      "Prospect research, outbound sequences, CRM updates, pipeline forecasting, and deal qualification — running 24/7.",
    enabled: true,
    runs7d: 312,
    avgRunMs: 18_400,
    acceptance: 0.86,
    lessons: 211,
    openApprovals: 0,
  },
  {
    id: "agent_marketing",
    role: "Marketing",
    monogram: "M",
    description:
      "Content strategy, campaign execution, SEO optimization, social media management, and performance analytics.",
    enabled: true,
    runs7d: 184,
    avgRunMs: 32_900,
    acceptance: 0.79,
    lessons: 142,
    openApprovals: 1,
  },
  {
    id: "agent_legal",
    role: "Legal",
    monogram: "Le",
    description:
      "Contract review, vendor MSA redlines, NDA drafting, regulatory compliance checks, and IP filing prep.",
    enabled: true,
    runs7d: 47,
    avgRunMs: 96_500,
    acceptance: 0.92,
    lessons: 38,
    openApprovals: 2,
  },
  {
    id: "agent_cs",
    role: "Customer Success",
    monogram: "CS",
    description:
      "Inbound triage, SLA tracking, churn risk detection, NPS analysis, and proactive outreach for at-risk accounts.",
    enabled: true,
    runs7d: 268,
    avgRunMs: 8_400,
    acceptance: 0.88,
    lessons: 174,
    openApprovals: 0,
  },
  {
    id: "agent_finance",
    role: "Finance",
    monogram: "Fi",
    description:
      "Financial modeling, fundraising prep, investor reporting, budget planning, and unit economics analysis.",
    enabled: true,
    runs7d: 14,
    avgRunMs: 184_000,
    acceptance: 0.95,
    lessons: 41,
    openApprovals: 1,
  },
  {
    id: "agent_hr",
    role: "HR",
    monogram: "HR",
    description:
      "Recruiting pipeline management, candidate screening, onboarding workflows, culture surveys, and performance reviews.",
    enabled: true,
    runs7d: 38,
    avgRunMs: 41_200,
    acceptance: 0.91,
    lessons: 27,
    openApprovals: 0,
  },
  {
    id: "agent_strategy",
    role: "Strategy",
    monogram: "St",
    description:
      "Market analysis, competitive intelligence, business modeling, OKR tracking, and strategic planning.",
    enabled: true,
    runs7d: 9,
    avgRunMs: 211_000,
    acceptance: 0.89,
    lessons: 18,
    openApprovals: 0,
  },
  {
    id: "agent_product",
    role: "Product",
    monogram: "P",
    description:
      "User research synthesis, feature prioritization, roadmap management, sprint planning, and stakeholder updates.",
    enabled: false,
    runs7d: 0,
    avgRunMs: 0,
    acceptance: 0,
    lessons: 0,
    openApprovals: 0,
  },
  {
    id: "agent_ops",
    role: "Operations",
    monogram: "Op",
    description:
      "Internal process optimization, vendor coordination, expense workflows, and cross-team handoff automation.",
    enabled: true,
    runs7d: 92,
    avgRunMs: 28_300,
    acceptance: 0.84,
    lessons: 71,
    openApprovals: 0,
  },
];

// Convenience lookup
export function getRoleAgent(roleSlug: string): RoleAgent | undefined {
  return roleAgents.find((r) => slugify(r.role) === roleSlug);
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Recent runs ───────────────────────────────────────────────────────────
// One run is broadly cross-functional (CEO orchestrator), others are
// role-specific. Each carries the originating role so per-role pages can
// filter cleanly.

export type RunStatus = "succeeded" | "failed" | "running" | "needs_approval";

export interface AgentRun {
  id: string;
  agentId: string;
  agentRole: string;
  status: RunStatus;
  startedAt: Date;
  durationMs: number;
  tokensUsed: number;
  toolCallsUsed: number;
  summary: string;
  triggeredBy: "schedule" | "messaging" | "manual" | "webhook" | "orchestrator";
  triggerDetail?: string;
  /** Set when this run is the result of a CEO-agent handoff. */
  handoffFromAgent?: string;
}

const now = Date.now();
function ago(minutes: number): Date {
  return new Date(now - minutes * 60_000);
}

export const recentRuns: AgentRun[] = [
  {
    id: "run_8c3e1a",
    agentId: "agent_ceo",
    agentRole: "CEO",
    status: "needs_approval",
    startedAt: ago(7),
    durationMs: 41_200,
    tokensUsed: 8_412,
    toolCallsUsed: 4,
    summary:
      "Synthesized 11 cross-agent escalations into a single brief; 4 items need partner sign-off.",
    triggeredBy: "schedule",
    triggerDetail: "07:00 daily orchestrator sweep",
  },
  {
    id: "run_2b6d09",
    agentId: "agent_sales",
    agentRole: "Sales",
    status: "succeeded",
    startedAt: ago(18),
    durationMs: 9_840,
    tokensUsed: 1_204,
    toolCallsUsed: 2,
    summary:
      "Researched and qualified 14 outbound prospects matching the Series-B fintech ICP.",
    triggeredBy: "schedule",
    triggerDetail: "every 4h",
  },
  {
    id: "run_9f1c45",
    agentId: "agent_marketing",
    agentRole: "Marketing",
    status: "succeeded",
    startedAt: ago(42),
    durationMs: 78_300,
    tokensUsed: 14_902,
    toolCallsUsed: 6,
    summary:
      "Drafted three blog posts on retention loops; surfaced two SEO gaps vs top competitors.",
    triggeredBy: "schedule",
    triggerDetail: "weekly content cadence",
  },
  {
    id: "run_5d7a2e",
    agentId: "agent_legal",
    agentRole: "Legal",
    status: "needs_approval",
    startedAt: ago(118),
    durationMs: 56_840,
    tokensUsed: 3_104,
    toolCallsUsed: 5,
    summary:
      "Reviewed AWS Enterprise Agreement renewal — flagged 3 redline items above the partner threshold.",
    triggeredBy: "messaging",
    triggerDetail: "from a partner via WhatsApp",
  },
  {
    id: "run_1a4f08",
    agentId: "agent_cs",
    agentRole: "Customer Success",
    status: "running",
    startedAt: ago(1),
    durationMs: 0,
    tokensUsed: 0,
    toolCallsUsed: 0,
    summary:
      "Triaging 23 inbound tickets from the past hour; routing churn-risk to a human.",
    triggeredBy: "schedule",
    triggerDetail: "every 5m",
  },
  {
    id: "run_6e2b91",
    agentId: "agent_sales",
    agentRole: "Sales",
    status: "succeeded",
    startedAt: ago(1_440),
    durationMs: 35_700,
    tokensUsed: 7_804,
    toolCallsUsed: 4,
    summary:
      "Sent personalized outbound to 47 contacts; 6 replies awaiting follow-up.",
    triggeredBy: "schedule",
    triggerDetail: "daily 09:00",
  },
  {
    id: "run_3d8f04",
    agentId: "agent_finance",
    agentRole: "Finance",
    status: "needs_approval",
    startedAt: ago(94),
    durationMs: 41_300,
    tokensUsed: 6_240,
    toolCallsUsed: 3,
    summary:
      "Q2 budget reforecast complete — runway extends to 18 months at current burn; partner sign-off required to lock.",
    triggeredBy: "schedule",
    triggerDetail: "month-end close",
  },
  {
    id: "run_4c19e7",
    agentId: "agent_hr",
    agentRole: "HR",
    status: "succeeded",
    startedAt: ago(220),
    durationMs: 24_700,
    tokensUsed: 2_840,
    toolCallsUsed: 2,
    summary:
      "Screened 38 applicants against the senior PM JD; advanced 7 to first-round interviews.",
    triggeredBy: "schedule",
    triggerDetail: "every 12h",
  },
  {
    id: "run_7a02bc",
    agentId: "agent_ops",
    agentRole: "Operations",
    status: "failed",
    startedAt: ago(310),
    durationMs: 12_400,
    tokensUsed: 1_902,
    toolCallsUsed: 1,
    summary:
      "Vendor renewal sweep paused — Slack connector returned 401; awaiting re-auth.",
    triggeredBy: "schedule",
    triggerDetail: "weekly",
  },
];

// ─── Approvals queue (CEO-agent surface) ───────────────────────────────────
// The CEO agent is the orchestrator: every approval card flows through it.
// `escalatedFromRole` shows which role agent originally raised the request.

export interface PendingApproval {
  cardId: string;
  /** Always agent_ceo in v1 — CEO is the human-facing approver. */
  agentId: string;
  /** The role agent that originally raised this. */
  escalatedFromRole: string;
  runId: string;
  to: string;
  toName: string;
  title: string;
  body: string;
  sentAt: Date;
  expiry: number;
  amountInr?: number;
}

export const pendingApprovals: PendingApproval[] = [
  {
    cardId: "card_4c7a23",
    agentId: "agent_ceo",
    escalatedFromRole: "Finance",
    runId: "run_3d8f04",
    to: "+91 ••••• •••••",
    toName: "Founder",
    title: "Approve Q2 reforecast — 18 months runway",
    body: "Burn $182K/mo, cash $3.28M, runway 18 months. Three plan-vs-actual deltas above ±15% need narrative.",
    sentAt: ago(6),
    expiry: Math.floor(now / 1000) + 86_400 * 6,
    amountInr: 32_800_000,
  },
  {
    cardId: "card_9b1f80",
    agentId: "agent_ceo",
    escalatedFromRole: "Legal",
    runId: "run_5d7a2e",
    to: "+91 ••••• •••••",
    toName: "Founder",
    title: "AWS EA renewal — 3 redlines",
    body: "Auto-renewal clause, indemnity cap at 12mo fees, data-residency rider. Vendor expects answer Friday.",
    sentAt: ago(33),
    expiry: Math.floor(now / 1000) + 86_400 * 6,
  },
  {
    cardId: "card_2f3a91",
    agentId: "agent_ceo",
    escalatedFromRole: "Marketing",
    runId: "run_9f1c45",
    to: "+91 ••••• •••••",
    toName: "Head of Marketing",
    title: "Approve next week's content slate",
    body: "Three blog posts drafted on retention loops + AI agents in MSME ops. Each ~1,400 words. Publish or revise?",
    sentAt: ago(94),
    expiry: Math.floor(now / 1000) + 86_400 * 5,
  },
  {
    cardId: "card_7e8b34",
    agentId: "agent_ceo",
    escalatedFromRole: "Legal",
    runId: "run_5d7a2e",
    to: "+91 ••••• •••••",
    toName: "Counsel",
    title: "Confirm signature authority on the new vendor MSA",
    body: "Sub-₹10L: ops lead. ₹10-50L: founder. Above: board. This MSA caps at ₹14L. Default to founder?",
    sentAt: ago(27),
    expiry: Math.floor(now / 1000) + 86_400 * 6,
  },
];

// ─── Notifications inbox (CEO-agent surface) ───────────────────────────────

export type Severity = "P1" | "P2" | "P3" | "INFO";

export interface AdminNotification {
  id: string;
  /** The role that surfaced this. CEO routes; the role still owns the issue. */
  fromRole: string;
  agentId: string;
  runId: string | null;
  severity: Severity;
  kind: "alert" | "escalation" | "handoff" | "system";
  subject: string;
  detail: string;
  roleHint?: string;
  acknowledgedAt: Date | null;
  createdAt: Date;
}

export const notifications: AdminNotification[] = [
  {
    id: "note_a91c4f",
    fromRole: "Operations",
    agentId: "agent_ops",
    runId: "run_7a02bc",
    severity: "P2",
    kind: "alert",
    subject: "Slack connector 401",
    detail:
      "Operations agent could not post to #vendor-renewals — bot token may have rotated. Workflow paused; re-auth needed.",
    acknowledgedAt: null,
    createdAt: ago(310),
  },
  {
    id: "note_b27ed0",
    fromRole: "Finance",
    agentId: "agent_finance",
    runId: "run_3d8f04",
    severity: "P3",
    kind: "escalation",
    subject: "Reforecast variance over 15%",
    detail:
      "Plan-vs-actual delta exceeded ±15% on three line items: AWS spend, contractor payouts, and event sponsorships.",
    roleHint: "founder",
    acknowledgedAt: null,
    createdAt: ago(94),
  },
  {
    id: "note_c83f12",
    fromRole: "system",
    agentId: "agent_ceo",
    runId: null,
    severity: "INFO",
    kind: "system",
    subject: "Vault re-embed scheduled",
    detail:
      "12 documents will be re-embedded tonight to migrate from text-embedding-3-small to embed-multilingual-v3.0. No action needed.",
    acknowledgedAt: ago(60 * 12),
    createdAt: ago(60 * 24),
  },
  {
    id: "note_d4ab88",
    fromRole: "Sales",
    agentId: "agent_sales",
    runId: "run_2b6d09",
    severity: "INFO",
    kind: "alert",
    subject: "ICP shift detected — Series B fintechs",
    detail:
      "Last 30 days, reply rate from Series-B fintechs is 3.4x the rest of the ICP. Sales agent suggests narrowing focus.",
    acknowledgedAt: null,
    createdAt: ago(18),
  },
  {
    id: "note_e51c0a",
    fromRole: "Customer Success",
    agentId: "agent_cs",
    runId: "run_1a4f08",
    severity: "P3",
    kind: "escalation",
    subject: "3 enterprise accounts flagged at-risk",
    detail:
      "NPS dropped from 56 to 31 over the last quarter at three named accounts. Saved-by-team playbook recommended.",
    roleHint: "head_of_cs",
    acknowledgedAt: null,
    createdAt: ago(42),
  },
  {
    id: "note_f72b41",
    fromRole: "system",
    agentId: "agent_ceo",
    runId: null,
    severity: "INFO",
    kind: "system",
    subject: "Cohere API key rotated",
    detail: "Embeddings service key rotated successfully. No interruption.",
    acknowledgedAt: ago(60 * 36),
    createdAt: ago(60 * 36),
  },
];

// ─── Vault documents (universal store) ─────────────────────────────────────
// Doc-type-agnostic. Any agent can ingest; any agent can query.

export interface VaultDoc {
  id: string;
  title: string;
  /** Free-form: brand_guidelines, contract, sop, customer_record, etc. */
  docType: string;
  ingestedBy: string;
  chunkCount: number;
  pages: number | null;
  createdAt: Date;
  /** Extracted entities — generic kinds (email, url, currency, doc_id, etc.) */
  entities: { kind: string; value: string }[];
  excerpt: string;
}

export const vaultDocs: VaultDoc[] = [
  {
    id: "vdoc_e8a4c1f7",
    title: "Brand voice guidelines v3",
    docType: "brand_guidelines",
    ingestedBy: "Marketing",
    chunkCount: 9,
    pages: 7,
    createdAt: ago(60 * 28),
    entities: [],
    excerpt:
      "Tone: warm, direct, never corporate. Avoid em dashes and AI vocabulary. First-person plural for the company; second-person singular for the reader. Always lead with what changed for the user.",
  },
  {
    id: "vdoc_7b29c4a3",
    title: "Sales playbook — outbound sequencing",
    docType: "sop",
    ingestedBy: "Sales",
    chunkCount: 14,
    pages: 11,
    createdAt: ago(60 * 96),
    entities: [],
    excerpt:
      "Step 1. Validate the ICP fit before drafting. Step 2. Reference one specific signal from the prospect's last 30 days (funding, hire, public commit). Step 3. Two follow-ups, then move to nurture…",
  },
  {
    id: "vdoc_3f0a18b2",
    title: "Vendor MSA — AWS Enterprise Agreement",
    docType: "contract",
    ingestedBy: "Legal",
    chunkCount: 22,
    pages: null,
    createdAt: ago(60 * 12),
    entities: [
      { kind: "URL", value: "aws.amazon.com/legal" },
      { kind: "Currency", value: "$420,000/year" },
    ],
    excerpt:
      "Three-year commitment, 12-month indemnity cap. Auto-renewal unless 90-day notice. Data residency rider attached as Annex C. Termination-for-convenience excluded after the 6-month onboarding window.",
  },
  {
    id: "vdoc_d1c9e2f0",
    title: "Customer NPS — Q1 raw responses",
    docType: "customer_data",
    ingestedBy: "Customer Success",
    chunkCount: 31,
    pages: null,
    createdAt: ago(60 * 240),
    entities: [],
    excerpt:
      "1,840 responses collected over 14 days. Mean NPS 47 (down from 56 last quarter). Drivers: shipping delays mentioned 312x, pricing changes 184x, support response time 142x.",
  },
  {
    id: "vdoc_a72f4c81",
    title: "Founder voice memo — Q2 priorities (transcribed)",
    docType: "user_input",
    ingestedBy: "user",
    chunkCount: 4,
    pages: null,
    createdAt: ago(60 * 720),
    entities: [],
    excerpt:
      "We're going to bias toward depth over breadth this quarter. One vertical, one ICP, one paid channel. The strategy agent should weight Series-B fintechs at 0.6 in the scoring model and consumer brands at 0.1…",
  },
];

// ─── Integrations (replaces Tally) ─────────────────────────────────────────

export type IntegrationStatus = "connected" | "needs_auth" | "stale" | "off";

export interface Integration {
  id: string;
  name: string;
  category: "messaging" | "crm" | "storage" | "comms" | "finance" | "custom";
  status: IntegrationStatus;
  /** Inbound payloads or outbound calls in last 24h. */
  activity24h: number;
  /** Used by which role agents. */
  usedBy: string[];
  lastEventAt: Date | null;
  description: string;
}

export const integrations: Integration[] = [
  {
    id: "int_whatsapp",
    name: "WhatsApp · Gupshup",
    category: "messaging",
    status: "connected",
    activity24h: 412,
    usedBy: ["CEO", "Sales", "Customer Success"],
    lastEventAt: ago(2),
    description:
      "Inbound + outbound business messaging. Approval cards, status pings, voice-note ingest.",
  },
  {
    id: "int_slack",
    name: "Slack",
    category: "comms",
    status: "needs_auth",
    activity24h: 0,
    usedBy: ["Operations", "CEO"],
    lastEventAt: ago(310),
    description: "Channel posts, DM digests, on-call paging.",
  },
  {
    id: "int_gdrive",
    name: "Google Drive",
    category: "storage",
    status: "connected",
    activity24h: 38,
    usedBy: ["Marketing", "Legal", "Operations"],
    lastEventAt: ago(14),
    description: "Document ingest into Vault; signed PDF exports.",
  },
  {
    id: "int_hubspot",
    name: "HubSpot",
    category: "crm",
    status: "connected",
    activity24h: 142,
    usedBy: ["Sales", "Marketing"],
    lastEventAt: ago(8),
    description: "Contact + deal sync, sequence enrolment, activity log.",
  },
  {
    id: "int_stripe",
    name: "Stripe",
    category: "finance",
    status: "connected",
    activity24h: 47,
    usedBy: ["Finance", "Customer Success"],
    lastEventAt: ago(22),
    description: "Subscription state, MRR/ARR roll-up, dunning watcher.",
  },
  {
    id: "int_tally",
    name: "Tally · on-prem agent",
    category: "finance",
    status: "off",
    activity24h: 0,
    usedBy: [],
    lastEventAt: null,
    description:
      "Optional connector for Indian SMBs running Tally locally. Off by default.",
  },
  {
    id: "int_webhook",
    name: "Custom webhook",
    category: "custom",
    status: "connected",
    activity24h: 12,
    usedBy: ["Operations"],
    lastEventAt: ago(86),
    description:
      "Generic POST endpoint for arbitrary upstream events. Per-webhook secret + signature verification.",
  },
];

// ─── Provisioning state ────────────────────────────────────────────────────

export type ProvisioningStep =
  | "created"
  | "schema_applied"
  | "kms_provisioned"
  | "langfuse_provisioned"
  | "vault_initialized"
  | "ready"
  | "failed";

export interface FirmProvisioning {
  id: string;
  name: string;
  state: ProvisioningStep;
  kmsKeyAlias: string | null;
  langfuseProjectId: string | null;
  spocPhone: string | null;
  provisionedAt: Date | null;
  lastError: string | null;
}

export const provisioningRoster: FirmProvisioning[] = [
  {
    id: "firm_alpha",
    name: "Customer #1 (live)",
    state: "ready",
    kmsKeyAlias: "alias/firm/firm_alpha",
    langfuseProjectId: "lf_firm_alpha",
    spocPhone: "+91 ••••• •••••",
    provisionedAt: ago(60 * 96),
    lastError: null,
  },
  {
    id: "firm_beta",
    name: "Customer #2 (mid-rollout)",
    state: "kms_provisioned",
    kmsKeyAlias: "alias/firm/firm_beta",
    langfuseProjectId: null,
    spocPhone: "+91 ••••• •••••",
    provisionedAt: null,
    lastError: null,
  },
  {
    id: "firm_gamma",
    name: "Customer #3 (failed)",
    state: "failed",
    kmsKeyAlias: null,
    langfuseProjectId: null,
    spocPhone: "+91 ••••• •••••",
    provisionedAt: null,
    lastError: "KMS quota exhausted (region ap-south-1) — re-run after quota raise.",
  },
  {
    id: "firm_delta",
    name: "Customer #4 (early)",
    state: "schema_applied",
    kmsKeyAlias: null,
    langfuseProjectId: null,
    spocPhone: "+91 ••••• •••••",
    provisionedAt: null,
    lastError: null,
  },
];
