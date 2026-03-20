import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

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

async function fetchWebsiteContent(url: string): Promise<string> {
  let targetUrl = url;
  if (!targetUrl.startsWith("http")) {
    targetUrl = `https://${targetUrl}`;
  }

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
      redirect: "follow",
    });

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
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Please provide a valid URL" },
        { status: 400 }
      );
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

    // Analyze with Claude
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze this company's website and recommend AI agents:\n\nURL: ${url}\n\nWebsite content:\n${websiteContent}`,
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
