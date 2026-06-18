import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  // App surfaces
  "/admin(.*)",
  "/provisioning(.*)",
  "/dashboard(.*)",
  "/profile(.*)",
  "/onboarding(.*)",
  // Tenant-data API groups — all require an authenticated session.
  // NOTE: middleware only guarantees *a* session; each handler must STILL
  // verify the caller owns the specific resource (see assertCompanyOwnership).
  "/api/profile(.*)",
  "/api/agents(.*)",
  "/api/companies(.*)",
  "/api/provisioning(.*)",
  "/api/shopify(.*)",
  "/api/timesheets(.*)",
  "/api/contacts(.*)",
  "/api/vault(.*)",
  "/api/team(.*)",
  "/api/upload(.*)",
  "/api/files(.*)",
  "/api/workflows(.*)",
  "/api/tasks(.*)",
  "/api/keys(.*)",
  "/api/user-keys(.*)",
  "/api/evals(.*)",
  "/api/debrief(.*)",
  "/api/search(.*)",
  "/api/actions(.*)",
  "/api/chat(.*)",
  "/api/credits(.*)",
  "/api/leaderboard(.*)",
  // Intentionally NOT gated here — these authenticate themselves:
  //   /api/messaging/*        — inbound WhatsApp/Telegram webhooks (HMAC / secret-token)
  //   /api/billing/webhook    — Stripe signature-verified
  //   /api/cron/*             — CRON_SECRET (constant-time, header-only)
  //   /api/integrations/tally — bearer + cert fingerprint
  //   /api/webhooks/*         — per-webhook HMAC
  //   /api/admin/register-*   — INTERNAL_SECRET
  //   /api/agents/relay, /api/agents/runs/*/feedback, /api/memory/* — INTERNAL_SECRET
  //   /api/analyze, /api/contact, /api/newsletter, /api/memory-waitlist, /api/health — public
  // NOTE: agents/relay, agents/runs/*/feedback, agents/* are matched by
  // "/api/agents(.*)" above, so a *session* is required; their internal-secret
  // path is for server→server calls that bypass the session intentionally.
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
