export const agentRoles = [
  {
    title: "Sales",
    icon: "S",
    description:
      "Prospect research, outbound sequences, CRM updates, pipeline forecasting, and deal qualification — running 24/7.",
    skills: [
      "Lead scoring",
      "Email sequences",
      "CRM management",
      "Pipeline analytics",
    ],
    connectors: ["Apollo.io", "HubSpot", "Calendly", "Gmail"],
    starters: ["Show me my prospect pipeline", "Draft outbound emails for enterprise", "Who should I reach out to first?"],
  },
  {
    title: "Marketing",
    icon: "M",
    description:
      "Content strategy, campaign execution, SEO optimization, social media management, and performance analytics.",
    skills: [
      "Content creation",
      "SEO optimization",
      "Campaign management",
      "Analytics",
    ],
    connectors: ["Instantly.ai", "Buffer", "SEMrush", "Canva"],
    starters: ["What should I post this week?", "Audit our SEO performance", "Draft a blog post outline"],
  },
  {
    title: "Accounting",
    icon: "A",
    description:
      "Invoice processing, expense tracking, financial reporting, tax preparation, and cash flow forecasting.",
    skills: ["Bookkeeping", "Financial reports", "Tax compliance", "Cash flow"],
    connectors: ["QuickBooks", "Xero", "Stripe", "Plaid"],
    starters: ["Generate a monthly financial report", "Track our cash flow this quarter", "What tax deadlines are coming up?"],
  },
  {
    title: "Strategy",
    icon: "St",
    description:
      "Market analysis, competitive intelligence, business modeling, OKR tracking, and strategic planning.",
    skills: [
      "Market research",
      "Competitive analysis",
      "Business modeling",
      "OKR tracking",
    ],
    connectors: ["Crunchbase", "SimilarWeb", "Google Trends"],
    starters: ["Analyze our competitive landscape", "Help me build a SWOT analysis", "What market opportunities should we pursue?"],
  },
  {
    title: "Product",
    icon: "P",
    description:
      "User research synthesis, feature prioritization, roadmap management, sprint planning, and stakeholder updates.",
    skills: [
      "User research",
      "Roadmap planning",
      "Sprint management",
      "Specs & PRDs",
    ],
    connectors: ["Linear", "Jira", "Notion", "Figma"],
    starters: ["Draft a PRD for our next feature", "Prioritize our feature backlog", "Synthesize recent user feedback"],
  },
  {
    title: "Front-End Engineering",
    icon: "FE",
    description:
      "UI component development, responsive design, performance optimization, accessibility, and design system maintenance.",
    skills: [
      "React / Next.js",
      "UI components",
      "Performance",
      "Accessibility",
    ],
    connectors: ["GitHub", "Vercel", "Chromatic"],
    starters: ["Review our frontend performance", "Audit accessibility issues", "Suggest component architecture improvements"],
  },
  {
    title: "Back-End Engineering",
    icon: "BE",
    description:
      "API development, database design, infrastructure management, security hardening, and system architecture.",
    skills: ["API design", "Databases", "Infrastructure", "Security"],
    connectors: ["GitHub", "AWS", "Datadog", "PagerDuty"],
    starters: ["Review our API design", "Identify security vulnerabilities", "Optimize our database queries"],
  },
  {
    title: "AI Expert",
    icon: "AI",
    description:
      "Model selection, prompt engineering, RAG pipeline setup, fine-tuning workflows, and AI strategy consulting.",
    skills: [
      "Model selection",
      "Prompt engineering",
      "RAG pipelines",
      "Fine-tuning",
    ],
    connectors: ["Anthropic API", "OpenAI API", "HuggingFace"],
    starters: ["Which AI model should we use for this task?", "Help me design a RAG pipeline", "Review our prompt engineering"],
  },
  {
    title: "Admin",
    icon: "Ad",
    description:
      "Contract drafting, document management, vendor coordination, office operations, and executive support.",
    skills: ["Contract drafting", "Document management", "Scheduling", "Vendor management"],
    connectors: ["DocuSign", "Google Workspace", "Slack", "Calendly"],
    starters: ["Draft a contract for a new vendor", "Organize our document structure", "Schedule team meetings for next week"],
  },
  {
    title: "HR",
    icon: "HR",
    description:
      "Recruiting pipeline management, candidate screening, onboarding workflows, culture surveys, and performance reviews.",
    skills: ["Recruiting", "Onboarding", "Performance reviews", "Culture"],
    connectors: ["Greenhouse", "Lever", "BambooHR", "LinkedIn"],
    starters: ["Screen candidates for our open roles", "Design an onboarding checklist", "Prepare quarterly performance review templates"],
  },
  {
    title: "Finance",
    icon: "Fi",
    description:
      "Financial modeling, fundraising prep, investor reporting, budget planning, and unit economics analysis.",
    skills: ["Financial modeling", "Investor relations", "Budgeting", "Unit economics"],
    connectors: ["Carta", "Brex", "Mercury", "Stripe"],
    starters: ["Build a financial model for fundraising", "Calculate our unit economics", "Draft an investor update"],
  },
  {
    title: "Customer Success",
    icon: "CS",
    description:
      "Customer onboarding, health scoring, churn prevention, NPS surveys, and support ticket escalation.",
    skills: ["Onboarding", "Health scoring", "Churn prevention", "NPS"],
    connectors: ["Intercom", "Zendesk", "Gainsight", "Slack"],
    starters: ["Identify at-risk customers", "Design an onboarding flow", "Analyze our NPS trends"],
  },
  {
    title: "Legal",
    icon: "Le",
    description:
      "Contract review, compliance monitoring, IP protection, terms of service drafting, and regulatory tracking.",
    skills: ["Contract review", "Compliance", "IP protection", "Regulatory"],
    connectors: ["DocuSign", "Ironclad", "LegalZoom", "Notion"],
    starters: ["Review this contract for risks", "Check our compliance requirements", "Draft terms of service updates"],
  },
  {
    title: "Data Analyst",
    icon: "DA",
    description:
      "Dashboard creation, SQL queries, cohort analysis, A/B test evaluation, and business intelligence reporting.",
    skills: ["SQL & analytics", "Dashboards", "Cohort analysis", "A/B testing"],
    connectors: ["Metabase", "Looker", "BigQuery", "Mixpanel"],
    starters: ["Build a dashboard for key metrics", "Run a cohort analysis", "Evaluate our latest A/B test"],
  },
  {
    title: "CEO",
    icon: "CEO",
    description:
      "Executive oversight, strategic direction, cross-agent orchestration, board reporting, and company-wide decision making.",
    skills: ["Executive reporting", "Board management", "Strategic planning", "OKR tracking"],
    connectors: ["All agents", "Activity feed", "Company metrics"],
    starters: ["What's our company status?", "Give me a debrief on yesterday", "What should we focus on this week?", "Prepare a board update"],
  },
];
