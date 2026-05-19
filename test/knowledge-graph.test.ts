import { describe, it, expect, vi } from "vitest";

// In tests there is no DATABASE_URL so db-postgres.sql is null. Every
// knowledge-graph helper must degrade gracefully to a no-op / empty result.
vi.mock("@/lib/db-postgres", () => ({
  sql: null,
}));

import * as kg from "@/lib/knowledge-graph";

describe("knowledge-graph — graceful no-DB fallback", () => {
  it("createPerson returns null when DATABASE_URL is unset", async () => {
    expect(
      await kg.createPerson({ companyId: "co-1", name: "Test" })
    ).toBeNull();
  });

  it("createConversation returns null when DATABASE_URL is unset", async () => {
    expect(
      await kg.createConversation({
        companyId: "co-1",
        kind: "meeting",
        title: "Test",
      })
    ).toBeNull();
  });

  it("createDecision returns null when DATABASE_URL is unset", async () => {
    expect(
      await kg.createDecision({ companyId: "co-1", title: "Test" })
    ).toBeNull();
  });

  it("createCommitment returns null when DATABASE_URL is unset", async () => {
    expect(
      await kg.createCommitment({
        companyId: "co-1",
        description: "Test",
      })
    ).toBeNull();
  });

  it("createArtifact returns null when DATABASE_URL is unset", async () => {
    expect(
      await kg.createArtifact({
        companyId: "co-1",
        kind: "brief",
        title: "Test",
      })
    ).toBeNull();
  });

  it("createEdge returns null when DATABASE_URL is unset", async () => {
    expect(
      await kg.createEdge({
        companyId: "co-1",
        sourceType: "person",
        sourceId: "p-1",
        relation: "attended",
        targetType: "conversation",
        targetId: "c-1",
      })
    ).toBeNull();
  });

  it("getRecentConversations returns [] when DATABASE_URL is unset", async () => {
    expect(await kg.getRecentConversations("co-1")).toEqual([]);
  });

  it("getRecentDecisions returns [] when DATABASE_URL is unset", async () => {
    expect(await kg.getRecentDecisions("co-1")).toEqual([]);
  });

  it("getOpenCommitments returns [] when DATABASE_URL is unset", async () => {
    expect(await kg.getOpenCommitments("co-1")).toEqual([]);
  });

  it("getUpcomingEvents returns [] when DATABASE_URL is unset", async () => {
    expect(await kg.getUpcomingEvents("co-1")).toEqual([]);
  });

  it("getRecentArtifacts returns [] when DATABASE_URL is unset", async () => {
    expect(await kg.getRecentArtifacts("co-1")).toEqual([]);
  });

  it("getEdgesFrom returns [] when DATABASE_URL is unset", async () => {
    expect(
      await kg.getEdgesFrom("co-1", "person", "p-1")
    ).toEqual([]);
  });

  it("getEdgesTo returns [] when DATABASE_URL is unset", async () => {
    expect(
      await kg.getEdgesTo("co-1", "conversation", "c-1")
    ).toEqual([]);
  });

  it("createEventLog returns null when DATABASE_URL is unset", async () => {
    expect(
      await kg.createEventLog({
        companyId: "co-1",
        title: "Acme review",
        startsAt: new Date(),
      })
    ).toBeNull();
  });

  it("getEventsBetween returns [] when DATABASE_URL is unset", async () => {
    expect(
      await kg.getEventsBetween("co-1", new Date(), new Date())
    ).toEqual([]);
  });

  it("getEventsAcrossTenantsBetween returns [] when DATABASE_URL is unset", async () => {
    expect(
      await kg.getEventsAcrossTenantsBetween(new Date(), new Date())
    ).toEqual([]);
  });

  it("summarizeKnowledgeGraph returns all-zero counts when DATABASE_URL is unset", async () => {
    const summary = await kg.summarizeKnowledgeGraph("co-1");
    expect(summary).toEqual({
      persons: 0,
      conversations: 0,
      decisions: 0,
      openCommitments: 0,
      upcomingEvents: 0,
      artifacts: 0,
      edges: 0,
    });
  });
});
