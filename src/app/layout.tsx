import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { PwaRegister } from "./components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "The Autonomous — AI Agents for Every Business Role",
    template: "%s | TheAutonomous — AI Agents for Every Business Role",
  },
  description:
    "Run your company with AI agents. Sales, Marketing, Accounting, HR, Legal, Strategy, Engineering, and more. Enter your website, get personalized agent recommendations, and start automating your business in 2 minutes. Built by Chainflux.",
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
  metadataBase: new URL("https://theautonomous.org"),
  alternates: {
    canonical: "https://theautonomous.org",
  },
  openGraph: {
    title: "The Autonomous — AI Agents for Every Business Role",
    description:
      "Enter your company website. Get AI agent recommendations. Launch agents for Sales, Marketing, HR, Accounting, Strategy, and more. Each agent has role-specific skills, persistent memory, and real tool integrations.",
    url: "https://theautonomous.org",
    siteName: "TheAutonomous",
    images: [
      {
        url: "https://theautonomous.org/og-image.svg",
        width: 1200,
        height: 630,
        alt: "TheAutonomous — AI Agents for Every Business Role",
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
    images: ["https://theautonomous.org/og-image.svg"],
    creator: "@chainflux",
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
    // Add your verification codes when you set them up
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
  },
  category: "technology",
};

// JSON-LD structured data for SEO and AEO/GEO
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "The Autonomous",
      url: "https://theautonomous.org",
      description:
        "AI agents for every role in your company. Sales, Marketing, Accounting, HR, Legal, Strategy, Engineering, and more.",
      publisher: {
        "@type": "Organization",
        name: "Chainflux",
        url: "https://chainflux.io",
      },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate:
            "https://theautonomous.org/?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "SoftwareApplication",
      name: "The Autonomous",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "AI-powered platform that provides AI agents for every business role. Enter your company website, get personalized AI agent recommendations, and launch your autonomous workforce. Each agent comes with role-specific skills, persistent memory, and integrations with tools like Apollo.io, Instantly.ai, and more.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free tier with 1000 credits. Paid plans starting at $5.",
      },
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
        "Credits-based pricing (1000 free credits on signup)",
      ],
      creator: {
        "@type": "Organization",
        name: "Chainflux",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is The Autonomous?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The Autonomous is an AI platform that provides AI agents for every role in your company — Sales, Marketing, Accounting, HR, Legal, Strategy, Product, Engineering, and more. Each agent comes with role-specific skills, persistent memory, and real tool integrations. You enter your company website, get personalized agent recommendations, and launch your AI workforce in 2 minutes.",
          },
        },
        {
          "@type": "Question",
          name: "How does The Autonomous work?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Enter your company website and our AI analyzes your business to recommend which agents would have the highest impact. Select the agents you want, and they're instantly provisioned with your company context, role-specific skills, and tool integrations. Agents start working proactively — researching prospects, auditing SEO, analyzing competitors — before you even ask.",
          },
        },
        {
          "@type": "Question",
          name: "What AI agent roles are available?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The Autonomous offers 14 pre-built agent roles: Sales, Marketing, Accounting, Strategy, Product, Front-End Engineering, Back-End Engineering, AI Expert, Admin, HR, Finance, Customer Success, Legal, and Data Analyst. You can also create custom agents with your own role definitions, skills, and instructions.",
          },
        },
        {
          "@type": "Question",
          name: "Is The Autonomous free?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, The Autonomous offers 1000 free credits on signup, which covers approximately 20 conversations with your agents. Additional credits can be purchased starting at $5 for 500 credits. No credit card is required to start.",
          },
        },
        {
          "@type": "Question",
          name: "What tools do the AI agents integrate with?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The platform provides built-in integrations with Apollo.io (prospect search with 210M+ contacts), Instantly.ai (email campaign automation), and Web Search. Additional integrations available via BYOK (Bring Your Own Key) include HubSpot, Slack, GitHub, Linear, Stripe, Google Workspace, and more.",
          },
        },
        {
          "@type": "Question",
          name: "Can AI agents communicate with each other?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, agents can collaborate using @mentions. For example, the Sales agent can ask the Admin agent to draft a contract, and the system automatically routes the message, gets the response, and relays it back. This makes your AI agents work like a real team.",
          },
        },
      ],
    },
    {
      "@type": "Organization",
      name: "Chainflux",
      url: "https://chainflux.io",
      foundingDate: "2026",
      description:
        "Chainflux builds AI-powered business automation tools. Creator of The Autonomous — AI agents for every role in your company.",
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0A0A0B" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        <ClerkProvider>{children}</ClerkProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
