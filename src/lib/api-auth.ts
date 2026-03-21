import { NextRequest, NextResponse } from "next/server";
import { getApiKeyByHash } from "./db";
import { hashApiKey } from "./api-keys";

export function authenticateApiKey(
  request: NextRequest
): { companyId: string } | NextResponse {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ta_live_")) {
    return NextResponse.json(
      { error: "Missing or invalid API key. Use: Authorization: Bearer ta_live_..." },
      { status: 401 }
    );
  }

  const apiKey = authHeader.slice(7); // Remove "Bearer "
  const keyHash = hashApiKey(apiKey);
  const record = getApiKeyByHash(keyHash);

  if (!record) {
    return NextResponse.json(
      { error: "Invalid API key" },
      { status: 401 }
    );
  }

  return { companyId: record.company_id };
}
