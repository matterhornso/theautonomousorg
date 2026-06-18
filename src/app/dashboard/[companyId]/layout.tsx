import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { getCompaniesByUser } from "@/lib/db";
import { withUserContext } from "@/lib/tenant-context";

/**
 * Ownership gate for every /dashboard/[companyId]/* page.
 *
 * The child pages read companyId from the URL and query the DB with it, with no
 * ownership check (getCompany is unscoped). Without this layout, any
 * authenticated user could read another tenant's analytics/billing/usage by
 * guessing a companyId (IDOR). This verifies membership once for the whole
 * subtree. (The /admin surface already does this via resolveTenant().)
 */
export default async function CompanyDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { companyId } = await params;
  const companies = await withUserContext(userId, () => getCompaniesByUser(userId));
  if (!companies.find((c) => c.id === companyId)) {
    notFound();
  }

  return <>{children}</>;
}
