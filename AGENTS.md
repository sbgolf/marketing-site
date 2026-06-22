# AGENTS.md — StartLine Sites Marketing Site

This repo is the public **StartLine Sites** marketing site (`sbgolf/marketing-site`). It explains the offer, captures audit/private-mockup leads, supports pricing/package pages, and connects the lead → deposit → kickoff workflow.

## Required Skill

Before doing dev work in this repo, load and follow the Hermes skill:

- `startline-marketing-site`

Also load these when relevant:

- `tbd-race-websites-venture` for venture-wide positioning, pipeline, pricing, and operating principles.
- `github-pr-workflow` for branch/PR/check/merge work.
- `requesting-code-review` for review-heavy changes.

## Non-Negotiables

- Branch + PR only. Do not merge to `main` without Steve's explicit approval.
- Keep this repo separate from BMQR, ShiftDiff, SmokerTime, Hermes runtime, and `race-templates` implementation work.
- Do not remove or significantly change a PRD/spec-required feature without Steve approval.
- Use fictional/generic demo races, customer names, URLs, screenshots, and proof examples unless Steve explicitly approves a real reference.
- Do not overpromise outcomes. Avoid guaranteed-growth claims such as “double registrations.”
- Do not disparage old race sites. Before/after language must be respectful and registration-focused.
- Keep dependencies light. Ask before adding heavy packages or new paid services.
- Never commit secrets, API keys, webhook secrets, real customer payment data, or private credentials.

## Standard Commands

Use npm; this repo has `package-lock.json`.

```bash
npm run build
npm run test
npm run lighthouse
npm run verify:stripe-webhook
```

Run the commands that match the touched area. At minimum, `npm run build` should pass before reporting a code change as done. If a command cannot run because credentials or external services are unavailable, report the exact blocker instead of guessing.

## Runtime/Integration Checks

If touching forms, Netlify Functions, Supabase, Resend, Stripe, intake, asset checklist, pricing CTAs, or payment paths, verify the relevant runtime path or clearly list what remains blocked.

Check as applicable:

- Netlify Function endpoint returns the expected status.
- Supabase receives/updates the expected row and test rows are cleaned up.
- Resend notification email is sent or function logs show the downstream failure.
- Reply-To/from addresses match StartLine conventions.
- Stripe Checkout/webhook behavior uses test mode or safe signed synthetic events, never real charges.
- Public package/payment claims match what StartLine can actually fulfill now.

## Copy and Demo Hygiene

- Brand name: `StartLine Sites`.
- Locked positioning: “Race websites built to turn interest into registrations.”
- Supporting line: “Fast, SEO-optimized websites for race directors — designed to help runners find your race, trust the details, and click through to register.”
- Proof phrase: “Built for search, speed, and signups.”
- Prefer polished verbs: “Complete the intake form,” “Submit your details,” “Review your mockup.”
- Public demos should use generic/fictional examples such as `Ocean Marathon` unless Steve approves a real race/customer.

Before opening a PR, search for accidental real/unapproved race names or stale placeholder branding if the task touched public-facing copy.

## Visual QA

For page/section changes, check responsive behavior at practical widths: 375, 414, 768, 1024, and desktop. Confirm no horizontal overflow, sticky nav/CTA behavior works, mobile tap targets are usable, and decorative elements do not create screenshot artifacts.

If Steve provided a screenshot artifact, treat it as valid until disproven and capture a confirming screenshot after the fix when possible.

## Definition of Done

A marketing-site task is done when:

1. The change is isolated on a branch and PR, or clearly staged locally for review.
2. `npm run build` passes, or the exact blocker is reported.
3. Relevant tests/smoke checks for the touched area have been run.
4. Copy/demo hygiene has been checked.
5. No secrets or unapproved real customer data were introduced.
6. The PR/report includes: what changed, why it matters, verification output, what is next, and links.
7. Steve approval is still required before merge or production-impacting action.
