import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";

// Test the HMAC verification logic directly
function verifySecret(
  payload: string,
  secret: string,
  signatureHeader: string | null
): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  const sig = signatureHeader.replace(/^sha256=/, "");
  if (sig.length !== expected.length) return false;
  try {
    return (
      Buffer.from(sig).toString("hex") === Buffer.from(expected).toString("hex")
    );
  } catch {
    return false;
  }
}

describe("Webhook HMAC Verification", () => {
  const secret = "test-secret-key-12345";
  const payload = JSON.stringify({ event: "test", data: { id: 1 } });

  it("accepts valid signature with sha256= prefix", () => {
    const sig = createHmac("sha256", secret).update(payload).digest("hex");
    expect(verifySecret(payload, secret, `sha256=${sig}`)).toBe(true);
  });

  it("accepts valid signature without prefix", () => {
    const sig = createHmac("sha256", secret).update(payload).digest("hex");
    expect(verifySecret(payload, secret, sig)).toBe(true);
  });

  it("rejects invalid signature", () => {
    expect(verifySecret(payload, secret, "sha256=invalid-hex-value-here-0000")).toBe(false);
  });

  it("rejects null signature header", () => {
    expect(verifySecret(payload, secret, null)).toBe(false);
  });

  it("rejects empty signature header", () => {
    expect(verifySecret(payload, secret, "")).toBe(false);
  });

  it("rejects signature from wrong secret", () => {
    const wrongSig = createHmac("sha256", "wrong-secret")
      .update(payload)
      .digest("hex");
    expect(verifySecret(payload, secret, `sha256=${wrongSig}`)).toBe(false);
  });

  it("rejects signature from wrong payload", () => {
    const sig = createHmac("sha256", secret)
      .update("different-payload")
      .digest("hex");
    expect(verifySecret(payload, secret, `sha256=${sig}`)).toBe(false);
  });
});
