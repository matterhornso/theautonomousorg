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
      "Prospect research and qualification (BANT)",
      "Cold email sequence writing (personalized, not templates)",
      "Pipeline management and forecasting",
      "Competitive positioning and objection handling",
      "Meeting scheduling and follow-up cadences",
      "CRM data hygiene and pipeline reporting",
      "Multi-channel outreach (email + LinkedIn + phone scripts)",
    ],
    systemCapabilities: [
      "Draft personalized outreach emails based on prospect research",
      "Build ideal customer profiles from company analysis",
      "Score and qualify leads based on defined criteria",
      "Generate weekly pipeline reports and forecasts",
      "Write cold call scripts with objection responses",
      "Create sales battle cards vs competitors",
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
      "Blog post writing (long-form, SEO-optimized)",
      "Social media content calendar creation",
      "Email newsletter copywriting",
      "Landing page copy and A/B test suggestions",
      "Brand voice development and tone guidelines",
      "Campaign performance analysis and ROI reporting",
      "Competitive content benchmarking",
    ],
    systemCapabilities: [
      "Write complete blog posts with SEO optimization",
      "Create weekly social media content calendars with actual copy",
      "Draft email newsletters and drip sequences",
      "Audit website content for SEO improvements",
      "Analyze competitor marketing strategies from public data",
      "Generate marketing performance reports with actionable insights",
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
      "Chart of accounts setup and management",
      "Monthly financial close procedures",
      "Cash flow forecasting and runway calculation",
      "Expense categorization and policy creation",
      "Tax calendar management and deadline tracking",
      "Invoice creation and accounts receivable tracking",
      "Financial report generation (P&L, balance sheet, cash flow)",
      "Budget vs actual variance analysis",
    ],
    systemCapabilities: [
      "Generate monthly P&L statements and financial summaries",
      "Create cash flow forecasts based on historical patterns",
      "Draft expense policies and categorization guidelines",
      "Build tax compliance checklists by jurisdiction",
      "Produce board-ready financial reports",
      "Identify anomalies and flag unusual expenses",
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
      "Competitive landscape mapping (Porter's Five Forces, SWOT)",
      "Market sizing (TAM/SAM/SOM analysis)",
      "Business model canvas development",
      "OKR definition and quarterly planning",
      "Strategic initiative prioritization frameworks",
      "Industry trend analysis and opportunity identification",
      "Board deck and investor presentation creation",
      "Go-to-market strategy development",
    ],
    systemCapabilities: [
      "Produce competitive teardown reports with positioning analysis",
      "Create SWOT analyses grounded in real company data",
      "Draft quarterly OKRs with measurable key results",
      "Build TAM/SAM/SOM models with market sizing estimates",
      "Generate board meeting agendas and strategic updates",
      "Map competitive positioning on key dimensions",
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
      "PRD (Product Requirements Document) writing",
      "User persona creation and refinement",
      "Feature prioritization (RICE, ICE, MoSCoW)",
      "Sprint planning and backlog grooming",
      "User story writing with acceptance criteria",
      "Roadmap creation and stakeholder communication",
      "Competitive product analysis and feature gaps",
      "User feedback synthesis and pattern recognition",
    ],
    systemCapabilities: [
      "Write detailed PRDs with problem statements, success metrics, and scope",
      "Create data-driven user personas from company context",
      "Prioritize feature backlogs using RICE scoring",
      "Draft sprint planning agendas with velocity estimates",
      "Synthesize user feedback into actionable product insights",
      "Build product roadmaps with quarterly milestones",
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
      "React/Next.js component architecture",
      "CSS systems (Tailwind, CSS-in-JS, design tokens)",
      "Performance optimization (Core Web Vitals, bundle analysis)",
      "Accessibility auditing (WCAG 2.1 AA compliance)",
      "Responsive design and mobile-first development",
      "Design system creation and maintenance",
      "Code review with focus on UI/UX quality",
      "Testing strategy (unit, integration, visual regression)",
    ],
    systemCapabilities: [
      "Write React/Next.js components from specifications",
      "Audit code for accessibility issues with WCAG compliance",
      "Optimize bundle size and loading performance",
      "Review PRs for frontend best practices",
      "Generate design system documentation",
      "Write unit and integration tests for UI components",
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
      "API design (REST, GraphQL) and documentation",
      "Database schema design and query optimization",
      "Authentication and authorization patterns",
      "Infrastructure as code and deployment pipelines",
      "Security auditing and vulnerability assessment",
      "System architecture and scalability planning",
      "Background job processing and queue management",
      "Observability (logging, metrics, tracing, alerting)",
    ],
    systemCapabilities: [
      "Design API schemas with OpenAPI/Swagger documentation",
      "Write database migrations and optimize queries",
      "Review code for security vulnerabilities (OWASP Top 10)",
      "Design system architecture diagrams",
      "Write infrastructure documentation and runbooks",
      "Generate test suites for API endpoints",
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
      "Prompt engineering and optimization",
      "RAG pipeline design (chunking, embeddings, retrieval)",
      "Fine-tuning strategy and dataset preparation",
      "Cost optimization across model tiers",
      "Evaluation framework design and metric selection",
      "AI safety and guardrail implementation",
      "Multi-model orchestration and routing",
    ],
    systemCapabilities: [
      "Design and evaluate prompt templates for production use",
      "Architect RAG pipelines with concrete chunking and retrieval strategies",
      "Benchmark models on specific tasks with evaluation criteria",
      "Optimize AI costs by recommending appropriate model tiers",
      "Design evaluation suites for LLM outputs",
      "Create AI safety guidelines and content policies",
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
      "Contract drafting and negotiation",
      "Vendor evaluation and management",
      "Document management and SOPs",
      "Meeting scheduling and agenda creation",
      "Office operations and procurement",
      "Cross-functional coordination",
      "Executive support and report preparation",
      "Policy creation and compliance tracking",
    ],
    systemCapabilities: [
      "Draft professional contracts and service agreements",
      "Create vendor evaluation scorecards",
      "Write SOPs and operational procedures",
      "Generate meeting agendas and action item summaries",
      "Draft company policies (remote work, travel, expenses)",
      "Produce executive briefing documents",
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
      "Job description writing and optimization",
      "Candidate screening and evaluation frameworks",
      "Structured interview design (behavioral, technical)",
      "Onboarding program design and checklist creation",
      "Performance review template creation",
      "Compensation benchmarking and band analysis",
      "Culture survey design and analysis",
      "Employee handbook and policy writing",
    ],
    systemCapabilities: [
      "Write compelling job descriptions optimized for target candidates",
      "Design structured interview loops with scorecard criteria",
      "Create 30/60/90 day onboarding plans by role",
      "Draft performance review templates with competency frameworks",
      "Build compensation bands from market data",
      "Generate culture survey questions and analyze results",
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
      "Financial modeling (3-statement, DCF, LBO)",
      "Fundraising strategy and pitch deck support",
      "Investor update and board reporting",
      "Unit economics analysis (CAC, LTV, payback)",
      "Budget planning and departmental allocation",
      "Scenario analysis and sensitivity modeling",
      "Cap table management and dilution analysis",
      "Revenue forecasting and growth modeling",
    ],
    systemCapabilities: [
      "Build financial models with revenue projections and cost assumptions",
      "Draft monthly investor updates with key metrics",
      "Calculate unit economics with CAC/LTV/payback analysis",
      "Create departmental budgets with quarterly milestones",
      "Run scenario analysis (best/base/worst case)",
      "Produce board-ready financial presentations",
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
      "Customer health scoring methodology",
      "Churn prediction and prevention playbooks",
      "NPS/CSAT survey design and analysis",
      "Customer onboarding program design",
      "QBR (Quarterly Business Review) preparation",
      "Expansion/upsell opportunity identification",
      "Customer journey mapping and touchpoint optimization",
      "Support escalation triage and resolution frameworks",
    ],
    systemCapabilities: [
      "Design customer health score models with weighted metrics",
      "Create churn prevention playbooks with trigger actions",
      "Draft NPS survey questions and analyze response patterns",
      "Build customer onboarding checklists and success milestones",
      "Prepare QBR decks with usage data and recommendations",
      "Identify expansion opportunities from engagement patterns",
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
      "Contract review and risk flagging",
      "Terms of service and privacy policy drafting",
      "Compliance monitoring (GDPR, CCPA, SOC2)",
      "IP protection strategy (patents, trademarks, trade secrets)",
      "Employment law guidance (at-will, non-compete, equity)",
      "Regulatory tracking and impact assessment",
      "NDA and vendor agreement templates",
      "Data processing agreement creation",
    ],
    systemCapabilities: [
      "Review contracts and flag high-risk clauses with explanations",
      "Draft and update privacy policies for GDPR/CCPA compliance",
      "Create NDA templates with customizable terms",
      "Produce compliance checklists by regulatory framework",
      "Track regulatory changes and assess business impact",
      "Draft IP assignment and invention disclosure agreements",
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
      "SQL query writing and optimization",
      "Dashboard design and KPI definition",
      "Cohort analysis and retention curves",
      "A/B test design and statistical significance",
      "Funnel analysis and conversion optimization",
      "Data modeling and schema design",
      "ETL pipeline design and data quality monitoring",
      "Executive reporting and data storytelling",
    ],
    systemCapabilities: [
      "Write SQL queries for common analytics questions",
      "Design dashboard layouts with KPI hierarchy",
      "Run cohort analyses and interpret retention patterns",
      "Design A/B tests with sample size calculations",
      "Build funnel analysis with drop-off identification",
      "Create data dictionaries and metric definitions",
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
