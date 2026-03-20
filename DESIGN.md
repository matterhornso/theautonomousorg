# Design System — TheAutonomous.org

## Product Context
- **What this is:** AI platform that enables companies to run their entire business with AI agents for every workflow — Sales, Marketing, Accounting, Strategy, Product Development, Engineering, PM, and AI expertise
- **Who it's for:** CTOs, COOs, and founders of SMBs and enterprises looking to augment or automate business workflows with AI
- **Space/industry:** AI agent platforms, workflow automation (peers: CrewAI, 11x.ai, Lindy.ai, n8n)
- **Project type:** Marketing site / landing page → future web app

## Aesthetic Direction
- **Direction:** Editorial/Magazine meets Luxury/Refined
- **Decoration level:** Intentional — subtle grain texture on hero, clean elsewhere
- **Mood:** Confident, cerebral, premium. Like reading a beautifully designed business magazine that happens to be about AI. Not "techy dark mode" — sophisticated and grounded. The product runs your whole company; the design should feel like it belongs in a boardroom, not a hackathon.
- **Reference sites:** 11x.ai (editorial warmth, serif headings), Stripe (clarity, whitespace), Linear (precision, dark sections)

## Typography
- **Display/Hero:** Instrument Serif — warm editorial presence, distinctive in a space full of geometric sans-serifs. Commands attention without shouting.
- **Body:** DM Sans — clean, modern, excellent readability at all sizes. Slightly warmer than Inter without being quirky.
- **UI/Labels:** DM Sans (medium weight)
- **Data/Tables:** DM Sans (tabular-nums)
- **Code:** JetBrains Mono
- **Loading:** Google Fonts CDN
- **Scale:**
  - Display 1: 72px / 4.5rem (hero headline)
  - Display 2: 56px / 3.5rem (section headlines)
  - H1: 48px / 3rem
  - H2: 36px / 2.25rem
  - H3: 24px / 1.5rem
  - Body Large: 20px / 1.25rem
  - Body: 16px / 1rem
  - Small: 14px / 0.875rem
  - Micro: 12px / 0.75rem

## Color
- **Approach:** Restrained — color is rare and meaningful
- **Primary:** #0A0A0B — near-black, the confident foundation
- **Accent:** #D4A853 — warm gold/amber. Distinctive in a sea of purple/blue AI gradients. Signals premium, not "tech startup." Used sparingly for CTAs and key highlights.
- **Secondary:** #2D5A3D — deep forest green. Trust, growth, autonomy. Used for secondary actions and success states.
- **Surface Light:** #FAFAF8 — warm off-white, avoids sterile pure white
- **Surface Mid:** #F0EDE6 — warm cream for card backgrounds and alternating sections
- **Neutrals:** warm grays
  - 50: #FAFAF8
  - 100: #F0EDE6
  - 200: #E2DED4
  - 300: #C4BFB3
  - 400: #A09A8D
  - 500: #7D776B
  - 600: #5A554B
  - 700: #3D3935
  - 800: #252320
  - 900: #0A0A0B
- **Semantic:** success #2D5A3D, warning #C4891A, error #B33A3A, info #3A6B9B
- **Dark mode:** Invert surfaces (900→background, 50→text), reduce accent saturation 15%, use #1A1918 as card surface

## Spacing
- **Base unit:** 8px
- **Density:** Spacious — generous whitespace signals premium
- **Scale:** 2xs(4) xs(8) sm(16) md(24) lg(32) xl(48) 2xl(64) 3xl(96) 4xl(128)

## Layout
- **Approach:** Editorial/hybrid — creative for hero and marketing sections, grid-disciplined for feature comparisons
- **Grid:** 12 columns, 1280px max
- **Max content width:** 1280px (prose max: 720px for readability)
- **Border radius:** sm:6px, md:12px, lg:16px, xl:24px, full:9999px

## Motion
- **Approach:** Intentional — smooth entrance animations and scroll reveals, nothing gratuitous
- **Easing:** enter(cubic-bezier(0.16, 1, 0.3, 1)) exit(ease-in) move(cubic-bezier(0.45, 0, 0.55, 1))
- **Duration:** micro(100ms) short(200ms) medium(350ms) long(500ms)
- **Scroll reveals:** Elements fade up 20px with medium duration, staggered 75ms per item

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-20 | Instrument Serif for display | Editorial warmth, breaks from ubiquitous geometric sans in AI space |
| 2026-03-20 | Gold/amber accent instead of purple/blue | Every AI startup uses purple gradients. Gold signals premium and stands out. |
| 2026-03-20 | Warm off-white surfaces | Avoids sterile tech feel, aligns with editorial direction |
| 2026-03-20 | Spacious density | Premium positioning demands generous whitespace |
| 2026-03-20 | Restrained color approach | Color is meaningful when rare. Let typography and whitespace do the work. |
