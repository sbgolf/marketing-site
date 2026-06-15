# StartLine Sites payment-flow readiness checklist

Use this checklist before exposing any customer-facing terms acknowledgement, proposal payment link, or deposit CTA beyond the current reviewed audit flow.

## Safe now

- Keep Starter and Standard deposit CTAs behind audit form submission.
- Keep Premium proposal-only until Steve approves scope and Stripe metadata includes `proposal_approved=true` or `deposit_source=approved_proposal`.
- Use customer-specific Checkout Sessions when `STRIPE_SECRET_KEY` is configured so deposits carry `audit_request_id` metadata.
- Send customer kickoff email only when approved intake/checklist URLs are configured in Netlify.

## Requires Steve/legal approval before publishing

- Public Terms page.
- Public Privacy Policy page.
- Service Agreement acceptance in Stripe Checkout.
- Any checkbox or copy saying the customer has accepted final legal terms.
- Any change to refund, cancellation, renewal, or monthly-start language.

## Open legal placeholders to resolve

- Legal entity name and mailing address.
- Governing law.
- Venue/arbitration language.
- Cure period.
- Correction/remedy period.
- Final liability cap language.
- Whether Stripe Checkout should require terms acknowledgement or whether signed proposal/agreement remains the source of truth.

## Stripe Checkout readiness

Before enabling terms acknowledgement in Stripe Checkout:

1. Publish reviewed Terms/Service Agreement URL.
2. Publish reviewed Privacy Policy URL.
3. Confirm Stripe account support email and descriptor use StartLine Sites branding.
4. Confirm product description matches the proposal tier.
5. Confirm Checkout Sessions include `audit_request_id` and `setup_tier` metadata.
6. Confirm webhook creates or updates the correct `customer_records` row.
7. Confirm customer kickoff email copy is approved and points to the current intake/checklist URLs.

## Do not do yet

- Do not publish the internal draft service agreement as final public terms.
- Do not require customers to accept incomplete legal placeholders.
- Do not expose a public Premium checkout link.
- Do not start monthly billing before go-live unless Steve explicitly changes the commercial terms.
