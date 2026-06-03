# Marketing Site — Astro Port Spec

Herbie — port the brand marketing site from HTML prototype to a production Astro project. Standard venture stack (Astro 4.x, Cloudflare Pages, GitHub under sbgolf org). The HTML prototype is the visual source of truth — match it, don’t improvise.

This site is the venture’s storefront. It must itself pass the launch gate from `TEMPLATE_STANDARDS.md` — we cannot ship a marketing site that promises 95+ Lighthouse scores and doesn’t hit them itself.

-----

## Source materials

- **Visual spec:** `brand-marketing-site.html` (attached to this prompt or in workspace root)
- **Authoritative venture docs** (already in your workspace):
  - `PROJECT_BRIEF.md` — mission, ICP, business model
  - `ARCHITECTURE.md` — approved stack and tooling
  - `OPERATING_PRINCIPLES.md` — behavioral rules
  - `TEMPLATE_STANDARDS.md` — performance gates that apply here too
- **This prompt** is the functional + structural spec.

-----

## Repo and workspace

- **Repo:** `sbgolf/marketing-site` (rename to `sbgolf/[brand-slug]-marketing` once name is locked)
- **Workspace:** `/Users/clawdbot/.hermes/hermes-agent/marketing-site/`
- **Branch model:** `main` for production, `staging` for Steve review, feature branches for incremental work
- **Deploy target:** Cloudflare Pages with automatic branch previews (preview URLs go in PR comments)

-----

## Tech stack

- **Astro 4.x** with TypeScript
- **No Tailwind.** Use CSS custom properties exactly as the prototype does — this is intentional. Astro’s scoped `<style>` tags per component handle isolation cleanly.
- **No client-side framework.** The prototype uses ~30 lines of vanilla JS. Keep it that way; the only reason to add React/Svelte islands is if a future section genuinely needs reactive state.
- **Fonts via `@fontsource`** rather than the Google Fonts CDN — improves Lighthouse, removes a third-party DNS lookup.
- **Approved tooling only** per `ARCHITECTURE.md`. Don’t introduce dependencies without flagging to Steve.

-----

## File structure

```
marketing-site/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── public/
│   ├── favicon.svg
│   ├── og-image.jpg          # 1200×630, needs design — see Open Decisions
│   └── robots.txt
└── src/
    ├── layouts/
    │   └── Base.astro        # html shell, head meta, font preload, grain overlay, SVG defs
    ├── pages/
    │   └── index.astro       # the only page; composes all sections
    ├── components/
    │   ├── Nav.astro
    │   ├── Hero.astro
    │   ├── Problem.astro
    │   ├── Templates.astro
    │   ├── HowItWorks.astro
    │   ├── Credibility.astro
    │   ├── BuiltFor.astro
    │   ├── Pricing.astro
    │   ├── AuditForm.astro
    │   ├── FAQ.astro
    │   ├── Finale.astro
    │   └── Footer.astro
    ├── styles/
    │   ├── tokens.css        # CSS custom properties (colors, type, spacing, radii)
    │   └── base.css          # resets, body defaults, grain, ::selection
    └── scripts/
        ├── nav.ts            # mobile menu toggle, hamburger animation, body scroll lock, Escape close
        ├── reveal.ts         # IntersectionObserver for .reveal and .stagger
        ├── smoothScroll.ts   # in-page anchor link interception
        └── auditForm.ts      # form submission handler (see Open Decisions)
```

-----

## Design tokens (preserve exactly)

Copy these as-is from the prototype into `tokens.css`. Do not adjust values without Steve sign-off.

```css
:root{
  --ink:#0E1729;
  --ink-2:#1A2438;
  --paper:#FAFAF7;
  --paper-2:#F0EDE5;
  --accent:#FF4D3D;
  --accent-deep:#D43B2D;
  --teal:#1FB8C4;
  --gold:#F5C04A;
  --muted:#8A93A6;
  --line:rgba(14,23,41,.12);
  --line-dark:rgba(250,250,247,.14);
  --maxw:1200px;
  --r-lg:24px;
}
```

**Typography:**

- Display: Instrument Serif (italic for emphasis, never bold)
- Body / UI: Plus Jakarta Sans (weights 400, 500, 600, 700, 800)
- Data callouts: JetBrains Mono (weights 400, 500)

-----

## Section-by-section component spec

Each component below corresponds to a `<section>` in the prototype. Match HTML structure, classes, and inline animations.

