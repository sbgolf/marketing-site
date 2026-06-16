# Marketing Site

`main` is the current production branch and source of truth for StartLine Sites. Use feature/ops branches and pull requests for new changes; do not treat `staging` as the active implementation branch.

## Production readiness status

The production code path now includes Supabase lead capture, customer-specific Checkout Session creation when `STRIPE_SECRET_KEY` is configured, Stripe deposit webhook processing, and best-effort Resend notifications/kickoff email support.

Remaining production verification blockers are operational, not code-path TODOs:

- Confirm all required Netlify production environment variables are present and scoped correctly.
- Apply/confirm the remote Supabase migrations through `20260614190000_add_stripe_deposit_webhook_support.sql`.
- Add the production `STRIPE_WEBHOOK_SECRET` and verify Stripe webhook delivery for `checkout.session.completed` with `npm run verify:stripe-webhook`.
- Verify Resend sender/domain deliverability for lead notifications, customer confirmations, and kickoff emails.

## Netlify production environment

The audit request form posts to `netlify/functions/submit-audit-request.mjs`, which writes to Supabase, can notify Steve by email after a successful insert, and can send the customer a best-effort confirmation email when Resend is configured.

Required for submissions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side Netlify Function only; do not expose client-side)
- `STARTLINE_SITE_URL=https://startlinesites.com`

Recommended for lead/customer notification emails via Resend REST API:

- `RESEND_API_KEY` or `STARTLINE_RESEND_API_KEY`
- `STARTLINE_LEAD_NOTIFY_EMAIL` (falls back to `STARTLINE_ADMIN_EMAIL`, then `support@startlinesites.com`)
- `STARTLINE_NOTIFY_FROM` (optional; must be a sender/domain verified in Resend; defaults to `StartLine Sites <support@startlinesites.com>`)
- `STARTLINE_KICKOFF_REPLY_TO` (optional; used as reply-to for customer confirmation and kickoff emails)

Customer-facing email behavior:

- Audit submissions send a best-effort receipt/next-step confirmation when Resend is configured.
- Email failures are logged but do not block the Supabase lead record or customer form response.
- Starter/Standard confirmations include the active deposit link. Premium confirmations say a proposal is required before a deposit link is sent.

Required for Stripe deposit automation:

- `STRIPE_WEBHOOK_SECRET` from the Stripe webhook endpoint signing secret.
- Configure Stripe to POST `checkout.session.completed` events to `https://startlinesites.com/.netlify/functions/stripe-webhook`.
- Run the Supabase migrations through `20260614190000_add_stripe_deposit_webhook_support.sql` before enabling the webhook.

Recommended for exact lead-to-payment matching:

- `STRIPE_SECRET_KEY` enables server-created Checkout Sessions after audit submission. When omitted, Starter/Standard fall back to the stored static Payment Links.

Optional:

- `STARTLINE_IP_HASH_SALT` for stable one-way IP hashing independent of the Supabase service role key.
- `STRIPE_WEBHOOK_TOLERANCE_SECONDS` (defaults to `300`).
- `STARTLINE_STRIPE_WEBHOOK_MAX_BODY_BYTES` (defaults to `100000`).
- `STARTLINE_STRIPE_WEBHOOK_URL` overrides the verification script's expected endpoint URL when testing non-production endpoints.
- `STARTLINE_INTAKE_FORM_URL=https://startlinesites.com/intake` and `STARTLINE_ASSET_CHECKLIST_URL=https://startlinesites.com/asset-checklist` enable the customer-facing post-deposit kickoff email after this branch is merged and deployed.
- `STARTLINE_KICKOFF_REPLY_TO` sets the reply-to address for kickoff and intake confirmation emails.

## Deposit automation behavior

The Stripe webhook verifies the Stripe signature, records every delivery in `stripe_webhook_events`, and processes paid one-time setup deposits into `audit_requests` and `customer_records`.

Processed deposits set the customer to:

- `customer_status = kickoff_ready`
- `deposit_status = paid`
- `kickoff_status = ready`
- `intake_status = ready_to_send`

Premium deposits are ignored unless the Stripe Checkout Session metadata includes `proposal_approved=true` or `deposit_source=approved_proposal`.

Recommended Checkout Session / Payment Link metadata:

- `startline_payment_type=deposit`
- `setup_tier=starter|standard|premium`
- `audit_request_id=<Supabase audit_requests.id>` when available
- `proposal_approved=true` only after Steve-approved Premium proposal

The webhook can fall back to matching by customer email and selected tier for the current static Starter/Standard links, but exact matching is strongest when Stripe metadata includes the `audit_request_id`.

When `STRIPE_SECRET_KEY` is configured, the audit form asks Stripe to create a customer-specific Checkout Session after the Supabase lead row is inserted. That session carries `client_reference_id` and `metadata.audit_request_id`, so the webhook can connect the paid deposit back to the exact audit request instead of relying on fallback matching.

When `STARTLINE_INTAKE_FORM_URL` and `STARTLINE_ASSET_CHECKLIST_URL` are configured, a processed deposit also sends the customer a short kickoff email and updates the customer record to `kickoff_status = started`, `intake_status = sent`, and `intake_sent_at = now()`. If either URL is missing, the email is skipped and the record stays ready for manual kickoff.

## Stripe webhook verification

Run the dependency-light verifier from a shell that has production env loaded, or from a local checkout with `.env.local` populated:

```bash
npm run verify:stripe-webhook
npm run verify:stripe-webhook -- --event-id evt_123
```

The command checks required env (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`), confirms the Stripe webhook endpoint URL is configured for `checkout.session.completed`, and checks `stripe_webhook_events` for processed `checkout.session.completed` rows from the last 72 hours or the supplied target event id. It redacts secret values in output. Missing env, endpoint mismatch, or a missing/unprocessed target `--event-id` exits nonzero; no recent processed event without `--event-id` is a warning so first-time setup can still verify endpoint configuration before a live test payment.

## Intake-to-build handoff

Customer intake submissions are stored in `customer_intake_submissions`. After a successful insert, the function best-effort matches a paid/started customer record by lower primary or billing contact email plus race name. A match updates the customer record to:

- `customer_status = build_queued`
- `intake_status = received`
- `build_status = ready_for_build`
- `customer_intake_submission_id = <intake id>`
- `build_handoff_at = now()`
- `build_handoff_checklist = <critical inputs / next steps snapshot>`

No match or update failure is logged for support but does not fail the customer response. The internal support email includes the build handoff checklist, missing critical inputs, suggested next steps, and Supabase intake/customer record ids when available.
