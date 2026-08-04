# Outreach engagement implementation spec

Owner: StartLine Sites internal ops
Status: implementation contract / no runtime behavior yet
Related docs:

- `outreach-engagement-tracking-process.md`
- `outreach-engagement-implementation-backlog.md`

## Purpose

This document locks the technical contract for wiring StartLine outreach engagement tracking. It exists so future implementation PRs can build schema, webhooks, aggregation, suppression, reporting, and owner-reviewed follow-up recommendations without guessing.

This is not a send approval document. Steve approval remains required before any race-director/customer-facing outreach or follow-up send until he explicitly changes that gate.

## Desired operating model

StartLine private mockup outreach should move from one-off sends to a measured, safe, owner-reviewed loop:

1. The existing branded send gate sends approved outreach through Resend and records the provider message ID on `race_mockup_outreach.resend_email_id`.
2. Resend open/click/delivery/bounce/suppression tracking sends webhooks to a StartLine Netlify Function.
3. The webhook verifies the provider signature, stores raw events idempotently in Supabase, and links events to the original outreach row.
4. Aggregation updates `race_mockup_outreach` with useful engagement state.
5. Suppression is enforced before every future send.
6. Owner digests show engagement and recommended follow-up actions.
7. Follow-up emails are drafted/recommended only; sends stay Steve-approved.

## Non-goals for this implementation sequence

- No automatic race-director or customer-facing sends.
- No auto-follow-up without Steve approval.
- No invasive visitor tracking or public exposure of private mockup tokens.
- No storage of webhook secrets, API keys, full recipient lists, or private mockup tokens in git.
- No claim that open tracking is a perfect human-read signal.
- No weakening of duplicate-send, QA, Site Auditor, or owner approval gates.

## External setup contract

These items require dashboard/DNS/provider access and may happen outside repo PRs.

### Resend tracking domain

Required provider/admin steps:

1. Enable open tracking for StartLine outreach sends.
2. Enable click tracking for StartLine outreach sends.
3. Configure custom tracking domain:

```text
track.startlinesites.com
```

4. Add the DNS records Resend requires for the tracking domain.
5. Wait for DNS propagation.
6. Verify the tracking domain in Resend.
7. Send a safe internal test email and confirm outbound links are rewritten through the tracking domain.

### Resend webhook endpoint

Expected production endpoint:

```text
https://startlinesites.com/.netlify/functions/resend-webhook
```

Expected Netlify function file:

```text
netlify/functions/resend-webhook.mjs
```

Expected Netlify env var:

```text
RESEND_WEBHOOK_SECRET
```

Subscribe to these categories if Resend exposes them for the configured account/domain:

- delivered
- opened
- clicked
- bounced
- complained
- unsubscribed
- suppressed or equivalent suppression event

If Resend uses provider-specific event names, map them into the canonical StartLine event names in this doc rather than leaking provider names throughout application code.

## Canonical event types

Use these normalized internal event types:

- `delivered`
- `opened`
- `clicked`
- `bounced`
- `complained`
- `unsubscribed`
- `suppressed`

Optional future event types:

- `reply_received`
- `wrong_contact`
- `negative_reply`
- `meeting_booked`
- `private_mockup_viewed`
- `private_mockup_cta_clicked`

Do not make optional future event types part of the Resend webhook PR unless the underlying source is implemented in that PR.

## Required normalized event shape

Webhook processing should normalize provider payloads into an internal shape like:

```json
{
  "provider": "resend",
  "provider_event_id": "provider-event-id-or-stable-derived-key",
  "provider_message_id": "resend-email-id",
  "event_type": "clicked",
  "event_timestamp": "2026-08-04T12:00:00.000Z",
  "recipient_email_hash": "sha256-or-provider-safe-reference",
  "recipient_email_masked": "di***[at]example.org",
  "outreach_id": "nullable-race_mockup_outreach-id",
  "clicked_url": "https://mockups.startlinesites.com/private-path-or-public-startline-url",
  "campaign_id": "nullable-campaign-or-wave-id",
  "source_payload": {
    "sanitized": true
  }
}
```

Rules:

- `provider_event_id` is required for idempotency. If Resend does not provide one for a particular event, derive a stable key from provider, message ID, event type, event timestamp, recipient reference, and clicked URL where applicable.
- `provider_message_id` must map to `race_mockup_outreach.resend_email_id` when present.
- `recipient_email_hash` is preferred over storing full addresses in event rows.
- `recipient_email_masked` is allowed for owner reports and debugging, but should not reveal the full address.
- `clicked_url` is present only for click-style events.
- `source_payload` must be sanitized before storage. Do not store secrets, auth headers, webhook signatures, or private API credentials.

## Signature verification contract

The webhook receiver must fail closed.

Requirements:

- Preserve the raw request body before JSON parsing.
- Verify the Resend webhook signature with `RESEND_WEBHOOK_SECRET`.
- Reject missing signature headers.
- Reject invalid signatures.
- Reject stale timestamps if Resend provides signed timestamps.
- Reject or dedupe replayed events using provider event ID / derived idempotency key.
- Do not log the webhook secret, raw signature, auth headers, or full payload on failure.
- Return non-2xx for invalid signatures or malformed required fields.
- Return 2xx when a duplicate valid event was intentionally deduped.

