import { describe, it, expect, beforeAll } from "vitest";
import {
  storeUserApiKey,
  getUserApiKey,
  getUserApiKeys,
  deleteUserApiKey,
  createCompany,
} from "@/lib/db";

let testCompanyId: string;

describe("User API Keys", () => {
  beforeAll(() => {
    const company = createCompany({
      user_id: "test-user-keys",
      name: "Key Test Co",
      url: "https://keytestco.com",
    });
    testCompanyId = company.id;
  });

  it("stores and retrieves an API key", () => {
    storeUserApiKey(testCompanyId, "apollo", "Apollo.io", "sk-test-123");
    const key = getUserApiKey(testCompanyId, "apollo");
    expect(key).toBe("sk-test-123");
  });

  it("lists keys without exposing raw values", () => {
    const keys = getUserApiKeys(testCompanyId);
    const apollo = keys.find((k) => k.service_name === "apollo");
    expect(apollo).toBeDefined();
    expect(apollo!.display_name).toBe("Apollo.io");
    // The list function should NOT include the raw key
    expect((apollo as unknown as Record<string, unknown>).api_key_encrypted).toBeUndefined();
  });

  it("upserts on duplicate service_name", () => {
    storeUserApiKey(testCompanyId, "apollo", "Apollo.io", "sk-updated-456");
    const key = getUserApiKey(testCompanyId, "apollo");
    expect(key).toBe("sk-updated-456");
  });

  it("deletes a key", () => {
    storeUserApiKey(testCompanyId, "temp_svc", "Temp", "sk-temp");
    deleteUserApiKey(testCompanyId, "temp_svc");
    const key = getUserApiKey(testCompanyId, "temp_svc");
    expect(key).toBeUndefined();
  });

  it("returns undefined for nonexistent service", () => {
    const key = getUserApiKey(testCompanyId, "nonexistent_service");
    expect(key).toBeUndefined();
  });
});
