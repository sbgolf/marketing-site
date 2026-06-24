# StartLineSites.com cold race-director UX audit backlog

Created from a Chief UX Officer cold-site audit of `https://startlinesites.com/` as a first-time race director buyer. This is an internal, agent-ready backlog for StartLine Sites. It is audit-derived only; do not treat this document as approval to merge or publish changes without Steve's review.

## Source audit lens

Audience: busy race directors evaluating whether StartLine Sites is credible, capable, and worth paying to build/run their race website. They are not runners and may not be technical.

Primary observed CTA today: **Request a private audit**.

Recommended working assumption until Steve changes strategy: keep **Request a private audit** as the primary conversion action and use **See sample audit** as the consistent lower-commitment secondary action.

## Operating rules for agents and sub-agents

- Work in the **dependency-safe sequence** below rather than pure High/Medium/Low order.
- Pick one focused item per branch/PR unless Steve explicitly groups related items.
- Preserve the primary conversion event unless Steve explicitly changes it.
- Keep all public proof honest: no fabricated testimonials, no unapproved real customer names/logos/screenshots/metrics, no guaranteed registration-lift claims.
- Use fictional/generic examples unless Steve provides and approves real assets.
- Respect existing race directors, volunteers, and staff. Frame improvements as clarity, trust, organization, and registration confidence — not as shaming old sites.
- Ask Steve before changing package names, prices, payment structure, service scope, response-time promise, or proof claims.
- Branch + PR only. Do not merge without Steve's explicit approval.

## Sequencing rationale

Steve approved sequencing this backlog by dependency safety instead of raw impact tier. The order starts with foundational CTA and information architecture work, then separates customer kickoff paths from cold-prospect paths, groups pricing and scope clarifications together, adds trust/proof once the architecture is clearer, and leaves homepage density plus final mobile consolidation for last so earlier structural decisions are not reworked.


## Global Definition of Done for every item

Each implementation PR spawned from this backlog is done only when:

- The work is isolated to a focused branch and PR.
- The PR names the backlog item(s) it addresses.
- The PR body includes a self-audit mapping changes to the item-specific acceptance criteria.
- `npm run build` passes, or the exact blocker is reported.
- Relevant tests/smoke checks for the touched area are run.
- For visual/layout changes, desktop and mobile behavior are checked at practical widths, including no horizontal overflow and usable tap targets.
- For form/CTA/payment-path changes, the affected path is smoke-tested without real customer submissions or real charges.
- Public copy preserves StartLine's core positioning: “Race websites built to turn interest into registrations.”
- Claims remain supportable and evidence-safe.
- No secrets, private customer data, customer-specific Stripe IDs, or unapproved real proof assets are introduced.
- Steve approval is still required before merge.

---

# Dependency-safe implementation backlog

## Phase 0 — Completed foundation

### 1. H-01 — Clarify the primary funnel above the fold

