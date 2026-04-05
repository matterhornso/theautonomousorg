# Launch To-Dos

## Before Monday Launch (Required)

### Your Action Items

- [x] ~~Add `RESEND_API_KEY` to env vars~~ — Done
- [x] ~~Verify Supabase database connection~~ — Done, healthy
- [x] ~~Verify domain SSL~~ — Done, TLSv1.3 valid until May 2026
- [x] ~~Set up Resend domain verification~~ — Done
- [ ] **Switch Clerk to production keys** — Currently using dev keys (your choice to keep for now). When ready: replace `pk_test_*` / `sk_test_*` with `pk_live_*` / `sk_live_*` in `.env.local` and Railway. Dev keys show "Development mode" badge and have rate limits.
- [ ] **Add Resend + Clerk keys to Railway env vars** — Local `.env.local` is set, but Railway production needs: `RESEND_API_KEY`, and eventually production Clerk keys
- [ ] **Commit and deploy latest code** — Newsletter API, contact API, PWA icons, scroll-behavior fix, enterprise email change are local only. Need to push to Railway.

## After Launch (Usability Improvements)

Findings from usability testing using Lenny Skills framework (Uri Levine, Judd Antin, Melanie Perkins, Kristen Berman principles):

### High Impact
- [ ] **Add loading progress for analysis form** — Claude API takes 25-45s. Users see only "Analyzing..." with a spinner and no time estimate. This is the #1 place users will abandon. Add a progress bar or "This usually takes 20-30 seconds" message.
- [ ] **Add a product demo video or GIF** — No media on the landing page. A 30-second screen recording of the analysis flow (enter URL → get recommendations → launch agents) would massively increase conversion. Per Guillermo Rauch: "give your product to another person and watch them interact with it."
- [ ] **Replace hypothetical use cases with real ones** — "A B2B SaaS startup" and "An e-commerce brand" read as fabricated. Even one real company name with a quote would 10x credibility. Per Melanie Perkins: "10 random people can give astute feedback."

### Medium Impact
- [ ] **Make FAQ section collapsible** — All 8 FAQs are expanded as static text, adding ~2000px to the page. Accordion pattern reduces scroll fatigue and lets users find their question faster.
- [ ] **Reduce page length** — Homepage is ~9700px (13+ screens). Consider consolidating the "Not chatbots. Actual teammates." section (8 feature cards) with the "How it works" section.
- [ ] **Add og-image as a proper PNG** — Current og-image is SVG. Some platforms (LinkedIn, iMessage) don't render SVG previews. Generate a 1200x630 PNG version.

### Low Impact (Polish)
- [ ] **Console 401 error on page load** — A single 401 from Clerk background request appears in console. Cosmetic, doesn't affect users.
- [ ] **Sign-up page title missing "Sign Up"** — Title is just "The Autonomous — AI Agents..." instead of "Sign Up | The Autonomous..." unlike sign-in which has "Sign In |".

## Usability Test Results (2026-04-05)

### What Works Well
- Hero headline "Your entire company, autonomous." communicates value in <5 seconds
- Website analysis form is the clear primary CTA
- Analysis results are personalized, detailed, and impressive (tested with stripe.com, linear.app, notion.so)
- "Launch agents" correctly redirects to sign-in
- Newsletter form submits and shows confirmation (Resend live)
- Contact form submits and shows "Message sent" (Resend live)
- Mobile responsive with working hamburger menu
- All 7 public pages load correctly
- API health: all checks passing, database connected
- Enterprise email correctly set to theautonomousorg@gmail.com
- No JS errors (only Clerk dev key warnings)
- SEO: title, meta, OG tags, JSON-LD, sitemap all present

### Friction Points Found
1. Analysis takes 25-45s with no progress feedback (users will think it's broken)
2. Page is very long (13+ screens of scrolling)
3. FAQ is not collapsible
4. Use cases read as hypothetical, not real
5. No video/demo showing the product in action

### Health Score: 95/100
