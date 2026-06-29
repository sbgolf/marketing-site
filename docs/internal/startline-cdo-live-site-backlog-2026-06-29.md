# CDO live-site backlog — 2026-06-29

## Backlog metadata

- **Source audit:** `docs/internal/audits/2026-06-29-cdo-audit.md`
- **Audit date:** 2026-06-29
- **Backlog owner:** Steve / StartLine Sites
- **Last updated:** 2026-06-29
- **Live site audited:** https://startlinesites.com/

## Prioritization rules

- **High:** Clear buyer-impacting issue, conversion friction, trust/proof safety risk, broken path, or high-confidence SEO/mobile improvement.
- **Medium:** Useful clarity, polish, or supporting-path improvement that is not blocking the buyer.
- **Low:** Nice-to-have refinement, optional polish, or item that depends on higher-priority work first.
- **Blocked / approval-needed:** Requires Steve approval, real customer proof, pricing/package decisions, legal terms, operational commitments, or private data.

## Reconciliation notes

- GitHub PR state confirmed recent customer-test readiness items are merged:
  - PR #114 — audit honeypot visibility.
  - PR #115 — audit-request smoke gate.
  - PR #116 — homepage accessible link names.
  - PR #117 — first-prospect navigation scan path.
  - PR #118 — sample-audit anchor CTA.
- The 2026-06-24 live-site audit backlog is closed: kickoff noindex/sitemap work was completed in PR #96 and closed out in PR #98.
- Do not reopen completed items unless a fresh live regression is observed.
- Real proof/customer assets remain blocked until Steve approves specific assets, claims, and usage constraints.

## Agent-actionable queue

### High priority

No new high-priority agent-actionable item was found in the 2026-06-29 CDO audit. The primary audit CTA path, homepage nav, sample audit, noindex kickoff separation, and previously logged accessibility/form issues were not observed as active regressions.

### Medium priority

#### [M1] Replace internal/outreach section labels on persona pages

- **Status:** In review — PR #120 (polish/persona-buyer-facing-labels)
- **Page/path:** `/for-race-directors/`, `/for-community-races/`, `/for-marathons/`, `/for-runsignup-races/`
- **Problem:** Several public persona-page section kickers still expose internal/outreach framing, especially `WHY THIS PAGE EXISTS` and `OUTREACH AUDIT PROMPTS`. The sections themselves are useful, but the labels feel more like sales-enablement notes than buyer-facing page copy.
- **Evidence from audit:** Live snapshots of persona pages showed labels such as `WHY THIS PAGE EXISTS` before buyer decision content and `OUTREACH AUDIT PROMPTS` before `What we would check first.` The CDO audit records this as the only new material agent-actionable polish issue.
- **Buyer impact:** A cold race director may briefly feel like they are reading StartLine's internal outreach strategy rather than a polished public resource, reducing trust in otherwise strong persona pages.
- **Smallest useful change:** Replace internal/outreach kickers with buyer-facing labels such as `RUNNER DECISION POINTS`, `FIRST AUDIT CHECKS`, or segment-specific equivalents. Preserve headings, routes, CTAs, layout, pricing/package claims, and proof-safety caveats unless a tiny adjacent wording change is necessary for grammar.
- **Acceptance criteria:**
  - [ ] Persona pages no longer display `WHY THIS PAGE EXISTS` as a public section label.
  - [ ] Persona pages no longer display `OUTREACH AUDIT PROMPTS` as a public section label.
  - [ ] Replacement labels are buyer-facing, race-director-friendly, and segment-appropriate.
  - [ ] Primary CTAs remain `Request a private audit` and secondary proof/checklist paths remain lower commitment.
  - [ ] No route, metadata, pricing, package, form, function, deposit, or proof-asset changes are included.
  - [ ] No fake proof, fake customer names, fake testimonials, or guaranteed outcome claims are introduced.
- **Verification:**
  - [ ] `npm run build`
  - [ ] `npm run test`
  - [ ] Source search confirms removed public strings are gone from public page data/components or intentionally internal-only.
  - [ ] Browser/deploy-preview smoke for all four persona pages.
  - [ ] Mobile/overflow check at 375/414/768 where practical.
  - [ ] `git diff --check`
- **Claim/proof safety notes:** Keep generic-example disclaimers claim-safe. Do not soften them into implied real customer proof.
- **Suggested branch name:** `polish/persona-buyer-facing-labels`
- **Suggested PR title:** `Polish persona page section labels`
- **Out of scope:** Broad persona rewrites, pricing/package changes, new proof, real customer references, metadata changes, form/runtime work, or creating new pages.

### Low priority

No new low-priority polish items were promoted in this audit. Avoid adding cosmetic churn while the medium-priority persona-label item and blocked real-proof gap are the meaningful findings.

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

- **Selected item ID:** M1
- **Why this is first:** It is the only new material agent-actionable issue from the audit and is safe to fix without business-strategy input.
- **Branch name:** `polish/persona-buyer-facing-labels`
- **PR title:** `Polish persona page section labels`
- **Minimum change required:** Replace public internal/outreach section labels on persona pages with buyer-facing labels.
- **Files likely to change:** Persona-page data/source only, most likely `src/data/outreachLandingPages.ts` or the shared persona-page component if labels are generated there.
- **Checks to run:** `npm run build`, `npm run test`, source search, deploy-preview persona-page smoke, mobile/overflow check where practical, and `git diff --check`.
- **Steve approval needed before merge:** Yes.

## Completed items

No implementation items from this backlog have been completed yet.
