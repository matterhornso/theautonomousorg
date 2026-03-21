import { getCompany, getAgentsByCompany } from "@/lib/db";
import { notFound } from "next/navigation";
import { DashboardClient } from "@/app/components/dashboard/dashboard-client";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = getCompany(companyId);
  if (!company) notFound();

  const agents = getAgentsByCompany(companyId).map((a) => ({
    id: a.id,
    role: a.role,
    status: a.status,
    skills: JSON.parse(a.skills_json || "[]") as string[],
    connectors: JSON.parse(a.connectors_json || "[]") as string[],
  }));

  return (
    <DashboardClient
      company={{
        id: company.id,
        name: company.name,
        industry: company.industry,
        stage: company.stage,
      }}
      agents={agents}
    />
  );
}
