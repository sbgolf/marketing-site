# StartLine opportunity backlog

Logged from Steve's request to keep the next StartLine Sites opportunities trackable and work through them one by one.

## Working order

1. **Audit path clarity + sample audit output** — Completed in PR #37
   - Add a clearer “what happens after you request an audit?” section.
   - Show a fictional sample audit deliverable so race directors understand what they receive.
   - Primary goal: improve private audit/mockup conversion.

2. **After-year-one services page or section expansion** — Completed in PR #38
   - Expand optional one-time services after the included first-year race cycle.
   - Include Annual Race Rollover, Quarterly Website Update, SEO Check + Fixes, Analytics Review, Sponsor Visibility Refresh, and Pre-Race Conversion Tune-Up.
   - Primary goal: support repeat revenue without required monthly retainers.

3. **Pricing/payment consistency audit** — Completed in this PR
   - Review form labels, success copy, deposit language, Stripe-facing copy, and public package language for first-year/race-cycle consistency.
   - Primary goal: avoid trust mismatch between the marketing page and checkout/payment flow.

4. **Race-director segment fit section** — In review in this PR
   - Add clearer “who this is for” copy for community races, BQ/certified marathons, multi-distance weekends, sponsor-heavy events, and platform-hosted races that need a stronger marketing layer.
   - Primary goal: help prospects self-qualify and improve SEO language.

5. **Race website checklist lead magnet page**
   - Create an evergreen checklist page covering registration clarity, mobile speed, course/logistics info, FAQ gaps, sponsor visibility, SEO/schema, analytics, and race-week update readiness.
   - Primary goal: SEO asset + outreach follow-up asset.

6. **Outreach-specific landing pages**
   - Create tailored landing pages such as `/for-community-races`, `/for-marathons`, `/for-runsignup-races`, or `/for-race-directors`.
   - Primary goal: support personalized outreach and search relevance.

7. **BMQR credibility section expansion**
   - Make the “from the team behind BMQR” proof point more specific without unsupported traffic/performance claims.
   - Primary goal: differentiate StartLine from generic web designers.

8. **Sponsor-value messaging and examples**
   - Add stronger copy around sponsor tiers, logos, community partners, charity visibility, and sponsor renewal support.
   - Primary goal: help directors justify the site cost through partner value.

9. **First-year package launch timeline**
   - Add a concrete timeline from deposit → intake → draft → review → launch → race-cycle support.
   - Primary goal: reduce buying anxiety and make fulfillment feel real.

10. **Stripe/monthly billing automation audit**
    - Inventory subscription/monthly/final-invoice logic and decide what should remain, change, or become dormant after the public pricing pivot.
    - Primary goal: prevent backend billing assumptions from drifting away from public pricing.

11. **Pricing-copy consistency tests**
    - Add lightweight checks to prevent forbidden public monthly-retainer phrasing from returning unintentionally.
    - Primary goal: protect the pricing strategy in future PRs.

## Execution rule

Each item should become its own small branch/PR when practical. Do not merge without Steve's explicit approval.
