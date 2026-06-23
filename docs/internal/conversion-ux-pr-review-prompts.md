# Conversion UX PR review prompts

Reusable self-review prompts for StartLine Sites conversion, UX, copy, form, outreach, and proof-related pull requests.

Use these prompts to catch the highest-risk misses before a PR is reported as ready. They are intentionally lightweight: use the short checklist for tiny copy fixes, and use the full checklist for any change that affects the buyer journey, CTAs, pricing/package copy, proof, forms, mobile layout, or public claims.

## When to use this

Use the checklist for PRs that touch any of these surfaces:

- Homepage or outreach landing page copy.
- Primary or secondary CTAs.
- Pricing/package framing, deposit language, or after-year-one support copy.
- Private audit, intake, asset checklist, or other form-adjacent copy.
- Testimonials, logos, before/after examples, sample audits, founder proof, or credibility sections.
- Mobile layout, section density, sticky navigation, or tap-target behavior.
- SEO/performance credibility claims.

For a tiny typo-only fix that does not change meaning, use the short checklist and skip the full prompt.

## Short checklist for tiny fixes

Before reporting a tiny copy/docs PR as done, confirm:

- [ ] The changed words do not alter package scope, pricing, timeline, or legal/payment expectations.
- [ ] No unsupported growth, ranking, registration-lift, revenue, or performance-score claim was introduced.
- [ ] No real customer/race asset, quote, logo, screenshot, metric, or private data was added.
- [ ] The PR still states that Steve approval is required before merge.

## Full conversion UX self-review prompt

Paste this into a PR body or review comment when a PR changes a conversion surface:

```markdown
## Conversion UX self-review

### Audience clarity
- [ ] The page/section makes the intended buyer obvious: race directors or the specific outreach segment.
- [ ] The copy names the race-director problem in plain language.
- [ ] Segment-specific pages stay generic unless Steve approved a real customer/prospect reference.

### CTA consistency
- [ ] The primary CTA still points to the intended private audit/request path unless Steve explicitly changed the conversion event.
- [ ] CTA labels are action-oriented and consistent with the visitor stage.
- [ ] Secondary CTAs are clearly lower commitment and do not compete with the primary path.
- [ ] No dead `href="#"` or misleading CTA destinations remain.

### Claim safety
- [ ] No guaranteed registration growth, ranking, revenue, sponsor value, or traffic-lift claim was introduced.
- [ ] Any SEO/performance language is evidence-safe and race-director-friendly.
- [ ] Package, deposit, final-payment, after-year-one, and support-scope copy does not contradict current StartLine policy.
- [ ] Before/after language is respectful and does not shame old race sites or volunteer work.

### Proof authenticity
- [ ] No testimonial, logo, screenshot, case study, quote, or customer metric is presented as real without Steve-approved source/permission notes.
- [ ] Fictional/generic examples are clearly framed as examples, not customer work.
- [ ] When real assets are unavailable, the PR uses approved-safe alternatives: sample audit, generic deliverable, founder note, factual BMQR background, transparent process/timeline, or evidence-safe SEO/performance discipline.

### Form friction and expectations
- [ ] Form-adjacent copy explains what happens after submission and reduces uncertainty.
- [ ] Required fields remain justified and understandable.
- [ ] Existing field names, required flags, honeypot, endpoint, payload mapping, success/error behavior, and lead routing were preserved unless intentionally changed and verified.
- [ ] Privacy/no-spam or no-pressure reassurance appears where it helps conversion.

### Mobile scan
- [ ] The changed page/section remains readable at narrow widths.
- [ ] Dense paragraphs are broken into scannable units where needed.
- [ ] CTAs remain visible after persuasive sections and tap targets are usable.
- [ ] No horizontal overflow or decorative artifact was introduced.

### Definition of Done mapping
- [ ] The PR is isolated to one branch and one coherent task.
- [ ] `npm run build` passed, or the exact blocker is reported.
- [ ] Relevant tests/smoke checks for the touched surface were run.
- [ ] Copy/demo hygiene was checked.
- [ ] No secrets, private customer data, or unapproved real customer assets were introduced.
- [ ] Steve approval is still required before merge.
```

## Extra prompts by change type

### Outreach page message-match prompt

```markdown
## Outreach message-match check

- [ ] The page names the specific segment without pretending to know a real recipient.
- [ ] The opening pain point matches the likely email/DM angle.
- [ ] The page explains how StartLine complements, rather than replaces, existing registration platforms or race operations.
- [ ] Proof/process language is generic, respectful, and supportable.
- [ ] The CTA points to the private audit/request path.
```

### Pricing/package prompt

```markdown
## Pricing/package check

- [ ] First-year/race-cycle package framing is clear.
- [ ] Deposit/final-payment mechanics are consistent with the current billing SOP.
- [ ] No required monthly-retainer language was introduced.
- [ ] Optional after-year-one services are framed as scoped, one-time race-cycle services unless Steve approved otherwise.
- [ ] Public/self-serve payment paths only describe deliverables StartLine can fulfill now.
```

### Proof/public credibility prompt

```markdown
## Proof/credibility check

- [ ] Any proof asset has source, permission, approved wording, approved usage surface, and approval date recorded outside the public repo.
- [ ] Google Drive remains the asset source of truth; git stores governance/checklists only.
- [ ] The public page does not imply fake customers, fake outcomes, or unapproved real screenshots.
- [ ] Fallback proof is process-based or fictional/generic and clearly labeled.
```

## Review note template

Use this short note in PRs after completing the relevant checklist:

```markdown
## Self-audit summary

- Audience clarity: <passed / notes>
- CTA consistency: <passed / notes>
- Claim safety: <passed / notes>
- Proof authenticity: <passed / notes>
- Form/mobile checks: <passed / not applicable / notes>
- Definition of Done: <build/test/smoke results>

Steve approval required before merge.
```
