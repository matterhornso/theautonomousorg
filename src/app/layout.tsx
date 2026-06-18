import type { Metadata } from "next";
import { Instrument_Serif, DM_Sans, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { PwaRegister } from "./components/pwa-register";
import "./globals.css";

// Brand fonts wired to the CSS variables consumed in globals.css
// (--font-serif / --font-sans / --font-mono). Instrument Serif is the
// editorial display face, DM Sans the body/UI face, JetBrains Mono for code.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-instrument-serif",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-dm-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

// Canonical host is www. The apex (theautonomous.org) does not currently
// resolve at the DNS layer — every URL emitted to crawlers, AI agents,
// and social cards must use the www form, or they 404.
const CANONICAL_HOST = "https://www.theautonomous.org";

export const metadata: Metadata = {
  title: {
    default: "The Autonomous — AI Agents for Every Business Role",
    template: "%s | The Autonomous — AI Agents for Every Business Role",
  },
  description:
    "Run your company with AI agents. Sales, Marketing, Accounting, HR, Legal, Strategy, Engineering, and more. Enter your website, get personalized agent recommendations, and start automating your business in 2 minutes.",
  keywords: [
    "AI agents for business",
    "AI workforce automation",
    "AI sales agent",
    "AI marketing agent",
    "AI accounting agent",
    "AI HR agent",
    "autonomous company",
    "business automation AI",
    "AI employee",
    "AI business tools",
    "AI agent platform",
    "automate business with AI",
    "AI for small business",
    "Claude AI agents",
    "AI virtual employees",
  ],
  metadataBase: new URL(CANONICAL_HOST),
  alternates: {
    canonical: CANONICAL_HOST,
  },
  openGraph: {
    title: "The Autonomous — AI Agents for Every Business Role",
    description:
      "Enter your company website. Get AI agent recommendations. Launch agents for Sales, Marketing, HR, Accounting, Strategy, and more. Each agent has role-specific skills, persistent memory, and real tool integrations.",
    url: CANONICAL_HOST,
    siteName: "The Autonomous",
    images: [
      {
        // PNG first — Facebook, LinkedIn, and Bing Copilot reject SVG.
        url: `${CANONICAL_HOST}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "The Autonomous — AI Agents for Every Business Role",
        type: "image/png",
      },
      {
        url: `${CANONICAL_HOST}/og-image.svg`,
        width: 1200,
        height: 630,
        alt: "The Autonomous — AI Agents for Every Business Role",
        type: "image/svg+xml",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Autonomous — AI Agents for Every Business Role",
    description:
      "Run your company with AI agents. 14 roles, 168 skills, real tool integrations. Enter your website and launch your AI workforce in 2 minutes.",
    images: [`${CANONICAL_HOST}/og-image.png`],
    creator: "@chainflux",
    site: "@chainflux",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add Google Search Console + Bing Webmaster verification codes here
    // once the properties are claimed at www.theautonomous.org.
    // google: "your-google-verification-code",
    // other: { "msvalidate.01": "your-bing-verification-code" },
  },
  category: "technology",
};

// JSON-LD structured data for SEO and AEO/GEO.
// Every node uses an explicit @id so other nodes can reference them by graph
// — this lets blog post Article schemas link to the canonical Person/Organization
// without duplicating the data.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${CANONICAL_HOST}/#website`,
      name: "The Autonomous",
      url: CANONICAL_HOST,
      description:
        "AI agents for every role in your company. Sales, Marketing, Accounting, HR, Legal, Strategy, Engineering, and more.",
      publisher: { "@id": `${CANONICAL_HOST}/#organization` },
      inLanguage: "en-US",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${CANONICAL_HOST}/blog?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": `${CANONICAL_HOST}/#organization`,
      name: "The Autonomous",
      legalName: "The Autonomous Org",
      alternateName: ["The Autonomous Org", "TheAutonomous"],
      url: CANONICAL_HOST,
      logo: {
        "@type": "ImageObject",
        url: `${CANONICAL_HOST}/icon.svg`,
        width: 512,
        height: 512,
      },
      foundingDate: "2026",
      description:
        "The Autonomous Org builds AI-powered business automation tools. Creator of The Autonomous — AI agents for every role in your company.",
      founder: { "@id": `${CANONICAL_HOST}/#founder` },
      sameAs: [
        "https://twitter.com/chainflux",
        "https://github.com/matterhornso",
      ],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "hello@theautonomous.org",
        url: `${CANONICAL_HOST}/contact`,
        availableLanguage: ["English"],
      },
    },
    {
      "@type": "Person",
      "@id": `${CANONICAL_HOST}/#founder`,
      name: "Abhinav Ramesh",
      jobTitle: "Founder",
      worksFor: { "@id": `${CANONICAL_HOST}/#organization` },
      email: "abhinav@chainflux.com",
      url: `${CANONICAL_HOST}/about`,
      sameAs: [
        "https://twitter.com/chainflux",
        "https://github.com/matterhornso",
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${CANONICAL_HOST}/#software`,
      name: "The Autonomous",
      url: CANONICAL_HOST,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      description:
        "AI-powered platform that provides AI agents for every business role. Enter your company website, get personalized AI agent recommendations, and launch your autonomous workforce. Each agent comes with role-specific skills, persistent memory, and integrations with tools like Apollo.io, Instantly.ai, and more.",
      offers: [
        {
          "@type": "Offer",
          name: "Starter",
          price: "0",
          priceCurrency: "USD",
          description:
            "1,000 free credits on signup. No credit card required.",
        },
        {
          "@type": "Offer",
          name: "Growth",
          price: "49",
          priceCurrency: "USD",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: "49",
            priceCurrency: "USD",
            billingDuration: "P1M",
          },
          description: "5,000 credits per month.",
        },
      ],
      featureList: [
        "14 AI agent roles (Sales, Marketing, Accounting, HR, Legal, Strategy, Product, Engineering, AI Expert, Admin, Finance, Customer Success, Data Analyst)",
        "168 role-specific skills across all agents",
        "Proactive task execution — agents work before you ask",
        "Persistent memory across conversations",
        "Inter-agent collaboration via @mentions",
        "Real tool integrations (Apollo.io, Instantly.ai, Web Search)",
        "Custom agent builder for unique business roles",
        "WhatsApp and Telegram messaging bridges",
        "Analytics dashboard with per-agent performance metrics",
        "Self-serve REST API for programmatic access",
        "Credits-based pricing (1,000 free credits on signup)",
      ],
      creator: { "@id": `${CANONICAL_HOST}/#organization` },
      provider: { "@id": `${CANONICAL_HOST}/#organization` },
    },
    {
      "@type": "FAQPage",
      "@id": `${CANONICAL_HOST}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "What is The Autonomous?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The Autonomous is an AI platform that provides AI agents for every role in your company — Sales, Marketing, Accounting, HR, Legal, Strategy, Product, Engineering, and more. Each agent comes with role-specific skills, persistent memory across conversations, and real tool integrations like Apollo.io for prospect search and Instantly.ai for email automation. You enter your company website, the platform analyzes your business and recommends which agents would have the highest impact, and you launch your AI workforce in two minutes. Agents work proactively — researching prospects, auditing SEO, analyzing competitors — before you even ask.",
          },
        },
        {
          "@type": "Question",
          name: "How does The Autonomous work?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Enter your company website and the platform analyzes your business to recommend which agents would have the highest impact. Select the agents you want, and they are instantly provisioned with your company context, role-specific skills, and tool integrations. Agents start working proactively — researching prospects, auditing SEO, analyzing competitors — before you even ask. You communicate with them via WhatsApp, Telegram, or the web dashboard. Every agent reads and writes to a shared tenant-scoped memory, so your Sales agent already knows what your Strategy agent decided yesterday.",
          },
        },
        {
          "@type": "Question",
          name: "What AI agent roles are available?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The Autonomous offers 14 pre-built agent roles: Sales, Marketing, Accounting, Strategy, Product, Front-End Engineering, Back-End Engineering, AI Expert, Admin, HR, Finance, Customer Success, Legal, and Data Analyst. Each role ships with role-specific skills — the Sales agent knows how to write outbound sequences and qualify leads, the Marketing agent knows how to structure SEO audits, the Accounting agent knows how to categorize transactions and prepare for filings. You can also create custom agents with your own role definitions, skills, and instructions for unique business functions.",
          },
        },
        {
          "@type": "Question",
          name: "Is The Autonomous free?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, The Autonomous offers 1,000 free credits on signup with no credit card required. That covers roughly 20 conversations with your agents. Credit overage rates differ by tier: on the free Starter plan, additional credits are $19 per 1,000; on the Growth plan ($49 per month, which includes 5,000 credits), additional credits are $15 per 1,000. Enterprise plans include unlimited credits, all integrations, BYOM (Bring Your Own Model), SOC 2, HIPAA compliance, and dedicated support — pricing on request.",
          },
        },
        {
          "@type": "Question",
          name: "What tools do the AI agents integrate with?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The platform provides built-in integrations with Apollo.io (prospect search with 210M+ contacts), Instantly.ai (email campaign automation), Shopify Admin API (for the revenue agent), and Web Search. Additional integrations available via BYOK (Bring Your Own Key) include HubSpot, Slack, GitHub, Linear, Stripe, Google Workspace, QuickBooks, and others. The Memory product additionally syncs with Fireflies, Otter, and Granola so meeting transcripts flow into the shared knowledge graph automatically.",
          },
        },
        {
          "@type": "Question",
          name: "Can AI agents communicate with each other?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Agents collaborate using @mentions, just like a team in Slack. The Sales agent can ask the Admin agent to draft a contract — the system routes the message, the Admin agent executes, and the response is relayed back inside the Sales agent's conversation. Because every agent reads from a shared tenant-scoped knowledge graph, the agent answering already knows the customer context, the previous call notes, and the commitments made. This is how a small operator runs the work of a 10-20 person team.",
          },
        },
        {
          "@type": "Question",
          name: "What AI models can I use?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Claude Sonnet 4.6 is the default model — it is the best reasoning model available today and the platform works out of the box without any model configuration. The Growth and Enterprise plans support BYOM (Bring Your Own Model), so you can swap in GPT-4o, Gemini, Llama, Mistral, a fine-tune, or any OpenAI-compatible endpoint. Use Claude Haiku for high-throughput tasks, Opus for strategy work, or your own fine-tune for domain-specific judgment. The memory and the agents stay the same — only the brain changes.",
          },
        },
        {
          "@type": "Question",
          name: "How do I message my agents — WhatsApp, Telegram, or web?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "All three. The web dashboard is the full experience — every agent has a conversation surface, every run is logged, every artifact is searchable. WhatsApp and Telegram bridges let you talk to your agents from your phone — send a message, the agent acts on it, the agent messages back. Multiple humans on the same team can connect to the same agent. The platform handles handoff context automatically so a conversation that starts in WhatsApp can be continued from the dashboard without losing state.",
          },
        },
        {
          "@type": "Question",
          name: "Is my data secure and private?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Each company runs in an isolated tenant with row-level security on every database read. Data never crosses between companies — your agents cannot see another tenant's knowledge graph, and the platform enforces this at the database layer, not just in application code. All traffic is HTTPS, secrets are encrypted at rest, and Enterprise customers get SOC 2 Type I docs, a DPA, and HIPAA compliance for healthcare workflows. Conversation data is not used to train AI models.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${instrumentSerif.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
      >
        <head>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          {/* Suppress browser-extension errors (MetaMask et al) from the Next dev overlay. */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){var EXT="chrome-extension://";function isExt(s){return typeof s==="string"&&s.indexOf(EXT)===0}window.addEventListener("error",function(e){if(isExt(e.filename))e.stopImmediatePropagation()},true);window.addEventListener("unhandledrejection",function(e){var r=e.reason||{};var stack=(r&&r.stack)||"";var src=(r&&r.fileName)||"";if(isExt(stack)||stack.indexOf(EXT)>-1||isExt(src))e.stopImmediatePropagation()},true);})();`,
            }}
          />
        </head>
        <body>
          <PwaRegister />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
