import type { Metadata } from "next";
import { Navbar } from "../components/navbar";
import { Reveal } from "../components/reveal";

const RECORDER_URL = "https://www.theautonomous.org/recorder";

export const metadata: Metadata = {
  title: "The Autonomous Recorder → Company Memory | The Autonomous",
  description:
    "A pocket AI voice recorder that turns in-person meetings into company memory your agents act on. 64GB, up to 90h per charge, MagSafe, one-button capture — every word becomes a knowledge graph of people, decisions, and commitments.",
  alternates: { canonical: RECORDER_URL },
  openGraph: {
    title: "Record the room. The whole company remembers.",
    description:
      "The Autonomous Recorder feeds in-person meetings straight into company memory — so every Sales, Finance, and Strategy agent starts from what was actually said.",
    url: RECORDER_URL,
    type: "website",
    images: [
      {
        url: "https://www.theautonomous.org/og-image.png",
        width: 1200,
        height: 630,
        alt: "The Autonomous Recorder feeding company memory",
        type: "image/png",
      },
    ],
  },
};

const productJsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "The Autonomous Recorder",
  brand: { "@type": "Brand", name: "The Autonomous" },
  category: "AI Voice Recorder",
  description:
    "A pocket AI voice recorder for in-person meetings, built to feed Autonomous Memory. One-button and app-controlled capture, 64GB storage, up to 90h recording per charge, MagSafe mount, USB-C, aluminum body.",
  url: RECORDER_URL,
  additionalProperty: [
    { "@type": "PropertyValue", name: "Storage", value: "64GB (up to 128GB)" },
    { "@type": "PropertyValue", name: "Recording time", value: "Up to 90h per charge" },
    { "@type": "PropertyValue", name: "Battery", value: "750mAh, charges in 1.5h via USB-C" },
    { "@type": "PropertyValue", name: "Audio format", value: "MP3" },
    { "@type": "PropertyValue", name: "Body", value: "Aluminum alloy, 87×56×5.9mm, 54g" },
    { "@type": "PropertyValue", name: "Mount", value: "MagSafe magnetic attach" },
  ],
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "Turn an in-person meeting into company memory your agents use",
  description:
    "How a recording from a pocket AI voice recorder flows into Autonomous Memory and reaches every relevant AI agent.",
  step: [
    {
      "@type": "HowToStep",
      name: "Record",
      text: "Press record on the AI voice recorder to capture the in-person meeting.",
    },
    {
      "@type": "HowToStep",
      name: "Upload",
      text: "Drop the audio into The Autonomous (web upload, USB-C transfer, or watched folder).",
    },
    {
      "@type": "HowToStep",
      name: "Transcribe",
      text: "Deepgram transcribes the audio with speaker separation and language auto-detection.",
    },
    {
      "@type": "HowToStep",
      name: "Extract",
      text: "Claude extracts people, decisions, and commitments into the company knowledge graph.",
    },
    {
      "@type": "HowToStep",
      name: "Recall",
      text: "Every relevant agent reads that shared context before it acts, and you get pre-meeting briefs.",
    },
  ],
};

// ─── Page data ───────────────────────────────────────────────────────────────

const PIPELINE = [
  {
    n: "01",
    title: "Record",
    body: "Press one button on the recorder and capture the whole room — a client lunch, a vendor negotiation, a hallway decision. No laptop open, no bot in the meeting.",
  },
  {
    n: "02",
    title: "Upload",
    body: "Recordings auto-transfer to the companion app, or pull the MP3s over USB-C. Drop them into The Autonomous — or point a watched folder at the device and skip the step.",
  },
  {
    n: "03",
    title: "Transcribe",
    body: "Deepgram turns the audio into a clean, speaker-separated transcript and auto-detects the language — including accented and multi-lingual rooms.",
  },
  {
    n: "04",
    title: "Extract",
    body: "Claude reads the transcript and writes the people, decisions, and commitments into the company knowledge graph — linked, deduped, and timestamped.",
  },
  {
    n: "05",
    title: "Recall",
    body: "From then on, every agent reads that context before it acts, and you get a pre-meeting brief before the next conversation with the same people.",
  },
];

