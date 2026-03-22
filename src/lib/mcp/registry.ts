/**
 * MCP Tool Registry — Maps each agent role to the tools and skills it needs
 *
 * Based on research of best-in-class tools per domain (March 2026):
 * - Sales: Apollo.io, Instantly.ai, HubSpot, Calendly
 * - Marketing: SEMrush/Ahrefs, Buffer, Jasper, Google Analytics
 * - Accounting: QuickBooks, Xero, Stripe, Plaid
 * - Strategy: Crunchbase, SimilarWeb, Google Trends, web search
 * - Product: Linear, Jira, Notion, Productboard
 * - Engineering: GitHub, Vercel, Datadog, PagerDuty
 * - AI Expert: Anthropic, OpenAI, HuggingFace, W&B
 * - Admin: DocuSign, Google Workspace, Slack, Calendly
 * - HR: Greenhouse, BambooHR, LinkedIn, Workable
 * - Finance: Carta, Brex, Mercury, Stripe
 * - Customer Success: Intercom, Zendesk, Gainsight, ChurnZero
 * - Legal: Ironclad, DocuSign, Spellbook
 * - Data Analyst: Metabase, Looker, BigQuery, Mixpanel
 *
 * API Key Model:
 * - Platform provides keys for core tools (included in subscription)
 * - Users can bring their own keys (BYOK) for existing accounts
 * - Free tier: rate-limited platform keys
 * - Paid tiers: higher limits
 */

export interface ToolDefinition {
  name: string;
  description: string;
  category: "prospecting" | "outreach" | "crm" | "analytics" | "content" | "search" | "docs" | "code" | "finance" | "comms" | "legal" | "data";
  provider: string;
  requiresApiKey: boolean;
  platformProvided: boolean; // true = TA provides the key, false = user must bring their own
  envVar: string; // env var name for the API key
}

export interface AgentToolkit {
  role: string;
  tools: ToolDefinition[];
  skills: string[];
  systemCapabilities: string[]; // Built-in capabilities that don't need external APIs
}

