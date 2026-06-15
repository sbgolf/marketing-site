# Marketing Site

Baseline branch. Active implementation is on `staging` for Steve review.

## Netlify production environment

The audit request form posts to `netlify/functions/submit-audit-request.mjs`, which writes to Supabase and can notify Steve by email after a successful insert.

Required for submissions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side Netlify Function only; do not expose client-side)
- `STARTLINE_SITE_URL=https://startlinesites.com`

Recommended for lead notifications via Resend REST API:

- `RESEND_API_KEY` or `STARTLINE_RESEND_API_KEY`
- `STARTLINE_LEAD_NOTIFY_EMAIL` (falls back to `STARTLINE_ADMIN_EMAIL`, then `support@startlinesites.com`)
- `STARTLINE_NOTIFY_FROM` (optional; must be a sender/domain verified in Resend; defaults to `StartLine Sites <support@startlinesites.com>`)

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
- `STARTLINE_INTAKE_FORM_URL` and `STARTLINE_ASSET_CHECKLIST_URL` enable the customer-facing post-deposit kickoff email.
- `STARTLINE_KICKOFF_REPLY_TO` sets the reply-to address for kickoff emails.

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
