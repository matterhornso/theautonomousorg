/**
 * Instantly.ai MCP Integration
 *
 * Provides tools for the Sales agent to:
 * - Manage email outreach campaigns (create, list, update)
 * - Manage leads (add to campaigns, list leads)
 * - View connected email accounts
 * - Get campaign analytics (open rates, reply rates, etc.)
 *
 * API docs: https://developer.instantly.ai/
 * Auth: Bearer token (Authorization header)
 * Base URL: https://api.instantly.ai
 * API Version: v2
 */

const INSTANTLY_BASE = "https://api.instantly.ai";

function getApiKey(): string | null {
  return process.env.INSTANTLY_API_KEY || null;
}

function headers(): Record<string, string> {
  const key = getApiKey();
  if (!key) throw new Error("INSTANTLY_API_KEY not configured");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

export function isInstantlyConfigured(): boolean {
  return !!getApiKey();
}

// ─── Campaign Management ─────────────────────────────────

export interface InstantlyCampaign {
  id: string;
  name: string;
  status: number;
  timestamp_created: string;
  timestamp_updated: string;
}

export interface ListCampaignsParams {
  limit?: number;
  starting_after?: string;
  status?: number;
  search?: string;
  tag_ids?: string[];
}

export async function listCampaigns(
  params: ListCampaignsParams = {}
): Promise<{ items: InstantlyCampaign[]; next_starting_after?: string }> {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.starting_after) query.set("starting_after", params.starting_after);
  if (params.status !== undefined) query.set("status", String(params.status));
  if (params.search) query.set("search", params.search);
  if (params.tag_ids?.length) query.set("tag_ids", params.tag_ids.join(","));

  const url = `${INSTANTLY_BASE}/api/v2/campaigns?${query.toString()}`;
  const response = await fetch(url, { method: "GET", headers: headers() });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Instantly API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return {
    items: (data.items || data || []).map(mapCampaign),
    next_starting_after: data.next_starting_after,
  };
}

