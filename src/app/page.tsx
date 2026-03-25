import { Reveal } from "./components/reveal";
import { Navbar } from "./components/navbar";
import { AgentShowcase } from "./components/agent-showcase";
import { agentRoles } from "./data";
import { WebsiteForm } from "./components/website-form";
import { ComingSoonButton } from "./components/coming-soon-button";
import { AgentIcon } from "./components/agent-icons";
import { NewsletterForm } from "./components/newsletter-form";
import { Logo } from "./components/logo";

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
    title: "Connect via dashboard, WhatsApp, or Telegram",
    description:
      "Manage your agents from the admin dashboard, or connect via WhatsApp and Telegram. Assign tasks, get updates, and make decisions — wherever you prefer.",
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
              <h1 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl lg:text-6xl leading-[1.08] tracking-tight mb-6">
                Your entire company,{" "}
                <span className="italic text-accent">autonomous.</span>
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
                Communicate with your agents via WhatsApp, Telegram, or the
                admin dashboard — no new tools to learn.
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
      <section className="py-16 lg:py-24 border-t border-neutral-200">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Reveal>
                <p className="text-sm text-accent font-medium tracking-wide uppercase mb-3">
                  The autonomous workforce
                </p>
              </Reveal>
              <Reveal delay={75}>
                <h2 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl lg:text-[42px] tracking-tight mb-6">
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
                <div className="relative">
                  <div className="max-h-[480px] overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                    {agentRoles.map((role) => (
                      <div
                        key={role.title}
                        className="flex items-center gap-3 p-3 bg-white border border-neutral-200/60 rounded-lg hover:shadow-md hover:shadow-neutral-900/[0.04] hover:-translate-y-px transition-all duration-300"
                      >
                        <AgentIcon role={role.title} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{role.title}</p>
                          <p className="text-xs text-neutral-500 truncate">
                            {role.connectors.join(" · ")}
                          </p>
                        </div>
                        <div className="w-2 h-2 bg-secondary rounded-full shrink-0" />
                      </div>
                    ))}
                  </div>
                  {/* Fade-out at bottom to indicate scrollability */}
                  <div className="absolute bottom-0 left-0 right-2 h-12 bg-gradient-to-t from-surface to-transparent pointer-events-none" />
                </div>
                <p className="text-xs text-neutral-400 mt-2 text-center">
                  {agentRoles.length} agent roles available &middot; scroll to see all
                </p>
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
            <h2 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl lg:text-[42px] tracking-tight mb-16 max-w-2xl">
              From website to workforce
              <br />
              <span className="text-neutral-400">in four steps.</span>
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <Reveal key={step.number} delay={i * 75}>
                <div className="group">
                  <span className="font-[family-name:var(--font-serif)] text-4xl text-accent/20 font-normal group-hover:text-accent/40 transition-colors duration-500">
                    {step.number}
                  </span>
                  <div className="w-full h-px bg-neutral-300 my-4 group-hover:bg-accent transition-colors duration-300" />
                  <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
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
      <section id="agents" className="py-24 lg:py-32 bg-primary text-surface relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-accent/[0.04] rounded-full blur-[160px] pointer-events-none" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-secondary/[0.03] rounded-full blur-[120px] pointer-events-none" />
        <div className="relative z-10 max-w-[1280px] mx-auto px-6 lg:px-8">
          <AgentShowcase />
        </div>
      </section>

      {/* ─── Platform Features ───────────────────────────── */}
      <section className="py-24 lg:py-32">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <Reveal>
              <p className="text-sm text-accent font-medium tracking-wide uppercase mb-3">
                How agents work
              </p>
            </Reveal>
            <Reveal delay={75}>
              <h2 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl lg:text-[42px] tracking-tight mb-4">
                Not chatbots.
                <br />
                <span className="text-neutral-400">Actual teammates.</span>
              </h2>
            </Reveal>
            <Reveal delay={150}>
              <p className="text-neutral-500 text-lg max-w-2xl mx-auto">
                Each agent runs in its own isolated cloud instance with
                persistent memory, role-specific tools, and the ability to
                collaborate with other agents — just like a real team.
              </p>
            </Reveal>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                title: "Isolated instances",
                desc: "Each agent runs in its own cloud environment with dedicated resources. Your data never crosses between companies.",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
                  </svg>
                ),
              },
              {
                title: "Persistent memory",
                desc: "Agents remember every conversation, decision, and context. They get smarter the more your team works with them.",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                  </svg>
                ),
              },
              {
                title: "Real connectors",
                desc: "Each agent comes with MCP integrations for its role — Apollo for Sales, Instantly for Marketing, QuickBooks for Accounting.",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                ),
              },
              {
                title: "Agent collaboration",
                desc: "Agents talk to each other. Your Sales agent can ask the Admin agent to draft a contract — automatically.",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                ),
              },
              {
                title: "Team access",
                desc: "Multiple people can connect to the same agent. Your whole sales team talks to one Sales agent that knows everything.",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                ),
              },
              {
                title: "Company context",
                desc: "We research your company across the web — website, socials, news — and give every agent deep context about your business.",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                ),
              },
              {
                title: "Downloadable skills",
                desc: "Every agent's skills are available for download. Use them locally with your own Claude Code setup if you prefer.",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                ),
              },
              {
                title: "Dashboard, WhatsApp & Telegram",
                desc: "Manage agents from the admin dashboard, or connect via WhatsApp and Telegram — talk to them from anywhere, anytime.",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                ),
              },
            ].map((feature, i) => (
              <Reveal key={feature.title} delay={i * 50}>
                <div className="p-5 rounded-xl border border-neutral-200/80 bg-white h-full shadow-sm shadow-neutral-900/[0.02] hover-lift">
                  <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-surface mb-3">
                    {feature.icon}
                  </div>
                  <h3 className="font-semibold text-sm mb-1.5">
                    {feature.title}
                  </h3>
                  <p className="text-neutral-500 text-sm leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WhatsApp Integration ───────────────────────── */}
      <section className="py-24 lg:py-32 bg-surface-mid border-t border-neutral-200">
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
                  Connect anywhere
                </p>
              </Reveal>
              <Reveal delay={75}>
                <h2 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl lg:text-[42px] tracking-tight mb-6">
                  Manage your team
                  <br />
                  <span className="text-neutral-400">your way.</span>
                </h2>
              </Reveal>
              <Reveal delay={150}>
                <p className="text-neutral-500 text-lg leading-relaxed mb-8 max-w-lg">
                  Use the admin dashboard for full control, or connect via
                  WhatsApp and Telegram for quick access on the go. Assign
                  tasks, get status updates, and make decisions — wherever you
                  are.
                </p>
              </Reveal>
              <Reveal delay={225}>
                <div className="space-y-4">
                  {[
                    "Admin dashboard for full agent management",
                    "WhatsApp & Telegram for on-the-go access",
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
                Powered by Claude Sonnet 4.6 &middot; Bring your own models
              </div>
            </Reveal>
            <Reveal delay={75}>
              <h2 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl lg:text-[42px] tracking-tight mb-6">
                Claude Sonnet 4.6 by default.
                <br />
                <span className="text-neutral-400">
                  Your model if you prefer.
                </span>
              </h2>
            </Reveal>
            <Reveal delay={150}>
              <p className="text-neutral-500 text-lg leading-relaxed mb-12">
                Every agent runs on Claude Sonnet 4.6 for best-in-class reasoning. But
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
                  name: "Claude Sonnet 4.6",
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
                  className={`p-5 rounded-xl border hover-lift ${
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
          <div className="text-center mb-10">
            <Reveal>
              <p className="text-sm text-accent font-medium tracking-wide uppercase mb-3">
                Pricing
              </p>
            </Reveal>
            <Reveal delay={75}>
              <h2 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl lg:text-[42px] tracking-tight mb-4">
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

          <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {[
              {
                name: "Starter",
                price: "Free",
                period: "",
                description: "Get started with TA credits",
                features: [
                  "1,000 TA credits included",
                  "Then $19 per 1,000 credits",
                  "50 credits per prompt",
                  "WhatsApp integration",
                  "Claude Sonnet 4.6 included",
                  "Community support",
                ],
                cta: "Start free",
                featured: false,
              },
              {
                name: "Growth",
                price: "$49",
                period: "/ month",
                description: "For growing teams",
                features: [
                  "5,000 TA credits / month",
                  "Then $15 per 1,000 credits",
                  "50 credits per prompt",
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
                  "Unlimited TA credits",
                  "Volume discounts",
                  "50 credits per prompt",
                  "All integrations",
                  "Custom models & fine-tuning",
                  "Dedicated support",
                  "SOC2 & HIPAA compliance",
                ],
                cta: "Talk to us",
                featured: false,
              },
            ].map((plan) => (
              <Reveal key={plan.name} delay={plan.featured ? 75 : 0}>
                <div
                  className={`rounded-[1.25rem] h-full ${
                    plan.featured
                      ? "bg-neutral-800/50 p-1.5 shadow-2xl shadow-primary/15"
                      : "bg-neutral-200/40 p-1.5"
                  }`}
                >
                <div
                  className={`p-6 rounded-[calc(1.25rem-6px)] h-full flex flex-col ${
                    plan.featured
                      ? "bg-primary text-surface relative shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]"
                      : "bg-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]"
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
                  <div className="flex items-baseline gap-1 mt-2 mb-1">
                    <span className="text-3xl font-semibold">{plan.price}</span>
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
                    className={`text-sm mb-5 ${
                      plan.featured ? "text-neutral-400" : "text-neutral-500"
                    }`}
                  >
                    {plan.description}
                  </p>

                  <ul className="space-y-2.5 mb-6">
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

                  <ComingSoonButton
                    label={plan.cta}
                    featured={plan.featured}
                  />
                </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Newsletter ──────────────────────────────────── */}
      <section className="py-16 bg-surface-mid border-t border-neutral-200">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="max-w-xl mx-auto text-center">
            <h3 className="font-semibold text-lg tracking-tight mb-2">
              Stay in the loop
            </h3>
            <p className="text-sm text-neutral-500 mb-5">
              Get updates on new agents, features, and the future of autonomous
              companies.
            </p>
            <NewsletterForm />
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────── */}
      <footer className="py-10 bg-primary text-neutral-400 border-t border-neutral-800">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Logo size="small" />
              </div>
              <p className="text-xs text-neutral-500 max-w-xs">
                AI agents for every role in your company. Enter your website,
                get recommended agents, and start automating your workflows.
              </p>
            </div>
            <div className="flex gap-12">
              <div>
                <p className="text-xs font-medium text-neutral-300 uppercase tracking-wider mb-3">
                  Product
                </p>
                <div className="flex flex-col gap-2 text-sm">
                  <a href="/#how-it-works" className="hover:text-surface transition-colors">
                    How it works
                  </a>
                  <a href="/#agents" className="hover:text-surface transition-colors">
                    Agents
                  </a>
                  <a href="/#pricing" className="hover:text-surface transition-colors">
                    Pricing
                  </a>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-300 uppercase tracking-wider mb-3">
                  Legal
                </p>
                <div className="flex flex-col gap-2 text-sm">
                  <a href="/privacy" className="hover:text-surface transition-colors">
                    Privacy Policy
                  </a>
                  <a href="/terms" className="hover:text-surface transition-colors">
                    Terms of Service
                  </a>
                  <a href="/contact" className="hover:text-surface transition-colors">
                    Contact Us
                  </a>
                </div>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-neutral-500">
              &copy; 2026 The Autonomous. All rights reserved.
            </span>
            <span className="text-xs text-neutral-500">
              Built by{" "}
              <span className="text-neutral-400 font-medium">Chainflux</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