const AGENTS = [
  {
    role: "Sales",
    pulls: "Open commitments to each customer, what was promised on the last call, and the relationship history before you walk into the renewal.",
  },
  {
    role: "Accounting & Finance",
    pulls: "Numbers, terms, and decisions agreed verbally in vendor and ops meetings — so the books reflect what the room actually decided.",
  },
  {
    role: "Strategy",
    pulls: "Board and leadership decisions, the rationale behind them, and the open threads that need a follow-up before the next offsite.",
  },
  {
    role: "Product & PM",
    pulls: "Action items and owner assignments from standups and planning, tracked as commitments with due dates instead of lost in notes.",
  },
  {
    role: "Marketing",
    pulls: "Customer language, objections, and positioning straight from real conversations — the raw material for messaging that lands.",
  },
  {
    role: "Any custom agent",
    pulls: "The same shared brain. Anything you spin up reads the company's meeting memory through one query — no per-agent integration.",
  },
];

const ROLES = [
  {
    role: "Founder / CEO",
    summary: "You live in back-to-back meetings the rest of the company never sees.",
    actions: [
      "Carry the recorder into investor, partner, and strategy meetings.",
      "Upload at the end of the day — or let a watched folder do it.",
      "Read the auto-generated pre-meeting brief before the next conversation.",
      "Mark sensitive 1:1s 'private' so they stay yours, not the company's.",
    ],
  },
  {
    role: "Sales / Revenue lead",
    summary: "In-person customer time is where deals move and commitments get made.",
    actions: [
      "Record client lunches, site visits, and negotiation rooms.",
      "Let the Sales agent surface every open commitment before the follow-up.",
      "Trust the CRM-adjacent memory to catch what you'd forget by Friday.",
    ],
  },
  {
    role: "Operations / Finance",
    summary: "Vendor and ops decisions happen verbally and rarely make it to a doc.",
    actions: [
      "Record vendor negotiations and operational reviews.",
      "Let the Accounting agent capture the numbers and terms that were agreed.",
      "Use the library to find 'what did we decide on pricing in March'.",
    ],
  },
  {
    role: "Executive Assistant / Chief of Staff",
    summary: "You run the principal's day and keep context flowing.",
    actions: [
      "Manage the recorder fleet and the upload routine.",
      "Title and tag captures so briefs and recall stay sharp.",
      "Set the privacy lane per meeting on the principal's behalf.",
    ],
  },
  {
    role: "IT / Admin",
    summary: "You own provisioning and the data governance around it.",
    actions: [
      "Wire the upload path (in-app, USB-C, or watched folder) for your team.",
      "Confirm the privacy default: company-shared, private by opt-in.",
      "Provision agents per workflow so the right teams read the right memory.",
    ],
  },
];

