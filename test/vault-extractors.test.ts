/**
 * Unit tests for src/lib/vault-extractors.ts.
 *
 * The structurally-valid test fixtures are synthetic (not real entities);
 * they're chosen to match the regex shape but are not registered with any
 * gov't portal. v2 will add a checksum-validation pass; v1 just shape-checks.
 */

import { describe, it, expect } from "vitest";
import {
  extractPans,
  extractGstins,
  extractCins,
  extractIfscs,
  extractAllEntities,
  mergeEntitiesIntoMetadata,
} from "@/lib/vault-extractors";

describe("PAN extraction", () => {
  it("matches a structurally-valid PAN", () => {
    expect(extractPans("My PAN is ABCPK1234E")).toEqual(["ABCPK1234E"]);
  });

  it("matches multiple PANs deduplicated", () => {
    const text = "Father: ABCPK1234E. Son: XYZAB5678F. Father again: ABCPK1234E.";
    expect(extractPans(text).sort()).toEqual(["ABCPK1234E", "XYZAB5678F"]);
  });

  it("rejects non-PAN strings of similar shape", () => {
    expect(extractPans("ABC1234567")).toEqual([]); // not the right pattern
    expect(extractPans("ABCPK12345")).toEqual([]); // wrong char count
  });

  it("rejects PANs whose 4th character isn't an entity-type letter", () => {
    expect(extractPans("ABCXX1234E")).toEqual([]);
  });

  it("normalizes lowercase to uppercase before matching", () => {
    expect(extractPans("my pan is abcpk1234e")).toEqual(["ABCPK1234E"]);
  });
});

describe("GSTIN extraction", () => {
  it("matches a 15-char GSTIN", () => {
    expect(extractGstins("Vendor 27ABCPK1234E1Z5 invoiced ₹12K")).toEqual([
      "27ABCPK1234E1Z5",
    ]);
  });

  it("rejects strings missing the constant Z at position 13", () => {
    expect(extractGstins("27ABCPK1234E1A5")).toEqual([]);
  });

  it("does not match when the GSTIN is glued to other alphanumerics", () => {
    // \b enforces a word boundary; a trailing alphanumeric char prevents the match.
    expect(extractGstins("27ABCPK1234E1Z5X")).toEqual([]);
  });
});

describe("CIN extraction", () => {
  it("matches a structurally-valid CIN", () => {
    expect(extractCins("Company CIN: U72200KA2010PTC012345")).toEqual([
      "U72200KA2010PTC012345",
    ]);
  });

  it("requires the L/U prefix", () => {
    expect(extractCins("X72200KA2010PTC012345")).toEqual([]);
  });
});

describe("IFSC extraction", () => {
  it("matches a structurally-valid IFSC", () => {
    expect(extractIfscs("Branch IFSC: HDFC0001234")).toEqual(["HDFC0001234"]);
  });

  it("rejects when position 5 is not 0", () => {
    expect(extractIfscs("HDFC1001234")).toEqual([]);
  });
});

describe("extractAllEntities", () => {
  it("returns empty arrays when nothing matches", () => {
    const ents = extractAllEntities("just a normal sentence");
    expect(ents).toEqual({ pans: [], gstins: [], cins: [], ifscs: [] });
  });

  it("extracts a mix in one pass", () => {
    const doc = `
      Engagement letter for Acme Pvt Ltd.
      PAN: ABCPK1234E. GSTIN: 27ABCPK1234E1Z5.
      Bank a/c at HDFC0001234. CIN U72200KA2010PTC012345.
    `;
    const ents = extractAllEntities(doc);
    expect(ents.pans).toEqual(["ABCPK1234E"]);
    expect(ents.gstins).toEqual(["27ABCPK1234E1Z5"]);
    expect(ents.cins).toEqual(["U72200KA2010PTC012345"]);
    expect(ents.ifscs).toEqual(["HDFC0001234"]);
  });
});

describe("mergeEntitiesIntoMetadata", () => {
  it("populates entity arrays into a fresh metadata object", () => {
    const md = mergeEntitiesIntoMetadata(undefined, "PAN: ABCPK1234E");
    expect(md).toEqual({ pans: ["ABCPK1234E"] });
  });

  it("does NOT overwrite existing keys", () => {
    const md = mergeEntitiesIntoMetadata(
      { pans: ["MANUAL1234E"] },
      "Document mentions ABCPK1234E"
    );
    expect(md.pans).toEqual(["MANUAL1234E"]);
  });

  it("preserves unrelated existing keys", () => {
    const md = mergeEntitiesIntoMetadata(
      { doc_type: "engagement_letter" },
      "PAN: ABCPK1234E"
    );
    expect(md).toEqual({ doc_type: "engagement_letter", pans: ["ABCPK1234E"] });
  });

  it("omits entity keys when none are extracted", () => {
    const md = mergeEntitiesIntoMetadata({ x: 1 }, "no entities here");
    expect(md).toEqual({ x: 1 });
  });
});
