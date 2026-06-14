# Deposit, final invoice, and monthly billing SOP

Internal operating procedure for StartLine Sites billing. This file is sanitized for repo storage; keep customer-specific payment IDs, private notes, and legal exceptions out of committed docs.

## Purpose

Keep the close-to-launch payment flow simple and repeatable:

1. Customer pays 50% setup deposit through a Stripe Payment Link.
2. Production starts only after deposit is confirmed.
3. Customer pays final 50% through a customer-specific Stripe Invoice at launch, due net 7.
4. Monthly subscription starts at go-live.

## Standard package map

### Starter + Foundation

- Setup fee: **$1,500**
- Deposit: **$750**
- Final invoice: **$750**
- Monthly plan: **Foundation — $99/mo**
- Deposit link: https://buy.stripe.com/8x2bIU1Bs0ww3H50UJ9fW00

### Standard + Growth

- Setup fee: **$2,500**
- Deposit: **$1,250**
- Final invoice: **$1,250**
- Monthly plan: **Growth — $249/mo**
- Deposit link: https://buy.stripe.com/28EeV65RI3II3H5bzn9fW01

### Premium + Performance

- Setup fee: **$4,500**
- Deposit: **$2,250**
- Final invoice: **$2,250**
- Monthly plan: **Performance — $499/mo**
- Deposit link: **proposal-only**. Do not send a Premium deposit link until Steve approves the customer-specific proposal/scope. Any approved Premium Checkout Session/Payment Link must include Stripe metadata `proposal_approved=true` or `deposit_source=approved_proposal`.

## Commercial rule

Every proposal should recommend **one setup tier and one monthly tier**.

Do not present all packages as a menu in a proposal unless Steve explicitly approves it for that customer.

## Step 1 — Confirm the package before proposal

Confirm:

- Race: [Race Name]
- Customer organization: [Organization]
- Billing contact: [Name + Email]
- Setup tier: [Starter / Standard / Premium]
- Monthly tier: [Foundation / Growth / Performance]
- Deposit amount: [$Amount]
- Final invoice amount: [$Amount]
- Monthly amount: [$Amount/mo]
- Deposit link: [Stripe Payment Link]
- Approved exceptions: [None / Details]

Blocker: if any pricing, timeline, scope, or billing-term exception is requested, get Steve approval before sending the proposal.

## Step 2 — Send the proposal and deposit CTA

Use the proposal one-pager template in `docs/internal/proposals/proposal-one-pager-template.md`.

Deposit language:

```text
To start, pay the 50% setup deposit here:

[Stripe deposit link]

Once that is paid, we’ll send the intake form and asset checklist and start the build timeline from receipt of complete intake/assets.
```

## Step 3 — Confirm deposit payment

After the customer pays:

- Stripe sends `checkout.session.completed` to `/.netlify/functions/stripe-webhook`.
- The webhook verifies the signature, records the Stripe event in `stripe_webhook_events`, and marks duplicate retries as no-ops.
- The webhook marks `audit_requests.deposit_status = paid` when it can match the lead by `audit_request_id`, `client_reference_id`, or email/package fallback.
- The webhook creates/updates the private Supabase `customer_records` row with Stripe customer/session/payment references.
- The webhook sets `customer_status = kickoff_ready`, `kickoff_status = ready`, and `intake_status = ready_to_send`.
- Confirm Stripe and Supabase agree before sending kickoff/welcome intake email.
- Start the customer folder/repo/intake workflow.

Do not begin production work until deposit payment is confirmed in Stripe and reflected in `customer_records`.

## Step 4 — Kickoff after deposit

Send the customer:

- Intake form link
- Asset checklist
- Expected delivery timeline for their tier
- Note that the delivery clock starts after complete intake and usable assets are received

Required kickoff fields:

- Race name
- Race website URL
- Registration platform URL
- Primary decision-maker
- Billing contact
- Preferred launch target
- Domain/DNS contact

## Step 5 — Create final invoice at launch

At launch, create a customer-specific Stripe Invoice for the final 50% setup balance.

Invoice terms:

- Invoice item: `StartLine Sites [Starter / Standard / Premium] Setup — Final 50% Balance`
- Amount: [$Final Amount]
- Terms: Net 7
- Memo: `Final 50% balance for [Race Name] website setup. Site launched at [Live URL] on [Launch Date].`
- Recipient: [Billing Contact Email]

Send final invoice when the site is launched or ready to launch per the approved launch plan.

## Step 6 — Start monthly subscription at go-live

Monthly billing starts at go-live.

Create/start the correct Stripe subscription under the same Stripe customer when practical:

- Foundation: $99/mo
- Growth: $249/mo
- Performance: $499/mo

Record in Stripe and `customer_records`:

- Stripe customer ID
- Stripe subscription ID
- Subscription start date
- Monthly tier
- Monthly amount
- Go-live URL
- First monthly report date

## Step 7 — Launch billing confirmation

After launch and billing setup, send customer-facing launch confirmation with:

- Live URL
- Final invoice note
- Monthly plan start date
- First monthly report timing
- Support/contact path

Keep it short and factual.

## Stop conditions

Stop and resolve before moving forward if:

- Package/tier is unclear.
- Billing contact is missing.
- Deposit has not been confirmed in Stripe.
- Deposit link does not match selected tier.
- Final invoice amount does not match selected tier.
- Monthly subscription tier does not match proposal.
- Launch date/go-live status is unclear.
- Customer asks for different payment terms.
- Steve has not approved an exception.

## Exceptions

Any deviation from standard terms requires Steve approval before customer communication.

Examples:

- Discounted setup fee
- Different deposit percentage
- Deferred final balance
- Monthly billing waived or delayed
- Custom payment schedule
- Different monthly tier pairing
- Presenting multiple package options instead of one recommendation

Record exception details in the customer record/CRM:

- Customer
- Exception
- Approved by Steve
- Approval date
- Where approval is documented