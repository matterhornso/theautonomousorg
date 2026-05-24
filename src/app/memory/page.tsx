import type { Metadata } from "next";
import { Navbar } from "../components/navbar";
import { Reveal } from "../components/reveal";
import { MemoryWaitlistForm } from "../components/memory-waitlist-form";

const MEMORY_URL = "https://www.theautonomous.org/memory";

export const metadata: Metadata = {
  title: "Autonomous Memory — Never forget a conversation",
  description:
    "An executive memory layer for CEOs, CROs, and founders. Record meetings, import Fireflies transcripts, and get pre-meeting briefs that remember every commitment, context, and person you've ever talked to.",
  alternates: { canonical: MEMORY_URL },
  openGraph: {
    title: "Autonomous Memory — Never forget a conversation",
    description:
      "Your private executive memory. Every meeting, commitment, and relationship — searchable, synthesized, and waiting before your next call.",
    url: MEMORY_URL,
    type: "website",
    images: [
      {
        url: "https://www.theautonomous.org/og-image.png",
        width: 1200,
        height: 630,
        alt: "Autonomous Memory — Never forget a conversation",
        type: "image/png",
      },
    ],
  },
};

const memoryJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${MEMORY_URL}#software`,
  name: "Autonomous Memory",
  url: MEMORY_URL,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android, macOS",
  description:
    "An executive memory layer for CEOs, CROs, and founders. Record meetings, import Fireflies transcripts, and get pre-meeting briefs that remember every commitment, context, and person you've ever talked to.",
  featureList: [
    "Unlimited meeting recordings and transcript imports",
    "Fireflies, Otter, and Granola sync",
    "Pre-meeting briefs with open commitments and relationship history",
    "Memory graph search across every conversation",
    "Desktop, web, and mobile access",
    "Source-linked answers — every claim cites its transcript",
    "Feeds the Autonomous workforce so agents share your context",
  ],
  offers: [
    {
      "@type": "Offer",
      name: "Early Access",
      price: "99",
      priceCurrency: "USD",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "99",
        priceCurrency: "USD",
        billingDuration: "P1M",
      },
      description:
        "Founders and operators who want in before we open the door.",
    },
    {
      "@type": "Offer",
      name: "Executive",
      price: "499",
      priceCurrency: "USD",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "499",
        priceCurrency: "USD",
        billingDuration: "P1M",
      },
      description:
        "For CEOs, CROs, and GPs running 30+ meetings a week.",
    },
  ],
  creator: { "@id": "https://www.theautonomous.org/#organization" },
  provider: { "@id": "https://www.theautonomous.org/#organization" },
  isPartOf: { "@id": "https://www.theautonomous.org/#software" },
};

