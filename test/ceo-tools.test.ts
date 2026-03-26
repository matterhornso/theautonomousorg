import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("@/lib/db", () => ({
  getAgentsByCompany: vi.fn(),
  getActivityFeed: vi.fn(),
  getTasksByCompany: vi.fn(),
  getUsage: vi.fn(),
  getMemory: vi.fn(),
  createTask: vi.fn(),
  logAgentAction: vi.fn(),
}));

// Mock Anthropic — must be a class constructor
vi.mock("@anthropic-ai/sdk", () => {
  const mockCreate = vi.fn().mockResolvedValue({
    content: [{ type: "text", text: "Agent status update" }],
  });
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

import { executeCeoTool, resetDelegationCount } from "@/lib/mcp/ceo-tools";
import * as db from "@/lib/db";

const mockAgents = [
  { id: "ceo-1", role: "CEO", company_id: "co-1", status: "active", system_prompt: "", skills_json: "[]", connectors_json: "[]" },
  { id: "sales-1", role: "Sales", company_id: "co-1", status: "active", system_prompt: "", skills_json: "[]", connectors_json: "[]" },
  { id: "marketing-1", role: "Marketing", company_id: "co-1", status: "active", system_prompt: "", skills_json: "[]", connectors_json: "[]" },
];

describe("CEO Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDelegationCount("test-conv");
    (db.getAgentsByCompany as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgents);
    (db.getMemory as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.createTask as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "task-123" });
    (db.logAgentAction as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  describe("query_all_agents", () => {
    it("returns status from all non-CEO agents", async () => {
      const result = await executeCeoTool(
        "query_all_agents",
        { question: "What's your status?" },
        "co-1"
      );
      expect(result).toContain("Agent Status Report");
      expect(result).toContain("@Sales");
      expect(result).toContain("@Marketing");
      expect(result).not.toContain("@CEO");
    });

    it("handles empty company", async () => {
      (db.getAgentsByCompany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const result = await executeCeoTool(
        "query_all_agents",
        { question: "Status?" },
        "co-1"
      );
      expect(result).toContain("No agents are currently active");
    });
  });

  describe("delegate_task", () => {
    it("creates a task for the target agent", async () => {
      const result = await executeCeoTool(
        "delegate_task",
        { target_agent_role: "Sales", task_title: "Run pipeline review" },
        "co-1",
        "test-conv"
      );
      expect(result).toContain("Task delegated to **@Sales**");
      expect(db.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_id: "sales-1",
          type: "ceo_delegation",
          title: "Run pipeline review",
        })
      );
    });

    it("rejects self-delegation", async () => {
      const result = await executeCeoTool(
        "delegate_task",
        { target_agent_role: "CEO", task_title: "Do stuff" },
        "co-1",
        "test-conv"
      );
      expect(result).toContain("Cannot delegate tasks to yourself");
      expect(db.createTask).not.toHaveBeenCalled();
    });

    it("rejects invalid role", async () => {
      const result = await executeCeoTool(
        "delegate_task",
        { target_agent_role: "Nonexistent", task_title: "Do stuff" },
        "co-1",
        "test-conv"
      );
      expect(result).toContain("No Nonexistent agent found");
      expect(result).toContain("Available agents");
    });

    it("enforces delegation limit", async () => {
      // Create 10 delegations
      for (let i = 0; i < 10; i++) {
        await executeCeoTool(
          "delegate_task",
          { target_agent_role: "Sales", task_title: `Task ${i}` },
          "co-1",
          "test-conv"
        );
      }
      // 11th should be blocked
      const result = await executeCeoTool(
        "delegate_task",
        { target_agent_role: "Sales", task_title: "One more" },
        "co-1",
        "test-conv"
      );
      expect(result).toContain("Delegation limit reached");
    });
  });

  describe("get_company_metrics", () => {
    it("returns formatted metrics", async () => {
      (db.getTasksByCompany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { status: "done" },
        { status: "failed" },
        { status: "queued" },
      ]);
      (db.getUsage as ReturnType<typeof vi.fn>).mockResolvedValue({
        task_count: 10,
        message_count: 50,
      });
      (db.getActivityFeed as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await executeCeoTool(
        "get_company_metrics",
        { period: "week" },
        "co-1"
      );
      expect(result).toContain("Company Metrics");
      expect(result).toContain("Completed: 1");
      expect(result).toContain("Failed: 1");
    });
  });
});
