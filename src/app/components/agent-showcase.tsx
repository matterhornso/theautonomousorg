"use client";

import { useState, useEffect } from "react";
import { Reveal } from "./reveal";
import { agentRoles } from "../data";

export function AgentShowcase() {
  const [activeRole, setActiveRole] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveRole((prev) => (prev + 1) % agentRoles.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid lg:grid-cols-2 gap-16 items-start">
      <div>
        <Reveal>
          <p className="text-sm text-accent font-medium tracking-wide uppercase mb-3">
            Your AI workforce
          </p>
        </Reveal>
        <Reveal delay={75}>
          <h2 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl lg:text-[56px] tracking-tight mb-4">
            Every role.
            <br />
            <span className="text-neutral-400">Every skill. Ready to go.</span>
          </h2>
        </Reveal>
        <Reveal delay={150}>
          <p className="text-neutral-400 text-lg leading-relaxed mb-10 max-w-lg">
            Each agent comes pre-configured with the right tools, knowledge, and
            workflows for their role. Powered by Claude Opus by default — or
            bring your own model.
          </p>
        </Reveal>

        <div className="flex flex-wrap gap-2">
          {agentRoles.map((role, i) => (
            <button
              key={role.title}
              onClick={() => setActiveRole(i)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeRole === i
                  ? "bg-accent text-primary"
                  : "bg-neutral-800 text-neutral-400 hover:text-surface hover:bg-neutral-700"
              }`}
            >
              {role.title}
            </button>
          ))}
        </div>
      </div>

      <Reveal delay={150}>
        <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-2xl p-8 lg:p-10 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center text-primary text-lg font-bold">
              {agentRoles[activeRole].icon}
            </div>
            <div>
              <h3 className="text-2xl font-semibold">
                {agentRoles[activeRole].title} Agent
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 bg-secondary rounded-full" />
                <span className="text-sm text-neutral-400">
                  Active &middot; Claude Opus
                </span>
              </div>
            </div>
          </div>

          <p className="text-neutral-300 leading-relaxed mb-8">
            {agentRoles[activeRole].description}
          </p>

          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3">
              Core Skills
            </p>
            <div className="flex flex-wrap gap-2">
              {agentRoles[activeRole].skills.map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1.5 bg-neutral-700/50 border border-neutral-600/30 rounded-lg text-sm text-neutral-300"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-neutral-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider">
                  Model
                </p>
                <p className="text-sm font-medium font-[family-name:var(--font-mono)] mt-1">
                  claude-opus-4
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider">
                  Channel
                </p>
                <p className="text-sm font-medium mt-1">WhatsApp</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider">
                  Status
                </p>
                <p className="text-sm font-medium text-secondary mt-1">Ready</p>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
