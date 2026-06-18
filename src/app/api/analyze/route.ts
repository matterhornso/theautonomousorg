import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserProfile } from "@/lib/db";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { assertPublicUrl, sanitizeInput } from "@/lib/validation";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are The Autonomous — an AI platform analyst. Given the content of a company's website, analyze their business and recommend which AI agents would be most valuable.

Available agent roles:
1. Sales — Lead scoring, email sequences, CRM management, pipeline analytics
2. Marketing — Content creation, SEO optimization, campaign management, analytics
3. Accounting — Bookkeeping, financial reports, tax compliance, cash flow
4. Strategy — Market research, competitive analysis, business modeling, OKR tracking
5. Product — User research, roadmap planning, sprint management, specs & PRDs
6. Front-End Engineering — React/Next.js, UI components, performance, accessibility
7. Back-End Engineering — API design, databases, infrastructure, security
8. AI Expert — Model selection, prompt engineering, RAG pipelines, fine-tuning
9. Admin — Contract drafting, document management, vendor coordination, operations
10. HR — Recruiting, candidate screening, onboarding, performance reviews
11. Finance — Financial modeling, fundraising prep, investor reporting, budgeting
12. Customer Success — Customer onboarding, health scoring, churn prevention, NPS
13. Legal — Contract review, compliance monitoring, IP protection, regulatory tracking
14. Data Analyst — Dashboards, SQL queries, cohort analysis, A/B test evaluation

Your analysis should:
1. Identify the company name, industry, and what they do
2. Estimate company stage (startup, growth, enterprise)
3. Recommend 3-5 agents ranked by impact, with a specific reason for each tied to what you observed on their site
4. For each recommended agent, give one concrete example of what it would do for THIS specific company

Respond in JSON format:
{
  "company": {
    "name": "string",
    "industry": "string",
    "description": "one sentence about what they do",
    "stage": "startup | growth | enterprise"
  },
  "recommendations": [
    {
      "role": "Sales | Marketing | Accounting | Strategy | Product | Front-End Engineering | Back-End Engineering | AI Expert",
      "impact": "high | medium",
      "reason": "why this agent would help, based on what you saw on their site",
      "example": "one concrete task this agent would handle for them"
    }
  ],
  "summary": "2-3 sentence overview of the recommendations"
}

If the website content is insufficient to analyze, still make reasonable inferences and note any assumptions.`;

async function fetchWebsiteContent(url: string, depth = 0): Promise<string> {
  if (depth > 3) throw new Error("Too many redirects");

  let targetUrl = url;
  if (!targetUrl.startsWith("http")) {
    targetUrl = `https://${targetUrl}`;
  }

  // SSRF guard: re-resolve and reject private/link-local IPs on EVERY hop
  // (defends against redirect-to-metadata and DNS rebinding).
  const ssrfError = await assertPublicUrl(targetUrl);
  if (ssrfError) throw new Error(ssrfError);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TheAutonomousBot/1.0; +https://theautonomous.org)",
        Accept: "text/html,application/xhtml+xml",
      },
      // Do NOT auto-follow: handle redirects manually so each hop is re-validated.
      redirect: "manual",
    });

    // Manual redirect handling with per-hop SSRF re-validation.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect without location");
      const nextUrl = new URL(location, targetUrl).toString();
      clearTimeout(timeout);
      return fetchWebsiteContent(nextUrl, depth + 1);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Extract useful text content from HTML
    const text = html
      // Remove scripts and styles
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      // Get meta description
      .replace(
        /.*<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>.*/gi,
        "META_DESCRIPTION: $1\n"
      )
      // Get title
      .replace(/.*<title[^>]*>([\s\S]*?)<\/title>.*/gi, "TITLE: $1\n")
      // Strip remaining HTML tags
      .replace(/<[^>]+>/g, " ")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim();

    // Truncate to ~8000 chars to stay within reasonable token limits
    return text.slice(0, 8000);
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    // Rate limit
    const ip = request.headers.get("x-forwarded-for") || "anonymous";
    const rateLimitResult = checkRateLimit(
      getRateLimitKey("analyze", userId || ip),
      RATE_LIMITS.analyze
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a moment." },
        { status: 429 }
      );
    }

    const { url: rawUrl } = await request.json();
    const url = typeof rawUrl === "string" ? sanitizeInput(rawUrl) : "";

    // Validate URL (prefix checks + DNS resolution → private-IP rejection)
    const urlError = await assertPublicUrl(url || "");
    if (urlError) {
      return NextResponse.json({ error: urlError }, { status: 400 });
    }

    // Fetch and extract website content
    let websiteContent: string;
    try {
      websiteContent = await fetchWebsiteContent(url);
    } catch {
      return NextResponse.json(
        {
          error:
            "Could not fetch that website. Please check the URL and try again.",
        },
        { status: 422 }
      );
    }

    if (websiteContent.length < 50) {
      return NextResponse.json(
        {
          error:
            "Could not extract enough content from that website. Please try a different URL.",
        },
        { status: 422 }
      );
    }

    // Build user context from profile if authenticated
    // Wrapped in isolated try/catch — DB failures must never block analysis
    let userContext = "";
    try {
      if (userId) {
        const profile = await getUserProfile(userId);
        if (profile) {
          const parts = [];
          if (profile.role_title) parts.push(`User's role: ${profile.role_title}`);
          if (profile.company_size) parts.push(`Company size: ${profile.company_size} people`);
          if (profile.current_tools) parts.push(`Tools they currently use: ${profile.current_tools}`);
          if (profile.biggest_challenges) parts.push(`Their biggest challenges: ${profile.biggest_challenges}`);
          if (profile.automation_goals) parts.push(`What they want to automate: ${profile.automation_goals}`);
          if (parts.length > 0) {
            userContext = `\n\nAdditional context from the user's profile:\n${parts.join("\n")}\n\nUse this context to make your recommendations more specific and relevant to their actual needs.`;
          }
        }
      }
    } catch (e) {
      console.warn("[analyze] Could not load user profile, continuing without context:", e instanceof Error ? e.message : e);
    }

    // Analyze with Claude
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze this company's website and recommend AI agents:\n\nURL: ${url}\n\nWebsite content:\n${websiteContent}${userContext}`,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Parse the JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to analyze the website. Please try again." },
        { status: 500 }
      );
    }

    const analysis = JSON.parse(jsonMatch[0]);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
