import { Navbar } from "../../components/navbar";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title:
    "Inside Two AI-Native Companies: An Accounting Firm and a Revenue Agent",
  description:
    "Two case studies from The Autonomous — a chartered accountancy firm running its compliance loop on Telegram, and an e-commerce revenue agent shipping catalog edits in minutes. Same platform, different shapes.",
  alternates: {
    canonical:
      "https://theautonomous.org/blog/inside-two-ai-native-companies",
  },
  keywords: [
    "AI-native company",
    "AI for accounting firms",
    "AI revenue agent",
    "Shopify AI agent",
    "chartered accountancy AI",
    "autonomous workflows",
    "AI agents case study",
    "AI agents for SMB",
  ],
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline:
    "Inside Two AI-Native Companies: An Accounting Firm and a Revenue Agent",
  description:
    "Two case studies from The Autonomous — a chartered accountancy firm running its compliance loop on Telegram, and an e-commerce revenue agent shipping catalog edits in minutes.",
  author: {
    "@type": "Person",
    name: "Abhinav Ramesh",
    url: "https://theautonomous.org",
  },
  publisher: {
    "@type": "Organization",
    name: "TheAutonomous",
    url: "https://theautonomous.org",
    logo: {
      "@type": "ImageObject",
      url: "https://theautonomous.org/icon.svg",
    },
  },
  datePublished: "2026-05-13",
  dateModified: "2026-05-13",
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id":
      "https://theautonomous.org/blog/inside-two-ai-native-companies",
  },
};

