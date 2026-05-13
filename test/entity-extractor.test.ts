import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAnthropicCreate } = vi.hoisted(() => ({
  mockAnthropicCreate: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockAnthropicCreate };
  },
}));

vi.mock("@/lib/knowledge-graph", () => ({
  createConversation: vi.fn(),
  createPerson: vi.fn(),
  createDecision: vi.fn(),
  createCommitment: vi.fn(),
  createEdge: vi.fn(),
}));

import { ingestConversation, __test__ } from "@/lib/entity-extractor";
import * as kg from "@/lib/knowledge-graph";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("normalizeBundle", () => {
  it("strips out malformed entries", () => {
    const out = __test__.normalizeBundle({
      persons: [
        { name: "Alice" },
        { name: "" } as unknown as { name: string },
        { name: "Bob", email: "b@x.com" },
      ],
      decisions: [
        { title: "Ship Q3 plan" },
        { title: "  " } as unknown as { title: string },
      ],
      commitments: [
        { description: "Send MSA by Friday" },
        { description: "" } as unknown as { description: string },
      ],
    });
    expect(out.persons.map((p) => p.name)).toEqual(["Alice", "Bob"]);
    expect(out.decisions.map((d) => d.title)).toEqual(["Ship Q3 plan"]);
    expect(out.commitments.map((c) => c.description)).toEqual([
      "Send MSA by Friday",
    ]);
  });

  it("handles non-array inputs without throwing", () => {
    const out = __test__.normalizeBundle({
      persons: "not-an-array" as unknown as never,
      decisions: undefined as unknown as never,
      commitments: null as unknown as never,
    });
    expect(out).toEqual({ persons: [], decisions: [], commitments: [] });
  });
});

describe("ingestConversation", () => {
  it("returns empty result + llmRan=false when createConversation returns null (no DB)", async () => {
    (kg.createConversation as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const out = await ingestConversation({
      companyId: "co-1",
      text: "stuff",
    });
    expect(out.conversation).toBeNull();
    expect(out.llmRan).toBe(false);
    expect(out.personIds).toEqual([]);
    expect(out.decisionIds).toEqual([]);
    expect(out.commitmentIds).toEqual([]);
    expect(out.edgesCreated).toBe(0);
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it("persists conversation and llmRan=false when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const conv = {
      id: "conv-1",
      companyId: "co-1",
      kind: "note" as const,
      transcript: "",
      metadata: {},
      createdAt: new Date(),
    };
    (kg.createConversation as ReturnType<typeof vi.fn>).mockResolvedValue(conv);
    const out = await ingestConversation({
      companyId: "co-1",
      text: "no key path",
    });
    expect(out.conversation).toEqual(conv);
    expect(out.llmRan).toBe(false);
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it("persists persons + decisions + commitments + edges from a Claude tool_use response", async () => {
    const conv = {
      id: "conv-2",
      companyId: "co-1",
      kind: "meeting" as const,
      title: "Acme kickoff",
      transcript: "",
      metadata: {},
      createdAt: new Date(),
    };
    (kg.createConversation as ReturnType<typeof vi.fn>).mockResolvedValue(conv);
    (kg.createPerson as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ name }: { name: string }) => ({
        id: `person-${name.toLowerCase().replace(/\s+/g, "-")}`,
        companyId: "co-1",
        name,
        isExternal: true,
        metadata: {},
        createdAt: new Date(),
      })
    );
    (kg.createDecision as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ title }: { title: string }) => ({
        id: `dec-${title.toLowerCase().replace(/\s+/g, "-")}`,
        companyId: "co-1",
        title,
        metadata: {},
        createdAt: new Date(),
      })
    );
    (kg.createCommitment as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ description }: { description: string }) => ({
        id: `commit-${description.length}`,
        companyId: "co-1",
        description,
        status: "open" as const,
        metadata: {},
        createdAt: new Date(),
      })
    );
    (kg.createEdge as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "edge-x",
    });
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          id: "t-1",
          name: "extract_entities",
          input: {
            persons: [
              { name: "Alice Chen", email: "alice@acme.com", isExternal: true },
              { name: "Bob Yuen", role: "Founder", isExternal: false },
            ],
            decisions: [
              { title: "Ship Q3 plan", category: "gtm", decidedBy: "Bob Yuen" },
            ],
            commitments: [
              {
                description: "Send pricing proposal by Friday",
                committedByName: "Bob Yuen",
                committedToName: "Alice Chen",
              },
            ],
          },
        },
      ],
    });

    const out = await ingestConversation({
      companyId: "co-1",
      text: "transcript body",
      kind: "meeting",
      title: "Acme kickoff",
    });

    expect(out.conversation).toEqual(conv);
    expect(out.llmRan).toBe(true);
    expect(out.personIds).toHaveLength(2);
    expect(out.decisionIds).toHaveLength(1);
    expect(out.commitmentIds).toHaveLength(1);
    // edges: 2 person→conversation + 1 conversation→decision + 1 conversation→commitment
    expect(out.edgesCreated).toBe(4);

    // commitment.committedBy + committedTo resolved by name
    const commitmentCall = (kg.createCommitment as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    expect(commitmentCall.committedBy).toBe("person-bob-yuen");
    expect(commitmentCall.committedTo).toBe("person-alice-chen");
    expect(commitmentCall.sourceConversationId).toBe("conv-2");
  });

  it("survives a Claude error and reports llmRan=false but keeps the conversation", async () => {
    const conv = {
      id: "conv-3",
      companyId: "co-1",
      kind: "note" as const,
      transcript: "",
      metadata: {},
      createdAt: new Date(),
    };
    (kg.createConversation as ReturnType<typeof vi.fn>).mockResolvedValue(conv);
    mockAnthropicCreate.mockRejectedValueOnce(new Error("anthropic 429"));
    const out = await ingestConversation({
      companyId: "co-1",
      text: "fail path",
    });
    expect(out.conversation).toEqual(conv);
    expect(out.llmRan).toBe(false);
    expect(kg.createPerson).not.toHaveBeenCalled();
  });
});