Future implementation should confirm exact Resend header names from current Resend docs during PR 3. If the provider uses Svix-style signatures, document the exact headers and verification helper in that PR.

## Supabase schema contract

PR 2 should add the schema foundation. Recommended tables and fields follow.

### `outreach_engagement_events`

Purpose: append-only raw engagement event log with idempotency.

Required fields:

- `id` UUID primary key, generated by DB.
- `provider` text, expected `resend` initially.
- `provider_event_id` text, not null.
- `provider_message_id` text, nullable but expected for Resend email events.
- `resend_email_id` text, alias/store for existing outreach matching if useful.
- `outreach_id` UUID nullable reference to `race_mockup_outreach.id` when resolvable.
- `prospect_id` UUID nullable if resolvable through outreach/job data.
- `generation_job_id` UUID nullable if resolvable through outreach/job data.
- `event_type` text, constrained to canonical event types where practical.
- `event_timestamp` timestamptz, not null.
- `recipient_email_hash` text nullable.
- `recipient_email_masked` text nullable.
- `clicked_url` text nullable.
- `campaign_id` text nullable.
- `raw_event` jsonb, sanitized.
- `created_at` timestamptz default now().

Required constraints/indexes:

- Unique constraint on `(provider, provider_event_id)`.
- Index on `provider_message_id` / `resend_email_id`.
- Index on `outreach_id`.
- Index on `event_type`.
- Index on `event_timestamp`.
- Optional index on `recipient_email_hash` for suppression/reporting joins.

### `outreach_suppressions`

Purpose: prevent future sends to bounced, complained, unsubscribed, or explicitly negative contacts.

Required fields:

- `id` UUID primary key, generated by DB.
- `recipient_email_hash` text, not null.
- `recipient_email_masked` text nullable for owner-readable reporting.
- `reason` text, constrained to suppression reasons where practical.
- `source_provider` text nullable.
- `source_event_id` UUID nullable reference to `outreach_engagement_events.id`.
- `source_outreach_id` UUID nullable reference to `race_mockup_outreach.id`.
- `created_at` timestamptz default now().
- `notes` text nullable, sanitized.

Suppression reasons:

- `bounce`
- `complaint`
- `unsubscribe`
- `negative_reply`
- `wrong_contact`
- `manual_suppression`

Required constraints/indexes:

- Unique active suppression per `recipient_email_hash` where practical.
- Index on `recipient_email_hash`.
- Index on `reason`.
- Index on `source_outreach_id`.

### `race_mockup_outreach` aggregation fields

Prefer typed columns when practical. If the migration risk is too high, store the same values in `metadata.engagement` first and later graduate to columns.

Recommended aggregate fields or metadata keys:

- `delivered_at`
- `first_opened_at`
- `last_opened_at`
- `open_count`
- `first_clicked_at`
- `last_clicked_at`
- `click_count`
- `clicked_urls`
- `bounced_at`
- `complained_at`
- `unsubscribed_at`
- `suppressed_at`
- `engagement_status`
- `next_follow_up_at`
- `follow_up_reason`
- `last_engagement_at`

## Engagement status precedence

Use one final `engagement_status` per outreach row for digest/reporting triage.

Precedence from strongest/most restrictive to weakest:

1. `suppressed` — unsubscribe, complaint, manual suppression, or equivalent.
2. `bounced` — delivery failure / invalid recipient.
3. `negative_reply` — explicit no / do not contact / wrong contact without better referral.
4. `replied` — positive or neutral reply received.
5. `clicked` — clicked mockup, pricing, package, audit, or CTA link.
6. `opened` — one or more open events, no stronger event.
7. `delivered` — delivered, no open/click/reply/negative event.
8. `no_activity` — sent but no delivery/engagement event recorded.

Rules:

- Suppression/negative events override previous opens/clicks.
- Opens are directional only; do not infer strong buying intent from opens alone.
- Clicks are stronger than opens, especially private mockup or pricing/package clicks.
- Never use follow-up wording like “I saw you opened” or “I saw you clicked.”
- If a wrong-contact reply provides a better contact, suppress or de-prioritize the wrong contact and create/update candidate contact research for the referred contact; do not auto-send.

## Follow-up recommendation contract

Recommendations should be owner-visible, not auto-sent.

Default timing:

- Opened but no click: soft follow-up after 3-5 business days.
- Clicked private mockup but no reply: personalized follow-up after 1-2 business days.
- No open/no click: one final nudge after 7-10 days.
- Bounce, complaint, unsubscribe, explicit negative reply: suppress immediately and do not follow up.

Recommended action labels:

- `no_action`
- `monitor`
- `soft_follow_up`
- `personalized_follow_up`
- `final_nudge`
- `suppress`
- `manual_review`

Owner digest items should include the recommendation and reason, but actual sends require Steve approval.

## Campaign/wave identifiers

Future outreach waves should carry a stable campaign/wave identifier through send, webhook, aggregation, and reporting.

Recommended metadata fields:

