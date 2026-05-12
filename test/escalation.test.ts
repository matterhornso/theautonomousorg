/**
 * Unit tests for src/lib/escalation.ts. Mocks postgres + injects a mock
 * WhatsAppHelper.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const { sqlMock } = vi.hoisted(() => {
  const sql = vi.fn();
  return { sqlMock: sql };
});

vi.mock("@/lib/db-postgres", () => ({
  sql: sqlMock,
}));

import { buildEscalationHelper } from "@/lib/escalation";
import type { WhatsAppHelper } from "@/lib/agent-sdk-helpers";

function makeMockWhatsApp(): { helper: WhatsAppHelper; sendNotification: ReturnType<typeof vi.fn> } {
  const sendNotification = vi.fn().mockResolvedValue({ messageId: "msg_1" });
  const sendApprovalCard = vi.fn().mockResolvedValue({ cardId: "card_1", messageId: "msg_2" });
  return {
    sendNotification,
    helper: {
      sendNotification,
      sendApprovalCard,
    } as WhatsAppHelper,
  };
}

describe("buildEscalationHelper", () => {
  beforeEach(() => {
    sqlMock.mockReset();
  });

  it("handoff inserts an inter_agent_messages row", async () => {
    const { helper } = makeMockWhatsApp();
    const escalation = buildEscalationHelper({
      firmId: "firm_a",
      agentId: "finance_a4_bank_recon",
      runId: "run_42",
      whatsapp: helper,
      resolveSpocPhone: async () => "+919999911111",
    });
    sqlMock.mockResolvedValueOnce([]);
    await escalation.handoff({
      toAgentId: "finance_t1_timesheet",
      reason: "Out of scope",
      context: { unmatchedItem: "abc" },
    });
    expect(sqlMock).toHaveBeenCalledTimes(1);
    const values = sqlMock.mock.calls[0].slice(1) as unknown[];
    expect(values).toContain("finance_a4_bank_recon");
    expect(values).toContain("finance_t1_timesheet");
    const requestJson = values.find((v) => typeof v === "string" && v.includes("Out of scope"));
    expect(requestJson).toBeTruthy();
    expect(JSON.parse(requestJson as string)).toMatchObject({
      reason: "Out of scope",
      fromRunId: "run_42",
      context: { unmatchedItem: "abc" },
    });
  });

  it("alertSpoc persists a notification AND sends WhatsApp", async () => {
    const { helper, sendNotification } = makeMockWhatsApp();
    const escalation = buildEscalationHelper({
      firmId: "firm_a",
      agentId: "agent_x",
      runId: "run_x",
      whatsapp: helper,
      resolveSpocPhone: async () => "+919999911111",
    });
    sqlMock.mockResolvedValueOnce([]); // INSERT into admin_notifications
    await escalation.alertSpoc({
      severity: "P2",
      subject: "Tally on-prem agent unreachable",
      detail: "ECONNREFUSED on port 9000",
    });
    expect(sqlMock).toHaveBeenCalledTimes(1);
    const values = sqlMock.mock.calls[0].slice(1) as unknown[];
    expect(values).toContain("firm_a");
    expect(values).toContain("P2");
    expect(values).toContain("spoc_alert");
    expect(values).toContain("Tally on-prem agent unreachable");

    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendNotification.mock.calls[0][0]).toMatchObject({
      to: "+919999911111",
      body: expect.stringContaining("[P2]"),
    });
  });

  it("alertSpoc still persists when WhatsApp send throws", async () => {
    const sendNotification = vi.fn().mockRejectedValue(new Error("Gupshup down"));
    const helper = {
      sendNotification,
      sendApprovalCard: vi.fn(),
    } as unknown as WhatsAppHelper;
    const escalation = buildEscalationHelper({
      firmId: "firm_a",
      agentId: "agent_x",
      runId: "run_x",
      whatsapp: helper,
      resolveSpocPhone: async () => "+919999911111",
    });
    sqlMock.mockResolvedValueOnce([]);
    await expect(
      escalation.alertSpoc({ severity: "P1", subject: "boom", detail: "oh no" })
    ).resolves.toBeUndefined();
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("alertSpoc skips WhatsApp when no SPOC phone is configured", async () => {
    const { helper, sendNotification } = makeMockWhatsApp();
    const escalation = buildEscalationHelper({
      firmId: "firm_a",
      agentId: "agent_x",
      runId: "run_x",
      whatsapp: helper,
      resolveSpocPhone: async () => null,
    });
    sqlMock.mockResolvedValueOnce([]);
    await escalation.alertSpoc({ severity: "P3", subject: "minor", detail: "fyi" });
    expect(sqlMock).toHaveBeenCalledTimes(1);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("escalateToHuman writes a notification with role_hint", async () => {
    const { helper } = makeMockWhatsApp();
    const escalation = buildEscalationHelper({
      firmId: "firm_a",
      agentId: "agent_x",
      runId: "run_x",
      whatsapp: helper,
      resolveSpocPhone: async () => "+919999911111",
    });
    sqlMock.mockResolvedValueOnce([]);
    await escalation.escalateToHuman({
      roleHint: "partner",
      subject: "Approval needed",
      detail: "₹5L sign-off",
    });
    const values = sqlMock.mock.calls[0].slice(1) as unknown[];
    expect(values).toContain("partner");
    expect(values).toContain("human_escalation");
  });

  it("when DATABASE_URL is missing, handoff is a no-op (logs only)", async () => {
    vi.doMock("@/lib/db-postgres", () => ({ sql: null }));
    vi.resetModules();
    const { buildEscalationHelper: build } = await import("@/lib/escalation");
    const { helper } = makeMockWhatsApp();
    const escalation = build({
      firmId: "firm_a",
      agentId: "agent_x",
      runId: "run_x",
      whatsapp: helper,
      resolveSpocPhone: async () => null,
    });
    await expect(
      escalation.handoff({ toAgentId: "agent_y", reason: "test" })
    ).resolves.toBeUndefined();
    // Restore for other tests in this file (vi.resetModules + remock).
    vi.doUnmock("@/lib/db-postgres");
  });
});
