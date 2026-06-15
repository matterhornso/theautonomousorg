import { describe, it, expect } from "vitest";
import {
  safeSecretEqual,
  isPubliclyFetchableHttpUrl,
} from "@/lib/request-guards";

describe("safeSecretEqual", () => {
  it("returns true only for an exact match", () => {
    expect(safeSecretEqual("s3cret", "s3cret")).toBe(true);
    expect(safeSecretEqual("s3cret", "s3crew")).toBe(false);
    expect(safeSecretEqual("s3cret", "s3cret ")).toBe(false); // length differs
  });

  it("fails closed when either side is missing/empty", () => {
    expect(safeSecretEqual(undefined, "x")).toBe(false);
    expect(safeSecretEqual("x", undefined)).toBe(false);
    expect(safeSecretEqual("", "")).toBe(false);
    expect(safeSecretEqual(null, null)).toBe(false);
  });
});

describe("isPubliclyFetchableHttpUrl (SSRF guard)", () => {
  it("allows public https URLs", () => {
    expect(isPubliclyFetchableHttpUrl("https://cdn.example.com/a.mp3")).toBe(true);
    expect(isPubliclyFetchableHttpUrl("https://1.2.3.4/a.mp3")).toBe(true);
  });

  it("blocks non-https schemes", () => {
    expect(isPubliclyFetchableHttpUrl("http://example.com/a.mp3")).toBe(false);
    expect(isPubliclyFetchableHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isPubliclyFetchableHttpUrl("data:audio/mp3;base64,AAAA")).toBe(false);
    expect(isPubliclyFetchableHttpUrl("not a url")).toBe(false);
  });

  it("blocks loopback, private, and link-local hosts (cloud metadata)", () => {
    expect(isPubliclyFetchableHttpUrl("https://localhost/a")).toBe(false);
    expect(isPubliclyFetchableHttpUrl("https://127.0.0.1/a")).toBe(false);
    expect(isPubliclyFetchableHttpUrl("https://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isPubliclyFetchableHttpUrl("https://10.0.0.5/a")).toBe(false);
    expect(isPubliclyFetchableHttpUrl("https://192.168.1.10/a")).toBe(false);
    expect(isPubliclyFetchableHttpUrl("https://172.16.4.4/a")).toBe(false);
    expect(isPubliclyFetchableHttpUrl("https://foo.internal/a")).toBe(false);
    expect(isPubliclyFetchableHttpUrl("https://printer.local/a")).toBe(false);
  });
});
