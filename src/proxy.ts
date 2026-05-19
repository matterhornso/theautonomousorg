import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/admin(.*)",
  "/provisioning(.*)",
  "/dashboard(.*)",
  "/profile(.*)",
  "/onboarding(.*)",
  "/api/profile(.*)",
  "/api/agents(.*)",
  "/api/companies(.*)",
  "/api/provisioning(.*)",
  "/api/shopify(.*)",
  "/api/timesheets(.*)",
  "/api/contacts(.*)",
  "/api/vault(.*)",
  // NOT gated here (route handlers do their own auth with internal-secret bypass):
  //   /api/memory/*           — Deepgram / Fireflies / Zoom webhooks
  //   /api/admin/register-*   — CI deploy hooks
  //   /api/agents/relay       — server→server inter-agent calls
  //   /api/agents/runs/*/feedback — agent self-rating with internal secret
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
