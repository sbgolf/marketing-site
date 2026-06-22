# Billing checklist

Quick checklist for StartLine Sites first-year package proposals, deposits, final package invoices, and optional after-year-one services.

> Public pricing note: StartLine’s current public offer is a one-time first-year race-cycle package with no required monthly retainer. Backend fields that still say `monthly`, `subscription`, or tier names like Foundation/Growth/Performance are legacy/internal automation names unless Steve explicitly approves a customer-specific recurring service.

## Before proposal is sent

- [ ] Race/customer name confirmed
- [ ] Primary contact confirmed
- [ ] Billing contact email confirmed
- [ ] One first-year package tier selected: [Starter / Standard / Premium]
- [ ] Recommendation reason is clear
- [ ] Deposit amount matches selected tier
- [ ] Final invoice amount matches selected tier
- [ ] Proposal says no required monthly retainer
- [ ] Correct Stripe first-year package deposit link included, or Premium is marked proposal-only
- [ ] No full pricing menu included unless Steve approved it
- [ ] Any exception approved by Steve before customer communication

## First-year package amount check

### Starter

- [ ] One-time first-year package: $1,500
- [ ] First-year package deposit: $750
- [ ] Final package balance: $750
- [ ] Deposit link: https://buy.stripe.com/8x2bIU1Bs0ww3H50UJ9fW00

### Standard

- [ ] One-time first-year package: $2,500
- [ ] First-year package deposit: $1,250
- [ ] Final package balance: $1,250
- [ ] Deposit link: https://buy.stripe.com/28EeV65RI3II3H5bzn9fW01

### Premium

- [ ] One-time first-year package: $4,500 starting point / reviewed proposal required
- [ ] First-year package deposit: proposal-specific after Steve approval
- [ ] Final package balance: proposal-specific
- [ ] Deposit link: **proposal-only**; send only after Steve approves the Premium proposal/scope and ensure Stripe metadata includes `proposal_approved=true` or `deposit_source=approved_proposal`

## After deposit link is sent

- [ ] First-year package deposit link sent to customer
- [ ] Deposit payment confirmed in Stripe
- [ ] Stripe webhook event recorded in `stripe_webhook_events` as processed or duplicate (`npm run verify:stripe-webhook -- --event-id evt_...` for a target delivery, or without `--event-id` for endpoint/recent-row verification)
- [ ] `customer_records.deposit_status = paid`
- [ ] `customer_records.kickoff_status = ready` or `started` if kickoff email was sent automatically
- [ ] `customer_records.intake_status = ready_to_send` or `sent` if kickoff email was sent automatically
- [ ] Kickoff/welcome email sent manually, or automatically via `STARTLINE_INTAKE_FORM_URL` + `STARTLINE_ASSET_CHECKLIST_URL`
- [ ] Intake form sent
- [ ] Asset checklist sent

## After customer intake is submitted

- [ ] `customer_intake_submissions` row exists for the race
- [ ] Matching `customer_records.customer_intake_submission_id` is set, when an existing paid/started customer record exists
- [ ] `customer_records.intake_status = received`
- [ ] `customer_records.build_status = ready_for_build`
- [ ] `customer_records.build_handoff_at` is populated
- [ ] Support email includes the build handoff checklist, missing critical inputs, suggested next steps, Supabase intake ID, and customer record ID (or clearly says not matched)
- [ ] Missing critical inputs are requested before production starts

## Before launch/final package invoice

- [ ] Staging approved by customer
- [ ] Steve approved launch
- [ ] Live URL or launch target confirmed
- [ ] Final package balance confirmed
- [ ] Billing contact confirmed again
- [ ] `STARTLINE_LAUNCH_BILLING_TOKEN` is configured in Netlify and only available internally
- [ ] Stripe webhook endpoint includes both `checkout.session.completed` and `invoice.paid`
- [ ] Trigger `/.netlify/functions/start-launch-billing` with `customer_record_id`
- [ ] `customer_records.final_invoice_status = sent`
- [ ] `customer_records.stripe_final_invoice_id` is recorded
- [ ] Invoice terms set to net 7

## At go-live

- [ ] Production site verified
- [ ] Go-live date recorded
- [ ] Final package invoice is paid in Stripe
- [ ] `invoice.paid` webhook is recorded as processed in `stripe_webhook_events`
- [ ] `customer_records.final_invoice_status = paid`
- [ ] Review any legacy internal subscription fields before use; do not start a recurring subscription unless Steve approved a customer-specific recurring service
- [ ] Launch confirmation email sent

## Blockers

Stop and resolve before moving forward if:

- [ ] Package is unclear
- [ ] Billing contact is missing
- [ ] Deposit has not been paid
- [ ] Stripe link does not match selected tier
- [ ] Final invoice amount is wrong
- [ ] Customer-facing copy implies a required monthly retainer
- [ ] Launch date is not confirmed
- [ ] Customer asks for custom terms
- [ ] Any exception has not been approved by Steve
