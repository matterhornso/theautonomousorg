"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";

// ─── Scroll-triggered animation wrapper ─────────────────────────────
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Agent role data ─────────────────────────────────────────────────
const agentRoles = [
  {
    title: "Sales",
    icon: "S",
    description:
      "Prospect research, outbound sequences, CRM updates, pipeline forecasting, and deal qualification — running 24/7.",
    skills: [
      "Lead scoring",
      "Email sequences",
      "CRM management",
      "Pipeline analytics",
    ],
  },
  {
    title: "Marketing",
    icon: "M",
    description:
      "Content strategy, campaign execution, SEO optimization, social media management, and performance analytics.",
    skills: [
      "Content creation",
      "SEO optimization",
      "Campaign management",
      "Analytics",
    ],
  },
  {
    title: "Accounting",
    icon: "A",
    description:
      "Invoice processing, expense tracking, financial reporting, tax preparation, and cash flow forecasting.",
    skills: [
      "Bookkeeping",
      "Financial reports",
      "Tax compliance",
      "Cash flow",
    ],
  },
  {
    title: "Strategy",
    icon: "St",
    description:
      "Market analysis, competitive intelligence, business modeling, OKR tracking, and strategic planning.",
    skills: [
      "Market research",
      "Competitive analysis",
      "Business modeling",
      "OKR tracking",
    ],
  },
  {
    title: "Product",
    icon: "P",
    description:
      "User research synthesis, feature prioritization, roadmap management, sprint planning, and stakeholder updates.",
    skills: [
      "User research",
      "Roadmap planning",
      "Sprint management",
      "Specs & PRDs",
    ],
  },
  {
    title: "Front-End Engineering",
    icon: "FE",
    description:
      "UI component development, responsive design, performance optimization, accessibility, and design system maintenance.",
    skills: [
      "React / Next.js",
      "UI components",
      "Performance",
      "Accessibility",
    ],
  },
  {
    title: "Back-End Engineering",
    icon: "BE",
    description:
      "API development, database design, infrastructure management, security hardening, and system architecture.",
    skills: ["API design", "Databases", "Infrastructure", "Security"],
  },
  {
    title: "AI Expert",
    icon: "AI",
    description:
      "Model selection, prompt engineering, RAG pipeline setup, fine-tuning workflows, and AI strategy consulting.",
    skills: [
      "Model selection",
      "Prompt engineering",
      "RAG pipelines",
      "Fine-tuning",
    ],
  },
];

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

