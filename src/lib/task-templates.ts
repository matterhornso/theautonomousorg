import type { Analysis } from "./types";

interface TaskTemplate {
  type: string;
  title: string;
  promptBuilder: (analysis: Analysis) => string;
}

const roleTaskTemplates: Record<string, TaskTemplate[]> = {
  Sales: [
    {
      type: "icp_research",
      title: "Ideal Customer Profile Research",
      promptBuilder: (a) =>
        `You are the Sales Agent for ${a.company.name} (${a.company.industry}). ${a.company.description}

Research and define the Ideal Customer Profile (ICP) for this company. Include:
1. Target company characteristics (industry, size, revenue range, tech stack)
2. Key decision-maker personas (titles, responsibilities, pain points)
3. Buying triggers — what events make them ready to buy
4. Disqualification criteria — who is NOT a good fit

Be specific to ${a.company.name}'s product and market. Output as a structured brief.`,
    },
    {
      type: "outbound_sequences",
      title: "Draft Outbound Email Sequences",
      promptBuilder: (a) =>
        `You are the Sales Agent for ${a.company.name} (${a.company.industry}). ${a.company.description}

Draft 2 outbound email sequences (3 emails each) for reaching cold prospects:

Sequence 1: "Problem-aware" — target people who know they have the problem you solve
Sequence 2: "Solution-aware" — target people already evaluating solutions in your space

For each email: subject line, body (under 150 words), and CTA. Make them specific to ${a.company.name}'s value proposition, not generic templates.`,
    },
  ],

  Marketing: [
    {
      type: "seo_audit",
      title: "SEO & Content Gap Analysis",
      promptBuilder: (a) =>
        `You are the Marketing Agent for ${a.company.name} (${a.company.industry}). ${a.company.description}

Conduct an SEO and content strategy analysis:
1. Identify 10 high-value keywords ${a.company.name} should target (based on their product and market)
2. Suggest 5 blog post topics that would drive organic traffic
3. Analyze likely content gaps — what topics are competitors covering that ${a.company.name} isn't?
4. Recommend a content calendar framework (frequency, content types, channels)

Be specific to their industry and product positioning.`,
    },
    {
      type: "social_calendar",
      title: "Social Media Content Calendar",
      promptBuilder: (a) =>
        `You are the Marketing Agent for ${a.company.name} (${a.company.industry}). ${a.company.description}

Create a 1-week social media content calendar:
- 5 LinkedIn posts (mix of thought leadership, product insights, industry commentary)
- 3 Twitter/X posts (concise, engaging, shareable)

For each post: write the actual copy, suggest timing, and note the goal (awareness, engagement, traffic). Match the tone to ${a.company.name}'s brand positioning.`,
    },
  ],

  Strategy: [
    {
      type: "competitive_landscape",
      title: "Competitive Landscape Analysis",
      promptBuilder: (a) =>
        `You are the Strategy Agent for ${a.company.name} (${a.company.industry}). ${a.company.description}

Produce a competitive landscape analysis:
1. Identify 5-8 direct and indirect competitors
2. For each: what they do, their positioning, strengths, weaknesses
3. Map the competitive landscape on two axes: [feature completeness vs price] and [enterprise vs SMB focus]
4. Identify ${a.company.name}'s differentiation opportunities
5. Flag any competitive threats or market shifts to watch

Base this on your knowledge of the ${a.company.industry} space.`,
    },
  ],

  Product: [
    {
      type: "user_personas",
      title: "User Persona Synthesis",
      promptBuilder: (a) =>
        `You are the Product Agent for ${a.company.name} (${a.company.industry}). ${a.company.description}

Define 2-3 primary user personas:
For each persona:
- Name, role, and company type
- Goals (what they're trying to achieve)
- Pain points (what's blocking them)
- How ${a.company.name} helps them specifically
- Key workflows they'd use the product for
- Success metrics (how they measure value)

Make these specific to ${a.company.name}'s product, not generic personas.`,
    },
  ],

  Accounting: [
    {
      type: "financial_setup",
      title: "Financial Framework Setup",
      promptBuilder: (a) =>
        `You are the Accounting Agent for ${a.company.name} (${a.company.industry}, ${a.company.stage} stage). ${a.company.description}

Set up a financial tracking framework:
1. Recommend chart of accounts categories appropriate for a ${a.company.stage} ${a.company.industry} company
2. Key financial metrics to track monthly (revenue, burn rate, runway, etc.)
3. Tax compliance calendar for the next 12 months
4. Cash flow forecasting template structure
5. Expense categorization guidelines

Be specific to their stage and industry.`,
    },
  ],

  CEO: [
    {
      type: "executive_assessment",
      title: "Initial Executive Assessment",
      promptBuilder: (a) =>
        `You are the CEO Agent for ${a.company.name} (${a.company.industry}, ${a.company.stage} stage). ${a.company.description}

Produce an initial executive assessment:
1. Company positioning: Where does ${a.company.name} stand in the ${a.company.industry} market?
2. Strategic priorities: What are the top 3 things the company should focus on this quarter?
3. Agent workforce plan: Which of the AI agents currently deployed are most critical? What roles are missing?
4. Risk assessment: What are the top 3 risks to the business right now?
5. 90-day action plan: Concrete milestones for the next 3 months

Be specific, actionable, and data-driven. This is a board-level document.`,
    },
  ],

  HR: [
    {
      type: "hiring_pipeline",
      title: "Hiring Pipeline Review",
      promptBuilder: (a) =>
        `You are the HR Agent for ${a.company.name} (${a.company.industry}). ${a.company.description}

Review and recommend for our hiring pipeline:
1. Based on our company stage (${a.company.stage}) and industry, what roles should we be hiring for?
2. Draft job descriptions for the top 2 priority roles
3. Suggest interview question frameworks for each role
4. Recommend compensation ranges based on market data
5. Outline a 30/60/90 day onboarding plan template

Be specific to our industry and stage.`,
    },
  ],

  Finance: [
    {
      type: "monthly_financial_review",
      title: "Monthly Financial Review",
      promptBuilder: (a) =>
        `You are the Finance Agent for ${a.company.name} (${a.company.industry}, ${a.company.stage} stage). ${a.company.description}

Produce a monthly financial review framework:
1. Key metrics to track: revenue, MRR/ARR, burn rate, runway, CAC, LTV
2. Recommended dashboard structure for a ${a.company.stage} company
3. Cash flow projection template for the next 3 months
4. Budget allocation recommendations by department
5. Financial risks and mitigation strategies

Be specific to our stage and industry.`,
    },
  ],

  "Customer Success": [
    {
      type: "customer_health_check",
      title: "Customer Health Assessment Framework",
      promptBuilder: (a) =>
        `You are the Customer Success Agent for ${a.company.name} (${a.company.industry}). ${a.company.description}

Build a customer health assessment framework:
1. Define health scoring criteria (usage, engagement, support tickets, NPS)
2. Create an early warning system for churn risk
3. Design a customer onboarding checklist (first 7 days, 30 days, 90 days)
4. Draft a QBR template for customer reviews
5. Recommend expansion/upsell triggers based on usage patterns

Make it specific to ${a.company.industry} customers.`,
    },
  ],

  Legal: [
    {
      type: "compliance_audit",
      title: "Compliance & Legal Framework",
      promptBuilder: (a) =>
        `You are the Legal Agent for ${a.company.name} (${a.company.industry}). ${a.company.description}

Produce a compliance and legal framework:
1. Key regulatory requirements for a ${a.company.industry} company
2. Essential legal documents checklist (ToS, privacy policy, DPA, NDA templates)
3. Data protection compliance requirements (GDPR, CCPA as applicable)
4. IP protection strategy (trademarks, patents, trade secrets)
5. Employment law considerations for our stage

Be specific to our industry and jurisdiction.`,
    },
  ],

  Admin: [
    {
      type: "operations_setup",
      title: "Operations & Admin Framework",
      promptBuilder: (a) =>
        `You are the Admin Agent for ${a.company.name} (${a.company.industry}). ${a.company.description}

Set up an operations framework:
1. Standard operating procedures (SOPs) for core business processes
2. Vendor management checklist and evaluation criteria
3. Document management structure and naming conventions
4. Meeting cadence recommendations (daily standups, weekly syncs, monthly reviews)
5. Company policy templates (remote work, expenses, time off)

Be specific to a ${a.company.stage} ${a.company.industry} company.`,
    },
  ],

  "Data Analyst": [
    {
      type: "analytics_setup",
      title: "Analytics & KPI Framework",
      promptBuilder: (a) =>
        `You are the Data Analyst Agent for ${a.company.name} (${a.company.industry}). ${a.company.description}

Build an analytics framework:
1. Define the North Star metric for ${a.company.name}
2. Supporting metrics by department (sales, marketing, product, finance)
3. Dashboard layout recommendations with KPI hierarchy
4. Data collection requirements — what to track and where
5. Reporting cadence (daily, weekly, monthly) with audience for each

Make it specific to our industry and stage.`,
    },
  ],
};