- `campaign_id`
- `campaign_lane` such as `community`, `operator_portfolio`, `audit_first`, or future lanes.
- `campaign_wave` such as `community-2026-08-w1`.
- `mockup_template`
- `send_gate_version`

Do not block PR 3 on campaign IDs if existing sends lack them. The webhook should still match by `resend_email_id`.

## Send-gate suppression contract

Before any Resend API side effect, the branded send gate must check:

1. Existing duplicate-send rules by mockup URL, provider/race ID, race domain, and recipient overlap.
2. Suppression by normalized/hash recipient reference.
3. Existing outreach status for the generation job/prospect.
4. QA, Site Auditor, owner approval, and explicit send flag.

Dry-run output should clearly show whether suppression would block the send.

Real send must fail closed if suppression lookup fails in a way that could hide a known suppression.

## Owner digest contract

Owner-facing digest output should be Telegram-readable and avoid full recipient disclosure.

Per item, include:

- Race name.
- Masked recipient or routing label.
- Outreach status.
- Engagement summary, e.g. `delivered / opened 2x / clicked mockup`.
- Last engagement timestamp in Central time where practical.
- Signal classification: weak, medium, strong, negative, or blocked.
- Recommended owner action.
- Suppression/blocker status.

Campaign recap should include:

- sent count,
- delivered count/rate,
- open count/rate labeled directional,
- click count/rate,
- private mockup click count/rate,
- reply count,
- bounce/complaint/unsubscribe count,
- follow-up candidates by recommendation bucket.

## Internal smoke-test contract

Before declaring the flow operational, run a safe internal smoke test.

Required smoke path:

1. Confirm `RESEND_WEBHOOK_SECRET` exists in Netlify production.
2. Confirm Supabase schema exists in production.
3. Confirm Resend webhook endpoint is configured to the production function.
4. Send a safe internal StartLine-branded test email to an internal recipient only.
5. Open the test email.
6. Click a safe StartLine/mockup test link.
7. Confirm Resend emits the expected events.
8. Confirm Supabase has raw rows in `outreach_engagement_events`.
9. Confirm the matching `race_mockup_outreach` row aggregates delivery/open/click state.
10. Confirm owner digest/reporting surfaces the engagement.
11. Seed or identify a safe suppressed recipient and verify dry-run plus real-send gate blocking before any provider side effect.

Do not use real race-director recipients for initial smoke testing.

## Future PR sequence

### PR 2: schema foundation

Build:

- Supabase migration for raw events.
- Suppression table/model.
- Aggregate fields or metadata contract.
- Tests/schema inspections.
- Production migration checklist.

Done when production migration steps are documented, but not necessarily applied until Steve/admin performs the external DB step.

### PR 3: webhook receiver

Build:

- `netlify/functions/resend-webhook.mjs`.
- Signature verification.
- Raw event normalization.
- Idempotent insert.
- Tests for valid/invalid/duplicate/unsupported events.

Done when deployable safely with no existing send behavior change.

### PR 4: aggregation

Build:

- Helper that aggregates raw events to `race_mockup_outreach`.
- Status precedence.
- Counts/timestamps/clicked URL updates.
- Tests for out-of-order and duplicate events.

Done when owner-readable state can be computed safely.

### PR 5: suppression enforcement

Build:

- Suppression lookup in send gate.
- Dry-run suppression reporting.
- Real-send fail-closed behavior.
- Tests proving blocked recipients never reach Resend.

Done when suppression is stronger than all send/follow-up paths.

### PR 6: digest/reporting

Build:

- Owner digest engagement summary.
- Recommendation buckets.
- Campaign recap metrics.
- Masked recipient formatting.

Done when Steve can review engagement and approve next actions without opening dashboards.

### PR 7: internal production smoke harness

Build:

- Repeatable internal smoke script/checklist.
- Safe test payload/event fixtures.
- Production verification steps that do not email real race directors.

Done when the end-to-end path is proven with internal recipients.

### PR 8: owner-reviewed follow-up drafts

Build:

- Draft generation/reporting for eligible follow-up candidates.
- Steve approval gate before each send.
- Suppression/duplicate checks before follow-up sends.
- Copy guardrails that avoid mentioning tracking surveillance.

Done when follow-up recommendations are useful but still owner-controlled.

### Future Phase 3: limited automated retargeting

Blocked until Steve explicitly approves changing the send gate.

Potential future scope:

- capped daily follow-up volume,
- campaign-level throttles,
- suppression-first automation,
- automatic draft creation only or carefully bounded sends.

## Implementation checklist for future agents

Before coding any runtime PR:

- Read this spec, the tracking process doc, and the implementation backlog.
- Start from current `origin/main` on a focused branch.
- Keep changes to one PR in the sequence.
- Preserve existing private mockup QA, Site Auditor, duplicate-send, and owner approval gates.
- Run `npm run build` and `npm test`.
- If touching Netlify Functions/Supabase/Resend, add targeted tests and smoke instructions.
- Report any external setup blocker instead of pretending the flow is operational.
- Do not expose secrets, full recipient emails, private mockup tokens, or hashes in PRs or Telegram reports.
