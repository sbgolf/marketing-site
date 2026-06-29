# StartLineSites.com customer-test readiness backlog — 2026-06-28

Docs-only backlog created after the prior StartLine UX/conversion, cold race-director UX, and 2026-06-24 live-site audit backlogs were closed out. This document captures a fresh live-site audit for first-prospect/customer-test readiness and does **not** implement production/site changes.

## Backlog metadata

- **Source audit:** Fresh live-site customer-test readiness audit from `https://startlinesites.com/`.
- **Audit date:** 2026-06-28.
- **Backlog owner:** Steve / StartLine Sites.
- **Last updated:** 2026-06-28.
- **Live site audited:** `https://startlinesites.com/` and linked buyer/customer resources.

## Context

- `race-templates` stale local work was archived/cleaned before this backlog was created.
- `sbgolf/marketing-site` had no open PRs at inspection time, and the existing implementation backlogs were closed out or approval-dependent.
- The previous live-site audit backlog item around customer kickoff page index hygiene is complete in PR #96: `/intake/` and `/asset-checklist/` now include `noindex,nofollow` while remaining directly reachable.
- This backlog should become the next source of truth for one focused implementation PR at a time.

## Live evidence captured 2026-06-28

### Homepage and audit form

Checked `https://startlinesites.com/` / `https://startlinesites.com/#audit` in a live browser session.

- Page title: `StartLine Sites — Race websites built to turn interest into registrations`.
- Primary hero CTA: `Request a private audit`.
- Secondary hero CTA: `See sample audit`.
- Audit path copy promises a written review within 2 business days before any deposit decision.
- Audit form fields observed:
  - `raceName` required.
  - `currentUrl` required.
  - `auditName` required.
  - `auditEmail` required.
  - `notes` optional.
  - Honeypot-style field `companyWebsite` rendered with visible label text `COMPANY WEBSITE` in browser-derived text and accessibility snapshots.
- Audit form DOM reported `method="get"` / action resolved to `https://startlinesites.com/#audit`; implementation may rely on JavaScript interception, so any fix should preserve the existing production submit path and smoke-test the endpoint rather than changing submission semantics casually.
- Browser-derived visible links included seven visible-size homepage anchors with no text, aria-label, or title:
  - `#problem`
  - `#fit`
  - `#templates`
  - `#proof-points`
  - `#how`
  - `/after-year-one/`
  - `/race-website-checklist/`

### Public trust/resources pages

Checked linked public resources in browser snapshots/text extraction.

- `https://startlinesites.com/sample-audit/`
  - Public, indexable sample page.
  - Clearly marked fictional/generic; no real customer claims observed.
  - Shows audit shape and repeats the private-audit CTA.
- `https://startlinesites.com/race-website-checklist/`
  - Public, indexable checklist page.
  - Explains green/yellow/red self-check and routes to private audit when multiple areas need review.
  - Buyer-safe language observed; no guaranteed growth claims observed.

### Customer kickoff pages

Checked direct customer resources in browser snapshots/text extraction.

- `https://startlinesites.com/intake/`
  - HTTP/browser route reachable.
  - Robots meta observed: `noindex,nofollow`.
  - Framed as `CUSTOMER KICKOFF RESOURCE` with prospect escape routes back to audit/pricing/sample audit.
- `https://startlinesites.com/asset-checklist/`
  - HTTP/browser route reachable.
  - Robots meta observed: `noindex,nofollow`.
  - Framed as customer kickoff and routes non-customers back to buyer resources.

## Prioritization rules

- **High:** Clear buyer-impacting issue, conversion friction, trust/proof safety risk, broken path, or high-confidence SEO/mobile/accessibility improvement.
- **Medium:** Useful clarity, polish, or supporting-path improvement that is not blocking the buyer.
- **Low:** Nice-to-have refinement, optional polish, or item that depends on higher-priority work first.
- **Blocked / approval-needed:** Requires Steve approval, real customer proof, pricing/package decisions, legal terms, operational commitments, or private data.

## Agent-actionable queue

### High priority

