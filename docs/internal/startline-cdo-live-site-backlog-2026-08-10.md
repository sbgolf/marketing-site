# CDO live-site backlog — 2026-08-10

## Backlog metadata

- **Source audit:** `docs/internal/audits/2026-08-10-cdo-audit.md`
- **Audit date:** 2026-08-10
- **Backlog owner:** Steve / StartLine Sites
- **Last updated:** 2026-08-10
- **Live site audited:** https://startlinesites.com/

## Prioritization rules

- **High:** Clear buyer-impacting issue, conversion friction, trust/proof safety risk, broken path, or high-confidence SEO/mobile improvement.
- **Medium:** Useful clarity, polish, or supporting-path improvement that is not blocking the buyer.
- **Low:** Nice-to-have refinement, optional polish, or item that depends on higher-priority work first.
- **Blocked / approval-needed:** Requires Steve approval, real customer proof, pricing/package decisions, legal terms, operational commitments, or private data.

## Reconciliation notes

- GitHub PR state confirmed the previous CDO implementation item is merged:
  - PR #132 — added the 2026-07-06 CDO audit/backlog docs.
  - PR #160 — polished persona-page footer label; live persona pages now use `For race types` rather than `Outreach pages`.
- The 2026-07-06 backlog listed PR #160 as `In review`; actual GitHub state is `MERGED`, so that item is complete and should not be reopened.
- One open docs-only PR exists outside this CDO backlog: PR #163 (`Document future self-service update portal idea`). It is unrelated and should not be counted as active CDO implementation work.
- Real proof/customer assets remain blocked until Steve approves specific assets, claims, and usage constraints.

## Agent-actionable queue

### High priority

#### [H1] Remove internal campaign narration from the RunSignup persona page

- **Status:** Agent-actionable
- **Page/path:** `/for-runsignup-races/`
- **Problem:** The public RunSignup persona page includes internal campaign/outreach instructions instead of buyer-facing copy.
- **Evidence from audit:** Live page snapshot and source search show `IMMEDIATE CAMPAIGN ANGLE`, `Use this page in direct outreach, mockup follow-ups, and small paid tests...`, and `This is campaign positioning, not a public promise...` in public-rendered content.
- **Buyer impact:** A race director arriving from outreach can feel like they are seeing StartLine's internal sales notes, which weakens trust on an otherwise valuable platform-specific path.
- **Smallest useful change:** Rewrite only this RunSignup page section into buyer-facing language about common RunSignup-race decision friction and how StartLine complements the existing registration platform.
- **Acceptance criteria:**
  - [ ] `/for-runsignup-races/` no longer displays `IMMEDIATE CAMPAIGN ANGLE`, `Use this page in direct outreach`, `mockup follow-ups`, `small paid tests`, or `campaign positioning`.
  - [ ] Replacement section speaks directly to race directors using RunSignup and explains runner-decision friction in public/buyer language.
  - [ ] The page still clearly says RunSignup can remain the registration/payment platform and StartLine complements it with the marketing/search/trust layer.
  - [ ] Primary CTA remains `Request a private audit`; secondary proof path remains `See sample audit`.
  - [ ] No route, metadata, pricing, package, form, function, deposit, or proof-asset changes are included.
  - [ ] No fake proof, fake customer names, fake testimonials, fake logos, case studies, metrics, platform partnership claims, or guaranteed outcome claims are introduced.
- **Verification:**
  - [ ] `npm run build`
  - [ ] `npm run test`
  - [ ] Source and rendered/deploy-preview search confirms removed internal phrases are absent from public copy.
  - [ ] Browser/deploy-preview smoke for `/for-runsignup-races/` confirms replacement visible copy and unchanged CTA destinations.
  - [ ] Mobile/overflow check at 375/414/768 where practical.
  - [ ] `git diff --check`.
- **Claim/proof safety notes:** Copy hygiene only. Do not add real proof, fake proof, special RunSignup integration claims, or customer references.
- **Suggested branch name:** `polish/runsignup-public-copy`
- **Suggested PR title:** `Polish RunSignup persona page public copy`
- **Out of scope:** Broad persona-page redesign, homepage changes, pricing/package changes, new proof, real customer references, metadata changes, form/runtime work, route changes, or creating new pages.

### Medium priority

#### [M1] Make shared persona FAQ heading buyer-facing

