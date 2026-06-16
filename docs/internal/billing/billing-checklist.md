# Billing checklist

Quick checklist for StartLine Sites proposals, deposits, final invoices, and monthly subscriptions.

## Before proposal is sent

- [ ] Race/customer name confirmed
- [ ] Primary contact confirmed
- [ ] Billing contact email confirmed
- [ ] One setup tier selected: [Starter / Standard / Premium]
- [ ] One monthly tier selected: [Foundation / Growth / Performance]
- [ ] Recommendation reason is clear
- [ ] Deposit amount matches selected tier
- [ ] Final invoice amount matches selected tier
- [ ] Monthly amount matches selected tier
- [ ] Correct Stripe deposit link included, or Premium is marked proposal-only
- [ ] No full pricing menu included unless Steve approved it
- [ ] Any exception approved by Steve before customer communication

## Package amount check

### Starter + Foundation

- [ ] Setup: $1,500
- [ ] Deposit: $750
- [ ] Final: $750
- [ ] Monthly: $99/mo
- [ ] Deposit link: https://buy.stripe.com/8x2bIU1Bs0ww3H50UJ9fW00

### Standard + Growth

- [ ] Setup: $2,500
- [ ] Deposit: $1,250
- [ ] Final: $1,250
- [ ] Monthly: $249/mo
- [ ] Deposit link: https://buy.stripe.com/28EeV65RI3II3H5bzn9fW01

### Premium + Performance

- [ ] Setup: $4,500
- [ ] Deposit: $2,250
- [ ] Final: $2,250
- [ ] Monthly: $499/mo
- [ ] Deposit link: **proposal-only**; send only after Steve approves the Premium proposal/scope and ensure Stripe metadata includes `proposal_approved=true` or `deposit_source=approved_proposal`

## After deposit link is sent

- [ ] Deposit link sent to customer
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

## Before launch/final invoice

- [ ] Staging approved by customer
- [ ] Steve approved launch
- [ ] Live URL or launch target confirmed
- [ ] Final invoice amount confirmed
- [ ] Billing contact confirmed again
- [ ] Final 50% Stripe Invoice created
- [ ] Invoice terms set to net 7
- [ ] Invoice memo includes live URL and launch date

## At go-live

- [ ] Production site verified
- [ ] Go-live date recorded
- [ ] Final invoice sent
- [ ] Correct monthly subscription started
- [ ] Stripe subscription ID recorded outside committed docs
- [ ] First monthly report date recorded
- [ ] Launch confirmation email sent

## Blockers

Stop and resolve before moving forward if:

- [ ] Package is unclear
- [ ] Billing contact is missing
- [ ] Deposit has not been paid
- [ ] Stripe link does not match selected tier
- [ ] Final invoice amount is wrong
- [ ] Monthly subscription does not match proposal
- [ ] Launch date is not confirmed
- [ ] Customer asks for custom terms
- [ ] Any exception has not been approved by Steve