#### [H1] Hide the private-audit honeypot from users and accessibility output

- **Status:** Completed / merged in PR #114 (`56fdb35008e6084dbc89e768b70b7554e63ae28c`).
- **Page/path:** `https://startlinesites.com/#audit`.
- **Problem:** The anti-spam `companyWebsite` field is visible enough to appear as `COMPANY WEBSITE` in browser snapshots/text and has a measurable input rectangle. This can confuse real race directors at the exact conversion point and may hurt form completion confidence.
- **Evidence from audit:** Live browser inspection of the audit form listed `companyWebsite` with visible label text `COMPANY WEBSITE`. The form text exposed the label immediately before `Send audit request →`.
- **Buyer impact:** A race director may think the form is asking for both the current race URL and a second company website, or may distrust the form polish at the moment of requesting the audit.
- **Smallest useful change:** Preserve the honeypot field and server-side spam check, but make the wrapper reliably non-visible, non-focusable, and hidden from assistive/user-facing output. Do not remove the spam protection.
- **Acceptance criteria:**
  - [ ] The audit form still includes the honeypot field submitted under the same expected name.
  - [ ] The honeypot label/input are not visible in rendered page text, browser accessibility snapshots, or normal tab order.
  - [ ] Real user fields and labels remain visible and accessible.
  - [ ] A safe spam/honeypot smoke test still rejects a bot-style payload.
  - [ ] A safe normal audit-request smoke test still reaches the expected success path or clearly reports any missing production credential blocker.
- **Verification:**
  - [ ] `npm run build`.
  - [ ] `npm run test`.
  - [ ] Browser/DOM check for `#audit` confirming no visible/focusable `COMPANY WEBSITE` output.
  - [ ] Production or deploy-preview form smoke appropriate to available credentials.
  - [ ] `git diff --check`.
- **Claim/proof safety notes:** Do not change the audit promise, package claims, or public proof claims in this fix.
- **Suggested branch name:** `fix/audit-form-honeypot-visibility`.
- **Suggested PR title:** `Fix private audit honeypot visibility`.
- **Out of scope:** Reworking the full audit form, changing collected fields, changing Supabase/Resend payload shape, or altering package/deposit language.

#### [H2] Add a first-customer audit-request smoke gate before outreach

- **Status:** Completed / merged in PR #115 (`7549a071219ca079ad036ff63a7e1bcc8414cc75`).
- **Page/path:** `https://startlinesites.com/#audit`, Netlify audit-request function, Supabase/Resend owner workflow.
- **Problem:** The live form is the primary conversion path and appears to depend on JavaScript/runtime handling rather than a meaningful non-JS form action. Before using the site with a real prospect, the team needs a repeatable safe smoke test that proves a normal request creates the expected owner/customer-review workflow while spam/honeypot submissions remain blocked.
- **Evidence from audit:** Live form inspection showed required race/name/email/URL fields and a `method="get"` / `#audit` fallback action. The site copy promises a written review within 2 business days, so the runtime path must be verified rather than assumed.
- **Buyer impact:** If the primary audit request silently fails, StartLine could miss the first real lead and undermine trust immediately.
- **Smallest useful change:** Create or update an internal production-readiness checklist/script/documentation for the audit-request path, then run the safe smoke test and record exact evidence in the PR. Only change product code if the smoke test exposes a real bug.
- **Acceptance criteria:**
  - [ ] A documented safe test payload exists for the private-audit request path.
  - [ ] Normal request smoke confirms expected status, Supabase record/update behavior, and owner notification/preview path where credentials allow.
  - [ ] Honeypot/spam payload smoke confirms rejection or safe no-op handling.
  - [ ] Any missing credential/access blocker is named exactly and does not get reported as production-ready.
  - [ ] The public 2-business-day promise remains unchanged unless Steve approves a copy change.
- **Verification:**
  - [ ] `npm run build`.
  - [ ] `npm run test`.
  - [ ] Safe production/deploy-preview function smoke with redacted output.
  - [ ] `git diff --check`.
