import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCompaniesByUser } from "@/lib/db";
import { withUserContext } from "@/lib/tenant-context";
import type { Company } from "@/lib/types";

export interface ResolvedTenant {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    initials: string;
  };
  firm: {
    id: string;
    name: string;
    initials: string;
    industry: string | null;
    stage: string | null;
    url: string;
  };
  companies: Company[];
}

function pickInitials(...parts: Array<string | null | undefined>): string {
  const tokens = parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .flatMap((p) => p.trim().split(/\s+/))
    .map((t) => t[0]?.toUpperCase())
    .filter((c): c is string => Boolean(c));
  if (tokens.length === 0) return "YC";
  return (tokens[0]! + (tokens[1] ?? "")).slice(0, 2);
}

/**
 * Resolves the active firm + user for an /admin request.
 *
 * - Redirects to /sign-in if not authenticated.
 * - Redirects to /onboarding if the user has no companies yet.
 * - For users with multiple companies, picks the most recently created one
 *   (server-side; a workspace switcher in the UI can override later).
 */
export async function resolveTenant(): Promise<ResolvedTenant> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [companies, user] = await Promise.all([
    // Bootstrap read: user GUC only, so it works under the NOBYPASSRLS app_user
    // role (companies policy allows `user_id = current_user_id()`).
    withUserContext(userId, () => getCompaniesByUser(userId)),
    currentUser(),
  ]);

  if (companies.length === 0) redirect("/onboarding");

  const firm = companies[0]!;

  return {
    user: {
      id: userId,
      firstName: user?.firstName ?? null,
      lastName: user?.lastName ?? null,
      email: user?.emailAddresses?.[0]?.emailAddress ?? null,
      initials: pickInitials(user?.firstName, user?.lastName, user?.username),
    },
    firm: {
      id: firm.id,
      name: firm.name,
      initials: pickInitials(firm.name),
      industry: firm.industry,
      stage: firm.stage,
      url: firm.url,
    },
    companies,
  };
}
