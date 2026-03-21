/**
 * Web Search MCP Integration
 *
 * Provides tools for agents to:
 * - Search the web for information using Claude with web search capability
 * - Fetch and summarize content from specific URLs
 *
 * Uses the Anthropic SDK with the built-in web search tool.
 * Auth: ANTHROPIC_API_KEY environment variable
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export function isWebSearchConfigured(): boolean {
  return true;
}

// ─── Web Search ─────────────────────────────────────────

async function performWebSearch(query: string): Promise<string> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
      },
    ],
    messages: [
      {
        role: "user",
        content: `Search the web for: "${query}"\n\nReturn a concise summary of the top results. For each result include the title, URL, and a brief description. Format as a numbered list.`,
      },
    ],
  });

  // Extract text blocks from the response (skip tool_use and web_search_tool_result blocks)
  const textBlocks = message.content.filter(
    (block) => block.type === "text"
  );

  if (textBlocks.length === 0) {
    return "No results found for that query.";
  }

  return textBlocks
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n\n");
}

// ─── Web Fetch ──────────────────────────────────────────

async function fetchAndSummarize(url: string): Promise<string> {
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

    // Extract useful text content from HTML (same approach as analyze route)
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
    const truncated = text.slice(0, 8000);

    if (truncated.length < 50) {
      return `Could not extract meaningful content from ${targetUrl}. The page may be dynamically rendered or require JavaScript.`;
    }

    return `**Content from ${targetUrl}:**\n\n${truncated}`;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Claude Tool Definitions ─────────────────────────────
// These are registered with Claude's tool-use API so agents can search the web
export const webSearchTools = [
  {
    name: "web_search",
    description:
      "Search the internet for current information on any topic. Returns a summary of top results with titles, URLs, and descriptions. Use this when you need up-to-date information that may not be in your training data.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string" as const,
          description:
            'The search query, e.g. "latest AI funding rounds 2026" or "best CRM tools for startups"',
        },
      },
      required: ["query"],
    },
  },
  {
    name: "web_fetch",
    description:
      "Fetch and extract the text content from a specific URL. Use this to read articles, blog posts, documentation, or any web page. Returns the extracted text content of the page.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string" as const,
          description:
            'The URL to fetch, e.g. "https://example.com/article" or "docs.stripe.com/api"',
        },
      },
      required: ["url"],
    },
  },
];

// ─── Tool Executor ───────────────────────────────────────
export async function executeWebSearchTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    switch (toolName) {
      case "web_search": {
        const query = input.query as string;
        if (!query) {
          return "Error: A search query is required.";
        }
        return await performWebSearch(query);
      }

      case "web_fetch": {
        const url = input.url as string;
        if (!url) {
          return "Error: A URL is required.";
        }
        return await fetchAndSummarize(url);
      }

      default:
        return `Unknown web search tool: ${toolName}`;
    }
  } catch (error) {
    return `Web search error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}
