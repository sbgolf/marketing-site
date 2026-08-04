# Outreach engagement tracking implementation backlog

Owner: StartLine Sites internal ops
Status: implementation in progress — PR 7 internal smoke-test harness in review
Source process: `outreach-engagement-tracking-process.md`
Scope: concrete PR sequence to fully wire Resend open/click tracking, webhook ingestion, Supabase event storage, outreach aggregation, suppression, owner reporting, and owner-gated follow-up recommendations.

## Purpose

This backlog preserves the full implementation path for StartLine outreach engagement tracking while external setup work is pending. It is intentionally broken into focused PRs so future agents can resume the work without guessing, over-automating sends, or weakening the existing private-mockup send gates.

The desired final state is:

1. Resend open/click tracking is enabled for StartLine outreach.
2. `track.startlinesites.com` is configured and verified in Resend.
3. A StartLine Netlify Function receives Resend webhooks and verifies signatures.
4. Supabase stores raw engagement events idempotently.
5. `race_mockup_outreach` rows aggregate delivered/open/click/bounce/suppression state.
6. Suppression blocks future sends before any Resend side effect.
7. Owner digests surface engagement and recommended follow-ups.
8. Steve approval remains required for race-director/customer-facing sends until explicitly changed.

## External setup dependencies

These steps require dashboard/DNS/provider access and may happen outside a repo PR.

### Resend tracking domain setup

- Enable Resend open tracking for StartLine outreach sends.
- Enable Resend click tracking for StartLine outreach sends.
- Configure custom tracking domain: `track.startlinesites.com`.
- Add the DNS records Resend requires for the tracking domain.
- Wait for DNS propagation and verify the domain in Resend.
- Confirm a safe internal test email rewrites outbound links through the tracking domain.

### Resend webhook setup

- Create a Resend webhook endpoint pointing to the deployed StartLine function path, expected to be:

```text
https://startlinesites.com/.netlify/functions/resend-webhook
```

- Subscribe to delivery, open, click, bounce, complaint, and unsubscribe/suppression event types when available.
- Store the webhook signing secret in Netlify, not in git.
- Use a clear env var name, recommended:

```text
RESEND_WEBHOOK_SECRET
```

### Production env setup

Before runtime verification, confirm Netlify production has:

- `RESEND_WEBHOOK_SECRET` for webhook signature verification.
- Existing Supabase service-role env vars required by current serverless write paths.
- Existing Resend send env vars required by current outreach send CLIs/functions.
- Any future recipient-hash salt if the schema PR chooses salted hashing.

## PR 1: implementation spec and contract lock

Recommended branch: `docs/outreach-engagement-implementation-spec`
Type: docs-only
Goal: turn the approved process into exact build contracts before runtime changes.

### Tasks

- Document exact Resend webhook event names StartLine will handle.
- Document expected payload fields for delivery/open/click/bounce/complaint/unsubscribe events.
- Document signature verification requirements:
  - header names,
  - raw-body handling in Netlify,
  - timestamp tolerance if Resend provides timestamps,
  - replay protection expectations,
  - env var name: `RESEND_WEBHOOK_SECRET` unless changed deliberately.
- Define the Supabase schema plan:
  - raw events table name,
  - suppression table/model,
  - aggregate typed columns vs metadata fields,
  - indexes and unique constraints,
  - RLS/service-role assumptions,
  - retention policy for raw JSON.
- Define engagement-status precedence rules, including suppression overriding prior positive engagement.
- Define campaign/wave identifier requirements for future reporting.
- Define internal smoke-test procedure with safe fictional/internal recipients.
- Link this backlog and the process doc from `docs/internal/README.md`.

### Acceptance criteria

- A future agent can implement PRs 2-7 without asking what tables, env vars, event types, or status precedence to use.
- No runtime behavior changes.
- No secrets or real recipient lists are added.
- `git diff --check` passes.
- `npm run build` and `npm test` pass if run for standard docs hygiene.

### Definition of done

- PR is docs-only.
- PR body states that runtime tracking is still not operational.
- Steve approval remains required before merge.

## PR 2: Supabase schema foundation

Status: Merged — PR #171

