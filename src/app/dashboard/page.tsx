import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCompaniesByUser, getAgentsByCompany } from "@/lib/db";
import Link from "next/link";
import { AgentIcon } from "@/app/components/agent-icons";
import { Logo } from "@/app/components/logo";

export default async function DashboardIndex() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const companies = await getCompaniesByUser(userId);

  if (companies.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="mx-auto mb-6">
            <Logo size="large" />
          </div>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight mb-3">
            No agents yet
          </h1>
          <p className="text-neutral-500 text-sm mb-6">
            Enter your company website on the homepage to get AI agent
            recommendations and launch your autonomous workforce.
          </p>
          <Link
            href="/"
            className="inline-flex px-6 py-3 bg-primary text-surface text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors"
          >
            Get started
          </Link>
        </div>
      </div>
    );
  }

  // If only one company, go straight to it
  if (companies.length === 1) {
    redirect(`/dashboard/${companies[0].id}`);
  }

  // Preload agents for all companies
  const agentsByCompany = await Promise.all(
    companies.map(async (c) => ({ companyId: c.id, agents: await getAgentsByCompany(c.id) }))
  );
  const agentMap = Object.fromEntries(agentsByCompany.map((x) => [x.companyId, x.agents]));

  // Multiple companies — show picker
  return (
    <div className="min-h-screen bg-surface pt-24 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight mb-2">
          Your companies
        </h1>
        <p className="text-neutral-500 text-sm mb-8">
          Select a company to manage its AI agents.
        </p>

        <div className="space-y-4">
          {companies.map((company) => {
            const agents = agentMap[company.id] || [];
            return (
              <Link
                key={company.id}
                href={`/dashboard/${company.id}`}
                className="block p-5 bg-white border border-neutral-200 rounded-xl hover:border-accent hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">{company.name}</h2>
                  <span className="text-xs text-neutral-500 px-2 py-0.5 bg-neutral-100 rounded-full">
                    {company.stage}
                  </span>
                </div>
                <p className="text-sm text-neutral-500 mb-3">
                  {company.industry}
                </p>
                <div className="flex gap-2">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center gap-1.5 px-2 py-1 bg-neutral-50 rounded-lg"
                    >
                      <AgentIcon role={agent.role} size="sm" />
                      <span className="text-xs text-neutral-600">
                        {agent.role}
                      </span>
                    </div>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
