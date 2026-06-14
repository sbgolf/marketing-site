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
   - Mitigation in this branch: webhook supports exact matching by `metadata.audit_request_id` / `client_reference_id`, then falls back to email/package matching for current links.
   - Best next improvement: replace static links with server-created Checkout Sessions after lead capture so every payment carries `audit_request_id`.

## Implemented safeguards

- Stripe signature verification using Node `crypto`; no Stripe SDK dependency.
- Raw Netlify body handling, including base64-encoded requests.
- Max webhook body size guard.
- Paid-deposit classification by mode, payment status, tier, currency, and exact amount.
- Amount mismatch records failure instead of silently creating a customer.
- Unsupported Stripe events are recorded and ignored cleanly.
- Resend deposit notification is best-effort only; notification failure does not roll back the payment record.
- Unit/smoke tests cover signature verification, Premium gating, amount mismatch, and a mocked Standard deposit webhook.

## Remaining blockers before live automation

- Apply Supabase migration `20260614190000_add_stripe_deposit_webhook_support.sql`.
- Add `STRIPE_WEBHOOK_SECRET` in Netlify production env.
- Configure Stripe webhook endpoint: `https://startlinesites.com/.netlify/functions/stripe-webhook` for `checkout.session.completed`.
- Confirm Stripe Payment Links/Checkout Sessions include metadata:
  - `startline_payment_type=deposit`
  - `setup_tier=starter|standard|premium`
  - `audit_request_id=<audit_requests.id>` when available
  - `proposal_approved=true` only for Steve-approved Premium proposal deposits
- Run one live/test-mode Stripe webhook smoke test from Stripe before relying on automation.

## Recommended next automation increment

Build a server-side `create-checkout-session` function so the audit form returns a customer-specific Stripe Checkout URL instead of static Payment Links. That will make lead-to-payment matching exact and remove the remaining fallback logic.
