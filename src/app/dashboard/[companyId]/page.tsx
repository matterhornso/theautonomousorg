import { getCompany, getAgentsByCompany, getActivityFeed, getTasksByCompany, getLatestDebrief } from "@/lib/db";
import { notFound } from "next/navigation";
import { DashboardClient } from "@/app/components/dashboard/dashboard-client";
import { HealthWidget } from "@/app/components/dashboard/health-widget";
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

  // Health widget data
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayTasks = tasks.filter(
    (t) => new Date(t.created_at) >= todayStart
  );
  const tasksDoneToday = todayTasks.filter((t) => t.status === "done").length;
  const tasksFailedToday = todayTasks.filter((t) => t.status === "failed").length;

  // Active agents = agents that have done tasks in the last 24h
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentAgentIds = new Set(
    tasks
      .filter((t) => t.status === "done" && new Date(t.created_at) >= yesterday)
      .map((t) => t.agent_id)
  );
  const activeAgents = recentAgentIds.size;

  // Debrief info
  const latestDebrief = await getLatestDebrief(companyId);
  const debriefDate = latestDebrief?.created_at || null;

  // Next debrief = hours until 10am user's local (approximate — use UTC 10am for now)
  const next10am = new Date(now);
  next10am.setUTCHours(10, 0, 0, 0);
  if (next10am <= now) next10am.setUTCDate(next10am.getUTCDate() + 1);
  const nextDebriefHours = Math.round(
    (next10am.getTime() - now.getTime()) / (1000 * 60 * 60)
  );

  return (
    <div>
      <HealthWidget
        companyId={companyId}
        activeAgents={activeAgents}
        totalAgents={agents.length}
        tasksDoneToday={tasksDoneToday}
        tasksFailedToday={tasksFailedToday}
        lastDebrief={debriefDate}
        nextDebriefHours={nextDebriefHours}
      />
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
    </div>
  );
}