- **Claim/proof safety notes:** Do not send customer-facing audit responses automatically; owner approval remains required.
- **Suggested branch name:** `ops/audit-request-smoke-gate`.
- **Suggested PR title:** `Document and verify the audit-request smoke gate`.
- **Out of scope:** Changing pricing, customer kickoff intake, or auto-sending AI findings to race directors.

### Medium priority

#### [M1] Give homepage section-link cards accessible names

- **Status:** In review in PR for `fix/homepage-section-link-accessible-names`.
- **Page/path:** `https://startlinesites.com/`.
- **Problem:** Several homepage anchor elements have visible dimensions but no text, `aria-label`, or title. They link to important decision/support resources but may be announced poorly by assistive tech and automated QA.
- **Evidence from audit:** Live browser DOM inspection found visible-size anchors with empty accessible text for `#problem`, `#fit`, `#templates`, `#proof-points`, `#how`, `/after-year-one/`, and `/race-website-checklist/`.
- **Buyer impact:** Accessibility and QA polish matter for a site selling fast, trustworthy race websites. Empty link names are also a poor signal before customer testing.
- **Smallest useful change:** Add meaningful visible text or `aria-label` values to the affected anchors while preserving the current visual design and click targets.
- **Acceptance criteria:**
  - [ ] No visible-size homepage anchor lacks an accessible name.
  - [ ] The existing click targets still route to the intended sections/pages.
  - [ ] Visual layout remains unchanged except for any intentional accessible text treatment.
- **Verification:**
  - [ ] `npm run build`.
  - [ ] `npm run test`.
  - [ ] Browser console/accessibility check for empty visible links.
  - [ ] `git diff --check`.
- **Claim/proof safety notes:** No public claims need to change.
- **Suggested branch name:** `fix/homepage-accessible-link-names`.
- **Suggested PR title:** `Add accessible names to homepage section links`.
- **Out of scope:** Redesigning homepage navigation or changing the primary CTA hierarchy.

#### [M2] Make the first-prospect journey easier to scan from global navigation

- **Status:** Agent-actionable after H1/H2 unless Steve wants it first.
- **Page/path:** Homepage nav/footer and linked buyer resources.
- **Problem:** Public buyer resources are strong, but the global navigation varies by page and the homepage top nav only surfaces Pricing, Sample audit, FAQ, and audit CTA. Checklist, After year one, and race-type/persona pages are mostly discovered later or from the footer.
- **Evidence from audit:** Homepage links include Checklist and After year one deeper in the page/footer, while other public resource pages surface a different nav mix such as Checklist or After year one.
- **Buyer impact:** A cold race director who wants to self-educate before submitting the audit form may miss the checklist or segment-specific fit pages.
- **Smallest useful change:** Standardize a light buyer-resource nav pattern that preserves the primary `Request a private audit` CTA and makes `Checklist` or `Sample audit` consistently discoverable without crowding mobile.
- **Acceptance criteria:**
  - [ ] Homepage and key public resource pages expose a consistent buyer-resource path.
  - [ ] Primary CTA remains `Request a private audit`.
  - [ ] Mobile nav remains usable with no overflow.
  - [ ] Footer grouping remains buyer-journey oriented.
- **Verification:**
  - [ ] `npm run build`.
  - [ ] `npm run test`.
  - [ ] Browser checks at desktop and mobile widths for nav overflow and CTA visibility.
  - [ ] `git diff --check`.
- **Claim/proof safety notes:** Do not add fake proof or imply real customer work.
- **Suggested branch name:** `ux/buyer-resource-nav-consistency`.
- **Suggested PR title:** `Improve buyer-resource navigation consistency`.
- **Out of scope:** Creating new pages or changing pricing/package strategy.

### Low priority

#### [L1] Reduce repeated sample-audit self-links

