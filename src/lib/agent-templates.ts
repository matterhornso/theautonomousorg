/**
 * Pre-built agent configurations for common industries.
 * Each pack includes recommended agents with specific first tasks
 * and a 30-day plan.
 */

export interface AgentTemplate {
  role: string;
  firstTasks: string[];
  priority: "high" | "medium";
}

export interface IndustryPack {
  id: string;
  name: string;
  description: string;
  icon: string;
  agents: AgentTemplate[];
  thirtyDayPlan: {
    week1: string[];
    week2: string[];
    week3: string[];
    week4: string[];
  };
}

export const industryPacks: IndustryPack[] = [
  {
    id: "saas-startup",
    name: "SaaS Startup Pack",
    description: "For early-stage SaaS companies focused on product-market fit and growth",
    icon: "rocket",
    agents: [
      {
        role: "Sales",
        firstTasks: [
          "Build an ICP (Ideal Customer Profile) based on our product",
          "Draft 3 outbound email sequences for different buyer personas",
          "Create a lead scoring framework",
        ],
        priority: "high",
      },
      {
        role: "Marketing",
        firstTasks: [
          "Create a content calendar for the next 4 weeks",
          "Audit our website SEO and suggest quick wins",
          "Draft a launch announcement blog post",
        ],
        priority: "high",
      },
      {
        role: "Product",
        firstTasks: [
          "Create a PRD template for our team",
          "Prioritize our feature backlog using RICE scoring",
          "Draft user interview questions for customer discovery",
        ],
        priority: "high",
      },
      {
        role: "Back-End Engineering",
        firstTasks: [
          "Review our API design and suggest improvements",
          "Create a monitoring and alerting checklist",
          "Audit database query performance",
        ],
        priority: "medium",
      },
      {
        role: "Strategy",
        firstTasks: [
          "Analyze our top 5 competitors",
          "Build a SWOT analysis for the company",
          "Identify 3 new market opportunities",
        ],
        priority: "medium",
      },
    ],
    thirtyDayPlan: {
      week1: [
        "Sales: Build ICP and start prospect research",
        "Marketing: SEO audit and content calendar setup",
        "Product: Feature backlog prioritization",
      ],
      week2: [
        "Sales: Launch first outbound email sequences",
        "Marketing: Publish 2 blog posts, set up social media",
        "Strategy: Complete competitive analysis",
      ],
      week3: [
        "Sales: Review pipeline and refine targeting",
        "Product: Draft PRDs for top 3 features",
        "Engineering: API review and security audit",
      ],
      week4: [
        "Sales: Analyze conversion rates, optimize sequences",
        "Marketing: Monthly content performance report",
        "Strategy: Present market opportunity findings",
      ],
    },
  },
  {
    id: "ecommerce",
    name: "E-commerce Pack",
    description: "For online retailers focused on customer acquisition and retention",
    icon: "cart",
    agents: [
      {
        role: "Marketing",
        firstTasks: [
          "Create a social media content strategy for product launches",
          "Audit our email marketing flows (welcome, abandoned cart, re-engagement)",
          "Plan a seasonal promotional calendar",
        ],
        priority: "high",
      },
      {
        role: "Customer Success",
        firstTasks: [
          "Design a post-purchase follow-up sequence",
          "Create customer segmentation by purchase behavior",
          "Build a churn prevention playbook",
        ],
        priority: "high",
      },
      {
        role: "Finance",
        firstTasks: [
          "Calculate unit economics for top product lines",
          "Create a monthly P&L tracking template",
          "Analyze profit margins by category",
        ],
        priority: "high",
      },
      {
        role: "Data Analyst",
        firstTasks: [
          "Build a key metrics dashboard (CAC, LTV, AOV, conversion rate)",
          "Run cohort analysis on customer retention",
          "Analyze traffic sources and conversion funnels",
        ],
        priority: "medium",
      },
      {
        role: "Sales",
        firstTasks: [
          "Identify wholesale and partnership opportunities",
          "Create a B2B outreach strategy",
          "Build a referral program framework",
        ],
        priority: "medium",
      },
    ],
    thirtyDayPlan: {
      week1: [
        "Marketing: Social media audit and content strategy",
        "Customer Success: Map current customer journey",
        "Finance: Unit economics baseline analysis",
      ],
      week2: [
        "Marketing: Launch first content campaign",
        "Customer Success: Implement post-purchase sequences",
        "Data Analyst: Build metrics dashboard",
      ],
      week3: [
        "Marketing: Analyze campaign performance",
        "Finance: Monthly financial reporting setup",
        "Data Analyst: Cohort and funnel analysis",
      ],
      week4: [
        "All: Review 30-day metrics and set next month goals",
        "Sales: Launch partnership outreach",
        "Customer Success: Review churn data and implement prevention",
      ],
    },
  },
  {
    id: "professional-services",
    name: "Professional Services Pack",
    description: "For consulting firms, agencies, and service businesses",
    icon: "briefcase",
    agents: [
      {
        role: "Sales",
        firstTasks: [
          "Build a pipeline tracking system for proposals",
          "Create follow-up sequences for past clients",
          "Draft proposal templates for common engagement types",
        ],
        priority: "high",
      },
      {
        role: "Admin",
        firstTasks: [
          "Create contract templates for standard engagements",
          "Set up document management structure",
          "Build a client onboarding checklist",
        ],
        priority: "high",
      },
      {
        role: "Accounting",
        firstTasks: [
          "Set up invoice templates and tracking",
          "Create a monthly billing workflow",
          "Analyze accounts receivable aging",
        ],
        priority: "high",
      },
      {
        role: "Legal",
        firstTasks: [
          "Review standard client agreement for risks",
          "Create NDA and confidentiality templates",
          "Audit compliance requirements for our industry",
        ],
        priority: "medium",
      },
      {
        role: "HR",
        firstTasks: [
          "Create job descriptions for common roles",
          "Build an employee onboarding program",
          "Design quarterly performance review framework",
        ],
        priority: "medium",
      },
    ],
    thirtyDayPlan: {
      week1: [
        "Sales: Audit current pipeline and set up tracking",
        "Admin: Document management and contract templates",
        "Accounting: Invoice system setup",
      ],
      week2: [
        "Sales: Launch client re-engagement sequences",
        "Legal: Client agreement review and updates",
        "Admin: Client onboarding workflow",
      ],
      week3: [
        "Sales: Proposal pipeline review",
        "Accounting: Monthly billing cycle setup",
        "HR: Job descriptions and hiring pipeline",
      ],
      week4: [
        "All: Monthly business review and metrics",
        "Sales: Pipeline forecast and next month planning",
        "Legal: Compliance audit report",
      ],
    },
  },
  {
    id: "fintech",
    name: "Fintech Pack",
    description: "For financial technology companies navigating compliance and growth",
    icon: "bank",
    agents: [
      {
        role: "Legal",
        firstTasks: [
          "Map all applicable regulatory requirements",
          "Create a compliance monitoring checklist",
          "Review terms of service and privacy policy",
        ],
        priority: "high",
      },
      {
        role: "Finance",
        firstTasks: [
          "Build a financial model for investor discussions",
          "Analyze unit economics and customer LTV",
          "Create a monthly investor update template",
        ],
        priority: "high",
      },
      {
        role: "Product",
        firstTasks: [
          "Map user journey and identify friction points",
          "Create security-focused PRD requirements checklist",
          "Prioritize features by compliance impact",
        ],
        priority: "high",
      },
      {
        role: "Back-End Engineering",
        firstTasks: [
          "Audit API security and data encryption",
          "Review database architecture for PII handling",
          "Create an incident response playbook",
        ],
        priority: "high",
      },
      {
        role: "Marketing",
        firstTasks: [
          "Create trust-building content (security, compliance)",
          "Build case studies from early customers",
          "Plan thought leadership content calendar",
        ],
        priority: "medium",
      },
    ],
    thirtyDayPlan: {
      week1: [
        "Legal: Regulatory mapping and compliance baseline",
        "Engineering: Security audit and PII review",
        "Finance: Unit economics analysis",
      ],
      week2: [
        "Product: User journey mapping and friction analysis",
        "Legal: Terms of service and privacy policy updates",
        "Marketing: Trust-building content plan",
      ],
      week3: [
        "Engineering: Implement security improvements",
        "Finance: Financial model for fundraising",
        "Product: Compliance-focused feature roadmap",
      ],
      week4: [
        "All: Monthly compliance and security review",
        "Finance: Investor update preparation",
        "Marketing: Publish first trust content pieces",
      ],
    },
  },
  {
    id: "agency",
    name: "Marketing Agency Pack",
    description: "For digital marketing and creative agencies managing multiple clients",
    icon: "sparkle",
    agents: [
      {
        role: "Marketing",
        firstTasks: [
          "Create a content production workflow template",
          "Build a multi-client social media calendar",
          "Audit SEO strategies across client accounts",
        ],
        priority: "high",
      },
      {
        role: "Sales",
        firstTasks: [
          "Build a new client acquisition pipeline",
          "Create case studies from best-performing campaigns",
          "Draft pitch deck content for common verticals",
        ],
        priority: "high",
      },
      {
        role: "Data Analyst",
        firstTasks: [
          "Create a client reporting dashboard template",
          "Build campaign ROI tracking across channels",
          "Analyze which services have highest margins",
        ],
        priority: "high",
      },
      {
        role: "Customer Success",
        firstTasks: [
          "Design client onboarding questionnaire",
          "Create monthly check-in meeting templates",
          "Build a client health scoring system",
        ],
        priority: "medium",
      },
      {
        role: "Accounting",
        firstTasks: [
          "Set up retainer billing and invoice tracking",
          "Analyze profitability by client and service line",
          "Create financial forecasts based on pipeline",
        ],
        priority: "medium",
      },
    ],
    thirtyDayPlan: {
      week1: [
        "Marketing: Content production workflow setup",
        "Sales: Pipeline audit and case study creation",
        "Data Analyst: Client reporting template",
      ],
      week2: [
        "Marketing: Multi-client calendar implementation",
        "Customer Success: Onboarding flow design",
        "Accounting: Billing system optimization",
      ],
      week3: [
        "Data Analyst: ROI tracking across campaigns",
        "Sales: New client outreach launch",
        "Marketing: SEO audit for top clients",
      ],
      week4: [
        "All: Monthly performance review and planning",
        "Customer Success: Health scoring implementation",
        "Accounting: Client profitability report",
      ],
    },
  },
];