export const agentToolkits: AgentToolkit[] = [
  {
    role: "Sales",
    tools: [
      {
        name: "Apollo.io",
        description: "Search 210M+ contacts, find prospects by title/industry/company, enrich contact data",
        category: "prospecting",
        provider: "apollo",
        requiresApiKey: true,
        platformProvided: true,
        envVar: "APOLLO_API_KEY",
      },
      {
        name: "Instantly.ai",
        description: "Create and manage email outreach campaigns, track deliverability, A/B test subject lines",
        category: "outreach",
        provider: "instantly",
        requiresApiKey: true,
        platformProvided: true,
        envVar: "INSTANTLY_API_KEY",
      },
      {
        name: "Web Search",
        description: "Research companies, find decision-makers, validate prospect info across the web",
        category: "search",
        provider: "builtin",
        requiresApiKey: false,
        platformProvided: true,
        envVar: "",
      },
    ],
    skills: [
      "ICP definition and refinement",
      "Lead scoring and qualification (BANT/MEDDIC)",
      "Cold email sequence writing (personalized multi-touch)",
      "LinkedIn outreach messaging",
      "Discovery call preparation and scripts",
      "Pipeline management and stage tracking",
      "Revenue forecasting and deal velocity analysis",
      "Objection handling playbooks",
      "Competitive battle cards",
      "Follow-up cadence optimization",
      "Proposal and SOW drafting",
      "Win/loss analysis",
    ],
    systemCapabilities: [
      "Draft personalized outbound email sequences for specific verticals",
      "Build ideal customer profiles from company and market data",
      "Create competitive battle cards with positioning and objection responses",
      "Generate weekly pipeline reports with deal-by-deal commentary",
      "Write discovery call scripts with qualifying questions",
      "Produce prospect research briefs before meetings",
      "Score and rank leads based on ICP fit and engagement signals",
      "Draft proposals and statements of work",
    ],
  },
  {
    role: "Marketing",
    tools: [
      {
        name: "Instantly.ai",
        description: "Email campaign automation, deliverability monitoring, warm-up sequences",
        category: "outreach",
        provider: "instantly",
        requiresApiKey: true,
        platformProvided: true,
        envVar: "INSTANTLY_API_KEY",
      },
      {
        name: "Web Search",
        description: "SEO research, competitor analysis, content gap identification, trend monitoring",
        category: "search",
        provider: "builtin",
        requiresApiKey: false,
        platformProvided: true,
        envVar: "",
      },
    ],
    skills: [
      "SEO keyword research and content gap analysis",
      "Long-form blog post writing (2000+ words SEO-optimized)",
      "Social media content calendar with actual copy",
      "Email newsletter and drip sequence creation",
      "Landing page copywriting and CTA optimization",
      "Brand voice and messaging framework development",
      "Competitor content analysis and differentiation",
      "Campaign performance reporting with ROI attribution",
      "PR and media outreach pitch writing",
      "Paid ad copy for Google/Meta/LinkedIn",
      "Community engagement strategy",
      "Webinar and event content planning",
    ],
    systemCapabilities: [
      "Write complete SEO blog posts ready to publish",
      "Create 30-day social media calendars with platform-specific copy",
      "Draft email nurture sequences (5-7 emails per sequence)",
      "Produce monthly marketing performance reports with insights",
      "Write press releases and media pitch emails",
      "Design landing page wireframes with copy",
      "Audit website content and produce SEO improvement roadmap",
      "Generate paid ad copy variants for A/B testing",
    ],
  },
  {
    role: "Accounting",
    tools: [
      {
        name: "Web Search",
        description: "Tax deadline research, compliance requirements, industry benchmarks",
        category: "search",
        provider: "builtin",
        requiresApiKey: false,
        platformProvided: true,
        envVar: "",
      },
    ],
    skills: [
      "Chart of accounts setup and maintenance",
      "Monthly financial close procedures and checklist",
      "Cash flow forecasting (13-week and annual)",
      "Expense categorization and policy enforcement",
      "Tax calendar management and deadline tracking",
      "Accounts receivable and collections workflow",
      "Accounts payable and vendor payment scheduling",
      "Bank reconciliation procedures",
      "Revenue recognition compliance",
      "Financial statement preparation (P&L, balance sheet, cash flow)",
      "Payroll tax compliance and filing",
      "Audit preparation and documentation",
    ],
    systemCapabilities: [
      "Generate monthly P&L with variance analysis vs budget",
      "Create 13-week cash flow forecasts",
      "Produce accounts receivable aging reports with collection recommendations",
      "Build expense policy documentation with approval workflows",
      "Draft tax filing checklists by jurisdiction",
      "Generate board-ready financial packages",
      "Reconcile bank statements and flag discrepancies",
      "Calculate burn rate and runway projections",
    ],
  },
  {
    role: "Strategy",
    tools: [
      {
        name: "Apollo.io",
        description: "Company research, market sizing by industry segment, competitor employee tracking",
        category: "prospecting",
        provider: "apollo",
        requiresApiKey: true,
        platformProvided: true,
        envVar: "APOLLO_API_KEY",
      },
      {
        name: "Web Search",
        description: "Market research, competitive intelligence, industry analysis, trend identification",
        category: "search",
        provider: "builtin",
        requiresApiKey: false,
        platformProvided: true,
        envVar: "",
      },
    ],
    skills: [
      "Competitive landscape mapping (Porter's Five Forces)",
      "Market sizing (TAM/SAM/SOM with methodology)",
      "SWOT analysis grounded in real data",
      "Business model canvas development",
      "OKR definition with measurable key results",
      "Go-to-market strategy and channel selection",
      "Strategic initiative prioritization (ICE/RICE frameworks)",
      "Industry trend analysis and opportunity identification",
      "Board presentation and investor deck creation",
      "Partnership and alliance strategy",
      "Pricing strategy and willingness-to-pay analysis",
      "Scenario planning (best/base/worst case)",
    ],
    systemCapabilities: [
      "Produce competitive teardown reports with feature-by-feature comparison",
      "Create TAM/SAM/SOM models with bottom-up and top-down estimates",
      "Draft quarterly OKRs with weekly check-in framework",
      "Build business model canvas with revenue and cost drivers",
      "Generate go-to-market plans with channel prioritization",
      "Map competitive positioning on multiple dimensions",
      "Conduct pricing analysis with competitor benchmarks",
      "Prepare board meeting decks with strategic recommendations",
    ],
  },
  {
    role: "Product",
    tools: [
      {
        name: "Web Search",
        description: "User research, competitor product analysis, industry best practices",
        category: "search",
        provider: "builtin",
        requiresApiKey: false,
        platformProvided: true,
        envVar: "",
      },
    ],
    skills: [
      "PRD writing with problem statements and success metrics",
      "User persona creation from research data",
      "Feature prioritization (RICE/ICE/MoSCoW scoring)",
      "Sprint planning and backlog grooming",
      "User story writing with acceptance criteria",
      "Product roadmap creation and stakeholder communication",
      "Competitive product teardown and feature gap analysis",
      "User feedback synthesis and pattern recognition",
      "A/B test design and hypothesis formulation",
      "Launch planning and GTM coordination",
      "Metrics definition (North Star + supporting metrics)",
      "Technical specification writing for engineering handoff",
    ],
    systemCapabilities: [
      "Write detailed PRDs with problem statement scope non-goals and success metrics",
      "Create data-driven user personas with jobs-to-be-done framework",
      "Prioritize feature backlogs using RICE scoring with justification",
      "Draft sprint planning documents with story point estimates",
      "Synthesize user feedback from multiple channels into actionable themes",
      "Build product roadmaps with quarterly milestones and dependencies",
      "Design A/B test plans with hypothesis metrics and sample size",
      "Write technical specs for engineering implementation",
    ],
  },
  {
    role: "Front-End Engineering",
    tools: [
      {
        name: "Web Search",
        description: "Framework docs, library research, best practices, performance benchmarks",
        category: "search",
        provider: "builtin",
        requiresApiKey: false,
        platformProvided: true,
        envVar: "",
      },
    ],
    skills: [
      "React/Next.js component architecture and state management",
      "CSS systems (Tailwind, CSS-in-JS, design tokens)",
      "Performance optimization (Core Web Vitals, bundle splitting, lazy loading)",
      "Accessibility auditing and remediation (WCAG 2.1 AA compliance)",
      "Responsive design and mobile-first development",
      "Design system creation with component library documentation",
      "Code review with focus on UI/UX quality and maintainability",
      "Testing strategy (unit, integration, E2E, visual regression)",
      "TypeScript strict mode patterns and type-safe API contracts",
      "Animation and micro-interaction implementation (Framer Motion, CSS transitions)",
      "Internationalization (i18n) and localization setup",
      "Error boundary design and graceful degradation patterns",
    ],
    systemCapabilities: [
      "Write production-ready React/Next.js components from design specs",
      "Audit code for accessibility issues and generate WCAG compliance reports",
      "Optimize bundle size with code splitting and tree shaking recommendations",
      "Review PRs for frontend best practices with line-by-line feedback",
      "Generate design system documentation with usage examples",
      "Write unit and integration tests for UI components with coverage targets",
      "Create TypeScript interfaces and type definitions for API contracts",
      "Produce performance audit reports with Core Web Vitals improvement plan",
    ],
  },
  {
    role: "Back-End Engineering",
    tools: [
      {
        name: "Web Search",
        description: "API documentation, security advisories, infrastructure best practices",
        category: "search",
        provider: "builtin",
        requiresApiKey: false,
        platformProvided: true,
        envVar: "",
      },
    ],
    skills: [
      "API design (REST, GraphQL) with versioning and documentation",
      "Database schema design and query optimization (PostgreSQL, Redis)",
      "Authentication and authorization patterns (OAuth2, JWT, RBAC)",
      "Infrastructure as code and CI/CD pipeline configuration",
      "Security auditing and vulnerability assessment (OWASP Top 10)",
      "System architecture and horizontal scalability planning",
      "Background job processing and queue management (Redis, SQS)",
      "Observability stack design (logging, metrics, tracing, alerting)",
      "Rate limiting, caching strategies, and API gateway configuration",
      "Database migration planning and zero-downtime deployment",
      "Microservices vs monolith trade-off analysis",
      "Incident response runbooks and post-mortem documentation",
    ],
    systemCapabilities: [
      "Design API schemas with OpenAPI/Swagger documentation and examples",
      "Write database migrations and optimize slow queries with EXPLAIN analysis",
      "Review code for security vulnerabilities with remediation guidance",
      "Design system architecture diagrams with component interaction flows",
      "Write infrastructure runbooks for common operational scenarios",
      "Generate comprehensive test suites for API endpoints (unit, integration, load)",
      "Draft incident response playbooks with escalation procedures",
      "Produce capacity planning estimates based on traffic patterns",
    ],
  },
  {
    role: "AI Expert",
    tools: [
      {
        name: "Web Search",
        description: "Latest model benchmarks, research papers, framework documentation",
        category: "search",
        provider: "builtin",
        requiresApiKey: false,
        platformProvided: true,
        envVar: "",
      },
    ],
    skills: [
      "Model selection and benchmarking for specific use cases",
      "Prompt engineering and systematic optimization (chain-of-thought, few-shot)",
      "RAG pipeline design (chunking strategies, embedding models, retrieval tuning)",
      "Fine-tuning strategy and training dataset preparation/curation",
      "Cost optimization across model tiers and token budgeting",
      "Evaluation framework design (automated evals, human-in-the-loop)",
      "AI safety guardrails and content filtering implementation",
      "Multi-model orchestration, routing, and fallback strategies",
      "Agent architecture design (tool use, memory, planning loops)",
      "Embedding model selection and vector database optimization",
      "Latency optimization (streaming, caching, model distillation)",
      "LLM output structured parsing and schema validation",
    ],
    systemCapabilities: [
      "Design and evaluate prompt templates with version-controlled iterations",
      "Architect RAG pipelines with concrete chunking and retrieval strategies",
      "Benchmark models on specific tasks with reproducible evaluation criteria",
      "Optimize AI costs by recommending model tiers and token reduction techniques",
      "Design automated evaluation suites for LLM output quality",
      "Create AI safety guidelines and content moderation policies",
      "Draft agent system prompts with tool definitions and behavioral constraints",
      "Produce model comparison reports with latency, cost, and quality trade-offs",
    ],
  },
  {
    role: "Admin",
    tools: [
      {
        name: "Web Search",
        description: "Vendor research, policy templates, compliance requirements",
        category: "search",
        provider: "builtin",
        requiresApiKey: false,
        platformProvided: true,
        envVar: "",
      },
    ],
    skills: [
      "Contract drafting and redlining for vendor agreements",
      "Vendor evaluation scorecards and RFP management",
      "Standard operating procedure (SOP) creation and versioning",
      "Meeting scheduling, agenda creation, and minutes documentation",
      "Office operations, procurement, and asset tracking",
      "Cross-functional coordination and project timeline management",
      "Executive support with briefing docs and travel logistics",
      "Policy creation, rollout communication, and compliance tracking",
      "Internal knowledge base organization and maintenance",
      "Event planning and logistics coordination",
      "Budget tracking for operational expenditures",
      "Onboarding logistics and new hire setup checklists",
    ],
    systemCapabilities: [
      "Draft professional contracts and service agreements with standard terms",
      "Create vendor evaluation scorecards with weighted criteria",
      "Write SOPs with step-by-step procedures and approval workflows",
      "Generate meeting agendas, minutes, and action item trackers",
      "Draft company policies (remote work, travel, expenses, equipment)",
      "Produce executive briefing documents with key decision points",
      "Build internal knowledge base articles and FAQ documents",
      "Create project timelines with milestones and dependency mapping",
    ],
  },
  {
    role: "HR",
    tools: [
      {
        name: "Web Search",
        description: "Salary benchmarks, labor law updates, hiring best practices",
        category: "search",
        provider: "builtin",
        requiresApiKey: false,
        platformProvided: true,
        envVar: "",
      },
    ],
    skills: [
      "Job description writing optimized for inclusive language and SEO",
      "Candidate screening rubrics and evaluation frameworks",
      "Structured interview design (behavioral, technical, culture-add)",
      "Onboarding program design with 30/60/90 day milestones",
      "Performance review cycle design and calibration frameworks",
      "Compensation benchmarking and leveling band creation",
      "Employee engagement survey design and analysis",
      "Employee handbook and HR policy writing",
      "PIP (Performance Improvement Plan) documentation",
      "Employer branding and careers page content",
      "Workforce planning and headcount modeling",
      "Offboarding procedures and exit interview analysis",
    ],
    systemCapabilities: [
      "Write compelling job descriptions optimized for target candidate pools",
      "Design structured interview loops with scorecard and rubric criteria",
      "Create 30/60/90 day onboarding plans tailored by role and level",
      "Draft performance review templates with competency-based frameworks",
      "Build compensation bands from market data with equity considerations",
      "Generate employee engagement survey questions and interpret results",
      "Produce headcount planning models with hiring timeline projections",
      "Draft PIP documentation with measurable improvement milestones",
    ],
  },
  {
    role: "Finance",
    tools: [
      {
        name: "Web Search",
        description: "Market data, funding rounds, valuation benchmarks, investor research",
        category: "search",
        provider: "builtin",
        requiresApiKey: false,
        platformProvided: true,
        envVar: "",
      },
    ],
    skills: [
      "Financial modeling (3-statement, DCF, LBO, comps)",
      "Fundraising strategy and pitch deck narrative support",
      "Investor update writing and board reporting cadence",
      "Unit economics analysis (CAC, LTV, payback period, margins)",
      "Budget planning with departmental allocation and variance tracking",
      "Scenario analysis and sensitivity modeling (best/base/worst)",
      "Cap table management, dilution modeling, and waterfall analysis",
      "Revenue forecasting with cohort-based growth modeling",
      "Working capital management and cash conversion cycle",
      "Vendor and contract spend analysis and optimization",
      "KPI dashboard design for financial health monitoring",
      "Due diligence preparation and data room organization",
    ],
    systemCapabilities: [
      "Build financial models with revenue projections and cost assumptions",
      "Draft monthly investor updates with narrative and key metrics",
      "Calculate unit economics with CAC/LTV/payback and margin analysis",
      "Create departmental budgets with quarterly milestones and variance tracking",
      "Run scenario analysis with sensitivity tables on key assumptions",
      "Produce board-ready financial presentations with commentary",
      "Model cap table scenarios for fundraising rounds with dilution impact",
      "Generate cash runway projections with multiple spending scenarios",
    ],
  },
  {
    role: "Customer Success",
    tools: [
      {
        name: "Web Search",
        description: "Industry benchmarks, churn analysis frameworks, best practices",
        category: "search",
        provider: "builtin",
        requiresApiKey: false,
        platformProvided: true,
        envVar: "",
      },
    ],
    skills: [
      "Customer health scoring methodology with leading indicators",
      "Churn prediction modeling and prevention playbooks",
      "NPS/CSAT/CES survey design, deployment, and analysis",
      "Customer onboarding program design with time-to-value tracking",
      "QBR (Quarterly Business Review) preparation and delivery",
      "Expansion and upsell opportunity identification from usage data",
      "Customer journey mapping with touchpoint optimization",
      "Support escalation triage and resolution SLA frameworks",
      "Customer segmentation and tiered engagement models",
      "Renewal forecasting and risk assessment",
      "Voice of customer program design and feedback loops",
      "Customer advocacy and reference program management",
    ],
    systemCapabilities: [
      "Design customer health score models with weighted leading indicators",
      "Create churn prevention playbooks with automated trigger actions",
      "Draft NPS/CSAT surveys and produce analysis reports with trends",
      "Build customer onboarding checklists with success milestone tracking",
      "Prepare QBR decks with usage analytics and strategic recommendations",
      "Identify expansion opportunities with revenue impact estimates",
      "Generate renewal risk reports with account-by-account commentary",
      "Draft customer success playbooks for each lifecycle stage",
    ],
  },
  {
    role: "Legal",
    tools: [
      {
        name: "Web Search",
        description: "Regulatory updates, case law research, compliance requirements by jurisdiction",
        category: "search",
        provider: "builtin",
        requiresApiKey: false,
        platformProvided: true,
        envVar: "",
      },
    ],
    skills: [
      "Contract review with risk flagging and redline recommendations",
      "Terms of service and privacy policy drafting and updates",
      "Compliance monitoring and audit preparation (GDPR, CCPA, SOC2, HIPAA)",
      "IP protection strategy (patents, trademarks, trade secrets, copyrights)",
      "Employment law guidance (offer letters, non-competes, equity agreements)",
      "Regulatory tracking and business impact assessment",
      "NDA and vendor agreement template creation and management",
      "Data processing agreement and sub-processor management",
      "Corporate governance documentation (board resolutions, bylaws)",
      "Litigation hold procedures and e-discovery preparation",
      "Open source license compliance and software audit",
      "International expansion legal requirements and entity structuring",
    ],
    systemCapabilities: [
      "Review contracts and flag high-risk clauses with plain-language explanations",
      "Draft and update privacy policies for multi-jurisdiction compliance",
      "Create NDA templates with customizable terms and mutual/one-way variants",
      "Produce compliance checklists by regulatory framework with evidence mapping",
      "Track regulatory changes and produce business impact assessments",
      "Draft IP assignment and invention disclosure agreements",
      "Generate corporate governance documents (board consents, resolutions)",
      "Audit open source dependencies for license compliance issues",
    ],
  },
  {
    role: "Data Analyst",
    tools: [
      {
        name: "Web Search",
        description: "SQL references, analytics methodologies, industry benchmarks",
        category: "search",
        provider: "builtin",
        requiresApiKey: false,
        platformProvided: true,
        envVar: "",
      },
    ],
    skills: [
      "SQL query writing, optimization, and window function patterns",
      "Dashboard design with KPI hierarchy and drill-down structure",
      "Cohort analysis and retention curve interpretation",
      "A/B test design with statistical significance and power analysis",
      "Funnel analysis with stage-by-stage conversion optimization",
      "Data modeling (star schema, snowflake) and warehouse design",
      "ETL/ELT pipeline design and data quality monitoring",
      "Executive reporting and data storytelling with visualization",
      "Segmentation analysis (RFM, behavioral, demographic)",
      "Anomaly detection and alerting threshold configuration",
      "Metric definition frameworks (leading vs lagging indicators)",
      "Attribution modeling (first-touch, last-touch, multi-touch)",
    ],
    systemCapabilities: [
      "Write optimized SQL queries for complex analytics questions",
      "Design dashboard layouts with KPI hierarchy and alert thresholds",
      "Run cohort analyses and produce retention reports with insights",
      "Design A/B tests with sample size calculations and duration estimates",
      "Build funnel analysis with drop-off identification and improvement hypotheses",
      "Create data dictionaries with metric definitions and ownership",
      "Produce weekly/monthly executive analytics reports with trend commentary",
      "Generate segmentation analysis with actionable cluster descriptions",
    ],
  },
  {
    role: "CEO",
    tools: [
      {
        name: "Company Dashboard",
        description: "Query all agents for status, get company-wide metrics, and aggregate activity",
        category: "analytics" as const,
        provider: "builtin",
        requiresApiKey: false,
        platformProvided: true,
        envVar: "",
      },
      {
        name: "Web Search",
        description: "Research market trends, competitors, industry news for strategic decisions",
        category: "search" as const,
        provider: "builtin",
        requiresApiKey: false,
        platformProvided: true,
        envVar: "",
      },
    ],
    skills: [
      "Executive reporting and board presentations",
      "Strategic planning and OKR management",
      "Cross-agent orchestration and priority setting",
      "Investor relations and fundraising strategy",
      "Risk assessment and crisis management",
      "Resource allocation and team performance evaluation",
      "Revenue forecasting and growth modeling",
      "M&A evaluation and partnership strategy",
      "Company culture and values articulation",
      "Stakeholder communication and narrative crafting",
      "Market positioning and competitive strategy",
      "Daily executive debriefs and weekly summaries",
    ],
    systemCapabilities: [
      "Query all agents simultaneously for company-wide status reports",
      "Generate board-ready executive summaries with metrics and recommendations",
      "Produce weekly investor updates with KPIs and milestones",
      "Create strategic OKRs with measurable key results across departments",
      "Identify cross-agent bottlenecks and recommend resource reallocation",
      "Synthesize daily agent activity into actionable executive briefs",
      "Produce risk assessment reports with mitigation strategies",
      "Generate quarterly business reviews with department-by-department analysis",
      "Draft fundraising narratives and pitch deck content",
      "Orchestrate multi-agent initiatives (e.g., coordinate Sales + Marketing for a launch)",
    ],
  },
];

/**
 * Get the complete toolkit for an agent role
 */
export function getToolkit(role: string): AgentToolkit | undefined {
  return agentToolkits.find((t) => t.role === role);
}

/**
 * Get all available tools across all roles (deduplicated)
 */
export function getAllTools(): ToolDefinition[] {
  const seen = new Set<string>();
  const tools: ToolDefinition[] = [];
  for (const toolkit of agentToolkits) {
    for (const tool of toolkit.tools) {
      if (!seen.has(tool.name)) {
        seen.add(tool.name);
        tools.push(tool);
      }
    }
  }
  return tools;
}

/**
 * Check which tools are currently configured (API keys set)
 */
export function getConfiguredTools(): string[] {
  const configured: string[] = [];
  for (const tool of getAllTools()) {
    if (!tool.requiresApiKey || !tool.envVar) {
      configured.push(tool.name);
    } else if (process.env[tool.envVar]) {
      configured.push(tool.name);
    }
  }
  return configured;
}
