import { MetadataRoute } from "next";

// Canonical host — www is the live, resolving hostname.
// The apex (theautonomous.org) returns a connection error; all URLs must use www.
const BASE = "https://www.theautonomous.org";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // ── Core marketing pages ────────────────────────────────────────────────
    {
      url: BASE,
      lastModified: new Date("2026-05-13"), // last structural content change
      priority: 1.0,
    },
    {
      url: `${BASE}/memory`,
      lastModified: new Date("2026-05-12"),
      priority: 0.9,
    },
    {
      url: `${BASE}/contact`,
      lastModified: new Date("2026-03-21"),
      priority: 0.6,
    },

    // ── Blog index ──────────────────────────────────────────────────────────
    {
      url: `${BASE}/blog`,
      lastModified: new Date("2026-05-13"), // bumped when latest post shipped
      priority: 0.8,
    },

    // ── Blog posts — ordered by datePublished desc ──────────────────────────
    // inside-two-ai-native-companies: datePublished 2026-05-13 (was missing)
    {
      url: `${BASE}/blog/inside-two-ai-native-companies`,
      lastModified: new Date("2026-05-13"),
      priority: 0.75,
    },
    // why-we-are-building-the-autonomous: datePublished 2026-05-12 (was missing)
    {
      url: `${BASE}/blog/why-we-are-building-the-autonomous`,
      lastModified: new Date("2026-05-12"),
      priority: 0.75,
    },
    // Original trio — all datePublished 2026-03-26
    {
      url: `${BASE}/blog/what-are-ai-agents`,
      lastModified: new Date("2026-03-26"),
      priority: 0.7,
    },
    {
      url: `${BASE}/blog/ai-agents-vs-chatbots`,
      lastModified: new Date("2026-03-26"),
      priority: 0.7,
    },
    {
      url: `${BASE}/blog/how-to-automate-sales`,
      lastModified: new Date("2026-03-26"),
      priority: 0.7,
    },

    // ── Legal ───────────────────────────────────────────────────────────────
    {
      url: `${BASE}/privacy`,
      lastModified: new Date("2026-03-21"),
      priority: 0.3,
    },
    {
      url: `${BASE}/terms`,
      lastModified: new Date("2026-03-21"),
      priority: 0.3,
    },

    // ── Excluded (do NOT add back without review) ───────────────────────────
    // /sign-in          — auth page; Google ignores but it pollutes the index
    // /sign-up          — same reason
    // /dashboard/*      — behind auth; also Disallowed in robots.txt
    // /admin/*          — internal tooling
    // /api/*            — API routes
    // /onboarding       — post-auth flow; Disallowed in robots.txt
    // /provisioning/*   — Disallowed in robots.txt
    // /profile          — user-specific, behind auth
  ];
}
