import { getCompany, getAgentsByCompany, getActivityFeed, getTasksByCompany } from "@/lib/db";
import { notFound } from "next/navigation";
import { DashboardClient } from "@/app/components/dashboard/dashboard-client";
import { agentRoles } from "@/app/data";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await getCompany(companyId);
  if (!company) notFound();

  const agents = (await getAgentsByCompany(companyId)).map((a) => {
    const roleData = agentRoles.find((r) => r.title === a.role);
    return {
      id: a.id,
      role: a.role,
      status: a.status,
      skills: JSON.parse(a.skills_json || "[]") as string[],
      connectors: JSON.parse(a.connectors_json || "[]") as string[],
      starters: roleData?.starters || [],
    };
  });

  const activity = await getActivityFeed(companyId, 30);
  const tasks = await getTasksByCompany(companyId);

  return (
    <DashboardClient
      company={{
        id: company.id,
        name: company.name,
        industry: company.industry,
        stage: company.stage,
      }}
      agents={agents}
      initialActivity={activity}
      initialTasks={tasks.map((t) => ({
        id: t.id,
        agent_id: t.agent_id,
        type: t.type,
        title: t.title,
        status: t.status,
        result: t.result_json,
        error: t.error_message,
        created_at: t.created_at,
      }))}
    />
  );
}