export async function getCampaign(
  campaignId: string
): Promise<InstantlyCampaign> {
  const response = await fetch(
    `${INSTANTLY_BASE}/api/v2/campaigns/${campaignId}`,
    { method: "GET", headers: headers() }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Instantly API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return mapCampaign(data);
}

export interface CreateCampaignParams {
  name: string;
  campaign_schedule?: {
    schedules?: Array<{
      name?: string;
      timing?: { from?: string; to?: string };
      days?: Record<string, boolean>;
    }>;
    start_date?: string;
    end_date?: string;
  };
}

export async function createCampaign(
  params: CreateCampaignParams
): Promise<InstantlyCampaign> {
  const response = await fetch(`${INSTANTLY_BASE}/api/v2/campaigns`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Instantly API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return mapCampaign(data);
}

export interface UpdateCampaignParams {
  name?: string;
  campaign_schedule?: {
    schedules?: Array<{
      name?: string;
      timing?: { from?: string; to?: string };
      days?: Record<string, boolean>;
    }>;
    start_date?: string;
    end_date?: string;
  };
}

export async function updateCampaign(
  campaignId: string,
  params: UpdateCampaignParams
): Promise<InstantlyCampaign> {
  const response = await fetch(
    `${INSTANTLY_BASE}/api/v2/campaigns/${campaignId}`,
    {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(params),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Instantly API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return mapCampaign(data);
}

// ─── Lead Management ─────────────────────────────────────

export interface InstantlyLead {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company_name: string;
  campaign_id: string;
  list_id: string;
  status: string;
  timestamp_created: string;
}

export interface CreateLeadParams {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  campaign?: string;
  list_id?: string;
  custom_variables?: Record<string, string | number | boolean | null>;
  skip_if_in_workspace?: boolean;
  skip_if_in_campaign?: boolean;
}

export async function createLead(
  params: CreateLeadParams
): Promise<InstantlyLead> {
  const response = await fetch(`${INSTANTLY_BASE}/api/v2/leads`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Instantly API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return mapLead(data);
}

export interface BulkAddLeadsParams {
  leads: Array<{
    email: string;
    first_name?: string;
    last_name?: string;
    company_name?: string;
    custom_variables?: Record<string, string | number | boolean | null>;
  }>;
  campaign?: string;
  list_id?: string;
  skip_if_in_workspace?: boolean;
  skip_if_in_campaign?: boolean;
}

export async function bulkAddLeads(
  params: BulkAddLeadsParams
): Promise<{ uploaded: number; skipped: number }> {
  const response = await fetch(`${INSTANTLY_BASE}/api/v2/leads/batch`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Instantly API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return {
    uploaded: data.uploaded ?? data.total ?? 0,
    skipped: data.skipped ?? 0,
  };
}

export interface ListLeadsParams {
  campaign_id?: string;
  list_id?: string;
  limit?: number;
  starting_after?: string;
  search?: string;
}

export async function listLeads(
  params: ListLeadsParams = {}
): Promise<{ items: InstantlyLead[]; next_starting_after?: string }> {
  const query = new URLSearchParams();
  if (params.campaign_id) query.set("campaign_id", params.campaign_id);
  if (params.list_id) query.set("list_id", params.list_id);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.starting_after) query.set("starting_after", params.starting_after);
  if (params.search) query.set("search", params.search);

  const url = `${INSTANTLY_BASE}/api/v2/leads?${query.toString()}`;
  const response = await fetch(url, { method: "GET", headers: headers() });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Instantly API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return {
    items: (data.items || data || []).map(mapLead),
    next_starting_after: data.next_starting_after,
  };
}

// ─── Email Account Management ────────────────────────────

export interface InstantlyAccount {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: number;
  provider_code: number;
  timestamp_created: string;
  timestamp_updated: string;
}

export interface ListAccountsParams {
  limit?: number;
  starting_after?: string;
  status?: number;
  search?: string;
  provider_code?: number;
}

export async function listAccounts(
  params: ListAccountsParams = {}
): Promise<{ items: InstantlyAccount[]; next_starting_after?: string }> {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.starting_after) query.set("starting_after", params.starting_after);
  if (params.status !== undefined) query.set("status", String(params.status));
  if (params.search) query.set("search", params.search);
  if (params.provider_code !== undefined)
    query.set("provider_code", String(params.provider_code));

  const url = `${INSTANTLY_BASE}/api/v2/accounts?${query.toString()}`;
  const response = await fetch(url, { method: "GET", headers: headers() });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Instantly API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return {
    items: (data.items || data || []).map(mapAccount),
    next_starting_after: data.next_starting_after,
  };
}

// ─── Analytics ───────────────────────────────────────────

export interface CampaignAnalytics {
  campaign_id: string;
  campaign_name: string;
  campaign_status: number;
  leads_count: number;
  contacted_count: number;
  emails_sent_count: number;
  new_leads_contacted_count: number;
  open_count: number;
  open_count_unique: number;
  reply_count: number;
  reply_count_unique: number;
  reply_count_automatic: number;
  link_click_count: number;
  link_click_count_unique: number;
  bounced_count: number;
  unsubscribed_count: number;
  completed_count: number;
  total_opportunities: number;
  total_opportunity_value: number;
}

export interface GetCampaignAnalyticsParams {
  id?: string;
  start_date?: string;
  end_date?: string;
}

export async function getCampaignAnalytics(
  params: GetCampaignAnalyticsParams = {}
): Promise<CampaignAnalytics[]> {
  const query = new URLSearchParams();
  if (params.id) query.set("id", params.id);
  if (params.start_date) query.set("start_date", params.start_date);
  if (params.end_date) query.set("end_date", params.end_date);

  const url = `${INSTANTLY_BASE}/api/v2/campaigns/analytics?${query.toString()}`;
  const response = await fetch(url, { method: "GET", headers: headers() });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Instantly API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const items = Array.isArray(data) ? data : data.items || data.data || [data];
  return items.map(mapAnalytics);
}

// ─── Claude Tool Definitions ─────────────────────────────
// These are registered with Claude's tool-use API so agents can call Instantly
export const instantlyTools = [
  {
    name: "instantly_list_campaigns",
    description:
      "List all email outreach campaigns in Instantly.ai. Returns campaign names, IDs, statuses. Supports filtering by status and search term.",
    input_schema: {
      type: "object" as const,
      properties: {
        search: {
          type: "string" as const,
          description: "Search campaigns by name",
        },
        status: {
          type: "number" as const,
          description:
            "Filter by status (0 = draft, 1 = active, 2 = paused, 3 = completed)",
        },
        limit: {
          type: "number" as const,
          description: "Max results to return (default 10)",
        },
      },
    },
  },
  {
    name: "instantly_get_campaign",
    description:
      "Get details of a specific campaign by its ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        campaign_id: {
          type: "string" as const,
          description: "The unique ID of the campaign",
        },
      },
      required: ["campaign_id"],
    },
  },
  {
    name: "instantly_create_campaign",
    description:
      "Create a new email outreach campaign in Instantly.ai. Requires at least a campaign name.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string" as const,
          description: "Name of the campaign",
        },
        start_date: {
          type: "string" as const,
          description: "Start date in YYYY-MM-DD format",
        },
        end_date: {
          type: "string" as const,
          description: "End date in YYYY-MM-DD format",
        },
        schedule_from: {
          type: "string" as const,
          description: 'Daily sending start time, e.g. "09:00"',
        },
        schedule_to: {
          type: "string" as const,
          description: 'Daily sending end time, e.g. "17:00"',
        },
      },
      required: ["name"],
    },
  },
  {
    name: "instantly_update_campaign",
    description:
      "Update an existing campaign's name or schedule.",
    input_schema: {
      type: "object" as const,
      properties: {
        campaign_id: {
          type: "string" as const,
          description: "The unique ID of the campaign to update",
        },
        name: {
          type: "string" as const,
          description: "New name for the campaign",
        },
      },
      required: ["campaign_id"],
    },
  },
  {
    name: "instantly_add_lead",
    description:
      "Add a single lead (prospect) to a campaign or list in Instantly.ai.",
    input_schema: {
      type: "object" as const,
      properties: {
        email: {
          type: "string" as const,
          description: "Lead's email address (required)",
        },
        first_name: {
          type: "string" as const,
          description: "Lead's first name",
        },
        last_name: {
          type: "string" as const,
          description: "Lead's last name",
        },
        company_name: {
          type: "string" as const,
          description: "Lead's company name",
        },
        campaign_id: {
          type: "string" as const,
          description: "Campaign ID to add the lead to",
        },
        list_id: {
          type: "string" as const,
          description: "Lead list ID to add the lead to (alternative to campaign_id)",
        },
        custom_variables: {
          type: "object" as const,
          description:
            "Custom variables as key-value pairs (values must be string, number, boolean, or null)",
        },
      },
      required: ["email"],
    },
  },
  {
    name: "instantly_bulk_add_leads",
    description:
      "Add multiple leads in bulk to a campaign or list in Instantly.ai. More efficient than adding one by one.",
    input_schema: {
      type: "object" as const,
      properties: {
        leads: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              email: { type: "string" as const, description: "Lead's email" },
              first_name: { type: "string" as const, description: "First name" },
              last_name: { type: "string" as const, description: "Last name" },
              company_name: { type: "string" as const, description: "Company" },
            },
            required: ["email"],
          },
          description: "Array of leads to add",
        },
        campaign_id: {
          type: "string" as const,
          description: "Campaign ID to add leads to",
        },
        list_id: {
          type: "string" as const,
          description: "Lead list ID to add leads to (alternative to campaign_id)",
        },
      },
      required: ["leads"],
    },
  },
  {
    name: "instantly_list_leads",
    description:
      "List leads in a campaign or list. Returns lead emails, names, companies, and statuses.",
    input_schema: {
      type: "object" as const,
      properties: {
        campaign_id: {
          type: "string" as const,
          description: "Filter leads by campaign ID",
        },
        list_id: {
          type: "string" as const,
          description: "Filter leads by list ID",
        },
        search: {
          type: "string" as const,
          description: "Search leads by email or name",
        },
        limit: {
          type: "number" as const,
          description: "Max results to return (default 10)",
        },
      },
    },
  },
  {
    name: "instantly_list_accounts",
    description:
      "List connected email sending accounts in Instantly.ai. Shows email addresses, statuses, and providers.",
    input_schema: {
      type: "object" as const,
      properties: {
        search: {
          type: "string" as const,
          description: "Search accounts by email",
        },
        status: {
          type: "number" as const,
          description: "Filter by account status (1 = active)",
        },
        limit: {
          type: "number" as const,
          description: "Max results to return (default 10)",
        },
      },
    },
  },
  {
    name: "instantly_get_campaign_analytics",
    description:
      "Get analytics for one or all campaigns: leads count, emails sent, open rate, reply rate, bounces, unsubscribes, link clicks, and more.",
    input_schema: {
      type: "object" as const,
      properties: {
        campaign_id: {
          type: "string" as const,
          description:
            "Campaign ID to get analytics for. Omit to get analytics for all campaigns.",
        },
        start_date: {
          type: "string" as const,
          description: "Start date filter in YYYY-MM-DD format",
        },
        end_date: {
          type: "string" as const,
          description: "End date filter in YYYY-MM-DD format",
        },
      },
    },
  },
];