1. **Nav.astro** — sticky top nav, `.scrolled` class on body scroll past 40px, `.menu-open` class when mobile menu open. Brand mark + 5 links + audit CTA + hamburger.
1. **Hero.astro** — eyebrow, h1 with italic emphasis, lead, dual CTA, trust row. Right column: tilted browser mock with Cascade hero render (SVG mountains, gradient bg, sun) + floating Lighthouse badge with SVG ring gauge.
1. **Problem.astro** — bento layout (1.55fr / 1fr, 2 rows). Card 01 dominates: oversized italic number, italic-serif heading, search-ranking visualization (4 result rows, the 4th highlighted as “Your Race #47”), stat pill. Cards 02/03 stack on right, smaller.
1. **Templates.astro** — main grid: Cascade card (full hero render with gradient sun + mountains) + Community card (cream/terracotta with photo placeholder block). Below: 3 mini cards for Trail / Performance / Charity (“Coming next”).
1. **HowItWorks.astro** — dark section (–ink). Dotted gold connecting line behind 4 step cards. Each step: gold-ringed circle with mono number, h4, copy, time pill.
1. **Credibility.astro** — paper-2 background. Left: copy + signature line. Right: dark “What We Measure On Every Site” callout with 6 metrics (95+ Lighthouse Performance, 100 SEO, 100 Accessibility, <2s LCP, <0.1 CLS, 14 days Contract to Live).
1. **BuiltFor.astro** — centered. Italic-emphasis h2. Row of 7 pill chips (USATF-Certified, Boston Qualifiers, Trail & Ultra, Community 5Ks, Charity, Multi-Distance, RRCA). Hover inverts chip to dark.
1. **Pricing.astro** — 3 tiers. Standard is featured (lifted, dark background, “Most popular” tag). Bullet lists use coral checkmark masks.
1. **AuditForm.astro** — dark section. Left: copy + “What you’ll get back” mono list. Right: paper form card with tilted “Site Audit · Your Race” report mock behind it (hidden on mobile per breakpoint).
1. **FAQ.astro** — accordion. Instrument Serif questions. Coral plus icons rotate 135° on open. Single-open behavior (opening one closes others).
1. **Finale.astro** — centered final CTA with italic-emphasis h2 and primary button.
1. **Footer.astro** — 4-column grid on dark background. Brand + tagline, Product links, Company links, Connect links. Footer bottom with copyright.

-----

## Critical fidelity points

Don’t lose these in translation. They’re what makes the site feel intentional rather than generic SaaS.

- **Bento Problem layout** — the asymmetric 1.55fr / 1fr grid with card 01 spanning two rows. Collapses to single column on mobile.
- **Floating Lighthouse badge** — SVG ring with `lhg` gradient definition (cyan to green), `98` score in Instrument Serif. Floats with 1.5s-delayed animation offset to the browser mock.
- **Browser mock with Cascade hero** — full gradient background (#FFD8A8 → #0B0E13), radial sun, SVG mountain silhouettes, countdown row. This is what visually demonstrates “we build sites like this.”
- **Dotted connecting line** — `repeating-linear-gradient` between step cards in How It Works. Hidden on mobile (steps stack vertically).
- **Tilted report mock** — 6° rotation, behind/beside the audit form. Hidden on mobile.
- **Mobile menu** — full-screen takeover, NOT a side drawer. Hamburger animates to X via three transform/opacity changes. Body scroll locks via `no-scroll` class. Escape key closes. Menu items are Instrument Serif at 1.65rem with dividers.
- **Reveal animations** — IntersectionObserver with `.in` class. Stagger groups use 90ms delays applied to children when parent enters viewport.
- **Grain texture** — SVG noise filter at 4% opacity, fixed-position, `pointer-events:none`, z-index 9999. Subtle, but it’s what stops the design from looking flat.

-----

## Functional requirements

- **Smooth scroll for all fragment links** — intercept `a[href^="#"]` clicks, preventDefault, route through `scrollToId()`. Do not rely on browser default fragment behavior; it breaks in iframe previews and is jumpy on iOS.
- **Mobile nav toggle** — class toggling on `nav` (`menu-open`), `body` (`no-scroll`), and `.nav-links` (`open`). All three sync.
- **FAQ accordion** — max-height transition. Single-open behavior.
- **Audit form submission** — see Open Decisions below for backend.

-----

## SEO and metadata

```html
<title>[BRAND] — Race websites that drive registrations</title>
<meta name="description" content="Modern, SEO-optimized race websites built in 14 days. Built by the team behind bostonmarathonqualifyingraces.com. For race directors who want their site to actually drive signups.">
<meta property="og:title" content="[BRAND] — Race websites that drive registrations">
<meta property="og:description" content="...">
<meta property="og:image" content="/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
```

Add JSON-LD `Organization` schema in `Base.astro` head:

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "[BRAND]",
  "url": "https://[domain].com",
  "description": "Modern race websites for race directors.",
  "sameAs": ["https://bostonmarathonqualifyingraces.com"]
}
```

Use `@astrojs/sitemap` to auto-generate `sitemap.xml`. `robots.txt` allow all.

-----

## Performance gates (non-negotiable)

This site must pass the launch gate from `TEMPLATE_STANDARDS.md`:

- Lighthouse Performance: **95+**
- Lighthouse SEO: **100**
- Lighthouse Accessibility: **100**
- LCP: **< 2s**
- CLS: **< 0.1**

If any score falls short, fix before requesting Steve review. The marketing site claims these scores; failing them is a credibility hit we cannot afford.

Specifically watch for:

- Font loading (use `font-display: swap`, preload critical weights)
- Image optimization (anything raster gets WebP/AVIF with `<picture>` fallback)
- Layout shift from the browser mock animation — make sure the demo browser has a reserved size before animation kicks in
- The grain SVG is inline — keep it that way, don’t externalize

-----

## Open decisions (need Steve’s call before launch)

These are blockers for going live, not for starting work.

### 1. Brand name (biggest blocker)

The HTML prototype uses `[BRAND]` as a placeholder swap token. Once Steve locks the name:

- Global find/replace `[BRAND]` → actual name
- Rename repo to `sbgolf/[brand-slug]-marketing`
- Rename workspace folder
- Update `<title>`, footer brand, OG meta, JSON-LD
- Update favicon and OG image (need design)

**Do not start customer-facing copy work until brand name is locked.** Component scaffolding and structure can proceed with placeholders.

### 2. Audit form backend

Pick one of three options and confirm with Steve:

- **Tally form embed** (recommended) — keeps all venture intake in one tool consistent with TALLY_FORM_SPEC.md. Embed via iframe or Tally’s React component. Submissions go to Tally → Resend → Steve’s inbox + Supabase audit_requests table.
- **Direct Resend** — simplest, posts to a Cloudflare Pages Function that emails Steve. No dashboard.
- **Supabase + Telegram** — POST to Supabase row, Telegram notification to Steve. Gives a leads dashboard later.

If Steve doesn’t have a preference, default to Tally. Lowest ops overhead, consistent with existing pattern.

### 3. Domain

Venture domain TBD. After brand name lock, register and configure Cloudflare DNS. Until then, the staging URL stays on `.pages.dev`.

### 4. GA4 property

Create a new property for the marketing site. Do **not** reuse BMQR’s GA4 (`509944089`) — separate venture, separate measurement. Add property ID to env config.

### 5. Open Graph image

1200×630 image showing brand mark + tagline. Design fitting the navy + coral palette. Steve to approve before launch.

-----

## Build flow

1. **Init.** Spin up Astro project in `/Users/clawdbot/.hermes/hermes-agent/marketing-site/`. TypeScript, no integrations beyond `@astrojs/sitemap` and `@fontsource/*`.
1. **Port shell.** Build `Base.astro` layout with font preloads, grain overlay, SVG defs (the `lhg` gradient), and global styles. Verify clean blank page.
1. **Port components in this order.** This sequence lets you smoke-test each one in isolation:
- Nav → Hero → Footer (full skeleton)
- Problem → Templates → HowItWorks (main content)
- Credibility → BuiltFor → Pricing
- AuditForm → FAQ → Finale
1. **Wire scripts.** `nav.ts`, `reveal.ts`, `smoothScroll.ts`, `auditForm.ts`. Each loads via `<script>` in `index.astro` or via Astro’s `client:load` if you choose to make any island.
1. **Visual parity check.** Open the HTML prototype and the Astro dev server side-by-side. Walk through every section, every breakpoint (1400px, 1000px, 780px, 520px). Any drift, fix before moving on.
1. **Lighthouse.** Run against the dev build and a production build. Fix until thresholds met.
1. **Push.** GitHub repo, set up Cloudflare Pages, get the preview URL.
1. **Hand off.** Send Steve the preview URL via Telegram with a one-line summary: “Marketing site staging is up at [URL]. Lighthouse [scores]. Open Decisions still pending: brand name, audit backend, OG image.”
1. **Steve reviews.** Once approved, configure custom domain (when chosen) and promote to production.

-----

## What to flag back to Steve

If during the build you hit any of:

- A spec ambiguity (something in the HTML prototype isn’t clear how to implement)
- A performance trade-off (something looks great but tanks Lighthouse)
- A dependency you want to add that isn’t in `ARCHITECTURE.md`’s approved list
- An accessibility issue in the design that can’t be solved without changing the visual

…stop and flag to Steve via Telegram before deciding. Don’t unilaterally improve. The prototype is the spec; deviations need sign-off, same as the SOP escalation rules in `HERBIE_SOPS.md`.

-----

After completing the build and confirming Lighthouse passes, summarize back to Steve: what was built, what the scores are, what Open Decisions are still blocking go-live.