// Generic template for roles without specific templates
const genericTemplate: TaskTemplate = {
  type: "introduction",
  title: "Initial Analysis & Recommendations",
  promptBuilder: (a) =>
    `You are an AI agent for ${a.company.name} (${a.company.industry}). ${a.company.description}

Introduce yourself and provide an initial analysis:
1. Based on the company context, identify the top 3 ways you can add value in your role
2. Suggest specific first actions you'd take
3. Ask 2-3 clarifying questions that would help you be more effective

Be proactive and specific — show that you've done your homework on this company.`,
};

export function getTaskTemplatesForRole(
  role: string,
  analysis: Analysis
): { type: string; title: string; prompt: string }[] {
  const templates = roleTaskTemplates[role];
  if (templates && templates.length > 0) {
    return templates.map((t) => ({
      type: t.type,
      title: t.title,
      prompt: t.promptBuilder(analysis),
    }));
  }
  // Generic template for roles without specific ones
  return [
    {
      type: genericTemplate.type,
      title: genericTemplate.title,
      prompt: genericTemplate.promptBuilder(analysis),
    },
  ];
}

/**
 * Cron task templates — suggested recurring tasks per agent role.
 * Users enable these with one click from the Schedule panel.
 */
export interface CronTemplate {
  id: string;
  role: string;
  title: string;
  description: string;
  cron_expression: string;
  cron_human: string;
  prompt: string;
}

