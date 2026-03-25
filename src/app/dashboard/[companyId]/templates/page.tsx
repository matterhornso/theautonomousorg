"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { industryPacks, type IndustryPack } from "@/lib/agent-templates";
import { AgentIcon } from "@/app/components/agent-icons";

const packIcons: Record<string, React.ReactNode> = {
  rocket: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  ),
  cart: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  ),
  briefcase: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
    </svg>
  ),
  bank: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
    </svg>
  ),
  sparkle: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  ),
};

export default function TemplatesPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;
  const [selectedPack, setSelectedPack] = useState<IndustryPack | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<string | null>("week1");

  return (
    <div className="min-h-screen bg-surface pt-8 pb-16 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/dashboard/${companyId}`}
            className="text-sm text-neutral-500 hover:text-primary transition-colors mb-2 inline-block"
          >
            &larr; Back to dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
              </svg>
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight">
                Agent Templates
              </h1>
              <p className="text-sm text-neutral-500">
                Pre-built agent packs for your industry with 30-day plans
              </p>
            </div>
          </div>
        </div>

        {!selectedPack ? (
          /* Pack selection grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {industryPacks.map(pack => (
              <button
                key={pack.id}
                onClick={() => setSelectedPack(pack)}
                className="bg-white border border-neutral-200 rounded-xl p-6 text-left hover-lift group"
              >
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent mb-4">
                  {packIcons[pack.icon] || packIcons.rocket}
                </div>
                <h3 className="font-semibold text-base mb-1">{pack.name}</h3>
                <p className="text-sm text-neutral-500 mb-4">{pack.description}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {pack.agents.map(a => (
                    <span
                      key={a.role}
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        a.priority === "high"
                          ? "bg-accent/10 text-accent"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {a.role}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* Pack detail view */
          <div>
            <button
              onClick={() => setSelectedPack(null)}
              className="text-sm text-neutral-500 hover:text-primary transition-colors mb-6 inline-block"
            >
              &larr; All templates
            </button>

            <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                  {packIcons[selectedPack.icon] || packIcons.rocket}
                </div>
                <div>
                  <h2 className="font-[family-name:var(--font-serif)] text-2xl">{selectedPack.name}</h2>
                  <p className="text-sm text-neutral-500">{selectedPack.description}</p>
                </div>
              </div>
            </div>

            {/* Recommended agents */}
            <div className="mb-10">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4">
                Recommended Agents
              </h2>
              <div className="space-y-4">
                {selectedPack.agents.map(agent => (
                  <div key={agent.role} className="bg-white border border-neutral-200 rounded-xl p-5">
                    <div className="flex items-center gap-4 mb-3">
                      <AgentIcon role={agent.role} size="md" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{agent.role} Agent</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            agent.priority === "high"
                              ? "bg-accent/10 text-accent"
                              : "bg-neutral-100 text-neutral-500"
                          }`}>
                            {agent.priority} priority
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-[52px]">
                      <p className="text-xs text-neutral-400 uppercase tracking-wider mb-2">
                        Suggested first tasks
                      </p>
                      <ul className="space-y-1.5">
                        {agent.firstTasks.map((task, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                            <span className="text-accent mt-0.5 shrink-0">-</span>
                            {task}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 30-day plan */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4">
                30-Day Plan
              </h2>
              <div className="space-y-3">
                {(["week1", "week2", "week3", "week4"] as const).map((week, i) => (
                  <div key={week} className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedWeek(expandedWeek === week ? null : week)}
                      className="w-full px-5 py-4 flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          expandedWeek === week
                            ? "bg-accent text-primary"
                            : "bg-neutral-100 text-neutral-500"
                        }`}>
                          {i + 1}
                        </div>
                        <span className="font-medium text-sm">Week {i + 1}</span>
                      </div>
                      <svg
                        className={`w-4 h-4 text-neutral-400 transition-transform ${
                          expandedWeek === week ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                    {expandedWeek === week && (
                      <div className="px-5 pb-4 border-t border-neutral-100">
                        <ul className="mt-3 space-y-2">
                          {selectedPack.thirtyDayPlan[week].map((item, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm text-neutral-700">
                              <svg className="w-4 h-4 text-secondary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