export default function RecorderPage() {
  return (
    <main className="bg-surface text-primary antialiased">
      <Navbar />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

      {/* ─── Hero ─────── */}
      <section className="relative bg-primary text-surface overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-accent/[0.06] rounded-full blur-[128px] pointer-events-none" />
        <div className="absolute inset-0 grain opacity-40 pointer-events-none" />

        <div className="relative z-10 max-w-[1280px] mx-auto px-6 lg:px-8 pt-32 pb-24 lg:pt-40 lg:pb-32">
          <div className="max-w-3xl">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/30 rounded-full mb-8">
                <span className="w-1.5 h-1.5 bg-accent rounded-full" />
                <span className="text-xs tracking-wide uppercase text-accent font-medium">
                  Hardware × Autonomous Memory
                </span>
              </div>
            </Reveal>

            <Reveal delay={75}>
              <h1 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl lg:text-7xl leading-[1.02] tracking-tight mb-8">
                Record the room.{" "}
                <span className="italic text-accent">
                  The whole company remembers.
                </span>
              </h1>
            </Reveal>

            <Reveal delay={150}>
              <p className="text-lg sm:text-xl text-white/75 leading-relaxed mb-4 max-w-2xl">
                The Autonomous Recorder is a pocket AI voice recorder that
                captures your in-person meetings — the ones no notetaker bot ever
                joins. One button, 64GB, up to 90 hours per charge. Every
                recording becomes shared company memory: a knowledge graph of
                every person, decision, and commitment that was actually spoken.
              </p>
            </Reveal>

            <Reveal delay={225}>
              <p className="text-base sm:text-lg text-white/55 leading-relaxed mb-10 max-w-2xl">
                Then your agents act on it. The Sales agent remembers what you
                promised the customer. Finance captures the terms you agreed with
                a vendor. Strategy recalls the decision and the reasoning. One
                recording, the entire workforce smarter.
              </p>
            </Reveal>

            <Reveal delay={300}>
              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-accent text-primary font-medium rounded-lg hover:bg-accent/90 transition-colors"
                >
                  Talk to us about a fleet
                </a>
                <a
                  href="/memory"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-white/20 text-white font-medium rounded-lg hover:border-white/40 transition-colors"
                >
                  How memory works
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── The device ─────── */}
      <section className="py-24 lg:py-32 border-t border-neutral-200">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5">
              <Reveal>
                <p className="text-sm text-accent font-medium tracking-wide uppercase mb-4">
                  The capture device
                </p>
              </Reveal>
              <Reveal delay={75}>
                <h2 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-6 leading-[1.1]">
                  A recorder built for the meetings software can&apos;t reach.
                </h2>
              </Reveal>
              <Reveal delay={150}>
                <p className="text-lg text-neutral-600 leading-relaxed">
                  Phone calls and video calls already have transcripts. The
                  conversations that don&apos;t — the client dinner, the factory
                  floor, the corridor decision — are where the real commitments
                  get made. A dedicated AI voice recorder captures them, and The
                  Autonomous does the rest.
                </p>
              </Reveal>
            </div>

            <div className="lg:col-span-7">
              <Reveal delay={150}>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    {
                      t: "One-button capture",
                      d: "Press to record, or start it from the app. No bot to invite, no laptop on the table.",
                    },
                    {
                      t: "Up to 90 hours, 64GB",
                      d: "Days of recording per charge and thousands of meetings on board. Full charge in ~1.5h over USB-C.",
                    },
                    {
                      t: "MagSafe, 54 grams",
                      d: "Aluminum body, 5.9mm thin. Snaps to the back of a phone or clips on — capture is never the bottleneck.",
                    },
                    {
                      t: "Auto-transfer",
                      d: "Recordings move to the companion app automatically, or pull the MP3s over USB-C. You own every file.",
                    },
                  ].map((f) => (
                    <div
                      key={f.t}
                      className="rounded-xl border border-neutral-200 bg-neutral-50 p-6"
                    >
                      <h3 className="font-[family-name:var(--font-serif)] text-xl text-primary mb-2">
                        {f.t}
                      </h3>
                      <p className="text-[15px] text-neutral-600 leading-relaxed">
                        {f.d}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Spec strip */}
                <dl className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-5 border-t border-neutral-200 pt-6">
                  {[
                    ["Storage", "64GB · up to 128GB"],
                    ["Recording", "Up to 90h / charge"],
                    ["Battery", "750mAh · 1.5h charge"],
                    ["Audio", "MP3"],
                    ["Body", "Aluminum · 54g · 5.9mm"],
                    ["Mount", "MagSafe + clip"],
                    ["Transfer", "App + USB-C"],
                    ["Control", "Button + app"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[10.5px] uppercase tracking-[0.14em] text-neutral-400 mb-1">
                        {k}
                      </dt>
                      <dd className="text-[14px] text-primary font-medium leading-snug">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="text-sm text-neutral-400 mt-5">
                  The Autonomous Recorder is our own hardware. The intelligence —
                  transcription, the knowledge graph, and agent recall — is what
                  The Autonomous adds on top.
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ─── The pipeline ─────── */}
      <section className="py-24 lg:py-32 bg-neutral-100 border-t border-neutral-200">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="max-w-3xl mb-16">
            <Reveal>
              <p className="text-sm text-accent font-medium tracking-wide uppercase mb-4">
                The flow
              </p>
            </Reveal>
            <Reveal delay={75}>
              <h2 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-[1.1]">
                From a recording to something your agents act on.
              </h2>
            </Reveal>
          </div>

          <div className="grid md:grid-cols-5 gap-6">
            {PIPELINE.map((s, i) => (
              <Reveal key={s.n} delay={i * 75}>
                <div className="h-full rounded-xl border border-neutral-200 bg-surface p-6">
                  <div className="font-[family-name:var(--font-mono)] text-accent text-sm mb-4">
                    {s.n}
                  </div>
                  <h3 className="font-[family-name:var(--font-serif)] text-xl text-primary mb-3">
                    {s.title}
                  </h3>
                  <p className="text-[14px] text-neutral-600 leading-relaxed">
                    {s.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── What agents do with it ─────── */}
      <section className="py-24 lg:py-32 border-t border-neutral-200">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="max-w-3xl mb-16">
            <Reveal>
              <p className="text-sm text-accent font-medium tracking-wide uppercase mb-4">
                Knowledge & context for agents
              </p>
            </Reveal>
            <Reveal delay={75}>
              <h2 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-[1.1] mb-6">
                The same meeting feeds every workflow.
              </h2>
            </Reveal>
            <Reveal delay={150}>
              <p className="text-lg text-neutral-600 leading-relaxed">
                Memory is a shared company brain, not a per-app silo. Every agent
                reads it as the company — so a meeting one person recorded informs
                an agent acting weeks later, without anyone re-typing a thing.
              </p>
            </Reveal>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {AGENTS.map((a, i) => (
              <Reveal key={a.role} delay={(i % 3) * 75}>
                <div className="h-full rounded-xl border border-neutral-200 bg-neutral-50 p-6">
                  <h3 className="font-[family-name:var(--font-serif)] text-xl text-primary mb-3">
                    {a.role}
                  </h3>
                  <p className="text-[14.5px] text-neutral-600 leading-relaxed">
                    {a.pulls}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Action items by role ─────── */}
      <section className="py-24 lg:py-32 bg-primary text-surface border-t border-neutral-800">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="max-w-3xl mb-16">
            <Reveal>
              <p className="text-sm text-accent font-medium tracking-wide uppercase mb-4">
                What to do, by role
              </p>
            </Reveal>
            <Reveal delay={75}>
              <h2 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-[1.1]">
                Clear next steps for everyone who touches it.
              </h2>
            </Reveal>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {ROLES.map((r, i) => (
              <Reveal key={r.role} delay={(i % 2) * 75}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-7">
                  <h3 className="font-[family-name:var(--font-serif)] text-2xl text-accent mb-2">
                    {r.role}
                  </h3>
                  <p className="text-[15px] text-white/55 leading-relaxed mb-5">
                    {r.summary}
                  </p>
                  <ul className="space-y-3">
                    {r.actions.map((act) => (
                      <li key={act} className="flex items-start gap-3">
                        <svg
                          className="w-4 h-4 text-accent mt-1 shrink-0"
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
                        <span className="text-[15px] text-white/80 leading-relaxed">
                          {act}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Privacy ─────── */}
      <section className="py-24 lg:py-32 border-t border-neutral-200">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <Reveal>
              <p className="text-sm text-accent font-medium tracking-wide uppercase mb-4">
                Privacy
              </p>
            </Reveal>
            <Reveal delay={75}>
              <h2 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl tracking-tight mb-6 leading-[1.1]">
                Company-shared by default. Private when it matters.
              </h2>
            </Reveal>
            <Reveal delay={150}>
              <p className="text-lg text-neutral-600 leading-relaxed">
                Recordings join the shared brain so your agents can use them. But
                any capture can be marked <span className="text-primary font-medium">private</span> —
                visible only to its owner, never to agents or teammates. A
                sensitive 1:1 stays a sensitive 1:1.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── CTA ─────── */}
      <section className="py-20 bg-neutral-100 border-t border-neutral-200">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8 text-center">
          <Reveal>
            <h2 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl tracking-tight mb-6">
              Put a recorder in every room that matters.
            </h2>
          </Reveal>
          <Reveal delay={75}>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-accent text-primary font-medium rounded-lg hover:bg-accent/90 transition-colors"
              >
                Talk to us about a fleet
              </a>
              <a
                href="/memory"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-neutral-300 text-primary font-medium rounded-lg hover:border-neutral-400 transition-colors"
              >
                Explore Autonomous Memory
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="py-10 bg-primary text-neutral-400 border-t border-neutral-800">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 text-sm">
          <span>© The Autonomous</span>
          <div className="flex items-center gap-6">
            <a href="/memory" className="hover:text-white transition-colors">
              Memory
            </a>
            <a href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </a>
            <a href="/contact" className="hover:text-white transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
