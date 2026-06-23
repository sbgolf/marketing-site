# StartLineSites.com Chief UX Officer audit backlog

Internal backlog for the StartLine Sites marketing site conversion audit. This is a docs-only record of prioritized UX/conversion opportunities; do not implement fixes from this file in this PR.

## Operating rules

- Work high-impact items first, then continue down the list as capacity allows.
- Each backlog item should become its own small, reversible branch and PR unless Steve explicitly groups related items.
- Before starting an item, ask clarifying questions if the item depends on unknown assets, customer proof, pricing/package strategy, legal/claims approval, or another blocked decision.
- If no clarification is needed, proceed with the next unblocked high-impact item in priority order.
- Do not use real customer names, testimonials, race data, screenshots, or performance claims unless Steve has approved the asset and wording.
- Steve approval is required before merge.

## Agent execution loop for every backlog item

1. **Select and clarify**: Pick the next unblocked, highest-impact item. Ask Steve clarifying questions first if the item lists unknowns, asset dependencies, strategy decisions, or approval needs.
2. **Create branch**: Create a focused branch named for the backlog item.
3. **Implement smallest reversible change**: Make the minimum public-site/docs/test change needed to satisfy the item's scope and acceptance criteria.
4. **Run checks**: Run `npm run build` at minimum for code/content changes, plus relevant tests or smoke checks for the touched area. For docs-only changes, run a sensible docs verification and `npm run build` if quick/available.
5. **Self-audit before completion**: Compare the change against this item's acceptance criteria and the repo Definition of Done. Confirm copy/demo hygiene, no secrets, no unapproved customer data, no unsupported claims, and no scope creep.
6. **Fix gaps**: If the self-audit finds misses, fix them before requesting review.
7. **Rerun checks**: Rerun the failed or relevant checks after fixes.
8. **Update PR**: Open/update the PR with what changed, why it matters, verification output, and a self-audit summary mapping the work to acceptance criteria and Definition of Done.
9. **Wait for Steve**: Do not merge or take production-impacting action until Steve approves.

## Definition of Done self-audit checklist

Every backlog-item PR must include evidence that:

- The change is isolated to its own branch/PR.
- Acceptance criteria for the selected item are explicitly checked off in the PR body or final report.
- `npm run build` passes, or the exact blocker is reported.
- Relevant tests/smoke checks for the touched area were run.
- Public copy keeps StartLine's positioning intact: “Race websites built to turn interest into registrations.”
- Claims remain supportable: no guaranteed growth, no fabricated customers, no unapproved real testimonials, and respectful before/after language.
- Demo/proof examples use fictional or generic assets unless Steve-approved real assets are provided.
- Before/after framing respects existing race-director, staff, and volunteer effort: describe the current state as a clarity or organization opportunity, not as ugly, broken, bad, neglected, or embarrassing.
- Improvement language connects to runner trust, registration confidence, race-director workload reduction, and sponsor value rather than promising growth.
- No secrets, private customer data, Stripe IDs, credentials, or sensitive operational notes were introduced.
- Steve approval is still required before merge.

## Prioritized backlog

### P0-01 — Sharpen above-the-fold conversion path

- **Impact**: Very high
- **Effort**: Medium
- **Category**: Homepage hero, messaging, CTA hierarchy
- **Details/scope**: Make the first screen answer “who is this for?”, “what outcome does StartLine create?”, “what do I do next?”, and “why trust this enough to request an audit?” Keep the locked positioning and avoid overpromising registration growth. Ensure the primary CTA is the audit/private mockup path and the secondary CTA supports lower-intent exploration.
- **Acceptance criteria**: Hero clearly names race directors/race websites; primary CTA appears without scrolling on desktop and mobile; CTA label matches the audit/mockup offer; supporting line reinforces search/speed/signups without guarantees; secondary CTA does not compete with the primary path; mobile first screen remains readable and tap targets are usable.
- **Clarifying questions before starting**: Confirm preferred primary CTA wording if changing from current copy.
- **Status**: Completed in PR #50.

### P0-02 — Make the audit/mockup offer feel concrete and low-risk