// ─── Main Page ───────────────────────────────────────────────────────
export default function Home() {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [activeRole, setActiveRole] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-rotate roles
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveRole((prev) => (prev + 1) % agentRoles.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen">
      {/* ─── Navigation ─────────────────────────────────── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-surface/90 backdrop-blur-xl border-b border-neutral-200"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <span className="text-surface text-xs font-bold tracking-tight font-[family-name:var(--font-sans)]">
                TA
              </span>
            </div>
            <span className="text-lg font-medium tracking-tight">
              The Autonomous
            </span>
          </a>

          <div className="hidden md:flex items-center gap-8 text-sm text-neutral-600">
            <a
              href="#how-it-works"
              className="hover:text-primary transition-colors py-3"
            >
              How it works
            </a>
            <a href="#agents" className="hover:text-primary transition-colors py-3">
              Agents
            </a>
            <a
              href="#pricing"
              className="hover:text-primary transition-colors py-3"
            >
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="#cta"
              className="hidden sm:inline-flex px-5 py-3 bg-primary text-surface text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors"
            >
              Get started
            </a>
          </div>
        </div>
      </nav>

      {/* ─── Hero ───────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center grain overflow-hidden">
        {/* Subtle gradient orb */}
        <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[128px] pointer-events-none" />

        <div className="relative z-10 max-w-[1280px] mx-auto px-6 lg:px-8 pt-32 pb-24">
          <div className="grid lg:grid-cols-[1fr,380px] gap-12 items-center">
            <div>
              <Reveal>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-mid rounded-full text-sm text-neutral-600 mb-8">
                  <span className="w-2 h-2 bg-accent rounded-full" />
                  Powered by Claude Opus &middot; Bring your own models
                </div>
              </Reveal>

              <Reveal delay={75}>
                <h1 className="font-[family-name:var(--font-serif)] text-5xl sm:text-6xl lg:text-[72px] leading-[1.05] tracking-tight mb-6">
                  Your entire company,{" "}
                  <span className="italic text-accent">autonomous.</span>
                </h1>
              </Reveal>

              <Reveal delay={150}>
                <p className="text-lg sm:text-xl text-neutral-600 max-w-2xl leading-relaxed mb-10">
                  AI agents for every role — Sales, Marketing, Engineering,
                  Strategy, and more. Enter your website, get recommended agents,
                  and talk to them on WhatsApp.
                </p>
              </Reveal>

              <Reveal delay={225}>
                <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
                  <div className="flex-1 relative">
                    <input
                      type="url"
                      placeholder="Enter your company website..."
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      className="w-full px-5 py-4 bg-white border border-neutral-200 rounded-xl text-base placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                    />
                  </div>
                  <button className="px-8 py-4 bg-primary text-surface font-medium rounded-xl hover:bg-neutral-800 transition-all hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98] whitespace-nowrap">
                    Get recommendations
                  </button>
                </div>
              </Reveal>

              <Reveal delay={300}>
                <p className="text-sm text-neutral-400 mt-4">
                  Free analysis &middot; No credit card required &middot; 2
                  minute setup
                </p>
              </Reveal>
            </div>

            {/* Floating agent cards - decorative */}
            <div className="hidden lg:block">
              <Reveal delay={200}>
                <div className="space-y-3">
                  {agentRoles.slice(0, 5).map((role, i) => (
                    <div
                      key={role.title}
                      className="bg-white/80 backdrop-blur-sm border border-neutral-200/60 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
                      style={{
                        opacity: 0.5 + i * 0.125,
                        transform: `translateX(${i * 4}px)`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-surface text-xs font-bold shrink-0">
                          {role.icon}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {role.title} Agent
                          </p>
                          <p className="text-xs text-neutral-500">
                            {role.skills[0]} &middot; {role.skills[1]}
                          </p>
                        </div>
                        <div className="ml-auto w-2 h-2 bg-secondary rounded-full shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Logos / Social Proof ───────────────────────── */}
      <section className="py-16 border-y border-neutral-200 bg-surface-mid">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <Reveal>
            <p className="text-center text-sm text-neutral-500 mb-8 tracking-wide uppercase">
              Trusted by forward-thinking teams
            </p>
          </Reveal>
          <Reveal delay={75}>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-40">
              {[
                "Acme Corp",
                "Globex",
                "Initech",
                "Hooli",
                "Piedmont",
                "Vehement",
              ].map((name) => (
                <span
                  key={name}
                  className="text-lg font-medium text-neutral-700 tracking-tight"
                >
                  {name}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── How It Works ───────────────────────────────── */}
      <section id="how-it-works" className="py-24 lg:py-32">
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
                  <div className="w-full h-px bg-neutral-200 my-4 group-hover:bg-accent transition-colors" />
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

      {/* ─── Agents Showcase ────────────────────────────── */}
      <section id="agents" className="py-24 lg:py-32 bg-primary text-surface">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            {/* Left — role selector */}
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
                  <span className="text-neutral-400">
                    Every skill. Ready to go.
                  </span>
                </h2>
              </Reveal>
              <Reveal delay={150}>
                <p className="text-neutral-400 text-lg leading-relaxed mb-10 max-w-lg">
                  Each agent comes pre-configured with the right tools,
                  knowledge, and workflows for their role. Powered by Claude
                  Opus by default — or bring your own model.
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

            {/* Right — agent detail card */}
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
                      <p className="text-sm font-medium mt-1">
                        WhatsApp
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wider">
                        Status
                      </p>
                      <p className="text-sm font-medium text-secondary mt-1">
                        Ready
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── WhatsApp Integration ───────────────────────── */}
      <section className="py-24 lg:py-32">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Chat mockup */}
            <Reveal>
              <div className="bg-white border border-neutral-200 rounded-2xl shadow-xl overflow-hidden max-w-md mx-auto lg:mx-0">
                {/* WhatsApp header */}
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

                {/* Chat messages */}
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
                        Great progress. 142 emails sent, 38 opened (26.8% rate),
                        12 replies so far. 3 are qualified leads — I&apos;ve
                        already updated the CRM.
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

            {/* Text */}
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

      {/* ─── BYOM Section ───────────────────────────────── */}
      <section className="py-24 lg:py-32 bg-surface-mid">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <Reveal>
              <p className="text-sm text-accent font-medium tracking-wide uppercase mb-3">
                Bring your own model
              </p>
            </Reveal>
            <Reveal delay={75}>
              <h2 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl lg:text-[56px] tracking-tight mb-6">
                Claude Opus by default.
                <br />
                <span className="text-neutral-400">Your model if you prefer.</span>
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

      {/* ─── Pricing Teaser ─────────────────────────────── */}
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
                  <p
                    className={`text-sm font-medium ${
                      plan.featured ? "text-accent" : "text-accent"
                    }`}
                  >
                    {plan.name}
                  </p>
                  <div className="flex items-baseline gap-1 mt-3 mb-1">
                    <span className="text-4xl font-semibold">{plan.price}</span>
                    {plan.period && (
                      <span
                        className={`text-sm ${
                          plan.featured ? "text-neutral-400" : "text-neutral-500"
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
      <section id="cta" className="py-24 lg:py-32 bg-primary text-surface">
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
            <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
              <input
                type="url"
                placeholder="Enter your company website..."
                className="flex-1 px-5 py-4 bg-neutral-800 border border-neutral-700 rounded-xl text-base text-surface placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
              />
              <button className="px-8 py-4 bg-accent text-primary font-medium rounded-xl hover:bg-accent-hover transition-all hover:shadow-lg hover:shadow-accent/10 active:scale-[0.98] whitespace-nowrap">
                Get started free
              </button>
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
              <a href="#" className="hover:text-surface transition-colors py-3">
                Privacy
              </a>
              <a href="#" className="hover:text-surface transition-colors py-3">
                Terms
              </a>
              <a href="#" className="hover:text-surface transition-colors py-3">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