- **Status:** Agent-actionable after higher-priority form/accessibility fixes.
- **Page/path:** `https://startlinesites.com/sample-audit/`.
- **Problem:** The sample-audit page includes both a nav `Sample audit` link and a hero `See sample audit` link on the same page. This is not broken, but it is slightly redundant once the visitor is already there.
- **Evidence from audit:** Browser snapshot for `/sample-audit/` showed hero links `Request a private audit →` and `See sample audit`; the latter routes to an anchor on the same page.
- **Buyer impact:** Minor clarity polish only.
- **Smallest useful change:** Consider relabeling the on-page secondary CTA to `Jump to sample report` or keeping it only if the anchor jump is visually useful.
- **Acceptance criteria:**
  - [ ] Secondary CTA language makes clear it jumps within the current page.
  - [ ] Primary private-audit CTA remains prominent.
- **Verification:**
  - [ ] `npm run build`.
  - [ ] Browser check `/sample-audit/` hero CTA labels/links.
  - [ ] `git diff --check`.
- **Claim/proof safety notes:** Keep fictional/generic labeling intact.
- **Suggested branch name:** `polish/sample-audit-anchor-cta`.
- **Suggested PR title:** `Clarify sample audit anchor CTA`.
- **Out of scope:** Rewriting the sample audit content.

## Blocked / approval-needed

### [B1] Add real customer proof, testimonials, logos, or before/after assets

- **Status:** Steve-needed / asset-needed.
- **Page/path:** Homepage proof areas, sample/trust sections, future case-study surfaces.
- **Problem/opportunity:** The site appropriately avoids fake proof. Real proof would improve trust but cannot be fabricated or published without approved assets.
- **Evidence from audit:** Public pages use fictional/generic proof framing and explicitly avoid real customer claims.
- **Buyer impact:** Real proof would likely improve confidence for a cold race director, but fake proof would create trust/legal risk.
- **Decision needed from Steve:** Provide approved customer proof assets or confirm which real examples can be used publicly.
- **Risk if implemented without approval:** Misleading claims, customer/privacy issues, and brand trust damage.
- **Safe interim action, if any:** Continue using fictional sample audit and process-based proof.
- **Can become agent-actionable when:** Steve approves specific assets, usage rights, quotes, customer names, or anonymized case-study constraints.

### [B2] Revisit runner decision path positioning

- **Status:** Proposed / hold for now.
- **Page/path:** Homepage positioning, CTA hierarchy, runner-decision narrative.
- **Problem/opportunity:** Prior repo state records this as an intentional proposed item, not an active implementation task.
- **Evidence from audit:** Homepage already has clear private-audit CTA, proof/process/pricing shortcuts, and runner-confidence messaging; changing the positioning could affect broader strategy.
- **Buyer impact:** Could sharpen conversion if Steve wants a new strategy, but it may also churn a recently stabilized page.
- **Decision needed from Steve:** Confirm whether to reopen the positioning discussion and what strategic direction should win.
- **Risk if implemented without approval:** Reversing a deliberate hold item or disrupting stable copy/CTA decisions.
- **Safe interim action, if any:** Keep as a proposed item while fixing concrete form/accessibility issues first.
- **Can become agent-actionable when:** Steve explicitly approves a positioning direction or asks for a docs-only strategy proposal.

## Next PR selection

- **Selected item ID:** H1.
- **Why this is first:** It is a concrete conversion-path bug at the primary private-audit form, has direct live evidence, and can be fixed without changing business strategy.
- **Branch name:** `fix/audit-form-honeypot-visibility`.
- **PR title:** `Fix private audit honeypot visibility`.
- **Minimum change required:** Preserve spam protection while hiding the honeypot from real users and accessibility output.
- **Files likely to change:** Audit form component/source, related styles, and possibly tests.
- **Checks to run:** `npm run build`, `npm run test`, rendered browser check for honeypot visibility/focusability, safe honeypot/normal form smoke where credentials allow, `git diff --check`.
- **Steve approval needed before merge:** Yes.

## Explicit non-scope for this docs PR

- No product code changes.
- No metadata/sitemap/robots changes.
- No route/form/workflow changes.
- No public copy changes.
- No pricing/package strategy changes.
- No publication of real customer proof.

## Completed items

No implementation items from this backlog have been completed yet.
