# Outreach follow-up draft workflow

This is the owner-review workflow for StartLine private-mockup follow-up emails after the engagement watcher flags an item as due.

## Purpose

Create consistent follow-up drafts for Steve to review without sending anything to a race director automatically.

The draft generator is intentionally local and dry-run only. It has no customer side effects:

- no email send
- no contact-form submit
- no Supabase write
- no outreach status mutation

## Command

Use the npm script for direct inputs:

```bash
npm run draft:outreach-follow-up -- \
  --scenario clicked \
  --race-name "Sample River 5K" \
  --contact-name "Jordan" \
  --mockup-url "https://mockups.startlinesites.com/private/sample-river-5k?t=abc" \
  --race-context "making course details, race-day schedule, sponsor visibility, and registration easier to scan on mobile" \
  --recommended-package "Standard" \
  --package-reason "the race has enough runner detail and sponsor context to benefit from more than a single-page starter site"
```

Or pass a sanitized outreach row fixture:

```bash
npm run draft:outreach-follow-up -- --input /tmp/outreach-row.json
```

The `--input` object can be shaped like a `race_mockup_outreach` row. The adapter reads these fields when present:

- `race_name`
- `mockup_url`
- `engagement_status` or `outreach_status`
- `recommended_package`
- `metadata.contact_name`
- `metadata.race_context`
- `metadata.package_reason`

## Scenarios

Use the watcher status to pick the draft scenario:

- `clicked`: high-interest follow-up. Suggest a practical next step without mentioning the click.
- `opened`: softer one-idea follow-up. Resend the preview without mentioning the open.
- `delivered`: low-pressure close-the-loop note when there is no visible engagement.
- `final_close`: respectful final close.
- `suppressed`: internal no-send guidance only.

## Customer-facing copy guardrails

Every sendable draft must pass these checks before Steve reviews it:

- no em dash character in the email body
- no mention of opens, clicks, tracking, or surveillance
- no early-partner, new-company, newly-formed, or beta framing
- one clear reply prompt or next step
- approved StartLine signature:

```text
Thanks,
Steve, CEO & Founder
StartLineSites.com
```

## Owner approval gate

The generator output is only a draft for Steve. Do not send externally until Steve explicitly approves the final customer-facing subject and body for that specific race/contact.

If the watcher flags suppression, bounce, complaint, unsubscribe, or another negative deliverability signal, do not draft a customer email. Verify a replacement contact first.

## Test coverage

The regression tests live in:

```text
tests/outreach-follow-up-drafts.test.mjs
```

They cover subject-line selection, customer-body guardrails, row-to-scenario mapping, non-send suppression behavior, and the CLI dry-run output.
