import { NextResponse } from "next/server";
import {
  getCompaniesByUser,
  getCompany,
  getTeamMemberByUserId,
  claimCompanyForUser,
} from "@/lib/db";

/**
 * Verify that a user owns the given company OR is an accepted team member.
 * Also auto-claims unclaimed companies (provisioned without auth).
 * Returns the companyId on success, or a NextResponse error on failure.
 */
export async function assertCompanyOwnership(
  userId: string,
  companyId: string | null,
  opts: { allowClaim?: boolean } = {}
): Promise<
  | { ok: true; companyId: string }
  | { ok: false; response: NextResponse }
> {
  if (!companyId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "companyId required" },
        { status: 400 }
      ),
    };
  }

  // Check direct ownership first
  const companies = await getCompaniesByUser(userId);
  if (companies.find((c) => c.id === companyId)) {
    return { ok: true, companyId };
  }

  // Check if the company exists but has no owner (provisioned without auth)
  // and claim it for the current user. SECURITY: only when the caller opts in
  // (i.e. the authenticated provisioning flow). Auto-claiming on every ownership
  // check let any user take over an unclaimed company by guessing its id.
  if (opts.allowClaim) {
    const company = await getCompany(companyId);
    if (company && !company.user_id) {
      await claimCompanyForUser(companyId, userId);
      return { ok: true, companyId };
    }
  }

  // Check team membership (accepted invites)
  const teamMember = await getTeamMemberByUserId(companyId, userId);
  if (teamMember && teamMember.invite_status === "accepted") {
    return { ok: true, companyId };
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "Not found" }, { status: 404 }),
  };
}
