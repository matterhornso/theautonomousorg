import { describe, it, expect } from "vitest";
import { getTaskTemplatesForRole, cronTemplates } from "@/lib/task-templates";
import type { Analysis } from "@/lib/types";

const mockAnalysis: Analysis = {
  company: {
    name: "TestCo",
    industry: "SaaS",
    description: "A project management tool for small teams",
    stage: "startup",
  },
  recommendations: [
    {
      role: "Sales",
      impact: "high",
      reason: "Need outbound",
      example: "Email sequences",
    },
  ],
  summary: "TestCo needs sales help",
};

describe("Task Templates", () => {
  it("returns Sales-specific templates", () => {
    const templates = getTaskTemplatesForRole("Sales", mockAnalysis);
    expect(templates.length).toBe(2);
    expect(templates[0].type).toBe("icp_research");
    expect(templates[1].type).toBe("outbound_sequences");
    expect(templates[0].prompt).toContain("TestCo");
  });

  it("returns Marketing-specific templates", () => {
    const templates = getTaskTemplatesForRole("Marketing", mockAnalysis);
    expect(templates.length).toBe(2);
    expect(templates[0].type).toBe("seo_audit");
    expect(templates[0].prompt).toContain("SaaS");
  });

  it("returns Strategy-specific templates", () => {
    const templates = getTaskTemplatesForRole("Strategy", mockAnalysis);
    expect(templates.length).toBe(1);
    expect(templates[0].type).toBe("competitive_landscape");
  });

  it("returns Product-specific templates", () => {
    const templates = getTaskTemplatesForRole("Product", mockAnalysis);
    expect(templates.length).toBe(1);
    expect(templates[0].type).toBe("user_personas");
  });

  it("returns specific template for Customer Success", () => {
    const templates = getTaskTemplatesForRole("Customer Success", mockAnalysis);
    expect(templates.length).toBe(1);
    expect(templates[0].type).toBe("customer_health_check");
    expect(templates[0].prompt).toContain("TestCo");
  });

  it("returns generic template for truly unknown roles", () => {
    const templates = getTaskTemplatesForRole("Totally Unknown Role", mockAnalysis);
    expect(templates.length).toBe(1);
    expect(templates[0].type).toBe("introduction");
  });

  it("includes company name in all prompts", () => {
    const roles = [
      "Sales",
      "Marketing",
      "Strategy",
      "Product",
      "Accounting",
      "HR",
    ];
    for (const role of roles) {
      const templates = getTaskTemplatesForRole(role, mockAnalysis);
      for (const t of templates) {
        expect(t.prompt).toContain("TestCo");
      }
    }
  });

  it("includes industry context in prompts", () => {
    const templates = getTaskTemplatesForRole("Sales", mockAnalysis);
    expect(templates[0].prompt).toContain("SaaS");
  });

  it("returns CEO-specific templates", () => {
    const templates = getTaskTemplatesForRole("CEO", mockAnalysis);
    expect(templates.length).toBe(1);
    expect(templates[0].type).toBe("executive_assessment");
    expect(templates[0].prompt).toContain("TestCo");
  });

  it("returns HR-specific templates", () => {
    const templates = getTaskTemplatesForRole("HR", mockAnalysis);
    expect(templates.length).toBe(1);
    expect(templates[0].type).toBe("hiring_pipeline");
  });

  it("returns Finance-specific templates", () => {
    const templates = getTaskTemplatesForRole("Finance", mockAnalysis);
    expect(templates.length).toBe(1);
    expect(templates[0].type).toBe("monthly_financial_review");
  });

  it("returns Legal-specific templates", () => {
    const templates = getTaskTemplatesForRole("Legal", mockAnalysis);
    expect(templates.length).toBe(1);
    expect(templates[0].type).toBe("compliance_audit");
  });

  it("returns Admin-specific templates", () => {
    const templates = getTaskTemplatesForRole("Admin", mockAnalysis);
    expect(templates.length).toBe(1);
    expect(templates[0].type).toBe("operations_setup");
  });

  it("returns Data Analyst-specific templates", () => {
    const templates = getTaskTemplatesForRole("Data Analyst", mockAnalysis);
    expect(templates.length).toBe(1);
    expect(templates[0].type).toBe("analytics_setup");
  });
});

describe("Cron Templates", () => {
  it("has templates for key roles", () => {
    const roles = cronTemplates.map((t) => t.role);
    expect(roles).toContain("Sales");
    expect(roles).toContain("Marketing");
    expect(roles).toContain("Strategy");
    expect(roles).toContain("CEO");
    expect(roles).toContain("HR");
    expect(roles).toContain("Accounting");
    expect(roles).toContain("Product");
  });

  it("has valid cron expressions", () => {
    for (const t of cronTemplates) {
      expect(t.cron_expression).toMatch(/^[0-9*,/-]+(\s[0-9*,/-]+){4}$/);
    }
  });

  it("has unique IDs", () => {
    const ids = cronTemplates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has non-empty prompts and descriptions", () => {
    for (const t of cronTemplates) {
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.prompt.length).toBeGreaterThan(0);
      expect(t.cron_human.length).toBeGreaterThan(0);
    }
  });
});
