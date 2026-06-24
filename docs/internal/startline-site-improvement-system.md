# StartLine Sites CDO self-improvement system

This document defines a durable Chief Design Officer (CDO) operating loop for improving the StartLine Sites marketing site without drifting into unsafe claims, sprawling changes, or unreviewed production impact.

The system is intentionally lightweight: audit the live site, convert findings into a ranked backlog, implement exactly one focused improvement per PR, verify the result, rescore, and repeat.

## Purpose

Use this system to keep `https://startlinesites.com/` improving for race director buyers while preserving StartLine rules:

- No fake real proof, fake customer claims, fake testimonials, or unapproved real race/customer references.
- No guaranteed-growth or overpromised outcome claims.
- One focused PR per implementation item.
- No merge without Steve approval.
- Docs and implementation work stay separate unless a task explicitly calls for a docs-only change.

## Operating loop

1. **Audit cold**
   - Open the live site as if encountering StartLine Sites for the first time.
   - Evaluate whether a busy race director understands the offer, trusts it, can see next steps, and can complete the intended conversion path.
   - Use `prompts/chief-design-officer-site-audit.md`.

2. **Score**
   - Score each rubric category from 1-5.
   - Record evidence, not vibes.
   - Save the report with `templates/cdo-audit-report-template.md`.

3. **Convert to backlog**
   - Convert findings into agent-ready backlog items with `templates/cdo-backlog-template.md`.
   - Separate High / Medium / Low priorities from Blocked / approval-needed work.
   - Label each item as either **agent-actionable** or **Steve-needed**.

4. **Pick one item**
   - Select one high-leverage, low-risk, agent-actionable item.
   - Do not bundle unrelated copy, design, routing, SEO, and form changes into one PR.

5. **Open one focused PR**
   - Branch from current `origin/main`.
   - Make only the scoped change.
   - Include why it matters, verification, and any remaining risk.
   - Do not merge without Steve approval.

6. **Verify**
   - Run the checks appropriate to the touched area.
   - For code/content changes, default to `npm run build` when dependencies are available.
   - For docs-only changes, at minimum run `git diff --check`, confirm changed files are docs-only, and grep for required markers.

7. **Rescore**
   - After the PR is reviewed or merged, rerun the relevant part of the audit.
   - Record score movement and remaining gaps.
   - Feed the next backlog item into the next loop.

## Cadence

- **Weekly lightweight audit:** Review the homepage, nav, footer, pricing path, primary CTA path, and any recently changed pages.
- **Monthly full CDO audit:** Review all key paths listed in the audit prompt, rescore the full rubric, and refresh the backlog.
- **After any significant PR:** Rescore affected categories before selecting the next item.
- **Quarterly strategy review with Steve:** Reconfirm package positioning, proof assets, pricing posture, and any customer claims that require founder approval.

## Scoring rubric

Score each category from 1-5.

- **1 = blocking:** Confusing, broken, unsafe, or likely to prevent buyer action.
- **2 = weak:** Understandable only with effort; missing important trust, clarity, or conversion support.
- **3 = acceptable:** Works, but has clear improvement opportunities.
- **4 = strong:** Clear, credible, and conversion-friendly with minor refinements available.
- **5 = excellent:** Buyer-ready, polished, credible, and difficult to improve without new business inputs.

Required categories:

1. **First-impression clarity:** A race director can quickly tell what StartLine Sites does, who it is for, and why it matters.
2. **Offer and package clarity:** Pricing, deliverables, timeline, and next steps are concrete without overpromising.
3. **Trust and proof safety:** Claims are credible, supportable, and do not imply fake customers or guaranteed outcomes.
4. **Navigation and information scent:** Nav, footer, CTAs, and page labels help buyers find the right next step.
5. **Persona/page coverage:** Relevant race director concerns are addressed across homepage, persona pages, sample audit, pricing, intake, and asset checklist paths.
6. **Conversion path:** The path from interest to audit/mockup/deposit/kickoff is understandable and low-friction.
7. **Mobile UX:** Core pages and CTAs work for a buyer reviewing on a phone.
8. **SEO fundamentals:** Titles, headings, internal links, indexability, and content focus support qualified discovery.
9. **Operational readiness:** The site sets expectations that StartLine can currently fulfill.
10. **Brand polish:** Copy, visual hierarchy, and tone feel professional, respectful, and specific to race directors.

## Roles

- **CDO/auditor agent:** Performs cold audits, scores the rubric, identifies issues, and produces backlog-ready findings.
- **Implementing agent:** Takes one approved backlog item, makes the smallest durable change, verifies it, and opens a PR.
- **Reviewer agent or Steve:** Reviews scope, claim safety, and whether the change should merge.
- **Steve:** Approves merges, real customer proof, real race/customer references, pricing/offer changes, and any strategic positioning changes.

## Agent-actionable vs Steve-needed

### Agent-actionable

An item is agent-actionable when it can be completed using existing repo context and public site behavior without new business approval. Examples:

- Fixing unclear internal docs.
- Improving obvious navigation consistency.
- Tightening generic, supportable copy without changing the offer.
- Fixing broken links, accessibility issues, metadata issues, or mobile layout defects.
- Adding safer phrasing that removes overclaiming.

### Steve-needed

An item requires Steve before implementation when it depends on business judgment, private information, or approval to make claims. Examples:

- Real customer names, testimonials, screenshots, outcomes, or logos.
- Pricing, package, guarantee, scope, timeline, or billing policy changes.
- Claims about conversion lift, revenue, registration increases, or customer results.
- New service commitments that affect operations.
- Changes to legal terms, payment terms, or customer-specific workflows.

If uncertain, mark the item `Blocked / Steve-needed` instead of guessing.

## Guardrails

- Use the live site as the evaluation source, but branch from `origin/main` for implementation.
- Preserve unrelated local workspace state; use a clean worktree when the main workspace is dirty.
- Keep each implementation PR focused on one backlog item.
- Do not change product code, public copy, routes, metadata, tests, package files, or assets in a docs-only PR.
- Do not introduce real or implied proof unless Steve has approved the exact asset/claim.
- Prefer respectful before/after language: registration-focused, never disparaging old race sites.
- Report blockers plainly; do not fabricate verification, screenshots, or metrics.

## Cron scheduling expectations

Hermes cron scheduling is managed outside this repository and should be configured separately. This repo only stores the operating docs, prompt, and templates.

Expected schedules:

- **Weekly CDO audit prompt run:** Produce a lightweight audit report and backlog delta.
- **Monthly full audit prompt run:** Produce a full scored report and refreshed backlog.
- **Post-merge rescore reminder:** After a StartLine marketing-site PR merges, rescore affected categories before selecting the next improvement.

Cron jobs should save outputs in the appropriate internal docs or linked operational record, then delegate one focused implementation item rather than attempting broad automatic rewrites.

## Definition of Done

A CDO self-improvement loop iteration is done when:

- The live site has been audited cold using the CDO prompt.
- Scores and evidence have been recorded in the audit report template.
- Findings have been converted into backlog-ready items.
- Each backlog item is tagged as High / Medium / Low and agent-actionable or Steve-needed.
- Exactly one implementation item has been selected for a focused PR.
- The PR includes verification results and states whether Steve approval is needed before merge.
- The change has been verified with the checks appropriate to its scope.
- The affected score categories have been rescored or marked for rescore after merge.

## Related files

- Audit prompt: `prompts/chief-design-officer-site-audit.md`
- Audit report template: `templates/cdo-audit-report-template.md`
- Backlog template: `templates/cdo-backlog-template.md`