export default function MemoryLanding() {
  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(memoryJsonLd) }}
      />

      {/* ─── Hero — dark, editorial ─────── */}
      <section className="relative bg-primary text-surface overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-accent/[0.06] rounded-full blur-[128px] pointer-events-none" />
        <div className="absolute inset-0 grain opacity-40 pointer-events-none" />

        <div className="relative z-10 max-w-[1280px] mx-auto px-6 lg:px-8 pt-32 pb-24 lg:pt-40 lg:pb-32">
          <div className="max-w-3xl">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/30 rounded-full mb-8">
                <span className="w-1.5 h-1.5 bg-accent rounded-full" />
                <span className="text-xs tracking-wide uppercase text-accent font-medium">
                  Private beta — Executive access
                </span>
              </div>
            </Reveal>

            <Reveal delay={75}>
              <h1 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl lg:text-7xl leading-[1.02] tracking-tight mb-8">
                Never forget a{" "}
                <span className="italic text-accent">conversation.</span>
              </h1>
            </Reveal>

            <Reveal delay={150}>
              <p className="text-lg sm:text-xl text-white/75 leading-relaxed mb-4 max-w-2xl">
                Autonomous Memory is a private memory layer for executives who
                live in back-to-back meetings. Record your day, import your
                Fireflies transcripts, and we build a knowledge graph of every
                person, commitment, and decision you&apos;ve ever made.
              </p>
            </Reveal>

            <Reveal delay={225}>
              <p className="text-base sm:text-lg text-white/55 leading-relaxed mb-10 max-w-2xl">
                Before your next meeting, get a pre-meeting brief that
                remembers what you promised, what they said last time, and what
                you actually need to decide. The same memory feeds the
                Autonomous workforce — so the agents running your company always
                start from what you already know.
              </p>
            </Reveal>

            <Reveal delay={300}>
              <div className="max-w-md">
                <MemoryWaitlistForm variant="dark" />
              </div>
            </Reveal>

            <Reveal delay={375}>
              <div className="flex flex-wrap items-center gap-6 mt-10 text-sm text-white/50">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Works with Fireflies, Otter, Granola
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Your data, your servers (SOC 2 in progress)
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Desktop, web, and mobile
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── The problem ─────── */}
      <section className="py-24 lg:py-32 border-t border-neutral-200">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <Reveal>
              <p className="text-sm text-accent font-medium tracking-wide uppercase mb-4">
                The problem
              </p>
            </Reveal>
            <Reveal delay={75}>
              <h2 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-8 leading-[1.1]">
                You&apos;ve had the same conversation three times.{" "}
                <span className="text-neutral-400">
                  Your memory tools went out of business.
                </span>
              </h2>
            </Reveal>
            <Reveal delay={150}>
              <div className="space-y-5 text-lg text-neutral-600 leading-relaxed">
                <p>
                  Limitless shut down its Pendant. Rewind got quietly acquired
                  and folded in. Otter became a meeting-summary tool. The
                  executive memory category is a graveyard — and you still
                  can&apos;t remember what you promised that customer six weeks
                  ago.
                </p>
                <p>
                  Meanwhile you&apos;re running 30+ meetings a week. Every one
                  generates commitments, context, follow-ups, and nuance. Your
                  brain drops 80% of it by Friday. Your CRM captures maybe 5%.
                  The rest is just gone.
                </p>
                <p className="text-neutral-800 font-medium">
                  Autonomous Memory is the layer your brain deserves. And
                  we&apos;re building it to last.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── How it works ─────── */}
      <section className="py-24 lg:py-32 bg-[#F0EDE6] border-y border-neutral-200">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="max-w-3xl mb-16">
            <Reveal>
              <p className="text-sm text-accent font-medium tracking-wide uppercase mb-4">
                How it works
              </p>
            </Reveal>
            <Reveal delay={75}>
              <h2 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-[1.1]">
                Record the conversation.{" "}
                <span className="italic text-accent">
                  Own the memory of it.
                </span>
              </h2>
            </Reveal>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                number: "01",
                title: "Capture everything",
                description:
                  "Press record on your phone, desktop app, or browser. Or connect Fireflies / Otter / Granola and we pull every transcript you already have.",
              },
              {
                number: "02",
                title: "Extract what matters",
                description:
                  "Claude reads the transcript and pulls out people, commitments, decisions, and context. Not a bullet-point summary. A structured graph.",
              },
              {
                number: "03",
                title: "Build your memory",
                description:
                  "Every meeting adds to your knowledge graph. Search 'what did I promise Sarah at Acme' and get the answer with sources, not a vibe.",
              },
              {
                number: "04",
                title: "Brief before you meet",
                description:
                  "Before your next call, get a pre-meeting brief: last conversation, open commitments, relationship history, and the 3 things you actually need to decide.",
              },
            ].map((step, idx) => (
              <Reveal key={step.number} delay={idx * 75}>
                <div className="bg-surface p-8 rounded-2xl border border-neutral-200/60 h-full">
                  <div className="text-accent font-[family-name:var(--font-serif)] text-3xl mb-6">
                    {step.number}
                  </div>
                  <h3 className="font-medium text-lg mb-3">{step.title}</h3>
                  <p className="text-neutral-500 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── What's in the brief ─────── */}
      <section className="py-24 lg:py-32">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Reveal>
                <p className="text-sm text-accent font-medium tracking-wide uppercase mb-4">
                  The pre-meeting brief
                </p>
              </Reveal>
              <Reveal delay={75}>
                <h2 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl lg:text-[42px] tracking-tight mb-6 leading-[1.1]">
                  Walk in prepared.{" "}
                  <span className="text-neutral-400">Without the prep.</span>
                </h2>
              </Reveal>
              <Reveal delay={150}>
                <p className="text-neutral-600 text-lg leading-relaxed mb-6">
                  Two minutes before your meeting, a brief lands in your inbox.
                  It remembers what your future self will wish you remembered.
                </p>
              </Reveal>
              <Reveal delay={225}>
                <ul className="space-y-3 text-neutral-600">
                  {[
                    "Last time you spoke, and what you actually said",
                    "Open commitments from both sides",
                    "Their team, org changes, and recent signals",
                    "The 3 decisions worth making this meeting",
                    "Sources linked back to the original transcript",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-secondary shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

            <Reveal delay={150}>
              <div className="bg-[#1A1918] text-surface rounded-2xl p-8 shadow-2xl shadow-neutral-900/10">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wide mb-1">
                      Brief for 3:00 PM
                    </p>
                    <p className="font-medium">Sarah Chen — Acme Corp</p>
                  </div>
                  <div className="text-xs text-accent">2 min read</div>
                </div>

                <div className="space-y-5 text-sm">
                  <div>
                    <p className="text-accent text-xs uppercase tracking-wide mb-2">
                      Last conversation · Mar 12
                    </p>
                    <p className="text-white/75 leading-relaxed">
                      You committed to sending the security questionnaire by
                      end of week. Sarah flagged her board is pushing for SOC 2
                      before Q3 signing.
                    </p>
                  </div>

                  <div>
                    <p className="text-accent text-xs uppercase tracking-wide mb-2">
                      Open commitments
                    </p>
                    <ul className="space-y-1.5 text-white/75">
                      <li>• Send SOC 2 Type I timeline (you, overdue)</li>
                      <li>• Intro to Marcus on pricing (you, pending)</li>
                      <li>• Share reference customer list (Sarah)</li>
                    </ul>
                  </div>

                  <div>
                    <p className="text-accent text-xs uppercase tracking-wide mb-2">
                      Decide this meeting
                    </p>
                    <ul className="space-y-1.5 text-white/75">
                      <li>1. Contract length: 12 vs 24 months</li>
                      <li>2. Pilot scope: 2 teams or 5</li>
                      <li>3. Launch timing: pre or post summit</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── Who it's for ─────── */}
      <section className="py-24 lg:py-32 bg-[#F0EDE6] border-y border-neutral-200">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <Reveal>
              <p className="text-sm text-accent font-medium tracking-wide uppercase mb-4">
                Who it&apos;s for
              </p>
            </Reveal>
            <Reveal delay={75}>
              <h2 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-[1.1]">
                If your calendar looks like this,{" "}
                <span className="italic text-accent">we built this for you.</span>
              </h2>
            </Reveal>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                role: "CEOs & Founders",
                detail:
                  "30+ meetings a week. Investors, customers, candidates, and the board. Your memory is the product.",
              },
              {
                role: "CROs & Heads of Sales",
                detail:
                  "Every rep depends on you remembering their pipeline. Every customer expects continuity. Both are slipping.",
              },
              {
                role: "VCs & Operators",
                detail:
                  "You talked to 40 founders this month. By next quarter you&apos;ll remember eight. This fixes that.",
              },
            ].map((audience, idx) => (
              <Reveal key={audience.role} delay={idx * 75}>
                <div className="bg-surface p-8 rounded-2xl border border-neutral-200/60 h-full">
                  <h3 className="font-[family-name:var(--font-serif)] text-2xl mb-3">
                    {audience.role}
                  </h3>
                  <p
                    className="text-neutral-500 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: audience.detail }}
                  />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─────── */}
      <section className="py-24 lg:py-32">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <Reveal>
              <p className="text-sm text-accent font-medium tracking-wide uppercase mb-4">
                Pricing
              </p>
            </Reveal>
            <Reveal delay={75}>
              <h2 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-[1.1]">
                Executive-grade.{" "}
                <span className="text-neutral-400">Priced that way.</span>
              </h2>
            </Reveal>
            <Reveal delay={150}>
              <p className="text-neutral-500 text-lg leading-relaxed mt-6">
                No free tier. No viral loops. If your time is worth less than
                $500/hour, this isn&apos;t for you yet.
              </p>
            </Reveal>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Reveal>
              <div className="bg-surface p-10 rounded-2xl border border-neutral-200 h-full flex flex-col">
                <h3 className="font-medium text-lg mb-2">Early Access</h3>
                <p className="text-sm text-neutral-500 mb-6">
                  For founders and operators who want in before we open the door.
                </p>
                <div className="mb-8">
                  <span className="font-[family-name:var(--font-serif)] text-5xl">
                    $99
                  </span>
                  <span className="text-neutral-500 text-sm ml-2">/ month</span>
                </div>
                <ul className="space-y-3 text-sm text-neutral-600 flex-1 mb-8">
                  {[
                    "Unlimited recordings & imports",
                    "Fireflies / Otter / Granola sync",
                    "Pre-meeting briefs",
                    "Memory graph search",
                    "Desktop, web, mobile",
                  ].map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <svg
                        className="w-4 h-4 text-secondary shrink-0 mt-0.5"
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
                      {feat}
                    </li>
                  ))}
                </ul>
                <a
                  href="#waitlist"
                  className="w-full py-3 text-center bg-primary text-surface text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors"
                >
                  Join the waitlist
                </a>
              </div>
            </Reveal>

            <Reveal delay={75}>
              <div className="bg-primary text-surface p-10 rounded-2xl border border-primary h-full flex flex-col relative">
                <div className="absolute -top-3 left-10 bg-accent text-primary text-xs font-medium px-3 py-1 rounded-full">
                  For executives
                </div>
                <h3 className="font-medium text-lg mb-2">Executive</h3>
                <p className="text-sm text-white/60 mb-6">
                  For CEOs, CROs, and GPs running 30+ meetings a week.
                </p>
                <div className="mb-8">
                  <span className="font-[family-name:var(--font-serif)] text-5xl">
                    $499
                  </span>
                  <span className="text-white/60 text-sm ml-2">/ month</span>
                </div>
                <ul className="space-y-3 text-sm text-white/75 flex-1 mb-8">
                  {[
                    "Everything in Early Access",
                    "Dedicated onboarding (we set it up for you)",
                    "Private Slack channel with the founders",
                    "Custom brief formats & CRM sync",
                    "Priority Fireflies/Otter ingestion",
                    "SOC 2 Type I docs + DPA",
                  ].map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <svg
                        className="w-4 h-4 text-accent shrink-0 mt-0.5"
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
                      {feat}
                    </li>
                  ))}
                </ul>
                <a
                  href="#waitlist"
                  className="w-full py-3 text-center bg-accent text-primary text-sm font-medium rounded-xl hover:bg-[#C4981F] transition-colors"
                >
                  Request access
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── Final CTA / Waitlist ─────── */}
      <section
        id="waitlist"
        className="py-24 lg:py-32 bg-primary text-surface border-t border-neutral-800"
      >
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <Reveal>
              <h2 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-6 leading-[1.1]">
                Your memory,{" "}
                <span className="italic text-accent">
                  finally on your side.
                </span>
              </h2>
            </Reveal>
            <Reveal delay={75}>
              <p className="text-lg text-white/70 leading-relaxed mb-10">
                We&apos;re onboarding executives weekly. Tell us who you are
                and we&apos;ll be in touch within 48 hours.
              </p>
            </Reveal>
            <Reveal delay={150}>
              <MemoryWaitlistForm variant="dark" />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── Footer ─────── */}
      <footer className="bg-primary text-surface">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8 py-12 border-t border-white/10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/50">
            <p>© 2026 The Autonomous Org. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="/" className="hover:text-white transition-colors">
                Platform
              </a>
              <a
                href="/privacy"
                className="hover:text-white transition-colors"
              >
                Privacy
              </a>
              <a href="/terms" className="hover:text-white transition-colors">
                Terms
              </a>
              <a
                href="/contact"
                className="hover:text-white transition-colors"
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
