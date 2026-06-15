# StartLine automation audit — deposit to kickoff

Date: 2026-06-14

## Scope

Audited the StartLine Sites lead-to-deposit path for manual steps that can be automated safely without turning the business into a fragile custom app.

## Highest-risk manual gaps found

1. **Paid deposits were not connected to customer records.**
   - Risk: a customer pays and kickoff depends on manual Stripe/Supabase reconciliation.
   - Fix in this branch: Stripe webhook records paid deposits, updates `audit_requests`, and creates/updates `customer_records`.

2. **Stripe webhook retries were not idempotent.**
   - Risk: duplicate Stripe retries could create duplicate customer records or conflicting states.
   - Fix in this branch: `stripe_webhook_events` stores Stripe event IDs with a unique index; duplicate deliveries return success without reprocessing.

3. **Premium deposit link could be exposed internally.**
   - Risk: Premium requires reviewed scope/proposal but the backend still carried a public deposit URL.
   - Fix in this branch: Premium is proposal-only in backend metadata and docs; webhook ignores Premium payments unless Stripe metadata says `proposal_approved=true` or `deposit_source=approved_proposal`.

4. **Kickoff and intake state were implicit.**
   - Risk: after payment, the team still has to remember whether intake is ready, sent, or complete.
   - Fix in this branch: customer records now include `kickoff_status` and `intake_status`; paid deposits become `kickoff_status=ready` and `intake_status=ready_to_send`.

5. **Payment matching was brittle with static Payment Links.**
   - Risk: static links do not always carry the Supabase lead ID.
   - Fix now implemented: the audit form can create customer-specific Stripe Checkout Sessions after lead capture when `STRIPE_SECRET_KEY` is configured, and those sessions carry `audit_request_id` / `client_reference_id` for exact webhook matching.
   - Fallback retained: webhook still supports email/package matching for legacy/static links when exact metadata is unavailable.

## Implemented safeguards

- Stripe signature verification using Node `crypto`; no Stripe SDK dependency.
- Raw Netlify body handling, including base64-encoded requests.
- Max webhook body size guard.
- Paid-deposit classification by mode, payment status, tier, currency, and exact amount.
- Amount mismatch records failure instead of silently creating a customer.
- Unsupported Stripe events are recorded and ignored cleanly.
- Resend deposit notification is best-effort only; notification failure does not roll back the payment record.
- Dynamic Checkout Session creation is implemented in `netlify/functions/create-checkout-session.mjs` and covered by tests.
- Unit/smoke tests cover signature verification, Premium gating, amount mismatch, and a mocked Standard deposit webhook.

## Remaining production verification blockers

- **Netlify production env vars:** confirm Supabase, Stripe, Resend, site URL, and kickoff/intake variables are present in production and not exposed client-side.
- **Remote Supabase migrations:** apply/confirm migrations through `20260614190000_add_stripe_deposit_webhook_support.sql` in the production Supabase project.
- **Stripe webhook secret and delivery:** add the production `STRIPE_WEBHOOK_SECRET`, configure Stripe to send `checkout.session.completed` to `https://startlinesites.com/.netlify/functions/stripe-webhook`, and run one live/test-mode delivery smoke test.
- **Resend deliverability:** verify the production sender/domain and delivery to Steve/customer inboxes for lead notifications, customer confirmations, and kickoff emails.

## Implemented automation increment

The server-side `create-checkout-session` path is implemented. With `STRIPE_SECRET_KEY` configured, the audit flow returns a customer-specific Stripe Checkout URL instead of relying only on static Payment Links, making lead-to-payment matching exact while preserving fallback behavior.