- **Impact**: Very high
- **Effort**: Medium
- **Category**: Lead offer clarity, conversion anxiety reduction
- **Details/scope**: Strengthen the explanation of what a prospect receives after requesting an audit/private mockup: review window, deliverable shape, what StartLine looks for, and what happens next. Reuse the existing fictional sample audit/example deliverable pattern rather than inventing real customer examples.
- **Acceptance criteria**: Page explains deliverable contents, expected next step, and no-pressure nature; sample/example is clearly fictional or generic; form-adjacent copy reduces uncertainty; no promises of specific registration lift; success/confirmation copy remains consistent with the offer.
- **Clarifying questions before starting**: Ask Steve if review timing or response window should be stated more specifically.
- **Status**: Completed in PR #51 — adds Steve-approved “within 2 business days” timing, clearer deliverable/next-step/no-pressure copy, fictional sample labeling, and aligned request-form success copy.

### P0-03 — Add trust/proof without fake testimonials

- **Impact**: Very high
- **Effort**: Medium to High
- **Category**: Social proof, credibility
- **Details/scope**: Add a proof section that can launch without real testimonials: founder note, behind-BMQR credibility, sample audit deliverable, example before/after, process transparency, performance/SEO discipline, and clear “built for search, speed, and signups” proof points. Keep real testimonials/customer logos blocked until Steve provides approved assets.
- **Acceptance criteria**: Proof section includes non-fabricated credibility; any examples are fictional/generic; no real testimonial/customer/logo appears without approval; founder/BMQR language is factual and not inflated; blocked testimonial/customer-proof placeholders are not shown publicly as if real.
- **Clarifying questions before starting**: Ask Steve whether a founder note should be signed by name and whether any real proof assets are approved.
- **Blocked/needs Steve-approved assets**: Real testimonials, customer logos, named case studies, and real screenshots.
- **Status**: Completed in PR #53 for evidence-safe founder/BMQR/process proof. Real testimonials, customer logos, named case studies, and real screenshots remain blocked until Steve approves assets.

### P0-04 — Strengthen form-section motivation and friction audit

- **Impact**: Very high
- **Effort**: Medium
- **Category**: Lead form UX, conversion friction
- **Details/scope**: Audit the request form and surrounding copy for required-field friction, privacy reassurance, expectations, CTA clarity, and mobile usability. Keep the form focused on what is necessary to evaluate the race site and send a useful response.
- **Acceptance criteria**: Required fields are justified and minimal; labels are plain-language; CTA matches the requested action; privacy/no-spam reassurance appears near the form if appropriate; error/success states are understandable; mobile keyboard/input behavior is checked; existing data capture requirements are not broken.
- **Clarifying questions before starting**: Ask before removing fields or changing lead-routing requirements.
- **Status**: Completed in PR #54.

### P0-05 — Clarify pricing/package value and reduce purchase anxiety

- **Impact**: High
- **Effort**: Medium
- **Category**: Pricing, offer packaging, trust
- **Details/scope**: Ensure package copy connects price to tangible deliverables, timeline, and race-director outcomes. Make deposit/final-payment language consistent with the existing billing SOP and avoid drift toward legacy monthly-retainer language.
- **Acceptance criteria**: Pricing copy makes scope, first-year/race-cycle coverage, deposit/final-payment mechanics, and next steps clear; no forbidden monthly-retainer framing returns; package recommendations are easy to compare; claims remain supportable.
- **Clarifying questions before starting**: Ask Steve before changing package names, prices, payment structure, or included services.
- **Status**: Completed in PR #55 — clarified package value, first-year scope, 50% deposit/final-invoice mechanics, Premium proposal gating, no-default-monthly-retainer language, and package comparison without changing package names, prices, payment structure, or included services.

### P0-06 — Make “who this is for” immediately scannable

- **Impact**: High
- **Effort**: Low to Medium
- **Category**: Audience segmentation, self-qualification
- **Details/scope**: Surface target segments and pain points more clearly: community races, marathons, multi-distance weekends, sponsor-heavy events, platform-hosted races needing a stronger marketing layer, and directors who need a reliable launch/update process.
- **Acceptance criteria**: Segments are visible and scannable; copy helps prospects self-identify; no segment feels excluded unintentionally; language supports SEO without keyword stuffing; CTAs from the section point to the audit/mockup path.
- **Clarifying questions before starting**: None unless segment priority changes.
- **Status**: Completed in PR #56 — makes the homepage “who this is for” section more scannable, adds fit signals for each segment, includes launch/update-process directors, and points section CTAs to the private audit/sample audit path.

### P1-07 — Improve narrative flow from problem to solution to action

