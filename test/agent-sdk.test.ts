/**
 * Unit tests for the agent SDK contract (src/lib/agent-sdk.ts).
 *
 * Validates that defineAgent() catches structural mistakes at module-load
 * time. Also verifies the A4 Bank Recon reference example registers
 * cleanly against the contract.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  defineAgent,
  BudgetExceededError,
  InputValidationError,
  OutputValidationError,
} from "@/lib/agent-sdk";
import { a4BankReconAgent } from "@/lib/packs/ca-firm/a4-bank-recon";

const validBudget = { maxTokens: 1000, maxToolCalls: 5, timeoutMs: 60_000 };
const validObs = { traceLevel: "minimal" as const };
const validInput = z.object({});
const validOutput = z.object({});
const validConfig = { schema: z.object({}) };
const validPrompt = { system: "s", user: "u" };
const validTrigger = { kind: "manual" as const };

const baseValidDef = {
  id: "test_agent",
  cluster: "test",
  name: "Test Agent",
  description: "A test agent",
  trigger: validTrigger,
  input: validInput,
  output: validOutput,
  prompt: validPrompt,
  config: validConfig,
  budget: validBudget,
  observability: validObs,
};

describe("defineAgent", () => {
  it("accepts a fully-valid definition", () => {
    expect(() => defineAgent(baseValidDef)).not.toThrow();
    const agent = defineAgent(baseValidDef);
    expect(agent.id).toBe("test_agent");
  });

  it("rejects an empty id", () => {
    expect(() => defineAgent({ ...baseValidDef, id: "" })).toThrow(/invalid definition/);
  });

  it("rejects an id with uppercase letters", () => {
    expect(() => defineAgent({ ...baseValidDef, id: "TestAgent" })).toThrow(
      /lowercase letters, digits, underscore/
    );
  });

  it("rejects an id with hyphens", () => {
    expect(() => defineAgent({ ...baseValidDef, id: "test-agent" })).toThrow(
      /lowercase letters, digits, underscore/
    );
  });

  it("rejects budget with zero maxTokens", () => {
    expect(() =>
      defineAgent({ ...baseValidDef, budget: { ...validBudget, maxTokens: 0 } })
    ).toThrow(/invalid definition/);
  });

  it("rejects budget with negative timeoutMs", () => {
    expect(() =>
      defineAgent({ ...baseValidDef, budget: { ...validBudget, timeoutMs: -1 } })
    ).toThrow(/invalid definition/);
  });

  it("accepts maxToolCalls=0 (valid: agent with no tool use)", () => {
    expect(() =>
      defineAgent({ ...baseValidDef, budget: { ...validBudget, maxToolCalls: 0 } })
    ).not.toThrow();
  });

  it("rejects observability traceLevel that's not minimal/full", () => {
    expect(() =>
      defineAgent({
        ...baseValidDef,
        observability: { traceLevel: "verbose" as unknown as "minimal" | "full" },
      })
    ).toThrow(/invalid definition/);
  });

  it("rejects when trigger is missing", () => {
    const def = { ...baseValidDef } as Partial<typeof baseValidDef>;
    delete def.trigger;
    expect(() => defineAgent(def as typeof baseValidDef)).toThrow(
      /trigger\/input\/output\/prompt\/config are all required/
    );
  });

  it("rejects when prompt is missing", () => {
    const def = { ...baseValidDef } as Partial<typeof baseValidDef>;
    delete def.prompt;
    expect(() => defineAgent(def as typeof baseValidDef)).toThrow(
      /trigger\/input\/output\/prompt\/config are all required/
    );
  });

  it("rejects when config is missing", () => {
    const def = { ...baseValidDef } as Partial<typeof baseValidDef>;
    delete def.config;
    expect(() => defineAgent(def as typeof baseValidDef)).toThrow(
      /trigger\/input\/output\/prompt\/config are all required/
    );
  });
});

describe("A4 Bank Recon reference example", () => {
  it("compiles and registers against the contract", () => {
    expect(a4BankReconAgent.id).toBe("finance_a4_bank_recon");
    expect(a4BankReconAgent.cluster).toBe("finance");
    expect(a4BankReconAgent.trigger.kind).toBe("schedule");
  });

  it("declares a sensible budget for the use case", () => {
    expect(a4BankReconAgent.budget.maxTokens).toBeGreaterThanOrEqual(10_000);
    expect(a4BankReconAgent.budget.timeoutMs).toBeGreaterThanOrEqual(60_000);
    expect(a4BankReconAgent.budget.maxToolCalls).toBeGreaterThanOrEqual(2);
  });

  it("uses full Langfuse tracing (finance-critical)", () => {
    expect(a4BankReconAgent.observability.traceLevel).toBe("full");
  });

  it("input schema validates ISO date format", () => {
    expect(() => a4BankReconAgent.input.parse({ date: "2026-05-01" })).not.toThrow();
    expect(() => a4BankReconAgent.input.parse({ date: "05/01/2026" })).toThrow();
    expect(() => a4BankReconAgent.input.parse({ date: "" })).toThrow();
  });

  it("output schema rejects negative matchedCount", () => {
    expect(() =>
      a4BankReconAgent.output.parse({
        matchedCount: -1,
        unmatchedItems: [],
        reconRunDurationMs: 100,
      })
    ).toThrow();
  });

  it("output schema accepts a valid recon result with exceptions", () => {
    const valid = {
      matchedCount: 42,
      unmatchedItems: [
        {
          ledgerEntryId: "L123",
          amount: 5000.0,
          narration: "ACME Corp consulting fee",
          reason: "no_bank_match",
          suggestedAction: "Verify with finance whether payment was received late",
        },
      ],
      reconRunDurationMs: 1234,
    };
    expect(() => a4BankReconAgent.output.parse(valid)).not.toThrow();
  });

  it("config schema enforces valid WhatsApp phone format", () => {
    const cfg = a4BankReconAgent.config.schema;
    expect(() =>
      cfg.parse({
        dateMismatchWindowDays: 7,
        fuzzyMatchThreshold: 0.85,
        reconAlertWhatsAppPhone: "+919876543210",
      })
    ).not.toThrow();
    expect(() =>
      cfg.parse({
        dateMismatchWindowDays: 7,
        fuzzyMatchThreshold: 0.85,
        reconAlertWhatsAppPhone: "9876543210", // missing +
      })
    ).toThrow();
  });

  it("registers the two expected tools", () => {
    expect(a4BankReconAgent.tools).toHaveLength(2);
    const names = a4BankReconAgent.tools!.map((t) => t.name);
    expect(names).toContain("fetch_bank_statement");
    expect(names).toContain("fetch_ledger_entries");
  });
});

describe("SDK error classes", () => {
  it("BudgetExceededError carries the specific limit", () => {
    const err = new BudgetExceededError("maxTokens", 50_001, 50_000);
    expect(err.limit).toBe("maxTokens");
    expect(err.used).toBe(50_001);
    expect(err.cap).toBe(50_000);
    expect(err.message).toMatch(/maxTokens.*50001.*50000/);
  });

  it("InputValidationError carries Zod issues", () => {
    const schema = z.object({ x: z.number() });
    const result = schema.safeParse({ x: "not-a-number" });
    if (!result.success) {
      const err = new InputValidationError(result.error.issues);
      expect(err.issues.length).toBeGreaterThan(0);
      expect(err.message).toMatch(/Agent input validation failed/);
    } else {
      throw new Error("expected schema parse to fail");
    }
  });

  it("OutputValidationError carries Zod issues", () => {
    const schema = z.object({ x: z.number() });
    const result = schema.safeParse({ x: "bad" });
    if (!result.success) {
      const err = new OutputValidationError(result.error.issues);
      expect(err.issues.length).toBeGreaterThan(0);
      expect(err.message).toMatch(/Agent output validation failed/);
    } else {
      throw new Error("expected schema parse to fail");
    }
  });
});
