# Outreach engagement tracking process

Owner: StartLine Sites internal ops  
Status: approved defaults / implementation-ready  
Scope: race-director private mockup, audit-first, and partner/operator outreach sent through StartLine-controlled email paths.

## Purpose

StartLine outreach should create a continuous feedback and retargeting loop, not just one-off sends. Track delivery, opens, clicks, replies, bounces, and suppression signals so future waves can prioritize the prospects showing real intent while protecting deliverability and avoiding duplicate or excessive outreach.

Open tracking is useful but imperfect. Treat opens as directional campaign-health signals. Treat private mockup clicks, pricing/audit clicks, replies, and booked calls as stronger buying-intent signals.

## Approved defaults

- Tracking subdomain: `track.startlinesites.com`.
- Email provider tracking: Resend open and click tracking.
- Event capture: Resend webhook into a StartLine Netlify Function.
- Source of truth: Supabase, linked back to `race_mockup_outreach` by `resend_email_id`.
- Reporting: include engagement in owner digests and campaign recaps.
- Retargeting:
  - Opened but no click: soft follow-up after 3-5 business days.
  - Clicked private mockup but no reply: personalized follow-up after 1-2 business days.
  - No open/no click: one final nudge after 7-10 days.
  - Bounce, complaint, unsubscribe, or explicit negative reply: suppress immediately.
- Privacy/compliance posture:
  - Do not over-message from opens alone.
  - Use clicks/replies as stronger intent.
  - Add unsubscribe/suppression handling before scaled cold waves.

## Signals and interpretation

### Weak signals

Use these for campaign diagnostics, not aggressive retargeting:

- Delivered.
- Opened once.
- Multiple opens with no click.

Common caveats:

- Apple Mail Privacy Protection can create opens that do not represent human reading.
- Gmail and enterprise security tools may proxy images or scan links.
- Blocked images can hide real opens.

### Stronger signals

Use these to prioritize human follow-up:

- Private mockup link clicked.
- Pricing, audit, package, or reply CTA clicked.
- Multiple clicks across different links.
- Reply received.
- Calendly/call/meeting action completed, if added later.

### Negative/suppression signals

These must stop or change outreach behavior:

- Bounce.
- Spam complaint.
- Unsubscribe.
- Explicit negative reply.
- Wrong-contact reply, unless they provide a better contact.

## Technical process

### 1. Enable Resend tracking

For StartLine outbound outreach domains:

1. Enable open tracking in Resend.
2. Enable click tracking in Resend.
3. Configure the custom tracking subdomain `track.startlinesites.com`.
4. Add required DNS records through StartLine DNS.
5. Verify the tracking domain in Resend before using it in live waves.

Do not start high-volume waves until the tracking domain is verified and test emails show expected link rewriting.

### 2. Add Resend webhook receiver

Add a Netlify Function such as:

```text
/.netlify/functions/resend-webhook
```

Requirements:

- Verify the Resend webhook signature before processing.
- Reject unsigned or invalid requests.
- Accept and store delivery, open, click, bounce, complaint, and unsubscribe/suppression events when available.
- Preserve the raw provider event ID for idempotency.
- Do not store secrets in git or logs.
- Return 2xx only after the event is safely handled or intentionally deduped.

### 3. Store raw events

Create a durable outreach engagement event table or equivalent store. Minimum fields:

- `id` or provider event ID.
- `resend_email_id`.
- `outreach_id`, when resolvable.
- `event_type`: delivered, opened, clicked, bounced, complained, unsubscribed, etc.
- `event_timestamp`.
- `recipient_email_hash` or masked/controlled recipient reference when practical.
- `url` for click events.
- `user_agent` / IP metadata only if needed and legally acceptable; avoid over-collecting.
- `raw_event` JSON for debugging, with no secrets.
- `created_at`.

Idempotency rule: duplicate provider events should not inflate counts.

### 4. Aggregate onto `race_mockup_outreach`

Use `race_mockup_outreach.resend_email_id` to link events back to a specific send.

Recommended aggregate fields or metadata keys:

- `delivered_at`.
- `first_opened_at`.
- `last_opened_at`.
- `open_count`.
- `first_clicked_at`.
- `last_clicked_at`.
- `click_count`.
- `clicked_urls`.
- `bounced_at`.
- `complained_at`.
- `unsubscribed_at`.
- `engagement_status`: no_activity, opened, clicked, replied, bounced, suppressed.
- `next_follow_up_at`.
- `follow_up_reason`.

If schema changes are not ready, store aggregate fields under existing metadata first, then migrate to typed columns once stable.

### 5. Track private mockup engagement separately

Email click tracking tells us a mockup link was clicked. Private mockup page engagement tells us whether the prospect actually interacted with the proof asset.

Future private mockup events should include:

- private mockup page viewed,
- repeat visit,
- pricing/package CTA clicked,
- registration handoff CTA clicked,
- audit/request CTA clicked,
- time-on-page or scroll-depth only if lightweight and privacy-safe.

Private mockup engagement should be linked to:

- generation job,
- prospect,
- outreach row,
- tokenized mockup URL,
- campaign/wave.

Do not make private mockup engagement tracking public or invasive. Keep private mockup routes noindex/nofollow.

## Owner digest format

Include engagement in daily/weekly owner digests once tracking is active.

Example item:

```text
1. 41st Annual Run for the Turtles
   Status: sent / delivered / opened 2x / mockup clicked
   Last engagement: 2026-08-04 10:42am CT
   Signal: strong intent - clicked private mockup
   Recommended action: personalized follow-up tomorrow if no reply
```

Campaign recap fields:

- Sent count.
- Delivered count and rate.
- Open count/rate, labeled directional.
- Click count/rate.
- Private mockup click count/rate.
- Replies and reply sentiment.
- Bounces/complaints/unsubscribes.
- Best-performing segment and subject line.
- Recommended next wave adjustment.

## Retargeting and follow-up rules

### Opened but no click

- Wait 3-5 business days.
- Send one soft follow-up.
- Mention the original value without implying surveillance.
- Do not say “I saw you opened this.”

Approved framing:

```text
I wanted to bump this once in case it got buried. The private mockup is meant to show how a dedicated race website could make the runner path clearer before registration.
```

### Clicked mockup but no reply

- Wait 1-2 business days.
- Prioritize human/personalized follow-up.
- Do not say “I saw you clicked.”
- Reference the mockup naturally.

Approved framing:

```text
I wanted to follow up on the private mockup and see if the direction felt useful for [Race Name]. If helpful, I can also outline what the first build would include and what we would need from you to make it real.
```

### No open and no click

- Wait 7-10 days.
- Send one final nudge.
- If no activity after the final nudge, archive or long-term nurture.

### Bounce / complaint / unsubscribe / negative reply

- Suppress immediately.
- Do not send follow-ups.
- Preserve suppression metadata for future duplicate prevention.
- If the recipient says they are the wrong contact but provides a better contact, store the new contact as candidate research and verify before any new send.

## Deliverability safeguards

Before scaled waves:

- Verify SPF, DKIM, and DMARC for StartLine sending domains.
- Use the custom tracking domain rather than generic tracking links.
- Use a monitored Reply-To: `support@startlinesites.com` unless Steve approves another route.
- Include `support@startlinesites.com` as BCC for external race-director sends.
- Keep emails mostly text with one primary CTA.
- Avoid spammy phrasing, fake urgency, or guaranteed-growth claims.
- Keep daily volume conservative until bounce/complaint/open/click data is healthy.
- Add unsubscribe/suppression handling before larger cold waves.

## Reporting thresholds

Early pilot thresholds are directional, not hard pass/fail rules:

- Bounce rate above 3%: pause and inspect list quality.
- Complaint/unsubscribe spike: pause the segment and revise targeting/copy.
- Opens but low clicks: improve subject/body/CTA clarity.
- Clicks but no replies: improve follow-up path, package clarity, and pricing/proposal CTA.
- Replies but low closes: review offer, proof, first-customer friction, and proposal handoff.

## Rollout phases

### Phase 1: Instrumentation

- Resend tracking enabled.
- `track.startlinesites.com` configured and verified.
- Webhook receiver deployed.
- Raw events captured in Supabase.
- Outreach rows aggregate delivery/open/click status.
- Reporting script or digest includes engagement.

No auto-follow-up yet.

### Phase 2: Owner-reviewed follow-up loop

- Daily/weekly digest recommends follow-up actions.
- Steve approves follow-up sends for early campaign waves.
- Suppression handling is enforced.
- Copy is adjusted based on real opens/clicks/replies.

### Phase 3: Limited automated retargeting

Only after Phase 2 proves quality and deliverability:

- Auto-schedule low-risk follow-up drafts.
- Keep sends owner-gated until Steve explicitly changes the gate.
- Cap daily follow-ups.
- Require suppression checks before every send.
- Continue reporting all activity back to owner digest.

## Implementation checklist

- [ ] Confirm Resend tracking settings and required DNS for `track.startlinesites.com`.
- [ ] Add DNS records and verify tracking domain.
- [ ] Add Netlify webhook function with signature verification.
- [ ] Add Supabase event storage and idempotency.
- [ ] Aggregate event data onto `race_mockup_outreach`.
- [ ] Add or update reporting script for outreach engagement.
- [ ] Add suppression handling for bounces, complaints, unsubscribes, and negative replies.
- [ ] Add tests for webhook signature handling, event idempotency, aggregation, and suppression behavior.
- [ ] Smoke-test with a safe internal Resend email before external sends.
- [ ] Verify event row and aggregate fields after the internal test.
- [ ] Keep race-director/customer sends gated by explicit Steve approval unless and until Steve changes the policy.

## Non-goals

- Do not fully automate race-director sends just because tracking exists.
- Do not use opens alone as proof of sales interest.
- Do not expose full recipient lists in git, chat, screenshots, or docs.
- Do not send follow-ups that reveal surveillance language such as “I saw you opened/clicked.”
- Do not weaken existing duplicate-send gates.

## Definition of done for this process

This process is operational only when:

1. Resend tracking is verified on the StartLine sending domain.
2. `track.startlinesites.com` is active and used for tracking.
3. The webhook is deployed and signature-verified.
4. A safe internal test email produces delivered/open/click events in Supabase.
5. The matching outreach row shows aggregate engagement state.
6. Owner digest/reporting surfaces the engagement summary.
7. Suppression behavior blocks future sends to bounced/complained/unsubscribed recipients.
8. Steve approval remains required for customer-facing outreach until explicitly changed.
