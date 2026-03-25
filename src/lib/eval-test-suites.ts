/**
 * Built-in test suites for agent evaluation.
 * Each role has 2-3 realistic test prompts that exercise core capabilities.
 */

export interface TestPrompt {
  role: string;
  name: string;
  prompt: string;
  expectedQualities: string[];
}

export const defaultTestSuites: TestPrompt[] = [
  // ─── Sales ─────────────────────────────────────────────
  {
    role: "Sales",
    name: "Cold outreach email",
    prompt: "Write a cold outreach email to a CTO at a Series B fintech company",
    expectedQualities: ["personalization", "value proposition", "clear CTA", "professional tone"],
  },
  {
    role: "Sales",
    name: "Quiet prospect follow-up",
    prompt: "Our prospect went quiet after the demo. Draft a follow-up strategy",
    expectedQualities: ["multi-touch approach", "value-add content", "urgency without pressure"],
  },
  {
    role: "Sales",
    name: "Lead scoring",
    prompt: "Score this lead: Company with 50 employees, $5M ARR, in our ICP",
    expectedQualities: ["scoring framework", "specific criteria", "actionable recommendation"],
  },

  // ─── Marketing ─────────────────────────────────────────
  {
    role: "Marketing",
    name: "Content calendar",
    prompt: "Create a content calendar for next week focused on thought leadership",
    expectedQualities: ["specific topics", "channel distribution", "posting schedule"],
  },
  {
    role: "Marketing",
    name: "SEO audit",
    prompt: "Audit our SEO — what keywords should we target?",
    expectedQualities: ["keyword research methodology", "competitive analysis", "priority ranking"],
  },
  {
    role: "Marketing",
    name: "LinkedIn post",
    prompt: "Write a LinkedIn post announcing our new product feature",
    expectedQualities: ["hook", "value framing", "engagement CTA", "appropriate length"],
  },

  // ─── Accounting ────────────────────────────────────────
  {
    role: "Accounting",
    name: "Monthly financial report",
    prompt: "Generate a monthly financial report template for a SaaS company",
    expectedQualities: ["revenue metrics", "expense categories", "key ratios", "visual structure"],
  },
  {
    role: "Accounting",
    name: "Cash flow analysis",
    prompt: "How should we improve our cash flow management?",
    expectedQualities: ["specific strategies", "metric recommendations", "timeline"],
  },

  // ─── Strategy ──────────────────────────────────────────
  {
    role: "Strategy",
    name: "SWOT analysis",
    prompt: "Do a SWOT analysis for our company",
    expectedQualities: ["all four quadrants", "specific examples", "actionable insights"],
  },
  {
    role: "Strategy",
    name: "Competitive analysis",
    prompt: "Identify our top 3 competitors and our differentiation",
    expectedQualities: ["framework", "specific differentiators", "strategic recommendations"],
  },
  {
    role: "Strategy",
    name: "Market opportunities",
    prompt: "What market opportunities should we pursue this quarter?",
    expectedQualities: ["market sizing", "prioritization criteria", "execution roadmap"],
  },

  // ─── Product ───────────────────────────────────────────
  {
    role: "Product",
    name: "PRD for onboarding",
    prompt: "Write a PRD for a user onboarding flow",
    expectedQualities: ["user stories", "requirements", "success metrics", "scope"],
  },
  {
    role: "Product",
    name: "RICE scoring",
    prompt: "Prioritize these 5 features using RICE scoring: analytics dashboard, API, mobile app, integrations, AI chat",
    expectedQualities: ["RICE framework", "scoring rationale", "clear ranking"],
  },
  {
    role: "Product",
    name: "User personas",
    prompt: "Create user personas for our product",
    expectedQualities: ["demographics", "pain points", "goals", "behavior patterns"],
  },

  // ─── Front-End Engineering ─────────────────────────────
  {
    role: "Front-End Engineering",
    name: "Component architecture",
    prompt: "Design a component architecture for a dashboard with real-time data",
    expectedQualities: ["component hierarchy", "state management", "performance considerations"],
  },
  {
    role: "Front-End Engineering",
    name: "Performance audit",
    prompt: "What are the top frontend performance optimizations we should implement?",
    expectedQualities: ["specific techniques", "measurement approach", "priority ranking"],
  },

  // ─── Back-End Engineering ──────────────────────────────
  {
    role: "Back-End Engineering",
    name: "API design",
    prompt: "Design a REST API for a task management system with assignments and deadlines",
    expectedQualities: ["endpoint design", "authentication", "error handling", "data models"],
  },
  {
    role: "Back-End Engineering",
    name: "Database optimization",
    prompt: "Our database queries are slow. What optimization strategies should we implement?",
    expectedQualities: ["indexing strategy", "query analysis", "caching", "monitoring"],
  },

  // ─── AI Expert ─────────────────────────────────────────
  {
    role: "AI Expert",
    name: "Model selection",
    prompt: "We need to choose an AI model for customer support automation. What should we use?",
    expectedQualities: ["model comparison", "cost analysis", "latency considerations", "recommendation"],
  },
  {
    role: "AI Expert",
    name: "RAG pipeline design",
    prompt: "Design a RAG pipeline for our internal documentation",
    expectedQualities: ["architecture diagram", "embedding strategy", "retrieval approach", "evaluation"],
  },

  // ─── Admin ─────────────────────────────────────────────
  {
    role: "Admin",
    name: "Vendor contract",
    prompt: "Draft key terms for a new SaaS vendor contract",
    expectedQualities: ["key clauses", "negotiation points", "risk mitigation"],
  },
  {
    role: "Admin",
    name: "Meeting organization",
    prompt: "Organize our team meeting schedule for a 20-person distributed team",
    expectedQualities: ["timezone considerations", "cadence", "agenda structure"],
  },

  // ─── HR ────────────────────────────────────────────────
  {
    role: "HR",
    name: "Onboarding checklist",
    prompt: "Design an onboarding checklist for a new engineering hire",
    expectedQualities: ["timeline", "stakeholders", "milestones", "culture elements"],
  },
  {
    role: "HR",
    name: "Performance review template",
    prompt: "Create a quarterly performance review template",
    expectedQualities: ["self-assessment", "manager assessment", "growth areas", "goal setting"],
  },

  // ─── Finance ───────────────────────────────────────────
  {
    role: "Finance",
    name: "Financial model",
    prompt: "Build a basic financial model for a Series A fundraise",
    expectedQualities: ["revenue projections", "cost structure", "key assumptions", "runway"],
  },
  {
    role: "Finance",
    name: "Unit economics",
    prompt: "Calculate and explain our key unit economics metrics",
    expectedQualities: ["CAC", "LTV", "payback period", "margin analysis"],
  },

  // ─── Customer Success ──────────────────────────────────
  {
    role: "Customer Success",
    name: "Churn prevention",
    prompt: "Identify at-risk customers and create a churn prevention playbook",
    expectedQualities: ["risk signals", "intervention strategies", "timeline", "metrics"],
  },
  {
    role: "Customer Success",
    name: "NPS analysis",
    prompt: "Analyze our NPS trends and recommend improvements",
    expectedQualities: ["trend analysis", "driver identification", "action plan"],
  },

  // ─── Legal ─────────────────────────────────────────────
  {
    role: "Legal",
    name: "Contract review checklist",
    prompt: "Create a contract review checklist for enterprise sales agreements",
    expectedQualities: ["key clauses", "risk areas", "compliance checks", "negotiation points"],
  },
  {
    role: "Legal",
    name: "Privacy compliance",
    prompt: "What privacy compliance requirements should we address for GDPR?",
    expectedQualities: ["specific requirements", "implementation steps", "documentation needs"],
  },

  // ─── Data Analyst ──────────────────────────────────────
  {
    role: "Data Analyst",
    name: "KPI dashboard",
    prompt: "Design a KPI dashboard for our SaaS product",
    expectedQualities: ["metric selection", "visualization types", "data sources", "refresh cadence"],
  },
  {
    role: "Data Analyst",
    name: "Cohort analysis",
    prompt: "Run a cohort analysis on our user retention",
    expectedQualities: ["cohort definition", "methodology", "visualization", "insights"],
  },

  // ─── CEO ───────────────────────────────────────────────
  {
    role: "CEO",
    name: "Board update",
    prompt: "Prepare a board update for this quarter",
    expectedQualities: ["key metrics", "strategic progress", "challenges", "asks"],
  },
  {
    role: "CEO",
    name: "Weekly priorities",
    prompt: "What should we focus on this week across all departments?",
    expectedQualities: ["cross-functional view", "priority ranking", "resource allocation", "blockers"],
  },
];