Recommended branch: `feat/outreach-engagement-schema`
Type: schema + tests/docs
Goal: add durable storage for raw events, suppression, and aggregation targets.

### Tasks

- Add a Supabase migration for an outreach engagement raw event table, tentatively:

```text
outreach_engagement_events
```

- Include, at minimum:
  - provider event ID or equivalent idempotency key,
  - `resend_email_id`,
  - nullable `outreach_id`,
  - event type,
  - event timestamp,
  - masked or hashed recipient reference,
  - clicked URL for click events,
  - sanitized raw event JSON,
  - created timestamp.
- Add unique constraint/index for provider event idempotency.
- Add indexes for `resend_email_id`, `outreach_id`, `event_type`, and event timestamp.
- Add a suppression model, either a dedicated table or a clearly documented metadata path. Prefer a dedicated table if practical, tentatively:

```text
outreach_suppressions
```

- Suppression records should include normalized email hash/reference, reason, source event, source outreach, created timestamp, and optional notes.
- Add migration support for aggregate fields on `race_mockup_outreach` if typed columns are chosen; otherwise document exact metadata keys to use.
- Update internal docs with the production migration application step.

### Acceptance criteria

- Migration is idempotent enough for Supabase deployment conventions.
- Schema supports duplicate webhook deliveries without duplicate counts.
- Schema supports suppression checks before sending.
- Schema avoids storing raw recipient lists in git or logs.
- Tests or schema inspections verify expected table/column names.

### Definition of done

- PR clearly states that production is not operational until Steve/admin applies the migration and env/webhook setup is complete.
- Post-merge checklist includes applying the production migration and verifying tables through Supabase REST or dashboard.

## PR 3: Resend webhook receiver

Status: Merged — PR #172

Recommended branch: `feat/resend-outreach-webhook`
Type: Netlify Function + tests
Goal: receive Resend events safely and store raw engagement rows.

### Tasks

- Add Netlify Function:

```text
netlify/functions/resend-webhook.mjs
```

- Preserve the raw request body for signature verification.
- Verify Resend webhook signatures using `RESEND_WEBHOOK_SECRET`.
- Reject missing, invalid, stale, or replayed signatures.
- Parse supported events:
  - delivered,
  - opened,
  - clicked,
  - bounced,
  - complained,
  - unsubscribed/suppressed when available.
- Extract `resend_email_id` and match to `race_mockup_outreach` when possible.
- Insert raw event rows with idempotency.
- Do not log secrets, full recipient lists, or sensitive raw payload fields.
- Return 2xx only after the event is stored or intentionally deduped.
- Return non-2xx for invalid signatures and malformed required fields.

### Tests

- Valid signed event is accepted and stored.
- Invalid signature is rejected before Supabase writes.
- Missing secret fails closed.
- Duplicate provider event is deduped.
- Unsupported event is handled safely without crashing.
- Click event stores the clicked URL.
- Bounce/complaint/unsubscribe event creates or prepares suppression state if PR 4 does not own that logic.

### Acceptance criteria

- Function can be deployed before the webhook is enabled without affecting existing sends.
- Existing outreach send CLIs/functions still pass tests.
- No customer/race-director email is sent by webhook handling.

### Definition of done

- PR body includes required Netlify env var and Resend dashboard webhook setup steps.
- Post-merge production smoke is required before declaring operational.

## PR 4: outreach aggregation and engagement status

Status: Merged — PR #173

Recommended branch: `feat/outreach-engagement-aggregation`
Type: serverless/helper logic + tests
Goal: update `race_mockup_outreach` with useful engagement summaries.

### Tasks

- Add aggregation helper used by the webhook receiver or a background/reporting job.
- Link raw events to `race_mockup_outreach` via `resend_email_id` first, then `outreach_id` if present.
- Update aggregate fields or metadata keys:
  - `delivered_at`,
  - `first_opened_at`,
  - `last_opened_at`,
  - `open_count`,
  - `first_clicked_at`,
  - `last_clicked_at`,
  - `click_count`,
  - `clicked_urls`,
  - `bounced_at`,
  - `complained_at`,
  - `unsubscribed_at`,
  - `engagement_status`,
  - `next_follow_up_at`,
  - `follow_up_reason`.