export default function InsideTwoAiNativeCompaniesPage() {
  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <article className="max-w-[720px] mx-auto px-6 lg:px-8 pt-28 pb-20">
        <div className="mb-8">
          <Link
            href="/blog"
            className="text-sm text-accent hover:underline mb-4 inline-block"
          >
            &larr; Back to Blog
          </Link>
          <div className="flex items-center gap-3 text-xs text-neutral-400 mb-3">
            <time dateTime="2026-05-13">May 13, 2026</time>
            <span>&middot;</span>
            <span>8 min read</span>
            <span>&middot;</span>
            <span>Case studies</span>
          </div>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl sm:text-4xl lg:text-[42px] tracking-tight mb-4">
            Inside Two AI-Native Companies: An Accounting Firm and a Revenue
            Agent
          </h1>
          <p className="text-neutral-500 text-lg leading-relaxed">
            What does an AI-native company actually look like when it ships?
            Here are two customers running on The Autonomous today — a
            chartered accountancy firm closing its compliance loop on Telegram,
            and an e-commerce revenue agent shipping catalog edits in minutes
            instead of hours. Same platform. Different shapes.
          </p>
        </div>

        <div className="prose prose-neutral max-w-none space-y-6 text-[15px] leading-relaxed text-neutral-600">
          <p>
            We have argued elsewhere that the next decade of company-building
            belongs to teams that treat AI as the operating system they run on,
            not a tool they bolt onto existing workflows. That essay is{" "}
            <Link
              href="/blog/why-we-are-building-the-autonomous"
              className="text-accent hover:underline"
            >
              here
            </Link>
            .
          </p>
          <p>
            This is a different kind of post. Less theory, more receipts. Two
            companies, two industries, two completely different workflows — and
            one platform underneath. The Autonomous is the same product for
            both. The agents, the memory, the orchestration, the BYOM gateway,
            the WhatsApp and Telegram entry points — all shared. What changes
            is which agents are doing the work and which tools they reach for.
          </p>
          <p>
            That is what an AI-native company looks like in practice. The
            company picks the shape. The platform makes it real.
          </p>

          <h2 className="font-[family-name:var(--font-serif)] text-2xl text-primary mt-10 mb-4">
            Case Study 1 — JAA Associates: An AI-native chartered accountancy firm
          </h2>
          <p>
            <strong>Industry:</strong> Chartered accountancy ·{" "}
            <strong>Team size:</strong> ~12 ·{" "}
            <strong>Where they live:</strong> Bengaluru, India ·{" "}
            <strong>Channels:</strong> Telegram, the admin dashboard
          </p>
          <p>
            JAA Associates is a chartered accountancy firm serving small and
            mid-sized businesses across audit, taxation, and compliance. Like
            most CA firms in India, their week revolves around a relentless
            cadence of client deliverables — GST filings, TDS returns, balance
            sheet finalisations, audit fieldwork — all of which depend on the
            firm&apos;s associates submitting accurate timesheets on time.
          </p>
          <p>
            The problem they came to us with was deceptively boring. Every
            Friday, the partners spent hours chasing associates over WhatsApp:{" "}
            <em>did you submit your timesheet?</em> Associates would forget.
            Reminders would get lost in DMs. By Monday, billing was behind, and
            the partners were doing the same chase again. It was the kind of
            thing every CA firm in the country deals with — and the kind of
            thing no off-the-shelf tool solves cleanly, because the workflow is
            specific to how a CA firm bills, books, and reports.
          </p>
          <h3 className="font-semibold text-primary mt-6 mb-3">
            What we shipped together
          </h3>
          <p>
            We deployed a Telegram-native reminder loop on top of The
            Autonomous, tied to JAA&apos;s roster, calendar, and admin
            dashboard. The flow looks like this:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Every associate runs <code>/link their.email@jaa-associates.com</code>{" "}
              once. Their Telegram chat is now bound to their HR record.
            </li>
            <li>
              On a cron the firm configures from the admin UI (default: Daily
              5:00 PM IST), the platform scans for outstanding timesheets for
              the current ISO week and pings only the people who have not
              submitted.
            </li>
            <li>
              Associates reply <code>DONE</code> to mark the period submitted,
              or <code>HELP</code> to flag a blocker.
            </li>
            <li>
              When someone sends <code>HELP</code>, the platform writes a
              priority notification into the partner&apos;s admin inbox and
              pings the firm&apos;s designated point of contact on WhatsApp.
              The partner sees, in one place, every associate who needs
              attention — without having to reconstruct it from three separate
              chats.
            </li>
          </ul>
          <p>
            None of this is glamorous. That is the point. The compliance loop
            closes by itself. The partners get their Friday afternoons back.
            The associates get a single channel they actually check.
          </p>
          <h3 className="font-semibold text-primary mt-6 mb-3">
            Why this is an AI-native company, not just automation
          </h3>
          <p>
            A naive automation tool could send a reminder on a schedule. What
            makes JAA an AI-native firm is what happens after the reminders:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Every interaction — every <code>HELP</code>, every late
              submission, every blocker — is captured into the firm&apos;s
              shared memory. The CEO agent and the role agents read from it.
              Over a quarter, the firm starts to learn{" "}
              <em>which associates need different cadence, which clients drive
              the most late submissions, which periods are structurally
              hardest.</em>
            </li>
            <li>
              When the partner asks the platform a question in chat —{" "}
              <em>&quot;who is behind on this week?&quot;</em>,{" "}
              <em>&quot;what was last quarter&apos;s compliance rate?&quot;</em>{" "}
              — the agent answers from that memory. No spreadsheet pull. No
              re-asking the team.
            </li>
            <li>
              The firm can extend the loop with more agents — a GST
              reconciliation agent for the April 2026 IMS rule, an AR-chase
              agent for client billing, an audit-prep agent for season —
              without rebuilding the substrate. Each new agent reads from the
              same brain.
            </li>
          </ul>
          <p>
            The timesheet workflow is the wedge, not the ceiling. JAA can run
            their entire compliance practice on this surface as we ship more
            agents into it. That is what &quot;AI-native&quot; means in
            production: the company is shaped to learn, not just to execute.
          </p>

          <h2 className="font-[family-name:var(--font-serif)] text-2xl text-primary mt-10 mb-4">
            Case Study 2 — getsoma.store: An AI-native revenue agent
          </h2>
          <p>
            <strong>Industry:</strong> E-commerce (Shopify) ·{" "}
            <strong>Team size:</strong> Founder + small ops team ·{" "}
            <strong>Channels:</strong> Admin dashboard, Shopify Admin API
          </p>
          <p>
            getsoma.store is a direct-to-consumer Shopify merchant in a
            crowded category. Their problem was not chasing people. Their
            problem was velocity. A modern e-commerce store lives or dies on
            the catalog: titles, descriptions, tags, collections, prices,
            promotional copy. Each of those decisions is small. The number of
            them is not. A merchant who is on top of every product page is a
            merchant whose conversion rate moves; a merchant who is not, is a
            merchant whose competitors out-list them on the same search
            queries.
          </p>
          <p>
            They came to us because catalog maintenance was eating their week.
            Editing 30 product pages in the Shopify admin was a half-day. Doing
            competitor research for a category launch was another half-day.
            Doing both of those every week, while running ads and fulfilment,
            was the bottleneck.
          </p>
          <h3 className="font-semibold text-primary mt-6 mb-3">
            What we shipped together
          </h3>
          <p>
            We turned The Autonomous into a revenue agent for their store. The
            agent has two surfaces:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Competitor insights.</strong> The merchant clicks one
              button. The agent surveys their category — competitor product
              pages, pricing, positioning, common claims, gaps — and returns a
              ranked list of suggestions with the prompt prefilled. Each card
              has the explicit edit it recommends: a tag to add, a description
              to rewrite, a missing keyword cluster, a competitor price band
              they are out of. Category-aware. Not generic.
            </li>
            <li>
              <strong>Prompt-driven catalog edits.</strong> The merchant
              describes the change in plain English —{" "}
              <em>&quot;Add the &apos;clean-ingredients&apos; tag to every
              product in the Hair Care collection that doesn&apos;t already
              have it&quot;</em> — and the agent plans the exact mutations
              against the Shopify Admin API, shows them in a diff, and applies
              them only after the merchant approves. Each apply is sequential
              and rollback-safe. If something fails midway, the agent stops and
              tells the merchant exactly which products were modified.
            </li>
          </ul>
          <p>
            The result is the same kind of compression as the JAA loop. What
            used to be a half-day of admin work is now a ten-minute review.
            What used to be impossible — competitive research at the depth of
            a category specialist, on demand — is now a button click.
          </p>
          <h3 className="font-semibold text-primary mt-6 mb-3">
            Why this is a revenue agent, not just a Shopify editor
          </h3>
          <p>
            The natural framing for this product is &quot;a faster Shopify
            admin.&quot; That framing under-sells what is actually happening.
            The agent is not a faster keyboard. It is the merchant&apos;s
            judgment, amplified.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Every edit teaches the agent.</strong> Approved
              suggestions, rejected suggestions, and modified suggestions all
              flow back into the merchant&apos;s lessons graph. The next
              insights run is sharper because the merchant&apos;s
              brand voice and risk appetite are now part of the brain.
            </li>
            <li>
              <strong>The same agent extends to other revenue work.</strong> A
              merchant who runs an insights pass once a week starts asking the
              agent harder questions:{" "}
              <em>which collections underperform on weekends?</em>,{" "}
              <em>which descriptions correlate with returns?</em> The platform
              answers those from the data it has captured. No new tool. Same
              agent, smarter context.
            </li>
            <li>
              <strong>It is multi-channel by default.</strong> The merchant can
              kick off an insights run from the admin dashboard, or from
              Telegram, or — once the inbound surface is live — from a
              WhatsApp message between meetings. The agent does not care which
              channel the human is on.
            </li>
          </ul>

          <h2 className="font-[family-name:var(--font-serif)] text-2xl text-primary mt-10 mb-4">
            Same platform. Different shapes. That is the point.
          </h2>
          <p>
            The two companies above could not look more different on the
            surface. One is a chartered accountancy firm in Bengaluru working
            in Telegram and Excel. The other is a Shopify merchant working in
            an admin dashboard and the Shopify Admin API. They have no shared
            buyer, no shared tooling, and no shared cadence.
          </p>
          <p>
            They do, however, share an architecture. Both are running on the
            same multi-tenant platform. Both have a CEO orchestrator agent
            routing inbound messages. Both write every run into a tenant-scoped
            knowledge graph, and every agent reads from that graph before it
            executes. Both use Claude Sonnet 4.6 as the default brain, and
            either could swap to OpenAI or Gemini or a fine-tune without a
            migration. Both write lessons after every run so the next run is
            smarter than the last.
          </p>
          <p>
            That is the bet. We do not believe the future of AI is one
            vertical-specific copilot per industry — we have seen how many
            failed AI sales agents and abandoned AI bookkeepers there already
            are. We also do not believe the future is a thousand isolated
            chatbots. The future is a small number of horizontal platforms
            that let any company assemble the workforce it needs, in the
            channels its people already use, with the model it already trusts.
          </p>
          <p>
            Two companies in two industries proving that thesis is a start.
            The next ten will be different again. We expect that. The platform
            is designed for it.
          </p>

          <h2 className="font-[family-name:var(--font-serif)] text-2xl text-primary mt-10 mb-4">
            If your company should be on this list
          </h2>
          <p>
            We are taking on design-partner customers in two phases. If you
            are a services firm — CA firm, law firm, audit firm, consultancy —
            with a workflow that lives in WhatsApp and spreadsheets, we want
            to talk. If you are a Shopify merchant or a D2C operator whose
            catalog is eating your week, we want to talk. If you are
            somewhere else entirely and you can describe one workflow that
            costs your team ten hours a week, we still want to talk — that is
            usually the right starting wedge.
          </p>
          <p>
            Enter your website at{" "}
            <Link href="/" className="text-accent hover:underline">
              theautonomous.org
            </Link>{" "}
            to see what your workforce would look like. Or email{" "}
            <a
              href="mailto:abhinav@chainflux.com"
              className="text-accent hover:underline"
            >
              abhinav@chainflux.com
            </a>{" "}
            with one paragraph on what you would have an agent do tomorrow if
            it could.
          </p>
          <p className="text-primary font-medium">
            The era of the autonomous company is here. You pick the shape.
          </p>

          <div className="mt-16 pt-8 border-t border-neutral-200">
            <p className="text-sm text-neutral-500">
              Abhinav Ramesh is the founder of Chainflux and the maker of The
              Autonomous. Reach him at{" "}
              <a
                href="mailto:abhinav@chainflux.com"
                className="text-accent hover:underline"
              >
                abhinav@chainflux.com
              </a>{" "}
              or{" "}
              <a
                href="https://twitter.com/chainflux"
                className="text-accent hover:underline"
              >
                @chainflux
              </a>
              .
            </p>
          </div>

          <div className="mt-12 grid sm:grid-cols-2 gap-4">
            <Link
              href="/blog/why-we-are-building-the-autonomous"
              className="block p-5 bg-white border border-neutral-200/80 rounded-xl hover:shadow-md hover:-translate-y-px transition-all duration-300"
            >
              <p className="text-xs text-accent font-medium uppercase tracking-wider mb-1">
                Related reading
              </p>
              <h3 className="font-semibold text-sm">
                Why We&apos;re Building The Autonomous
              </h3>
            </Link>
            <Link
              href="/blog/how-to-automate-sales"
              className="block p-5 bg-white border border-neutral-200/80 rounded-xl hover:shadow-md hover:-translate-y-px transition-all duration-300"
            >
              <p className="text-xs text-accent font-medium uppercase tracking-wider mb-1">
                Related reading
              </p>
              <h3 className="font-semibold text-sm">
                How to Automate Sales with AI Agents
              </h3>
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
