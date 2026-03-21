import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/prompts";
import type { Analysis } from "@/lib/types";

const mockAnalysis: Analysis = {
  company: {
    name: "Acme Corp",
    industry: "E-commerce",
    description: "Online marketplace for handmade goods",
    stage: "growth",
  },
  recommendations: [
    {
      role: "Sales",
      impact: "high",
      reason: "Need to scale outbound",
      example: "Build prospect lists",
    },
    {
      role: "Marketing",
      impact: "high",
      reason: "SEO opportunity",
      example: "Content marketing",
    },
  ],
  summary: "Acme needs sales and marketing help",
};

const roster = [
  { role: "Sales", id: "agent-1" },
  { role: "Marketing", id: "agent-2" },
];

describe("System Prompts", () => {
  it("includes company name and industry", () => {
    const prompt = buildSystemPrompt("Sales", mockAnalysis, roster);
    expect(prompt).toContain("Acme Corp");
    expect(prompt).toContain("E-commerce");
    expect(prompt).toContain("Online marketplace for handmade goods");
  });

  it("includes role-specific instructions", () => {
    const salesPrompt = buildSystemPrompt("Sales", mockAnalysis, roster);
    expect(salesPrompt).toContain("BANT");
    expect(salesPrompt).toContain("pipeline");

    const mktgPrompt = buildSystemPrompt("Marketing", mockAnalysis, roster);
    expect(mktgPrompt).toContain("Content");
    expect(mktgPrompt).toContain("SEO");
  });

  it("includes recommendation reason", () => {
    const prompt = buildSystemPrompt("Sales", mockAnalysis, roster);
    expect(prompt).toContain("Need to scale outbound");
  });

  it("lists other agents in roster", () => {
    const prompt = buildSystemPrompt("Sales", mockAnalysis, roster);
    expect(prompt).toContain("@Marketing");
    expect(prompt).not.toContain("@Sales"); // Shouldn't list itself
  });

  it("handles unknown role gracefully", () => {
    const prompt = buildSystemPrompt("Unknown Role", mockAnalysis, roster);
    expect(prompt).toContain("Acme Corp");
    expect(prompt).toContain("Unknown Role");
  });

  it("includes skills and tools from registry", () => {
    const prompt = buildSystemPrompt("Sales", mockAnalysis, roster);
    // Registry skills are more detailed than data.ts skills
    expect(prompt).toContain("ICP definition");
    expect(prompt).toContain("Apollo.io");
  });

  it("includes collaboration guidelines", () => {
    const prompt = buildSystemPrompt("Sales", mockAnalysis, roster);
    expect(prompt).toContain("@AgentRole");
    expect(prompt).toContain("persistent memory");
  });
});