- **Impact**: High
- **Effort**: Low
- **Category**: Conversion / Copy
- **Status**: Completed / merged foundation (`feat: clarify homepage audit funnel`, #71)
- **Why this matters**: A busy race director should understand the path in seconds: request audit, get recommendation, choose package/deposit, complete intake/assets, launch.
- **Scope**:
  - Add or tighten a concise funnel explanation near the hero or first major CTA.
  - Keep `Request a private audit` as the primary action unless Steve changes strategy.
  - Clarify that the audit comes before deposit/package commitment.
- **Acceptance criteria**:
  - The first screen or immediately adjacent hero support area explains the buyer journey in 3–5 plain-English steps.
  - Copy states that the audit/recommendation happens before any required deposit.
  - The primary CTA remains visually dominant over secondary exploration CTAs.
  - Mobile view keeps the funnel readable without creating a wall of text.
- **Definition of Done**:
  - Hero/near-hero copy and CTA hierarchy are updated in a focused PR.
  - Desktop and mobile first-screen screenshots or DOM checks confirm primary CTA visibility and readable funnel copy.
  - `npm run build` passes.

## Phase 1 — CTA system and buyer information architecture

### 2a. H-03 — Make “See sample audit” the consistent secondary CTA

- **Impact**: High
- **Effort**: Low
- **Category**: Conversion / Navigation
- **Status**: Completed / merged in PR #73 (`ux/h03-l04-cta-consistency`).
- **Why this matters**: Cold visitors who are not ready to request an audit need a clear proof-oriented next step that does not compete with the primary CTA.
- **Scope**:
  - Pair primary audit CTAs with a consistent secondary `See sample audit` or equivalent.
  - Reduce inconsistent secondary CTA labels where they distract from the audit path.
- **Acceptance criteria**:
  - Hero, audit-adjacent, pricing/supporting sections, and persona pages use a consistent primary/secondary CTA pattern where applicable.
  - Secondary CTA routes to `/sample-audit/` or a clearly labeled sample-audit section.
  - No secondary CTA is styled or worded as more important than the audit CTA.
  - No dead `href="#"` or ambiguous CTA destinations remain in touched areas.
- **Definition of Done**:
  - CTA inventory is updated in the PR notes.
  - Click/smoke checks confirm primary and secondary CTA destinations.
  - `npm run build` passes.

### 2b. L-04 — CTA wording consistency polish

- **Impact**: Low
- **Effort**: Low
- **Category**: Copy / Conversion
- **Status**: Completed / merged in PR #73 (`ux/h03-l04-cta-consistency`).
- **Why this matters**: Small wording variations are not fatal, but consistency helps users understand the next step.
- **Scope**:
  - Standardize primary CTA language around `Request a private audit` unless a page context intentionally needs a variant.
- **Acceptance criteria**:
  - Primary CTA variants are intentional and documented in PR notes.
  - Secondary CTA wording remains clearly lower commitment.
  - No page-specific CTA becomes misleading.
- **Definition of Done**:
  - CTA label inventory is included in the PR notes.
  - `npm run build` passes.

### 3. H-04 — Tighten homepage nav and reduce decision overload

- **Impact**: High
- **Effort**: Medium
- **Category**: Navigation / Conversion
- **Status**: Completed / merged in PR #74 (`feat/h04-tighten-homepage-nav`).
- **Why this matters**: The homepage nav is comprehensive but cognitively heavy for a first-time buyer.
- **Scope**:
  - Simplify the visible top nav to the highest-intent buyer tasks.
  - Group or demote lower-priority internal anchors/resources without orphaning them.
  - Preserve access to pricing, sample audit, FAQ, and private audit.
- **Acceptance criteria**:
  - Top nav is shorter and easier to scan.
  - A race director can still find pricing, sample audit, FAQ, and audit request without hunting.
  - Persona/support/customer pages are not accidentally made inaccessible.
  - Mobile nav remains usable and tap targets remain accessible.
- **Definition of Done**:
  - Nav/footer links are inventoried before and after.
  - Internal link checks confirm no broken or orphaned key pages.
  - `npm run build` passes.

### 4. H-05 — Make persona pages discoverable from homepage fit cards

- **Impact**: High
- **Effort**: Low
- **Category**: Navigation / Conversion
- **Status**: Completed / merged in PR #75 (`feat/h-05-homepage-persona-links`).
- **Why this matters**: Strong segment pages exist but are not prominent in the main buyer journey.
- **Scope**:
  - Link relevant homepage fit/segment cards to `/for-community-races/`, `/for-marathons/`, `/for-runsignup-races/`, and `/for-race-directors/`.
  - Keep the audit CTA as the primary action.
- **Acceptance criteria**:
  - Each public persona page has a clear path from the homepage.
  - Link labels make the segment benefit obvious.
  - The homepage still offers a direct audit CTA from the fit area.
  - Persona page crosslinks remain intact.
- **Definition of Done**:
  - Internal link smoke check confirms all persona links return 200.
  - Mobile layout check confirms segment links do not clutter cards.
  - `npm run build` passes.

### 5. L-03 — Footer grouping cleanup

- **Impact**: Low
- **Effort**: Medium
- **Category**: Navigation / Visual
- **Status**: Completed / merged in PR #77 (`feat/l03-footer-grouping`).
- **Why this matters**: Footer grouping can help agents and users understand which pages are buyer resources vs. customer kickoff resources.
- **Scope**:
  - Group footer links into Buyer resources, Customer kickoff, and Company/Credibility if the current footer supports it.
- **Acceptance criteria**:
  - Footer groups make page purpose clearer.
  - Key pages remain accessible.
  - Mobile footer remains compact and readable.
- **Definition of Done**:
  - Footer links are smoke-checked.
  - `npm run build` passes.

### 6. L-01 — Add redirects for likely guessed paths

- **Impact**: Low
- **Effort**: Low
- **Category**: Technical / Navigation
- **Status**: Completed / merged in PR #78 (`seo/l01-guessed-path-redirects`).
- **Why this matters**: Common guessed paths currently return 404 even though they map to real sections/pages.
- **Scope**:
  - Add redirects for likely paths such as `/pricing/`, `/audit/`, `/private-audit/`, `/checklist/`, `/thank-you/` if appropriate.
- **Acceptance criteria**:
  - Redirects point to the most relevant live page/section.
  - No existing route is broken.
  - Redirect behavior works in local/build/deploy environment.
- **Definition of Done**:
  - Redirects are tested with status/location checks.
  - `npm run build` passes.

## Phase 2 — Customer/prospect path separation and form confidence

### 7. H-07 — Reframe public `/intake/` and `/asset-checklist/` as customer kickoff pages

- **Impact**: High
- **Effort**: Low
- **Category**: Conversion / Navigation
- **Status**: Completed in PR #79 (`content/h07-kickoff-pages`).
- **Noindex decision**: Remain indexable for now because PR #79 framed them clearly as kickoff/customer resources; L-02 is recorded as decided with no metadata change unless Steve later asks to remove these pages from search discovery.
- **Why this matters**: These pages are useful after purchase but can confuse cold prospects if discovered early.
- **Scope**:
  - Make both pages clearly say they are for customers after audit/package approval or StartLine kickoff.
  - Add a cold-prospect escape route back to audit/pricing/sample audit.
  - Consider `noindex` only if Steve wants these removed from search discovery.
- **Acceptance criteria**:
  - `/intake/` clearly states when to complete the form.
  - `/asset-checklist/` clearly states it supports customer kickoff/assets preparation.
  - Cold prospects have an obvious link to request an audit instead of completing intake prematurely.
  - No intake field names, endpoint payloads, or existing customer flow behavior are broken.
- **Definition of Done**:
  - Intake and asset-checklist page copy is updated in a focused PR.
  - Client-side required-field behavior on intake is smoke-checked without submitting real data.
  - `npm run build` passes.

### 8. L-02 — Decide whether customer kickoff pages should be noindex

- **Impact**: Low
- **Effort**: Low
- **Category**: Technical / Navigation
- **Status**: Decided in PR #79 and recorded in this PR — remain indexable for now because `/intake/` and `/asset-checklist/` are clearly framed as kickoff/customer resources.
- **Why this matters**: `/intake/` and `/asset-checklist/` are useful publicly only if framed correctly; otherwise search discovery may confuse prospects.
- **Scope**:
  - Decide with Steve whether these should remain indexed, be noindexed, or simply be reframed.
- **Acceptance criteria**:
  - Decision is recorded in the PR or docs.
  - If noindex is implemented, metadata is correct and does not affect buyer pages.
  - If pages remain indexed, copy clearly identifies them as kickoff/customer resources.
- **Definition of Done**:
  - Metadata/rendered HTML is checked if changed.
  - `npm run build` passes.

### 9. M-06 — Improve post-deposit handoff clarity

- **Impact**: Medium
- **Effort**: Low
- **Category**: Conversion / Technical
- **Status**: Completed in PR #80 (`feat/m06-post-deposit-handoff`).
- **Why this matters**: After deposit, the customer should immediately understand intake/assets next steps.
- **Scope**:
  - Improve deposit success state and supporting copy/links to `/intake/`, `/asset-checklist/`, and support.
  - Do not alter Stripe behavior unless explicitly scoped.
- **Acceptance criteria**:
  - `?deposit=success` state clearly explains what happens next.
  - Links to intake and asset checklist are present where appropriate.
  - Copy states the build timeline starts after complete intake details and usable assets are received.
  - Cancelled state remains reassuring and routes back to pricing/audit.
- **Definition of Done**:
  - Success and cancelled query states are smoke-tested.
  - `npm run build` passes.

### 10. H-06 — Clarify acceptable audit-form URLs

- **Impact**: High
- **Effort**: Low
- **Category**: Conversion / Copy
- **Status**: Completed in PR #81 (`feat/h06-audit-url-helper`).
- **Why this matters**: `Current URL` may block races that only have a RunSignup/Race Roster/BikeReg listing or a placeholder page.
- **Scope**:
  - Add helper copy near `Current URL` explaining that a race website, RunSignup page, registration-platform page, or best available public link is acceptable.
  - Avoid changing data-capture fields unless Steve approves.
- **Acceptance criteria**:
  - Field label/helper copy reduces uncertainty for platform-only races.
  - Existing field name, required status, endpoint payload, honeypot, success/error flow, and routing are preserved unless explicitly scoped.
  - Copy remains concise on mobile.
- **Definition of Done**:
  - Form-adjacent copy is updated only.
  - Empty-required-field validation and form rendering are smoke-checked.
  - `npm run build` passes.

### 11. M-07 — Add support/contact fallback near forms

- **Impact**: Medium
- **Effort**: Low
- **Category**: Conversion / Trust
- **Status**: Completed in PR #82 (`main`; form contact fallback copy).
- **Why this matters**: If a form fails or a director has a non-standard situation, they need a fallback.
- **Scope**:
  - Add concise support/contact fallback near audit and intake forms.
  - Keep spam exposure and existing Resend/Supabase flow in mind.
- **Acceptance criteria**:
  - Audit form has a clear fallback if submission fails or the URL situation is unusual.
  - Intake form has a customer-support fallback.
  - Error-state copy remains consistent with visible fallback.
- **Definition of Done**:
  - Form error/success copy is checked for consistency.
  - `npm run build` passes.

### 12. L-05 — Add “no sales call required for the audit” reassurance if true

- **Impact**: Low
- **Effort**: Low
- **Category**: Conversion / Copy
- **Status**: Completed in PR #83 (`content/l05-no-sales-call-audit`).
- **Confirmation**: StartLine marketing-site positioning confirms the private audit response is a concise written review within 2 business days, with no sales call or deposit required for the audit response.
- **Why this matters**: This may reduce form anxiety, but only if it matches Steve's actual sales process.
- **Scope**:
  - Ask Steve whether the audit can be promised without a required sales call.
  - If approved, add concise reassurance near the audit form.
- **Acceptance criteria**:
  - Steve confirms the claim before implementation.
  - Copy does not prevent StartLine from offering a call when useful.
  - Form-adjacent copy remains concise.
- **Definition of Done**:
  - Approval note is referenced in PR body.
  - `npm run build` passes.

## Phase 3 — Pricing, scope, and qualification clarity

### 13. M-01 — Add package recommendation guidance before pricing cards

- **Impact**: Medium
- **Effort**: Low
- **Category**: Pricing / Copy
- **Status**: Completed in PR #84 (`feat/m01-package-fit-guidance`).
- **Why this matters**: Transparent prices are good, but directors may not know which package fits their race.
- **Scope**:
  - Add concise “which package usually fits” guidance without changing package names, prices, inclusions, or payment terms.
- **Acceptance criteria**:
  - Starter, Standard, and Premium each have plain-English fit guidance.
  - Standard can be identified as common/recommended only if existing strategy supports that.
  - Premium remains proposal-gated.
  - No package scope/pricing changes are made without Steve approval.
- **Definition of Done**:
  - Pricing copy is updated and checked against existing billing/payment language.
  - `npm run build` passes.

### 14. M-02 — Make Premium proposal gating visually distinct

- **Impact**: Medium
- **Effort**: Low
- **Category**: Pricing / Trust
- **Status**: Completed / merged in PR #85 (`feat/m02-premium-proposal-gating`).
- **Why this matters**: Premium mentions deposit math but requires proposal review, which should feel intentionally different from Starter/Standard.
- **Scope**:
  - Clarify Premium as proposal-first and not a direct checkout path.
  - Keep deposit/final-payment language consistent with current policy.
- **Acceptance criteria**:
  - Premium card clearly says proposal/audit review comes before any deposit.
  - Starter and Standard direct-deposit paths remain distinct.
  - No Premium Stripe link is implied unless one exists and is approved.
- **Definition of Done**:
  - Pricing-card CTA and helper copy are smoke-checked.
  - `npm run build` passes.

### 15. M-05 — Clarify first-year vs. after-year-one cost boundary

- **Impact**: Medium
- **Effort**: Medium
- **Category**: Pricing / Trust
- **Status**: Completed / merged in PR #86 (`content/m05-year-one-cost-boundary`).
- **Why this matters**: Buyers need to know what is included in year one and what may cost extra later.
- **Scope**:
  - Add a compact comparison or callout linking pricing to after-year-one services.
  - Avoid required-retainer framing.
- **Acceptance criteria**:
  - First-year build/support scope is clear.
  - Optional future services are clearly optional and scoped.
  - Existing after-year-one policy is not changed without Steve approval.
- **Definition of Done**:
  - Pricing and after-year-one page language are checked for consistency.
  - `npm run build` passes.

### 16. M-04 — Add “who this is not for” qualification copy

- **Impact**: Medium
- **Effort**: Low
- **Category**: Copy / Trust
- **Status**: Completed / merged in PR #87 (`content/m04-not-for`).
- **Why this matters**: Clear disqualification can increase trust and reduce poor-fit leads.
- **Scope**:
  - Add concise not-for guidance, such as races needing custom registration software, urgent same-day rebuilds, unsupported real-time race ops, or unlimited edits.
- **Acceptance criteria**:
  - Copy is respectful and does not reject good-fit prospects accidentally.
  - It reinforces StartLine as a public marketing website layer.
  - It does not introduce new legal/service commitments.
- **Definition of Done**:
  - Copy is reviewed for tone and claim safety.
  - `npm run build` passes.

## Phase 4 — Trust, platform proof, and proof substitutes

### 17. H-02 — Add compact trust/proof near the first CTA

- **Impact**: High
- **Effort**: Low
- **Category**: Trust / Conversion
- **Status**: Completed / merged in PR #88 (`feat/h02-hero-trust-strip`).
- **Why this matters**: The site is honest about not having fake testimonials, but skeptical buyers need a credibility bridge before submitting a form.
- **Scope**:
  - Add a concise trust strip near the hero or first audit CTA.
  - Use approved-safe proof only: founder/process credibility, BMQR context if appropriate, sample audit, transparent pricing, no platform switch, fictional-example disclaimer.
- **Acceptance criteria**:
  - Trust block appears before or near the first primary CTA follow-up.
  - It includes at least 3 concrete, supportable trust cues.
  - It does not imply real customers, testimonials, or case studies unless Steve-approved assets exist.
  - It links or points to the sample audit as proof of deliverable shape.
- **Definition of Done**:
  - Trust block is implemented with evidence-safe language.
  - Copy/demo hygiene check confirms no fabricated proof or unsupported claims.
  - `npm run build` passes.

### 18. H-08 — Add a RunSignup / registration-platform flow diagram

- **Impact**: High
- **Effort**: Medium
- **Category**: Visual / Trust / Copy
- **Status**: Completed / merged in PR #89 (`feat/h08-runsignup-flow-diagram`).
- **Why this matters**: One of the strongest buyer objections is “we already use RunSignup.” A simple visual can explain StartLine as the marketing layer before checkout.
- **Scope**:
  - Add a simple, accessible diagram to the RunSignup page and/or homepage: Search/social/email → StartLine race website → RunSignup/registration checkout.
  - Keep language complementary, not competitive.
- **Acceptance criteria**:
  - Diagram makes clear StartLine does not replace registration/payment operations.
  - Copy mentions registration platforms generically where appropriate, with RunSignup-specific language only on the RunSignup page.
  - Diagram is readable on mobile and accessible in text.
  - No unsupported integration claims are introduced.
- **Definition of Done**:
  - Diagram renders correctly at desktop and mobile widths.
  - Accessibility/text fallback is present.
  - `npm run build` passes.

### 19. M-08 — Add segment-specific proof substitutes to persona pages

- **Impact**: Medium
- **Effort**: Medium
- **Category**: Trust / Copy
- **Status**: Completed / merged in PR #90 (`feat/m08-persona-proof-substitutes`).
- **Why this matters**: Persona pages are good, but they can feel generic without segment-specific proof or process cues.
- **Scope**:
  - Add evidence-safe proof substitutes per segment: community logistics checklist, marathon certification/logistics review cues, RunSignup handoff map, race-director workload cues.
- **Acceptance criteria**:
  - Each persona page includes a segment-specific reason to trust StartLine's process.
  - Examples remain fictional/generic unless approved.
  - CTAs still route to audit/sample audit.
- **Definition of Done**:
  - Persona pages are smoke-checked for internal links and CTA destinations.
  - `npm run build` passes.

### 20. M-03 — Strengthen checklist-to-audit conversion bridge

- **Impact**: Medium
- **Effort**: Low
- **Category**: Conversion / Copy
- **Status**: Completed / merged in PR #91 (`feat/m03-checklist-audit-bridge`).
- **Why this matters**: The checklist is useful, but it should more clearly tell a self-auditing director when to request help.
- **Scope**:
  - Add a clear bridge such as “If you marked 2+ yellow/red areas, request a private audit.”
- **Acceptance criteria**:
  - Checklist page helps users interpret their result.
  - Audit CTA appears after meaningful self-diagnosis moments.
  - Copy does not shame existing sites or overstate urgency.
- **Definition of Done**:
  - Checklist path and CTA destination are click-tested.
  - `npm run build` passes.

## Phase 5 — Homepage density and final mobile QA

### 21. H-09 — Trim homepage section density before the audit form

- **Impact**: High
- **Effort**: Medium
- **Category**: Copy / Visual / Conversion
- **Status**: Completed / merged in PR #92 (`feat/h09-homepage-density-trim`).
- **Why this matters**: The homepage is persuasive but very long. Busy directors may understand the offer and still not reach the form.
- **Scope**:
  - Audit sections before `#audit` for repeated messages.
  - Shorten, combine, or add jump paths without removing PRD-required content without Steve approval.
  - Preserve pricing, proof, process, sample audit, and FAQ access.
- **Acceptance criteria**:
  - Each homepage section has a distinct job in the buyer journey.
  - Repeated messages are reduced.
  - The path to audit is easier to follow without losing pricing/proof clarity.
  - Mobile scroll experience is measurably less dense in touched sections.
- **Definition of Done**:
  - PR includes before/after section-order or section-purpose notes.
  - Mobile scan verifies no horizontal overflow and improved scannability.
  - `npm run build` passes.

---

# Medium Impact backlog

### 22. M-09 — Review mobile section density and tap-target usability

- **Impact**: Medium
- **Effort**: Medium
- **Category**: Visual / Technical
- **Status**: Completed / merged in PR #93 (`feat/m09-mobile-tap-usability`).
- **Why this matters**: Race directors may review the site on mobile between tasks; long dense cards and small CTAs can reduce completion.
- **Scope**:
  - Review homepage and forms at 375, 414, 768, and desktop widths.
  - Prioritize dense sections before the audit form.
- **Acceptance criteria**:
  - No horizontal overflow at checked widths.
  - CTAs remain visible and tappable.
  - Long paragraphs/cards are broken into scannable units where needed.
  - Form labels/inputs remain usable on mobile.
- **Definition of Done**:
  - PR includes viewport evidence: `scrollWidth`, `clientWidth`, overflow delta, and notes for CTA/form state.
  - `npm run build` passes.

---

# Low Impact backlog

No unblocked low-impact items remain from this audit backlog; the remaining proof opportunities require Steve-approved assets and wording.

---

## Blocked / approval-dependent proof opportunities

These remain high-value trust builders but must not be published as real until Steve approves the assets and wording:

- Real race/customer testimonials.
- Real race/customer logos.
- Named case studies.
- Live customer before/after screenshots.
- Registration, traffic, conversion, sponsor, revenue, or SEO performance metrics.
- Quotes from race directors, sponsors, runners, volunteers, timers, or partners.

Until approved assets exist, agents should use evidence-safe alternatives: fictional sample audits, generic example deliverables, transparent process, founder note, BMQR background where appropriate, checklist content, pricing transparency, and no-platform-switch messaging.
