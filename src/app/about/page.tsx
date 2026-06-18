import { Navbar } from "../components/navbar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "The Autonomous gives companies an AI workforce for every business function — Sales, Marketing, Accounting, HR, Legal, Strategy, Product, Engineering, and more. Built by Chainflux.",
  alternates: { canonical: "https://www.theautonomous.org/about" },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 lg:px-8 pt-28 pb-20">
        <p className="text-xs uppercase tracking-wider text-accent-ink font-medium mb-3">
          About
        </p>
        <h1 className="font-[family-name:var(--font-serif)] text-4xl tracking-tight mb-4">
          Your entire company, autonomous.
        </h1>
        <p className="text-lg text-neutral-600 leading-relaxed mb-12 max-w-[680px]">
          The Autonomous gives companies an AI workforce for every business
          function — Sales, Marketing, Accounting, HR, Legal, Strategy, Product,
          Engineering, and more. Enter your website, get AI-powered
          recommendations for which agents would have the highest impact, and
          launch your AI workforce in under two minutes.
        </p>

        <div className="prose prose-neutral max-w-none space-y-10 text-[15px] leading-relaxed text-neutral-600">
          <section>
            <h2 className="font-[family-name:var(--font-serif)] text-2xl text-primary tracking-tight mb-3">
              What we do
            </h2>
            <p className="mb-3">
              The Autonomous is an AI-powered platform that enables companies to
              run their entire business with AI agents for every workflow. Unlike
              chatbots that answer questions and forget, our agents are
              autonomous workers — they research, execute, report back, remember
              everything, and get smarter over time.
            </p>
            <p>
              Each agent comes pre-configured with role-specific skills, real
              tool integrations like Apollo.io and Instantly.ai, persistent
              memory, and the ability to collaborate with other agents via
              @mentions. Every agent reads from and writes to one tenant-scoped
              knowledge graph — so your Sales agent already knows what your
              Strategy agent decided yesterday.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-serif)] text-2xl text-primary tracking-tight mb-3">
              How it works
            </h2>
            <ol className="space-y-3 list-decimal pl-5">
              <li>
                <span className="font-medium text-primary">
                  Enter your website.
                </span>{" "}
                Our AI analyzes your business — industry, team size, workflows,
                and growth stage.
              </li>
              <li>
                <span className="font-medium text-primary">
                  Get agent recommendations.
                </span>{" "}
                We recommend which AI agents would have the highest impact for
                your specific business.
              </li>
              <li>
                <span className="font-medium text-primary">
                  Spawn your agents.
                </span>{" "}
                Select the roles you need — each agent arrives pre-configured
                with the right skills, tools, and context.
              </li>
              <li>
                <span className="font-medium text-primary">
                  Connect via dashboard, WhatsApp, or Telegram.
                </span>{" "}
                Assign tasks, get updates, and make decisions wherever you
                prefer.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-serif)] text-2xl text-primary tracking-tight mb-3">
              Built by Chainflux
            </h2>
            <p className="mb-3">
              The Autonomous is built by Chainflux and founded by Abhinav
              Ramesh. It is designed for traditional small businesses adopting
              AI for the first time, as well as AI-native startups building
              closed-loop operations from day one — so a non-technical business
              owner can get AI agents working for their company in two minutes.
            </p>
            <p>
              Every agent runs on Claude Sonnet 4.6 by default, with Bring Your
              Own Model support on Growth and Enterprise plans. Each company runs
              in an isolated tenant with row-level security on every database
              read, all traffic is encrypted, and customer data is never used to
              train AI models.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-serif)] text-2xl text-primary tracking-tight mb-3">
              Get in touch
            </h2>
            <p>
              Questions, partnerships, or enterprise plans? Reach us at{" "}
              <a
                href="mailto:hello@theautonomous.org"
                className="text-accent-ink hover:underline"
              >
                hello@theautonomous.org
              </a>{" "}
              or visit our{" "}
              <a href="/contact" className="text-accent-ink hover:underline">
                contact page
              </a>
              . You can also follow{" "}
              <a
                href="https://twitter.com/chainflux"
                className="text-accent-ink hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                @chainflux
              </a>{" "}
              on X.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
