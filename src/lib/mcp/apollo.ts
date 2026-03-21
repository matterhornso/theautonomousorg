/**
 * Apollo.io MCP Integration
 *
 * Provides tools for the Sales agent to:
 * - Search for prospects by job title, company, industry, location
 * - Enrich contacts with detailed info
 * - Search organizations/companies
 *
 * API docs: https://docs.apollo.io/reference/people-api-search
 * Auth: X-Api-Key header
 * Base URL: https://api.apollo.io
 */

const APOLLO_BASE = "https://api.apollo.io";

function getApiKey(): string | null {
  return process.env.APOLLO_API_KEY || null;
}

function headers(): Record<string, string> {
  const key = getApiKey();
  if (!key) throw new Error("APOLLO_API_KEY not configured");
  return {
    "Content-Type": "application/json",
    "X-Api-Key": key,
    "Cache-Control": "no-cache",
  };
}

export function isApolloConfigured(): boolean {
  return !!getApiKey();
}

// ─── People Search ───────────────────────────────────────
export interface ApolloPersonSearchParams {
  person_titles?: string[];
  person_locations?: string[];
  organization_domains?: string[];
  organization_industry_tag_ids?: string[];
  organization_num_employees_ranges?: string[];
  q_keywords?: string;
  page?: number;
  per_page?: number;
}

export interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  title: string;
  headline: string;
  linkedin_url: string;
  organization: {
    name: string;
    website_url: string;
    industry: string;
    estimated_num_employees: number;
  } | null;
  city: string;
  state: string;
  country: string;
}

