# CDO live-site backlog — 2026-07-06

## Backlog metadata

- **Source audit:** `docs/internal/audits/2026-07-06-cdo-audit.md`
- **Audit date:** 2026-07-06
- **Backlog owner:** Steve / StartLine Sites
- **Last updated:** 2026-07-06
- **Live site audited:** https://startlinesites.com/

## Prioritization rules

- **High:** Clear buyer-impacting issue, conversion friction, trust/proof safety risk, broken path, or high-confidence SEO/mobile improvement.
- **Medium:** Useful clarity, polish, or supporting-path improvement that is not blocking the buyer.
- **Low:** Nice-to-have refinement, optional polish, or item that depends on higher-priority work first.
- **Blocked / approval-needed:** Requires Steve approval, real customer proof, pricing/package decisions, legal terms, operational commitments, or private data.

## Reconciliation notes

- GitHub PR state confirmed the prior 2026-06-29 CDO implementation item is merged:
  - PR #119 — added the 2026-06-29 CDO audit/backlog docs.
  - PR #120 — polished persona-page section labels; live persona pages now show buyer-facing labels such as `RUNNER DECISION POINTS` and `FIRST AUDIT CHECKS`.
- GitHub PR state also confirmed recent customer-kickoff/payment/email polish PRs #121-#131 are merged. Do not count those as active CDO backlog items.
- The 2026-06-29 backlog still says M1 was `In review — PR #120`, but actual GitHub state is `MERGED`; do not reopen that item.
- Real proof/customer assets remain blocked until Steve approves specific assets, claims, and usage constraints.

## Agent-actionable queue

### High priority

No new high-priority agent-actionable item was found in the 2026-07-06 CDO audit. The primary audit CTA path, homepage nav, sample audit, customer kickoff noindex separation, and previously logged persona section-label issue were not observed as active regressions.

### Medium priority

#### [M1] Replace persona-page footer `Outreach pages` label

- **Status:** In review — PR #160
- **Page/path:** `/for-race-directors/`, `/for-community-races/`, `/for-marathons/`, `/for-runsignup-races/`
- **Problem:** Public persona-page footers still use the group heading `Outreach pages` above the segment page links. The phrase is internal go-to-market framing, not buyer-facing site IA.
- **Evidence from audit:** Live snapshots/fetches of all four persona pages showed `Outreach pages` in the footer, followed by `For community races`, `For marathons`, `For RunSignup races`, and `For race directors`. The homepage footer uses buyer-facing grouping (`FOR RACE TYPES`) for similar links.
- **Buyer impact:** A cold race director may briefly feel like they are reading StartLine's outreach collateral instead of a polished public resource. This is a tone/polish issue, not a broken conversion path.
- **Smallest useful change:** Replace only the persona-page footer group heading with buyer-facing wording, ideally consistent with the homepage footer (`For race types`) unless the existing component needs a similarly concise title.
- **Acceptance criteria:**
  - [ ] Persona pages no longer display `Outreach pages` in the public footer.
  - [ ] Replacement label is buyer-facing and consistent with homepage/footer IA.
  - [ ] Existing persona footer links remain intact and point to the same live destinations.
  - [ ] Primary CTAs remain `Request a private audit` and secondary proof/checklist paths remain lower commitment.
  - [ ] No route, metadata, pricing, package, form, function, deposit, or proof-asset changes are included.
  - [ ] No fake proof, fake customer names, fake testimonials, fake logos, case studies, metrics, or guaranteed outcome claims are introduced.
- **Verification:**
  - [ ] `npm run build`
  - [ ] `npm run test`
  - [ ] Source search confirms `Outreach pages` is removed from public-rendered persona footer copy or remains only in internal docs.
  - [ ] Browser/deploy-preview smoke for all four persona pages.
  - [ ] Mobile/overflow check at 375/414/768 where practical.
  - [ ] `git diff --check`
- **Claim/proof safety notes:** This is public-copy label polish only. Do not add proof claims or customer references.
- **Suggested branch name:** `polish/persona-footer-label`
- **Suggested PR title:** `Polish persona page footer label`
- **Out of scope:** Broad footer redesign, homepage footer changes unless strictly required by a shared component, pricing/package changes, new proof, real customer references, metadata changes, form/runtime work, or creating new pages.

### Low priority

No new low-priority polish items were promoted in this audit. Avoid cosmetic churn while the persona-footer label item and blocked proof gap are the meaningful findings.

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
- **Branch name:** `polish/persona-footer-label`
- **PR title:** `Polish persona page footer label`
- **Minimum change required:** Replace the public `Outreach pages` persona-footer group label with buyer-facing wording.
- **Files likely to change:** Persona-page layout/component or footer data source only.
- **Checks to run:** `npm run build`, `npm run test`, source search, deploy-preview persona-page smoke, mobile/overflow check where practical, and `git diff --check`.
- **Steve approval needed before merge:** Yes.

## Completed items

### [Done] Replace internal/outreach section labels on persona pages

- **PR:** #120 — `Polish persona page section labels`
- **Merged or reviewed date:** 2026-06-29
- **Verification:** Live persona pages inspected on 2026-07-06 show buyer-facing labels such as `RUNNER DECISION POINTS` and `FIRST AUDIT CHECKS`; old labels were not observed in public body sections.
- **Score movement:** Persona/page coverage and Brand polish improved from the previous audit, but remain 4/5 because of the remaining persona-footer `Outreach pages` label.
- **Follow-up needed:** M1 in this backlog.