- **Impact**: High
- **Effort**: Medium
- **Category**: Information architecture, homepage story
- **Details/scope**: Review section order so the page moves from race-director problem to StartLine solution, proof/process, package fit, and CTA. Remove duplicated or competing messages where they weaken momentum.
- **Acceptance criteria**: Page has a clear conversion narrative; each section has a unique job; CTAs appear after persuasive sections; no major content needed for a decision is buried; mobile scroll order still makes sense.
- **Clarifying questions before starting**: Ask Steve before removing entire public sections.
- **Status**: Completed in PR #57 — reorders the homepage narrative from problem to outcomes/fit, examples/proof, process, pricing/package fit, and private-audit action without removing public sections.

### P1-08 — Add objection handling for common race-director concerns

- **Impact**: High
- **Effort**: Medium
- **Category**: FAQ, sales enablement
- **Details/scope**: Address concerns such as “we already use RunSignup/Bikereg/etc.”, “we have a volunteer webmaster,” “we only need updates once a year,” “what if our race details are not final?”, “can sponsors/charity content be included?”, and “what happens after year one?”
- **Acceptance criteria**: FAQ/objection copy is respectful and concise; answers reinforce StartLine as a marketing layer rather than replacing registration platforms; after-year-one language matches current policy; no unsupported promises or legal commitments are introduced.
- **Clarifying questions before starting**: Ask Steve if any objection answer affects service scope or policy.
- **Status**: Completed in PR #58 — expanded homepage FAQ objection handling while keeping service scope/policy unchanged.

### P1-09 — Create a stronger sample deliverable path

- **Impact**: High
- **Effort**: Medium to High
- **Category**: Proof, lead magnet, conversion support
- **Details/scope**: Make the fictional sample audit/example deliverable easier to find and use in outreach. Consider a dedicated section or page that previews what StartLine notices: registration CTA clarity, mobile speed, logistics gaps, sponsor visibility, search basics, and race-week readiness.
- **Acceptance criteria**: Sample is clearly fictional/generic; it demonstrates the value of the audit without disparaging existing race sites; linked from relevant CTA/supporting areas; can be reused in outreach; no real customer data is used.
- **Clarifying questions before starting**: Public page option approved by Steve.
- **Status**: Completed in PR #59 — adds a public fictional/generic sample audit deliverable page and links it from relevant supporting areas.

### P1-10 — Tighten CTA labels and placement across pages

- **Impact**: Medium to High
- **Effort**: Low to Medium
- **Category**: CTA consistency, navigation
- **Details/scope**: Inventory CTA labels and destinations across homepage, checklist, outreach pages, pricing/intake-related pages, and ensure they consistently point to the intended next step for the visitor's stage.
- **Acceptance criteria**: Primary CTAs use consistent language for audit/private mockup; secondary CTAs are intentionally lower commitment; nav/sticky CTA does not conflict with page-specific goals; no dead or confusing CTA paths remain.
- **Clarifying questions before starting**: Ask Steve before changing the primary conversion event.
- **Status**: Completed in PR #60 — tightens CTA language and removes confusing/dead CTA paths while preserving the private audit/request conversion event.

### P1-11 — Add respectful before/after framing guardrails

- **Impact**: Medium to High
- **Effort**: Low
- **Category**: Copy hygiene, brand trust
- **Details/scope**: Audit public before/after language to ensure it never insults old race sites or volunteer-built pages. Position improvements as clarity, trust, registration confidence, and sponsor value.
- **Acceptance criteria**: Before/after copy is respectful; no “ugly/bad/broken” style language; improvements are framed around runner trust and race-director workload; fictional examples remain labeled as examples.
- **Clarifying questions before starting**: None.
- **Status**: Completed in PR #62 — adds respectful before/after framing guardrails for public and outreach copy, including internal review prompts and claim-safety reminders.

### P2-12 — Improve mobile-first scanning and section density

- **Impact**: Medium
- **Effort**: Medium
- **Category**: Responsive UX, readability
- **Details/scope**: Review mobile layouts for dense sections, long paragraphs, CTA visibility, card stacking, and tap-target spacing. Prioritize reducing cognitive load on the lead path.
- **Acceptance criteria**: Mobile viewports at 375, 414, and 768 are checked; no horizontal overflow; key CTAs are visible after persuasive sections; dense paragraphs are broken into scannable units; visual hierarchy remains intact.
- **Clarifying questions before starting**: None unless a visual redesign is needed.
- **Status**: Completed in PR #63 — reduces homepage paragraph density, adds scannable fit/audit lists, improves post-section audit CTAs, and adds mobile smoke coverage for 375/414/768 overflow checks.