export async function searchPeople(
  params: ApolloPersonSearchParams
): Promise<{ people: ApolloPerson[]; total: number; page: number }> {
  const response = await fetch(
    `${APOLLO_BASE}/api/v1/mixed_people/api_search`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        ...params,
        page: params.page || 1,
        per_page: params.per_page || 10,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apollo API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return {
    people: (data.people || []).map(mapPerson),
    total: data.pagination?.total_entries || 0,
    page: data.pagination?.page || 1,
  };
}

// ─── Person Enrichment ───────────────────────────────────
export async function enrichPerson(params: {
  email?: string;
  linkedin_url?: string;
  first_name?: string;
  last_name?: string;
  organization_name?: string;
}): Promise<ApolloPerson | null> {
  const response = await fetch(`${APOLLO_BASE}/api/v1/people/match`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    const text = await response.text();
    throw new Error(`Apollo API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.person ? mapPerson(data.person) : null;
}

// ─── Organization Search ─────────────────────────────────
export interface ApolloOrgSearchParams {
  q_organization_keyword_tags?: string[];
  organization_locations?: string[];
  organization_num_employees_ranges?: string[];
  organization_industry_tag_ids?: string[];
  page?: number;
  per_page?: number;
}

export interface ApolloOrganization {
  id: string;
  name: string;
  website_url: string;
  industry: string;
  estimated_num_employees: number;
  city: string;
  state: string;
  country: string;
  short_description: string;
  linkedin_url: string;
  founded_year: number | null;
}

export async function searchOrganizations(
  params: ApolloOrgSearchParams
): Promise<{ organizations: ApolloOrganization[]; total: number }> {
  const response = await fetch(
    `${APOLLO_BASE}/api/v1/mixed_companies/api_search`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        ...params,
        page: params.page || 1,
        per_page: params.per_page || 10,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apollo API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return {
    organizations: (data.organizations || []).map(mapOrg),
    total: data.pagination?.total_entries || 0,
  };
}

// ─── Claude Tool Definitions ─────────────────────────────
// These are registered with Claude's tool-use API so agents can call Apollo
export const apolloTools = [
  {
    name: "apollo_search_people",
    description:
      "Search Apollo's database of 210M+ contacts to find prospects. Returns names, titles, companies, and LinkedIn URLs. Does NOT return emails or phone numbers (use enrich for that).",
    input_schema: {
      type: "object" as const,
      properties: {
        person_titles: {
          type: "array" as const,
          items: { type: "string" as const },
          description:
            'Job titles to search for, e.g. ["CEO", "VP of Sales", "Head of Marketing"]',
        },
        person_locations: {
          type: "array" as const,
          items: { type: "string" as const },
          description:
            'Locations to filter by, e.g. ["San Francisco", "New York"]',
        },
        organization_domains: {
          type: "array" as const,
          items: { type: "string" as const },
          description:
            'Company domains to search within, e.g. ["google.com", "stripe.com"]',
        },
        q_keywords: {
          type: "string" as const,
          description: "General keyword search across all fields",
        },
        per_page: {
          type: "number" as const,
          description: "Results per page (max 25, default 10)",
        },
      },
    },
  },
  {
    name: "apollo_enrich_person",
    description:
      "Look up detailed info about a specific person by email, LinkedIn URL, or name + company. Returns enriched profile data.",
    input_schema: {
      type: "object" as const,
      properties: {
        email: { type: "string" as const, description: "Person's email address" },
        linkedin_url: {
          type: "string" as const,
          description: "Person's LinkedIn profile URL",
        },
        first_name: { type: "string" as const, description: "First name" },
        last_name: { type: "string" as const, description: "Last name" },
        organization_name: {
          type: "string" as const,
          description: "Company name (helps with name-based lookup)",
        },
      },
    },
  },
  {
    name: "apollo_search_companies",
    description:
      "Search for companies/organizations by industry, size, location, or keywords.",
    input_schema: {
      type: "object" as const,
      properties: {
        q_organization_keyword_tags: {
          type: "array" as const,
          items: { type: "string" as const },
          description: 'Keywords, e.g. ["SaaS", "fintech", "AI"]',
        },
        organization_locations: {
          type: "array" as const,
          items: { type: "string" as const },
          description: 'Locations, e.g. ["United States", "Europe"]',
        },
        organization_num_employees_ranges: {
          type: "array" as const,
          items: { type: "string" as const },
          description:
            'Employee count ranges, e.g. ["1,10", "11,50", "51,200"]',
        },
        per_page: {
          type: "number" as const,
          description: "Results per page (max 25, default 10)",
        },
      },
    },
  },
];

// ─── Tool Executor ───────────────────────────────────────
export async function executeApolloTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    switch (toolName) {
      case "apollo_search_people": {
        const results = await searchPeople(
          input as ApolloPersonSearchParams
        );
        if (results.people.length === 0) {
          return "No prospects found matching those criteria. Try broadening your search.";
        }
        return `Found ${results.total} prospects (showing ${results.people.length}):\n\n${results.people
          .map(
            (p, i) =>
              `${i + 1}. **${p.name}** — ${p.title}\n   Company: ${p.organization?.name || "Unknown"} (${p.organization?.industry || "Unknown"})\n   Location: ${p.city}${p.state ? `, ${p.state}` : ""}, ${p.country}\n   LinkedIn: ${p.linkedin_url || "N/A"}`
          )
          .join("\n\n")}`;
      }

      case "apollo_enrich_person": {
        const person = await enrichPerson(
          input as {
            email?: string;
            linkedin_url?: string;
            first_name?: string;
            last_name?: string;
            organization_name?: string;
          }
        );
        if (!person) {
          return "No matching person found in Apollo's database.";
        }
        return `**${person.name}**\n- Title: ${person.title}\n- Company: ${person.organization?.name || "Unknown"}\n- Industry: ${person.organization?.industry || "Unknown"}\n- Location: ${person.city}${person.state ? `, ${person.state}` : ""}, ${person.country}\n- LinkedIn: ${person.linkedin_url || "N/A"}`;
      }

      case "apollo_search_companies": {
        const results = await searchOrganizations(
          input as ApolloOrgSearchParams
        );
        if (results.organizations.length === 0) {
          return "No companies found matching those criteria.";
        }
        return `Found ${results.total} companies (showing ${results.organizations.length}):\n\n${results.organizations
          .map(
            (o, i) =>
              `${i + 1}. **${o.name}** — ${o.industry}\n   Website: ${o.website_url || "N/A"}\n   Employees: ~${o.estimated_num_employees}\n   Location: ${o.city}${o.state ? `, ${o.state}` : ""}, ${o.country}\n   ${o.short_description || ""}`
          )
          .join("\n\n")}`;
      }

      default:
        return `Unknown Apollo tool: ${toolName}`;
    }
  } catch (error) {
    return `Apollo API error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

// ─── Helpers ─────────────────────────────────────────────
function mapPerson(raw: Record<string, unknown>): ApolloPerson {
  const org = raw.organization as Record<string, unknown> | null;
  return {
    id: (raw.id as string) || "",
    first_name: (raw.first_name as string) || "",
    last_name: (raw.last_name as string) || "",
    name: (raw.name as string) || "",
    title: (raw.title as string) || "",
    headline: (raw.headline as string) || "",
    linkedin_url: (raw.linkedin_url as string) || "",
    organization: org
      ? {
          name: (org.name as string) || "",
          website_url: (org.website_url as string) || "",
          industry: (org.industry as string) || "",
          estimated_num_employees:
            (org.estimated_num_employees as number) || 0,
        }
      : null,
    city: (raw.city as string) || "",
    state: (raw.state as string) || "",
    country: (raw.country as string) || "",
  };
}

function mapOrg(raw: Record<string, unknown>): ApolloOrganization {
  return {
    id: (raw.id as string) || "",
    name: (raw.name as string) || "",
    website_url: (raw.website_url as string) || "",
    industry: (raw.industry as string) || "",
    estimated_num_employees: (raw.estimated_num_employees as number) || 0,
    city: (raw.city as string) || "",
    state: (raw.state as string) || "",
    country: (raw.country as string) || "",
    short_description: (raw.short_description as string) || "",
    linkedin_url: (raw.linkedin_url as string) || "",
    founded_year: (raw.founded_year as number) || null,
  };
}