- Implement status precedence:
  - `suppressed` overrides all other states,
  - `bounced`/`complained`/`unsubscribed` suppress future outreach,
  - `clicked` outranks `opened`,
  - `opened` outranks `delivered`,
  - `no_activity` remains the default before tracked events.
- Implement follow-up recommendation dates using America/Chicago business-day rules or document any simpler first-pass logic.
- Keep surveillance language out of generated recommendation copy.

### Tests

- Delivered event sets delivered state.
- First open and repeated open update first/last/count correctly.
- Click event updates click fields and outranks opened.
- Bounce/complaint/unsubscribe overrides prior clicked/opened state.
- Duplicate event does not inflate counts.
- Follow-up recommendation cadence matches process doc:
  - opened/no click: 3-5 business days,
  - clicked/no reply: 1-2 business days,
  - no open/no click: 7-10 days,
  - suppressed: no follow-up.

### Acceptance criteria

- Owner can look at `race_mockup_outreach` and understand engagement state without reading raw webhooks.
- Aggregation is safe under repeated webhook delivery.
- No automatic customer follow-up sends are added.

### Definition of done

- Existing duplicate-send gates remain intact.
- Tests cover precedence and idempotency.

## PR 5: suppression enforcement in send gate

Status: Merged — PR #174

Recommended branch: `feat/outreach-suppression-send-gate`
Type: send-gate logic + tests
Goal: make suppression block future customer/race-director outreach before any Resend side effect.

### Tasks

- Add a suppression lookup helper used by existing send paths, especially:
  - `send:mockup-outreach-from-job`,
  - any direct `record/send-mockup-outreach` path that can send externally.
- Normalize recipient matching consistently with the schema PR.
- Block sends when a recipient is suppressed due to:
  - bounce,
  - complaint,
  - unsubscribe,
  - explicit negative reply/manual suppression,
  - wrong-contact reply without verified replacement.
- Ensure dry-run output reports suppression status and blocks clearly.
- Ensure real send exits before Resend API calls or outreach-row mutation when suppressed.
- Preserve current Steve approval gate and duplicate-send checks.
- Add a safe manual suppression entry path if needed for negative replies.

### Tests

- Suppressed recipient blocks dry-run and real send.
- Suppressed recipient prevents Resend API call.
- Unsuppressed approved recipient still follows existing gates.
- Duplicate-send protection still runs and is not weakened.
- Mixed recipient lists fail closed or skip only if explicitly designed and documented.

### Acceptance criteria

- No suppressed race-director/customer recipient can be emailed by the StartLine send gate.
- Error messages are clear enough for owner/admin action.
- No suppression secrets or full recipient lists are logged.

### Definition of done

- PR body states that this enables safety enforcement but does not enable auto-follow-up.
- Post-merge smoke includes a seeded suppressed recipient dry-run.

## PR 6: owner digest engagement reporting

Status: Merged — PR #175

Recommended branch: `feat/outreach-engagement-owner-digest`
Type: reporting script/digest logic + tests
Goal: surface engagement and recommendations to Steve without sending customer follow-ups automatically.

### Tasks

- Add or update a reporting script that reads `race_mockup_outreach` aggregates and raw event summaries.
- Include campaign/wave filters when available.
- Report:
  - sent count,
  - delivered count/rate,
  - open count/rate labeled directional,
  - click count/rate,
  - private mockup click count/rate when distinguishable,
  - bounce/complaint/unsubscribe count,
  - recommended follow-up action,
  - suppression blockers.
- Format output for Telegram readability.
- Avoid tables; use numbered or bulleted summaries.
- Keep follow-up recommendations owner-reviewed.
- Include caveat that opens are directional due to Apple/Gmail/security scanning behavior.

### Tests

- Empty digest does not fabricate engagement.
- Open-only row recommends soft follow-up after cadence.
- Clicked mockup recommends stronger personalized follow-up after cadence.
- Suppressed row recommends no follow-up.
- Output masks or avoids full recipient email exposure.
- Telegram formatting is readable.

### Acceptance criteria

- Steve can review a digest and decide which follow-ups to approve.
- Digest does not imply surveillance language such as “I saw you opened/clicked.”
- No customer email is sent by digest generation.

### Definition of done