### P2-13 — Reinforce SEO/performance credibility with evidence-safe language

- **Impact**: Medium
- **Effort**: Low to Medium
- **Category**: Technical credibility, copy
- **Details/scope**: Explain StartLine's SEO/performance discipline in plain language: clean structure, fast pages, metadata/schema where appropriate, content hierarchy, and analytics readiness. Avoid claiming rankings or traffic lifts.
- **Acceptance criteria**: Technical proof is understandable to race directors; no ranking guarantees; any metrics shown are from tooling/demo context or approved real assets; section supports “Built for search, speed, and signups.”
- **Clarifying questions before starting**: Ask Steve before publishing specific performance scores or benchmarks.
- **Status**: Completed in PR #64 — adds evidence-safe technical credibility copy for clean structure, fast pages, metadata/schema, content hierarchy, and analytics readiness without ranking guarantees, traffic promises, or numeric scores.

### P2-14 — Add analytics/learning loop messaging

- **Impact**: Medium
- **Effort**: Low to Medium
- **Category**: Post-launch value, retention
- **Details/scope**: Clarify how StartLine can support race-cycle learning: analytics review, registration CTA observations, sponsor visibility review, and pre-race tune-up opportunities after launch/year one.
- **Acceptance criteria**: Copy aligns with existing after-year-one services; no required monthly retainer is implied; next-step CTA remains clear; optional services are described as optional.
- **Clarifying questions before starting**: Ask Steve before changing after-year-one package/service policy.
- **Status**: In review via `content/p2-14-analytics-learning-loop` — clarifies optional analytics/learning-loop messaging for after-year-one services without changing service policy or implying a required retainer.

### P2-15 — Build a customer-proof readiness checklist

- **Impact**: Medium now, high once assets exist
- **Effort**: Low
- **Category**: Proof operations, asset readiness
- **Details/scope**: Create an internal/public-proof checklist for collecting Steve-approved testimonials, logos, screenshots, before/after stories, and measurable but supportable outcomes once real customers exist.
- **Acceptance criteria**: Checklist separates approved, pending, and blocked proof assets; requires permission/source notes for each real asset; includes fallback proof alternatives when assets are unavailable; protects against fabricated testimonials.
- **Clarifying questions before starting**: Ask Steve where approved proof assets should be stored/tracked.
- **Blocked/needs Steve-approved assets**: Any public real testimonial, customer logo, named case study, or live race screenshot.

### P3-16 — Expand outreach-page message matching

- **Impact**: Medium
- **Effort**: Medium
- **Category**: Outreach landing pages, personalization
- **Details/scope**: Review outreach landing pages for message match with likely email/DM outreach angles. Segment pages should speak to the visitor's specific context while preserving shared StartLine positioning.
- **Acceptance criteria**: Each outreach page has a clear audience, pain point, proof/process cue, and CTA; no page contains contradictory package/payment copy; generic pages do not pretend to be personalized to a real recipient.
- **Clarifying questions before starting**: Ask Steve which outreach segment is highest priority.

### P3-17 — Improve internal QA prompts for future UX work

- **Impact**: Medium
- **Effort**: Low
- **Category**: Process, QA
- **Details/scope**: Add reusable PR/self-review prompts for conversion UX changes: audience clarity, CTA consistency, claim safety, mobile scan, proof authenticity, form friction, and Definition of Done mapping.
- **Acceptance criteria**: Prompt/checklist is easy to copy into future PRs; it references acceptance criteria and Definition of Done; it reinforces Steve approval before merge; it does not add process overhead for tiny fixes beyond what is useful.
- **Clarifying questions before starting**: None.

## Blocked proof assets list

These are high-value proof items but must not be published as real until Steve approves the source asset and wording:

- Real customer testimonials.
- Real customer logos.
- Named case studies.
- Live customer before/after screenshots.
- Customer-specific registration, traffic, conversion, revenue, or sponsor metrics.
- Quotes from race directors, sponsors, runners, or volunteers.

Until those assets exist, prefer approved-safe alternatives: fictional sample audits, generic example deliverables, founder note, BMQR background, transparent process/timeline, public checklist content, and evidence-safe performance/SEO language.
