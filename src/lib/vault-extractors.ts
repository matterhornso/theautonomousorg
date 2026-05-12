/**
 * Vault entity extractors v1 — Indian-context structured-data recognizers.
 *
 * Extracted entities are written into vault_documents.metadata so agents
 * can filter the Vault by GSTIN / PAN / CIN / IFSC etc. without touching
 * the embedding layer. v1 ships pure regex; v2 (post-design-doc 6C-B) layers
 * a Cohere structured-extraction pass on top for the bilingual + handwriting
 * cases.
 *
 * Validation policy (v1): we accept structurally-valid identifiers without
 * cross-referencing the gov't registry. Verifying GSTIN/PAN/CIN against the
 * MCA + GSTN portals lives in the Tally on-prem agent (W3) once it ships.
 */

// ─── PAN ───────────────────────────────────────────────────────────────────
// Format: 5 letters + 4 digits + 1 letter. The 4th letter encodes entity
// type (P=person, C=company, H=HUF, F=firm, A=AOP, T=trust, B=BOI, L=local,
// J=artificial, G=govt). v1 accepts any of those in pos 4.

const PAN_REGEX = /\b[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]\b/g;

export function extractPans(text: string): string[] {
  return Array.from(new Set((text.toUpperCase().match(PAN_REGEX) ?? [])));
}

// ─── GSTIN ─────────────────────────────────────────────────────────────────
// Format: 2-digit state code + 10-char PAN + 1-digit entity num (1-9, A-Z) +
// "Z" + 1 alphanumeric checksum char. We accept the structural pattern; the
// checksum is verifiable but skipped in v1 (the bank-recon agent's
// confidence threshold catches false positives downstream).

const GSTIN_REGEX = /\b\d{2}[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/g;

export function extractGstins(text: string): string[] {
  return Array.from(new Set((text.toUpperCase().match(GSTIN_REGEX) ?? [])));
}

// ─── CIN ───────────────────────────────────────────────────────────────────
// Format: 1 letter (L/U) + 5-digit industry + 2-letter state + 4-digit year +
// 3-letter ownership + 6-digit registration. Total 21 chars.

const CIN_REGEX = /\b[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}\b/g;

export function extractCins(text: string): string[] {
  return Array.from(new Set((text.toUpperCase().match(CIN_REGEX) ?? [])));
}

// ─── IFSC ──────────────────────────────────────────────────────────────────
// Format: 4 letters (bank code) + "0" + 6 alphanumeric (branch code).
// Position 5 is always "0".

const IFSC_REGEX = /\b[A-Z]{4}0[A-Z0-9]{6}\b/g;

export function extractIfscs(text: string): string[] {
  return Array.from(new Set((text.toUpperCase().match(IFSC_REGEX) ?? [])));
}

// ─── Aggregate ─────────────────────────────────────────────────────────────

export interface ExtractedEntities {
  pans: string[];
  gstins: string[];
  cins: string[];
  ifscs: string[];
}

export function extractAllEntities(text: string): ExtractedEntities {
  return {
    pans: extractPans(text),
    gstins: extractGstins(text),
    cins: extractCins(text),
    ifscs: extractIfscs(text),
  };
}

/**
 * Merge extracted entities into a metadata object. Used by vault.ingest to
 * populate `vault_documents.metadata` before the row is written.
 *
 * Existing keys with the same name are NOT overwritten; the agent's caller
 * may already have a curated value (e.g. a user-supplied PAN in a contact
 * card) that should win over a regex hit elsewhere in the doc.
 */
export function mergeEntitiesIntoMetadata(
  existing: Record<string, unknown> | undefined,
  text: string
): Record<string, unknown> {
  const ents = extractAllEntities(text);
  const out: Record<string, unknown> = { ...(existing ?? {}) };
  if (!out.pans && ents.pans.length > 0) out.pans = ents.pans;
  if (!out.gstins && ents.gstins.length > 0) out.gstins = ents.gstins;
  if (!out.cins && ents.cins.length > 0) out.cins = ents.cins;
  if (!out.ifscs && ents.ifscs.length > 0) out.ifscs = ents.ifscs;
  return out;
}