- PR body includes how to run the report manually and how it could be scheduled later.
- If scheduled via Hermes cron later, the cron prompt must be self-contained and no-send.

## PR 7: internal smoke test and production verification harness

Status: In progress — branch `feat/outreach-engagement-smoke-test`

Recommended branch: `feat/outreach-engagement-smoke-test`
Type: script/tests/docs
Goal: provide a repeatable safe test proving the full loop works before external outreach waves.

### Tasks

- Add a script or documented command sequence that sends a safe internal StartLine-branded email through the same tracking-enabled path.
- Use fictional/internal recipient and fictional race/mockup context.
- Ensure no real race director receives the test.
- Include a test CTA/private mockup URL that can be clicked safely.
- Verify:
  - Resend accepted the message,
  - delivery/open/click webhook events arrive,
  - raw Supabase event rows exist,
  - `race_mockup_outreach` aggregate updates,
  - owner digest reports the engagement,
  - suppression test blocks a seeded recipient.
- Clean up or clearly mark smoke-test rows so they do not pollute production campaign metrics.

### Tests

- Script refuses to run without explicit internal recipient/test flag.
- Script refuses external-looking live race-director contexts unless explicitly designed for production sends and Steve-approved.
- Verification query masks recipient data.
- Cleanup/marking works for test rows.

### Acceptance criteria

- The team can prove the process end-to-end without relying on a real customer campaign.
- Failures clearly identify whether the blocker is DNS, Resend webhook setup, Netlify env, Supabase schema, aggregation, or digest reporting.

### Definition of done

- Process is still not considered scaled-outreach-ready until smoke test passes in production.
- Report includes exact evidence from the internal test: provider message ID, masked recipient, event counts, outreach row ID, and suppression dry-run result.

## PR 8: owner-reviewed follow-up workflow

Recommended branch: `feat/outreach-follow-up-drafts`
Type: follow-up draft generation + owner gate
Goal: create owner-reviewable follow-up drafts after engagement tracking proves reliable.

### Preconditions

Do not start this PR until:

- Resend tracking domain is verified.
- Webhook events are landing in Supabase.
- Aggregation works.
- Suppression enforcement works.
- Owner digest is usable.
- At least one safe internal smoke test passed.

### Tasks

- Generate recommended follow-up drafts based on engagement state.
- Keep all sends owner-gated.
- Store draft metadata without sending by default.
- Use approved framing from `outreach-engagement-tracking-process.md`.
- Never say “I saw you opened” or “I saw you clicked.”
- Require suppression check immediately before any follow-up send.
- Cap daily follow-up sends if/when real sends are approved.

### Tests

- Opened/no click produces soft bump draft only after cadence.
- Clicked/no reply produces personalized draft only after cadence.
- No activity produces one final nudge after cadence.
- Suppressed recipients produce no draft/send.
- Owner approval is required before send.

### Acceptance criteria

- Follow-up recommendations become actionable without making outreach automatic.
- Steve retains approval control.
- Suppression and duplicate-send gates remain enforced.

### Definition of done

- PR body states this is Phase 2 owner-reviewed follow-up, not Phase 3 automation.

## Phase 3 future work: limited automated retargeting

Do not implement Phase 3 until Steve explicitly approves moving beyond owner-reviewed follow-up.

Potential future tasks:

- Auto-schedule low-risk follow-up drafts.
- Keep sends owner-gated unless Steve explicitly changes the policy.
- Add daily send caps.
- Add campaign-health pauses for high bounce/complaint/unsubscribe rates.
- Continue owner digest reporting for every automated recommendation or send.

## Resume checklist for future agents

When returning to this work:

1. Read `outreach-engagement-tracking-process.md`.
2. Read this backlog.
3. Check open PRs in `sbgolf/marketing-site` before starting new work.
4. Confirm whether Steve/admin completed Resend tracking-domain and webhook setup.
5. Confirm whether production Supabase migrations were applied.
6. Pick the first unmerged PR in this sequence whose prerequisites are satisfied.
7. Use a focused branch and PR.
8. Keep race-director/customer sends gated by Steve approval.
9. Do not create or submit RunSignup/contact forms as part of this tracking work.
10. Do not declare the process operational until the internal production smoke test passes.