export const cronTemplates: CronTemplate[] = [
  {
    id: "sales_pipeline_weekly",
    role: "Sales",
    title: "Weekly Pipeline Review",
    description: "Review leads, update pipeline, flag stale deals",
    cron_expression: "0 9 * * 1",
    cron_human: "Every Monday at 9am",
    prompt: "Review the current sales pipeline. Identify stale leads (no activity in 7+ days), highlight top opportunities, and recommend 3 specific actions to move deals forward this week.",
  },
  {
    id: "sales_prospect_daily",
    role: "Sales",
    title: "Daily Prospect Check",
    description: "Check new leads matching ideal customer profile",
    cron_expression: "0 8 * * 1-5",
    cron_human: "Weekdays at 8am",
    prompt: "Check for new prospects that match our ideal customer profile. If Apollo is connected, search for companies matching our ICP. Summarize the top 5 new leads with key details.",
  },
  {
    id: "marketing_seo_monthly",
    role: "Marketing",
    title: "Monthly SEO Audit",
    description: "Analyze site rankings, suggest improvements",
    cron_expression: "0 10 1 * *",
    cron_human: "1st of each month at 10am",
    prompt: "Conduct a monthly SEO audit. Analyze current keyword rankings, identify content gaps, review competitor content strategies, and provide 5 specific recommendations to improve organic traffic this month.",
  },
  {
    id: "marketing_content_weekly",
    role: "Marketing",
    title: "Weekly Content Plan",
    description: "Plan social posts and blog topics for the week",
    cron_expression: "0 9 * * 1",
    cron_human: "Every Monday at 9am",
    prompt: "Create a content plan for this week. Include: 3-5 social media post ideas with draft copy, 1 blog topic with outline, and any timely/trending topics to capitalize on. Align with our brand voice.",
  },
  {
    id: "strategy_competitor_quarterly",
    role: "Strategy",
    title: "Quarterly Competitor Analysis",
    description: "Research competitor moves and market trends",
    cron_expression: "0 10 1 1,4,7,10 *",
    cron_human: "Quarterly (Jan, Apr, Jul, Oct 1st)",
    prompt: "Conduct a quarterly competitive landscape analysis. Research what key competitors have launched, any pricing changes, market positioning shifts, and emerging trends. Provide strategic recommendations.",
  },
  {
    id: "accounting_expense_monthly",
    role: "Accounting",
    title: "Monthly Expense Review",
    description: "Review expenses, flag anomalies",
    cron_expression: "0 9 1 * *",
    cron_human: "1st of each month at 9am",
    prompt: "Review the company's monthly expenses. Identify any anomalies, unexpected charges, or areas where costs could be optimized. Provide a brief expense summary and flag anything requiring attention.",
  },
  {
    id: "hr_pulse_weekly",
    role: "HR",
    title: "Weekly Team Pulse",
    description: "Check team sentiment, upcoming reviews",
    cron_expression: "0 10 * * 5",
    cron_human: "Every Friday at 10am",
    prompt: "Prepare a weekly team pulse report. Review any team updates, upcoming performance reviews, PTO requests, and general team health indicators. Flag any concerns that need attention.",
  },
  {
    id: "product_prioritization_biweekly",
    role: "Product",
    title: "Biweekly Feature Prioritization",
    description: "Review backlog, prioritize based on user feedback",
    cron_expression: "0 10 1,15 * *",
    cron_human: "1st and 15th of each month",
    prompt: "Review the product backlog and prioritize features. Consider user feedback, business impact, and engineering effort. Recommend the top 5 items to work on in the next sprint with justification.",
  },
  {
    id: "ceo_summary_daily",
    role: "CEO",
    title: "Daily Executive Summary",
    description: "Query all agents and delegate follow-ups",
    cron_expression: "0 7 * * 1-5",
    cron_human: "Weekdays at 7am",
    prompt: "Generate a daily executive summary. Query all agents for status updates, review company metrics, identify blockers or risks, and recommend 3 priority actions for today.",
  },
];