/**
 * Get a recommended pack based on company industry
 */
export function getRecommendedPack(industry: string | null): IndustryPack | null {
  if (!industry) return null;
  const lower = industry.toLowerCase();

  if (lower.includes("saas") || lower.includes("software") || lower.includes("technology") || lower.includes("ai") || lower.includes("machine learning")) {
    return industryPacks.find(p => p.id === "saas-startup") || null;
  }
  if (lower.includes("ecommerce") || lower.includes("e-commerce") || lower.includes("retail") || lower.includes("shop")) {
    return industryPacks.find(p => p.id === "ecommerce") || null;
  }
  if (lower.includes("consult") || lower.includes("professional") || lower.includes("service") || lower.includes("law") || lower.includes("accounting")) {
    return industryPacks.find(p => p.id === "professional-services") || null;
  }
  if (lower.includes("fintech") || lower.includes("financial") || lower.includes("banking") || lower.includes("payment") || lower.includes("web3") || lower.includes("blockchain")) {
    return industryPacks.find(p => p.id === "fintech") || null;
  }
  if (lower.includes("agency") || lower.includes("marketing") || lower.includes("media") || lower.includes("creative") || lower.includes("advertising")) {
    return industryPacks.find(p => p.id === "agency") || null;
  }

  // Default for unknown industries
  return industryPacks.find(p => p.id === "saas-startup") || null;
}
