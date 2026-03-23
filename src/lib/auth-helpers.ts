import { NextResponse } from "next/server";
import { getCompaniesByUser } from "@/lib/db";

/**
 * Verify that a user owns the given company.
 * Returns the company list on success, or a NextResponse error on failure.
 */
export function assertCompanyOwnership(
  userId: string,
  companyId: string | null
):
  | { ok: true; companyId: string }
  | { ok: false; response: NextResponse } {
  if (!companyId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "companyId required" },
        { status: 400 }
      ),
    };
  }

  const companies = getCompaniesByUser(userId);
  if (!companies.find((c) => c.id === companyId)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }

  return { ok: true, companyId };
}
