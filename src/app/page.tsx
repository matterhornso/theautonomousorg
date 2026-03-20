import { Reveal } from "./components/reveal";
import { Navbar } from "./components/navbar";
import { AgentShowcase } from "./components/agent-showcase";
import { agentRoles } from "./data";
import { WebsiteForm } from "./components/website-form";

const steps = [
  {
    number: "01",
    title: "Enter your website",
    description:
      "Share your company URL and our AI analyzes your business — industry, team size, workflows, and growth stage.",
  },
  {
    number: "02",
    title: "Get agent recommendations",
    description:
      "We recommend which AI agents would have the highest impact for your specific business. No guesswork.",
  },
  {
    number: "03",
    title: "Spawn your agents",
    description:
      "Select the roles you need. Each agent comes pre-configured with the right skills, tools, and context for the job.",
  },
  {
    number: "04",
    title: "Communicate via WhatsApp",
    description:
      "Talk to your agents where you already work. Assign tasks, get updates, and make decisions — all from WhatsApp.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* ─── Hero — focused on description + form ─────── */}
      <section className="relative min-h-screen flex items-center grain overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-accent/[0.03] rounded-full blur-[128px] pointer-events-none" />

        <div className="relative z-10 max-w-[1280px] mx-auto px-6 lg:px-8 pt-28 pb-20">
          <div className="max-w-3xl mx-auto text-center">
            <Reveal>
              <h1 className="font-[family-name:var(--font-serif)] text-[42px] sm:text-6xl lg:text-[80px] leading-[1.02] tracking-tight mb-6">
                Run your company
                <br />
                with{" "}
                <span className="italic text-accent">AI agents.</span>
              </h1>
            </Reveal>

            <Reveal delay={75}>
              <p className="text-lg sm:text-xl text-neutral-600 leading-relaxed mb-4 max-w-2xl mx-auto">
                The Autonomous gives you an AI workforce for every part of your
                business — Sales, Marketing, Accounting, Strategy, Product,
                Engineering, and more. Each agent comes with the right skills
                for the job, ready to work 24/7.
              </p>
            </Reveal>

            <Reveal delay={150}>
              <p className="text-base sm:text-lg text-neutral-500 leading-relaxed mb-10 max-w-2xl mx-auto">
                Enter your company website and we&apos;ll analyze your business
                to recommend which agents would have the highest impact.
                Communicate with your agents via WhatsApp — no new tools to
                learn.
              </p>
            </Reveal>

            <Reveal delay={225}>
              <div className="max-w-xl mx-auto">
                <WebsiteForm variant="light" />
              </div>
            </Reveal>

            <Reveal delay={300}>
              <p className="text-sm text-neutral-400 mt-4">
                Free analysis &middot; No credit card required &middot; 2 minute
                setup
              </p>
            </Reveal>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-neutral-400">
          <span className="text-xs tracking-wide uppercase">Learn more</span>
          <svg
            className="w-4 h-4 animate-bounce"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 14l-7 7m0 0l-7-7"
            />
          </svg>
        </div>
      </section>

      {/* ─── What is The Autonomous ─────────────────────── */}
      <section className="py-24 lg:py-32 border-t border-neutral-200">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Reveal>
                <p className="text-sm text-accent font-medium tracking-wide uppercase mb-3">
                  The autonomous workforce
                </p>
              </Reveal>
              <Reveal delay={75}>
                <h2 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl lg:text-[56px] tracking-tight mb-6">
                  Every role your company needs.
                  <br />
                  <span className="text-neutral-400">Handled by AI.</span>
                </h2>
              </Reveal>
              <Reveal delay={150}>
                <p className="text-neutral-500 text-lg leading-relaxed mb-8">
                  Most AI tools automate one task. The Autonomous runs entire
                  departments. Your AI Sales agent doesn&apos;t just send
                  emails — it researches prospects, qualifies leads, updates
                  your CRM, and schedules demos. Your AI Marketing agent
                  doesn&apos;t just write copy — it plans campaigns, optimizes
                  SEO, manages social, and reports on performance.
                </p>
              </Reveal>
              <Reveal delay={225}>
                <p className="text-neutral-500 text-lg leading-relaxed">
                  You choose which roles to fill. Each agent arrives
                  pre-configured with the skills, tools, and domain knowledge
                  for its job. And they collaborate with each other — just
                  like a real team.
                </p>
              </Reveal>
            </div>

            <div>
              <Reveal delay={150}>
                <div className="space-y-3">
                  {agentRoles.map((role, i) => (
                    <div
                      key={role.title}
                      className="flex items-center gap-4 p-4 bg-white border border-neutral-200/60 rounded-xl hover:shadow-sm transition-all"
                    >
                      <div className="w-11 h-11 bg-primary rounded-lg flex items-center justify-center text-surface text-xs font-bold shrink-0">
                        {role.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{role.title}</p>
                        <p className="text-xs text-neutral-500 truncate">
                          {role.skills.join(" · ")}
                        </p>
                      </div>
                      <div className="w-2 h-2 bg-secondary rounded-full shrink-0" />
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How It Works ───────────────────────────────── */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-surface-mid">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <Reveal>
            <p className="text-sm text-accent font-medium tracking-wide uppercase mb-3">
              How it works
            </p>
          </Reveal>
          <Reveal delay={75}>
            <h2 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl lg:text-[56px] tracking-tight mb-16 max-w-2xl">
              From website to workforce
              <br />
              <span className="text-neutral-400">in four steps.</span>
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <Reveal key={step.number} delay={i * 75}>
                <div className="group">
                  <span className="font-[family-name:var(--font-mono)] text-xs text-accent font-medium">
                    {step.number}
                  </span>
                  <div className="w-full h-px bg-neutral-300 my-4 group-hover:bg-accent transition-colors" />
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-neutral-500 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Agents Showcase (interactive) ──────────────── */}
      <section id="agents" className="py-24 lg:py-32 bg-primary text-surface">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <AgentShowcase />
        </div>
      </section>

      {/* ─── WhatsApp Integration ───────────────────────── */}
      <section className="py-24 lg:py-32">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <Reveal>
              <div className="bg-white border border-neutral-200 rounded-2xl shadow-xl overflow-hidden max-w-md mx-auto lg:mx-0">
                <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    S
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">
                      Sales Agent
                    </p>
                    <p className="text-white/60 text-xs">online</p>
                  </div>
                </div>

                <div className="p-4 space-y-3 bg-[#ECE5DD] min-h-[320px]">
                  <div className="flex justify-end">
                    <div className="bg-[#DCF8C6] rounded-xl rounded-tr-sm px-3 py-2 max-w-[75%] shadow-sm">
                      <p className="text-sm">
                        How&apos;s the outreach going for the Q1 enterprise
                        list?
                      </p>
                      <p className="text-[10px] text-neutral-500 text-right mt-1">
                        10:32 AM
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 max-w-[75%] shadow-sm">
                      <p className="text-sm">
                        Great progress. 142 emails sent, 38 opened (26.8%
                        rate), 12 replies so far. 3 are qualified leads —
                        I&apos;ve already updated the CRM.
                      </p>
                      <p className="text-[10px] text-neutral-500 text-right mt-1">
                        10:32 AM
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <div className="bg-[#DCF8C6] rounded-xl rounded-tr-sm px-3 py-2 max-w-[75%] shadow-sm">
                      <p className="text-sm">
                        Nice. Schedule demos with the qualified leads for next
                        week.
                      </p>
                      <p className="text-[10px] text-neutral-500 text-right mt-1">
                        10:33 AM
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 max-w-[75%] shadow-sm">
                      <p className="text-sm">
                        Done. 3 demos scheduled: Tues 2pm, Wed 10am, Thu 3pm.
                        Calendar invites sent, prep docs drafted for each.
                      </p>
                      <p className="text-[10px] text-neutral-500 text-right mt-1">
                        10:33 AM
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            <div>
              <Reveal>
                <p className="text-sm text-accent font-medium tracking-wide uppercase mb-3">
                  WhatsApp native
                </p>
              </Reveal>
              <Reveal delay={75}>
                <h2 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl lg:text-[56px] tracking-tight mb-6">
                  Manage your team
                  <br />
                  <span className="text-neutral-400">from your pocket.</span>
                </h2>
              </Reveal>
              <Reveal delay={150}>
                <p className="text-neutral-500 text-lg leading-relaxed mb-8 max-w-lg">
                  No new apps to learn. No dashboards to check. Your AI agents
                  live in WhatsApp — assign tasks, get status updates, review
                  work, and make decisions from the app you already use every
                  day.
                </p>
              </Reveal>
              <Reveal delay={225}>
                <div className="space-y-4">
                  {[
                    "Natural language — just tell agents what to do",
                    "Real-time updates pushed to your phone",
                    "Agents collaborate with each other autonomously",
                    "Full audit trail of every action taken",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 bg-secondary/10 rounded-full flex items-center justify-center mt-0.5 shrink-0">
                        <svg
                          className="w-3 h-3 text-secondary"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <p className="text-neutral-600">{item}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Powered by / BYOM — moved down from hero ──── */}
      <section className="py-20 lg:py-28 bg-surface-mid">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full text-sm text-neutral-600 mb-6 border border-neutral-200">
                <span className="w-2 h-2 bg-accent rounded-full" />
                Powered by Claude Opus &middot; Bring your own models
              </div>
            </Reveal>
            <Reveal delay={75}>
              <h2 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl lg:text-[56px] tracking-tight mb-6">
                Claude Opus by default.
                <br />
                <span className="text-neutral-400">
                  Your model if you prefer.
                </span>
              </h2>
            </Reveal>
            <Reveal delay={150}>
              <p className="text-neutral-500 text-lg leading-relaxed mb-12">
                Every agent runs on Claude Opus for best-in-class reasoning. But
                if you have specific model requirements — latency, cost,
                compliance — bring your own. GPT-4o, Gemini, Llama, Mistral, or
                any OpenAI-compatible endpoint.
              </p>
            </Reveal>
          </div>

          <Reveal delay={225}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {[
                {
                  name: "Claude Opus",
                  tag: "Default",
                  desc: "Best reasoning & analysis",
                },
                { name: "GPT-4o", tag: "BYOM", desc: "Fast & versatile" },
                {
                  name: "Gemini Pro",
                  tag: "BYOM",
                  desc: "Multimodal strength",
                },
                {
                  name: "Your Model",
                  tag: "Custom",
                  desc: "Any OpenAI-compatible API",
                },
              ].map((model) => (
                <div
                  key={model.name}
                  className={`p-5 rounded-xl border ${
                    model.tag === "Default"
                      ? "bg-primary text-surface border-primary"
                      : "bg-white border-neutral-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`font-medium ${
                        model.tag === "Default" ? "" : "text-primary"
                      }`}
                    >
                      {model.name}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        model.tag === "Default"
                          ? "bg-accent text-primary"
                          : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {model.tag}
                    </span>
                  </div>
                  <p
                    className={`text-sm ${
                      model.tag === "Default"
                        ? "text-neutral-300"
                        : "text-neutral-500"
                    }`}
                  >
                    {model.desc}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Pricing ────────────────────────────────────── */}
      <section id="pricing" className="py-24 lg:py-32">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <Reveal>
              <p className="text-sm text-accent font-medium tracking-wide uppercase mb-3">
                Pricing
              </p>
            </Reveal>
            <Reveal delay={75}>
              <h2 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl lg:text-[56px] tracking-tight mb-4">
                Pay for what you use.
              </h2>
            </Reveal>
            <Reveal delay={150}>
              <p className="text-neutral-500 text-lg max-w-xl mx-auto">
                Start free. Scale as your AI workforce grows. No contracts, no
                surprises.
              </p>
            </Reveal>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: "Starter",
                price: "Free",
                period: "",
                description: "Try it with one agent",
                features: [
                  "1 AI agent",
                  "100 tasks / month",
                  "WhatsApp integration",
                  "Claude Opus included",
                  "Community support",
                ],
                cta: "Start free",
                featured: false,
              },
              {
                name: "Growth",
                price: "$99",
                period: "/ month",
                description: "For growing teams",
                features: [
                  "Up to 5 agents",
                  "Unlimited tasks",
                  "WhatsApp + Slack",
                  "BYOM support",
                  "Priority support",
                  "Agent collaboration",
                ],
                cta: "Get started",
                featured: true,
              },
              {
                name: "Enterprise",
                price: "Custom",
                period: "",
                description: "Full autonomous workforce",
                features: [
                  "Unlimited agents",
                  "Unlimited tasks",
                  "All integrations",
                  "Custom models & fine-tuning",
                  "Dedicated support",
                  "SOC2 & HIPAA compliance",
                  "Custom agent development",
                ],
                cta: "Talk to us",
                featured: false,
              },
            ].map((plan) => (
              <Reveal key={plan.name} delay={plan.featured ? 75 : 0}>
                <div
                  className={`p-8 rounded-2xl border h-full flex flex-col ${
                    plan.featured
                      ? "bg-primary text-surface border-primary shadow-2xl shadow-primary/10 relative"
                      : "bg-white border-neutral-200"
                  }`}
                >
                  {plan.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent text-primary text-xs font-semibold rounded-full">
                      Most popular
                    </div>
                  )}
                  <p className="text-sm font-medium text-accent">
                    {plan.name}
                  </p>
                  <div className="flex items-baseline gap-1 mt-3 mb-1">
                    <span className="text-4xl font-semibold">{plan.price}</span>
                    {plan.period && (
                      <span
                        className={`text-sm ${
                          plan.featured
                            ? "text-neutral-400"
                            : "text-neutral-500"
                        }`}
                      >
                        {plan.period}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-sm mb-6 ${
                      plan.featured ? "text-neutral-400" : "text-neutral-500"
                    }`}
                  >
                    {plan.description}
                  </p>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <svg
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            plan.featured ? "text-accent" : "text-secondary"
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span
                          className={`text-sm ${
                            plan.featured
                              ? "text-neutral-300"
                              : "text-neutral-600"
                          }`}
                        >
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <button
                    className={`w-full py-3 rounded-xl text-sm font-medium transition-all ${
                      plan.featured
                        ? "bg-accent text-primary hover:bg-accent-hover"
                        : "bg-primary text-surface hover:bg-neutral-800"
                    }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ──────────────────────────────────── */}
      <section id="cta" className="py-20 lg:py-28 bg-primary text-surface">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8 text-center">
          <Reveal>
            <h2 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl lg:text-6xl tracking-tight mb-6">
              Ready to go{" "}
              <span className="italic text-accent">autonomous?</span>
            </h2>
          </Reveal>
          <Reveal delay={75}>
            <p className="text-neutral-400 text-lg max-w-xl mx-auto mb-10">
              Enter your website and discover which AI agents can transform your
              business. Setup takes 2 minutes.
            </p>
          </Reveal>
          <Reveal delay={150}>
            <div className="max-w-xl mx-auto">
              <WebsiteForm variant="dark" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────── */}
      <footer className="py-12 bg-primary text-neutral-400 border-t border-neutral-800">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-neutral-800 rounded-md flex items-center justify-center">
                <span className="text-surface text-xs font-bold">TA</span>
              </div>
              <span className="text-sm text-neutral-500">
                &copy; 2026 The Autonomous. All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a
                href="#"
                className="hover:text-surface transition-colors py-3"
              >
                Privacy
              </a>
              <a
                href="#"
                className="hover:text-surface transition-colors py-3"
              >
                Terms
              </a>
              <a
                href="#"
                className="hover:text-surface transition-colors py-3"
              >
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
