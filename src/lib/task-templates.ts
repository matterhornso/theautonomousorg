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