- **Status:** Agent-actionable
- **Page/path:** `/for-race-directors/`, `/for-community-races/`, `/for-marathons/`, `/for-runsignup-races/`
- **Problem:** Shared persona FAQ copy says `Questions before you share the link.` and `These race-type pages are designed to show how StartLine's audit lens applies...`, which reads like outreach/share-prep language rather than buyer evaluation language.
- **Evidence from audit:** Live persona pages all render the same FAQ heading/lead.
- **Buyer impact:** Mild public-polish issue. It is less urgent than H1 because it does not expose direct campaign instructions, but it still makes persona pages sound like collateral.
- **Smallest useful change:** In a separate PR after H1, rename the shared FAQ heading/lead to buyer-facing language such as `Questions before you request an audit.` while preserving each page's existing FAQ items.
- **Acceptance criteria:**
  - [ ] Persona FAQ heading/lead speaks to race directors considering StartLine, not to an internal sender sharing the link.
  - [ ] Existing FAQ items and CTA links remain intact.
  - [ ] No unrelated persona-page rewrites are included.
  - [ ] No proof, pricing, route, metadata, form, or runtime changes are included.
- **Verification:**
  - [ ] `npm run build`
  - [ ] `npm run test`
  - [ ] Source/rendered search for the old heading.
  - [ ] Browser/deploy-preview smoke on all four persona pages.
  - [ ] `git diff --check`.
- **Claim/proof safety notes:** Low-risk copy polish; avoid offer, proof, or pricing changes.
- **Suggested branch name:** `polish/persona-faq-heading`
- **Suggested PR title:** `Polish persona FAQ heading`
- **Out of scope:** H1 if not already completed, RunSignup section rewrite beyond shared heading/lead, proof, pricing, metadata, routes, forms, or runtime work.

### Low priority

No new low-priority item was promoted in this audit. Avoid cosmetic churn until H1 and M1 are resolved or Steve provides approved proof inputs.

## Blocked / approval-needed

### [B1] Add real customer proof, testimonials, logos, screenshots, or case-study assets

- **Status:** Steve-needed
- **Page/path:** Homepage proof sections, sample audit, persona pages, future case-study/proof surfaces.
- **Problem/opportunity:** The site correctly avoids fake proof and uses fictional/generic examples. This is safe, but real approved proof would likely improve buyer trust.
- **Evidence from audit:** Public pages use fictional/generic proof framing and explicitly avoid real customer claims. No unsafe proof claims were observed.
- **Buyer impact:** Some buyers may want evidence beyond process proof before requesting an audit or paying a deposit.
- **Decision needed from Steve:** Provide approved proof assets, customer/race names, testimonial language, anonymization rules, or confirm no real proof should be published yet.
- **Risk if implemented without approval:** Misleading claims, privacy/customer-permission problems, and StartLine trust damage.
- **Safe interim action, if any:** Continue using fictional sample audit and process-based proof.
- **Can become agent-actionable when:** Steve approves exact assets/claims and usage constraints.

### [B2] Decide whether pricing should remain a homepage section or become a standalone page

- **Status:** Steve-needed
- **Page/path:** `/#pricing`, `/pricing/`
- **Problem/opportunity:** The live site currently redirects `/pricing/` to `/#pricing`. This is functional and not broken, but some buyers may expect a dedicated pricing page if they type or search for pricing directly.
- **Evidence from audit:** `https://startlinesites.com/pricing/` resolves to `https://startlinesites.com/#pricing`; no linked buyer path returned 4xx.
- **Buyer impact:** Current behavior is acceptable, but a dedicated page could support deeper package confidence if Steve wants that strategy.
- **Decision needed from Steve:** Keep the homepage pricing section as canonical, or approve a standalone pricing page scope.
- **Risk if implemented without approval:** Could alter offer framing, package expectations, or payment path assumptions.
- **Safe interim action, if any:** Keep existing redirect and audit-first pricing path.
- **Can become agent-actionable when:** Steve approves the standalone pricing-page strategy and scope.

## Next PR selection

- **Selected item ID:** H1
- **Why this is first:** It is the only high-priority agent-actionable issue from the audit and is safe to fix without business-strategy input.
- **Branch name:** `polish/runsignup-public-copy`
- **PR title:** `Polish RunSignup persona page public copy`
- **Minimum change required:** Replace the internal campaign-angle section on `/for-runsignup-races/` with buyer-facing RunSignup fit/problem copy.
- **Files likely to change:** `src/data/outreachLandingPages.ts` and any directly relevant test/snapshot files if present.
- **Checks to run:** `npm run build`, `npm run test`, source/rendered phrase search, deploy-preview RunSignup page smoke, mobile/overflow check where practical, and `git diff --check`.
- **Steve approval needed before merge:** Yes.

## Completed items

### [Done] Replace persona-page footer `Outreach pages` label

- **PR:** #160 — `Polish persona page footer label`
- **Merged or reviewed date:** 2026-07-22
- **Verification:** Live persona page inspection on 2026-08-10 shows the footer group label `For race types`; source/live fetches no longer show `Outreach pages` in public persona copy.
- **Score movement:** Navigation/information scent improved from the prior footer-label issue, but brand polish is now limited by H1.
- **Follow-up needed:** H1 in this backlog.
