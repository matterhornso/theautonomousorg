import { Navbar } from "../components/navbar";
import type { Metadata } from "next";
import Link from "next/link";

const BLOG_URL = "https://www.theautonomous.org/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Insights on AI agents, business automation, and the future of autonomous companies. Guides, comparisons, and strategies from The Autonomous.",
  alternates: { canonical: BLOG_URL },
  openGraph: {
    type: "website",
    url: BLOG_URL,
    title: "The Autonomous Blog",
    description:
      "Insights on AI agents, business automation, and the future of autonomous companies.",
  },
};

const posts = [
  {
    slug: "inside-two-ai-native-companies",
    title:
      "Inside Two AI-Native Companies: An Accounting Firm and a Revenue Agent",
    description:
      "Two case studies from The Autonomous — a chartered accountancy firm closing its compliance loop on Telegram, and an e-commerce revenue agent shipping catalog edits in minutes. Same platform, different shapes.",
    date: "2026-05-13",
    readTime: "8 min read",
  },
  {
    slug: "why-we-are-building-the-autonomous",
    title:
      "Why We're Building The Autonomous: The Operating System for AI-Native Companies",
    description:
      "Most companies treat AI as a productivity tool. The next decade belongs to companies that treat it as the operating system they run on. Here's why.",
    date: "2026-05-12",
    readTime: "9 min read",
  },
  {
    slug: "what-are-ai-agents",
    title: "What Are AI Agents? A Complete Guide for Business Leaders (2026)",
    description:
      "Learn what AI agents are, how they differ from traditional software, and why businesses are adopting AI workforces to automate Sales, Marketing, HR, and more.",
    date: "2026-03-26",
    readTime: "8 min read",
  },
  {
    slug: "ai-agents-vs-chatbots",
    title:
      "AI Agents vs Chatbots: Why Your Business Needs Actual Teammates, Not Chat Windows",
    description:
      "Chatbots answer questions. AI agents do the work. Understand the fundamental differences and why it matters for your business.",
    date: "2026-03-26",
    readTime: "6 min read",
  },
  {
    slug: "how-to-automate-sales",
    title: "How to Automate Sales with AI Agents: A Step-by-Step Guide",
    description:
      "A practical guide to automating your sales pipeline with AI agents — from prospect research to demo scheduling to CRM updates.",
    date: "2026-03-26",
    readTime: "9 min read",
  },
];

const blogJsonLd = {
  "@context": "https://schema.org",
  "@type": "Blog",
  "@id": BLOG_URL,
  name: "The Autonomous Blog",
  description:
    "Insights on AI agents, business automation, and the future of autonomous companies. Guides, comparisons, and strategies from The Autonomous.",
  url: BLOG_URL,
  publisher: { "@id": "https://www.theautonomous.org/#organization" },
  isPartOf: { "@id": "https://www.theautonomous.org/#website" },
  blogPost: posts.map((p) => ({
    "@type": "BlogPosting",
    "@id": `https://www.theautonomous.org/blog/${p.slug}`,
    headline: p.title,
    description: p.description,
    url: `https://www.theautonomous.org/blog/${p.slug}`,
    datePublished: p.date,
    author: {
      "@type": "Person",
      "@id": "https://www.theautonomous.org/#founder",
      name: "Abhinav Ramesh",
    },
    publisher: { "@id": "https://www.theautonomous.org/#organization" },
  })),
};

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }}
      />
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 pt-28 pb-20">
        <h1 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl tracking-tight mb-4">
          Blog
        </h1>
        <p className="text-neutral-500 text-lg mb-12 max-w-2xl">
          Insights on AI agents, business automation, and the future of
          autonomous companies.
        </p>

        <div className="grid gap-8 max-w-3xl">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block p-6 bg-white border border-neutral-200/80 rounded-xl hover:shadow-md hover:shadow-neutral-900/[0.04] hover:-translate-y-px transition-all duration-300"
            >
              <div className="flex items-center gap-3 text-xs text-neutral-400 mb-3">
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                <span>&middot;</span>
                <span>{post.readTime}</span>
              </div>
              <h2 className="font-[family-name:var(--font-serif)] text-xl sm:text-2xl tracking-tight mb-2 group-hover:text-accent transition-colors">
                {post.title}
              </h2>
              <p className="text-neutral-500 text-sm leading-relaxed">
                {post.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
