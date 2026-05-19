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
  getOpenCommitments: vi.fn(),
  getRecentConversations: vi.fn(),
  getRecentDecisions: vi.fn(),
}));

import { generateBrief, __test__ } from "@/lib/brief";
import * as kg from "@/lib/knowledge-graph";

const baseDate = new Date("2026-05-10T12:00:00Z");

const fixtureCommitments = [
  {
    id: "commit-1",
    companyId: "co-1",
    description: "Send updated pricing to Alice next week",
    status: "open" as const,
    dueAt: new Date("2026-05-20T17:00:00Z"),
    metadata: {},
    createdAt: baseDate,
  },
  {
    id: "commit-2",
    companyId: "co-1",
    description: "Unrelated task for someone else",
    status: "open" as const,
    metadata: {},
    createdAt: baseDate,
  },
];

const fixtureConversations = [
  {
    id: "conv-1",
    companyId: "co-1",
    kind: "meeting" as const,
    title: "Acme kickoff with Alice",
    transcript: "Discussed onboarding plan with Alice and Bob.",
    occurredAt: new Date("2026-05-05T15:00:00Z"),
    metadata: {},
    createdAt: baseDate,
  },
  {
    id: "conv-2",
    companyId: "co-1",
    kind: "call" as const,
    title: "Internal review",
    transcript: "Team-only sync, no external attendees.",
    occurredAt: baseDate,
    metadata: {},
    createdAt: baseDate,
  },
];

const fixtureDecisions = [
  {
    id: "dec-1",
    companyId: "co-1",
    title: "Ship Q3 plan",
    detail: "Approved by the founder.",
    decidedBy: "Bob",
    category: "gtm",
    metadata: {},
    createdAt: baseDate,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  (kg.getOpenCommitments as ReturnType<typeof vi.fn>).mockResolvedValue(
    fixtureCommitments
  );
  (kg.getRecentConversations as ReturnType<typeof vi.fn>).mockResolvedValue(
    fixtureConversations
  );
  (kg.getRecentDecisions as ReturnType<typeof vi.fn>).mockResolvedValue(
    fixtureDecisions
  );
});

describe("generateBrief — relevance filtering", () => {
  it("only includes commitments/conversations matching attendee names", async () => {
    const out = await generateBrief(
      {
        companyId: "co-1",
        eventTitle: "Acme follow-up",
        attendees: ["Alice"],
      },
      // No client + no env key → deterministic render path
      { client: undefined }
    );
    delete process.env.ANTHROPIC_API_KEY;
    // Already empty in test runner, but be defensive.
    expect(out.sources.commitmentIds).toEqual(["commit-1"]);
    expect(out.sources.conversationIds).toEqual(["conv-1"]);
    expect(out.sources.decisionIds).toEqual(["dec-1"]);
  });

  it("returns all items when no attendees are supplied", async () => {
    const out = await generateBrief({
      companyId: "co-1",
      eventTitle: "Board sync",
      attendees: [],
    });
    expect(out.sources.commitmentIds).toEqual(["commit-1", "commit-2"]);
  });
});

describe("generateBrief — deterministic render fallback", () => {
  it("falls back when ANTHROPIC_API_KEY is missing", async () => {
    const origKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const out = await generateBrief({
        companyId: "co-1",
        eventTitle: "Acme follow-up",
        attendees: ["Alice"],
      });
      expect(out.llmRan).toBe(false);
      expect(out.markdown).toContain("# Pre-meeting brief: Acme follow-up");
      expect(out.markdown).toContain("Send updated pricing to Alice");
      expect(out.markdown).toContain("Ship Q3 plan");
      expect(mockAnthropicCreate).not.toHaveBeenCalled();
    } finally {
      if (origKey !== undefined) process.env.ANTHROPIC_API_KEY = origKey;
    }
  });
});

describe("generateBrief — Claude synthesis path", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("calls Claude and returns its markdown", async () => {
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: "## Why this meeting matters\n- Alice is your biggest deal.",
        },
      ],
    });
    const out = await generateBrief({
      companyId: "co-1",
      eventTitle: "Acme follow-up",
      attendees: ["Alice"],
    });
    expect(out.llmRan).toBe(true);
    expect(out.markdown).toContain("Why this meeting matters");
    expect(out.markdown).toContain("Alice");
  });

  it("falls back to deterministic render on Claude error", async () => {
    mockAnthropicCreate.mockRejectedValueOnce(new Error("429 rate limit"));
    const out = await generateBrief({
      companyId: "co-1",
      eventTitle: "Acme follow-up",
      attendees: ["Alice"],
    });
    expect(out.llmRan).toBe(false);
    expect(out.markdown).toContain("Pre-meeting brief");
  });
});

describe("buildBriefPrompt", () => {
  it("emits the structured payload Claude expects", () => {
    const prompt = __test__.buildBriefPrompt(
      {
        companyId: "co-1",
        eventTitle: "Acme follow-up",
        attendees: ["Alice"],
        occurredAt: new Date("2026-06-01T10:00:00Z"),
      },
      {
        commitments: [fixtureCommitments[0]],
        conversations: [fixtureConversations[0]],
        decisions: fixtureDecisions,
      }
    );
    expect(prompt).toContain("Meeting: Acme follow-up");
    expect(prompt).toContain("When: 2026-06-01T10:00:00.000Z");
    expect(prompt).toContain("Attendees: Alice");
    expect(prompt).toContain("Commitments (open)");
    expect(prompt).toContain("Send updated pricing");
    expect(prompt).toContain("Conversations (recent)");
  });
});