// ─── Tool Executor ───────────────────────────────────────
export async function executeInstantlyTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    switch (toolName) {
      case "instantly_list_campaigns": {
        const results = await listCampaigns({
          search: input.search as string | undefined,
          status: input.status as number | undefined,
          limit: (input.limit as number) || 10,
        });
        if (results.items.length === 0) {
          return "No campaigns found. Try broadening your search or check that campaigns exist in your Instantly workspace.";
        }
        return `Found ${results.items.length} campaign(s):\n\n${results.items
          .map(
            (c, i) =>
              `${i + 1}. **${c.name}**\n   ID: ${c.id}\n   Status: ${formatCampaignStatus(c.status)}\n   Created: ${c.timestamp_created}`
          )
          .join("\n\n")}`;
      }

      case "instantly_get_campaign": {
        const campaign = await getCampaign(input.campaign_id as string);
        return `**${campaign.name}**\n- ID: ${campaign.id}\n- Status: ${formatCampaignStatus(campaign.status)}\n- Created: ${campaign.timestamp_created}\n- Updated: ${campaign.timestamp_updated}`;
      }

      case "instantly_create_campaign": {
        const schedule: CreateCampaignParams["campaign_schedule"] = {};
        if (input.start_date) schedule.start_date = input.start_date as string;
        if (input.end_date) schedule.end_date = input.end_date as string;
        if (input.schedule_from || input.schedule_to) {
          schedule.schedules = [
            {
              name: "Default",
              timing: {
                from: (input.schedule_from as string) || "09:00",
                to: (input.schedule_to as string) || "17:00",
              },
            },
          ];
        }

        const campaign = await createCampaign({
          name: input.name as string,
          ...(Object.keys(schedule).length > 0
            ? { campaign_schedule: schedule }
            : {}),
        });
        return `Campaign created successfully!\n- Name: **${campaign.name}**\n- ID: ${campaign.id}\n- Status: ${formatCampaignStatus(campaign.status)}`;
      }

      case "instantly_update_campaign": {
        const updateParams: UpdateCampaignParams = {};
        if (input.name) updateParams.name = input.name as string;

        const campaign = await updateCampaign(
          input.campaign_id as string,
          updateParams
        );
        return `Campaign updated successfully!\n- Name: **${campaign.name}**\n- ID: ${campaign.id}\n- Status: ${formatCampaignStatus(campaign.status)}`;
      }

      case "instantly_add_lead": {
        const lead = await createLead({
          email: input.email as string,
          first_name: input.first_name as string | undefined,
          last_name: input.last_name as string | undefined,
          company_name: input.company_name as string | undefined,
          campaign: input.campaign_id as string | undefined,
          list_id: input.list_id as string | undefined,
          custom_variables: input.custom_variables as
            | Record<string, string | number | boolean | null>
            | undefined,
        });
        return `Lead added successfully!\n- Email: ${lead.email}\n- Name: ${lead.first_name} ${lead.last_name}\n- Company: ${lead.company_name || "N/A"}\n- Campaign: ${lead.campaign_id || "N/A"}`;
      }

      case "instantly_bulk_add_leads": {
        const leadsInput = input.leads as Array<{
          email: string;
          first_name?: string;
          last_name?: string;
          company_name?: string;
          custom_variables?: Record<string, string | number | boolean | null>;
        }>;
        const result = await bulkAddLeads({
          leads: leadsInput,
          campaign: input.campaign_id as string | undefined,
          list_id: input.list_id as string | undefined,
        });
        return `Bulk lead upload complete!\n- Uploaded: ${result.uploaded}\n- Skipped: ${result.skipped}`;
      }

      case "instantly_list_leads": {
        const results = await listLeads({
          campaign_id: input.campaign_id as string | undefined,
          list_id: input.list_id as string | undefined,
          search: input.search as string | undefined,
          limit: (input.limit as number) || 10,
        });
        if (results.items.length === 0) {
          return "No leads found matching those criteria.";
        }
        return `Found ${results.items.length} lead(s):\n\n${results.items
          .map(
            (l, i) =>
              `${i + 1}. **${l.first_name} ${l.last_name}** <${l.email}>\n   Company: ${l.company_name || "N/A"}\n   Status: ${l.status || "N/A"}\n   Added: ${l.timestamp_created}`
          )
          .join("\n\n")}`;
      }

      case "instantly_list_accounts": {
        const results = await listAccounts({
          search: input.search as string | undefined,
          status: input.status as number | undefined,
          limit: (input.limit as number) || 10,
        });
        if (results.items.length === 0) {
          return "No email accounts found. Make sure accounts are connected in your Instantly workspace.";
        }
        return `Found ${results.items.length} email account(s):\n\n${results.items
          .map(
            (a, i) =>
              `${i + 1}. **${a.email}**\n   Name: ${a.first_name} ${a.last_name}\n   Status: ${a.status === 1 ? "Active" : `Status ${a.status}`}\n   Provider: ${formatProvider(a.provider_code)}\n   Connected: ${a.timestamp_created}`
          )
          .join("\n\n")}`;
      }

      case "instantly_get_campaign_analytics": {
        const analytics = await getCampaignAnalytics({
          id: input.campaign_id as string | undefined,
          start_date: input.start_date as string | undefined,
          end_date: input.end_date as string | undefined,
        });
        if (analytics.length === 0) {
          return "No analytics data found for the specified criteria.";
        }
        return analytics
          .map((a) => {
            const openRate =
              a.contacted_count > 0
                ? ((a.open_count_unique / a.contacted_count) * 100).toFixed(1)
                : "0.0";
            const replyRate =
              a.contacted_count > 0
                ? ((a.reply_count_unique / a.contacted_count) * 100).toFixed(1)
                : "0.0";
            const bounceRate =
              a.emails_sent_count > 0
                ? ((a.bounced_count / a.emails_sent_count) * 100).toFixed(1)
                : "0.0";
            return `**${a.campaign_name}** (${formatCampaignStatus(a.campaign_status)})\n- Leads: ${a.leads_count} | Contacted: ${a.contacted_count} | Emails Sent: ${a.emails_sent_count}\n- Opens: ${a.open_count_unique} unique (${openRate}% open rate)\n- Replies: ${a.reply_count_unique} unique (${replyRate}% reply rate)\n- Link Clicks: ${a.link_click_count_unique} unique\n- Bounced: ${a.bounced_count} (${bounceRate}%) | Unsubscribed: ${a.unsubscribed_count}\n- Completed: ${a.completed_count}\n- Opportunities: ${a.total_opportunities} ($${a.total_opportunity_value})`;
          })
          .join("\n\n---\n\n");
      }

      default:
        return `Unknown Instantly tool: ${toolName}`;
    }
  } catch (error) {
    return `Instantly API error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

// ─── Helpers ─────────────────────────────────────────────

function mapCampaign(raw: Record<string, unknown>): InstantlyCampaign {
  return {
    id: (raw.id as string) || "",
    name: (raw.name as string) || "",
    status: (raw.status as number) ?? 0,
    timestamp_created: (raw.timestamp_created as string) || "",
    timestamp_updated: (raw.timestamp_updated as string) || "",
  };
}

function mapLead(raw: Record<string, unknown>): InstantlyLead {
  return {
    id: (raw.id as string) || "",
    email: (raw.email as string) || "",
    first_name: (raw.first_name as string) || "",
    last_name: (raw.last_name as string) || "",
    company_name: (raw.company_name as string) || "",
    campaign_id: (raw.campaign_id as string) || (raw.campaign as string) || "",
    list_id: (raw.list_id as string) || "",
    status: (raw.status as string) || "",
    timestamp_created: (raw.timestamp_created as string) || "",
  };
}

function mapAccount(raw: Record<string, unknown>): InstantlyAccount {
  return {
    id: (raw.id as string) || "",
    email: (raw.email as string) || "",
    first_name: (raw.first_name as string) || "",
    last_name: (raw.last_name as string) || "",
    status: (raw.status as number) ?? 0,
    provider_code: (raw.provider_code as number) ?? 0,
    timestamp_created: (raw.timestamp_created as string) || "",
    timestamp_updated: (raw.timestamp_updated as string) || "",
  };
}

function mapAnalytics(raw: Record<string, unknown>): CampaignAnalytics {
  return {
    campaign_id: (raw.campaign_id as string) || "",
    campaign_name: (raw.campaign_name as string) || "",
    campaign_status: (raw.campaign_status as number) ?? 0,
    leads_count: (raw.leads_count as number) || 0,
    contacted_count: (raw.contacted_count as number) || 0,
    emails_sent_count: (raw.emails_sent_count as number) || 0,
    new_leads_contacted_count: (raw.new_leads_contacted_count as number) || 0,
    open_count: (raw.open_count as number) || 0,
    open_count_unique: (raw.open_count_unique as number) || 0,
    reply_count: (raw.reply_count as number) || 0,
    reply_count_unique: (raw.reply_count_unique as number) || 0,
    reply_count_automatic: (raw.reply_count_automatic as number) || 0,
    link_click_count: (raw.link_click_count as number) || 0,
    link_click_count_unique: (raw.link_click_count_unique as number) || 0,
    bounced_count: (raw.bounced_count as number) || 0,
    unsubscribed_count: (raw.unsubscribed_count as number) || 0,
    completed_count: (raw.completed_count as number) || 0,
    total_opportunities: (raw.total_opportunities as number) || 0,
    total_opportunity_value: (raw.total_opportunity_value as number) || 0,
  };
}

function formatCampaignStatus(status: number): string {
  switch (status) {
    case 0:
      return "Draft";
    case 1:
      return "Active";
    case 2:
      return "Paused";
    case 3:
      return "Completed";
    default:
      return `Unknown (${status})`;
  }
}

function formatProvider(code: number): string {
  switch (code) {
    case 1:
      return "SMTP/IMAP";
    case 2:
      return "Gmail";
    case 3:
      return "Outlook";
    case 4:
      return "AWS SES";
    default:
      return `Provider ${code}`;
  }
}
