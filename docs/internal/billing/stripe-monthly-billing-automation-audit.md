# Stripe/monthly billing automation audit

Internal audit for StartLine Sites after the public pricing pivot to one-time first-year race-cycle packages with no required monthly retainer.

## Public pricing source of truth

- Public offer: one-time first-year packages for one race cycle.
- Public promise: no required monthly retainer or automatic subscription.
- After-year-one work: optional scoped services when useful, not a default recurring plan.
- Steve approval required before any customer-specific recurring service or legacy monthly plan is started.

## Inventory and decisions

### Keep — deposit checkout session creation

Files:

- `netlify/functions/create-checkout-session.mjs`
- `netlify/functions/stripe-webhook.mjs`
- `tests/create-checkout-session.test.mjs`
- `tests/stripe-webhook.test.mjs`

Current behavior:

- Creates Stripe Checkout Sessions for Starter and Standard deposits.
- Blocks public Premium deposit creation unless an approved proposal path is used.
- Uses one-time first-year package wording in Checkout product names/descriptions.
- Records deposit metadata and creates/updates customer records after `checkout.session.completed`.

Decision: **Keep.** This supports the current public pricing model and kickoff workflow.

Follow-up watch item:

- Legacy fields such as `monthly_tier` are still populated on deposit-created customer records for historical/internal compatibility. Do not expose them publicly as a required monthly plan.

### Keep, with guardrails — final invoice automation

Files:

- `netlify/functions/start-launch-billing.mjs`
- `tests/start-launch-billing.test.mjs`
- `netlify/functions/stripe-webhook.mjs`
- `tests/stripe-webhook-launch-billing.test.mjs`

Current behavior:

- Internal token-protected function creates and sends the final 50% first-year package invoice.
- Stripe metadata identifies these invoices as `startline_payment_type=final_invoice`.
- `invoice.paid` webhook marks the final invoice paid in `customer_records`.

Decision: **Keep.** Final-invoice automation matches the one-time first-year package model.

Change made in this PR:

- `invoice.paid` now marks the customer active/final invoice paid but leaves legacy monthly subscription automation dormant by default.

### Make dormant by default — automatic monthly subscription start

Files:

- `netlify/functions/stripe-webhook.mjs`
- `tests/stripe-webhook-launch-billing.test.mjs`
- `supabase/migrations/20260614131939_create_customer_records.sql`
- `docs/internal/billing/deposit-final-invoice-monthly-billing-sop.md`
- `docs/internal/billing/invoice-wording-and-monthly-start-policy.md`

Previous behavior:

- After a StartLine final invoice was paid, the `invoice.paid` webhook automatically created a Stripe monthly subscription using legacy Foundation/Growth/Performance fields.

Decision: **Dormant by default.** Automatic subscription creation conflicts with current public pricing unless Steve has explicitly approved a recurring customer-specific service.

Change made in this PR:

- Automatic subscription creation now requires both:
  - `STARTLINE_ENABLE_LEGACY_MONTHLY_SUBSCRIPTIONS=true`, and
  - an approved recurring flag on the customer record, either `approved_exception=true`, `metadata.recurring_service_approved=true`, or `metadata.monthly_subscription_approved=true`.
- Without both gates, the webhook records final invoice payment and sets `subscription_status='dormant'` instead of calling Stripe Subscriptions.

Operational note:

- Keep the database columns for now so historical records and legacy workflow references remain readable.
- Do not use the legacy monthly fields as a customer-facing promise.

### Change — internal billing docs that still prescribe monthly plans

Files:

- `docs/internal/billing/deposit-final-invoice-monthly-billing-sop.md`
- `docs/internal/billing/invoice-wording-and-monthly-start-policy.md`
- `docs/internal/billing/billing-checklist.md`

Current state:

- `billing-checklist.md` already warns that monthly/subscription fields are legacy/internal unless Steve approves recurring work.
- The SOP and monthly policy docs still present monthly subscription start as the default.

Decision: **Change docs.** The default internal procedure should match public pricing: final package invoice at launch, no automatic monthly plan unless Steve approves a customer-specific recurring service.

Change made in this PR:

- Added this audit and backlog status update.
- Updated internal SOP/legal/readiness docs so the default flow says no monthly retainer starts automatically.
- Code now enforces dormant-by-default monthly automation.

Follow-up:

- After Steve confirms how recurring optional services should be sold and recorded, consider a dedicated recurring-service SOP that is separate from the first-year package closeout flow.

### Follow-up — public pricing-copy consistency tests

Backlog item:

- `Pricing-copy consistency tests`

Decision: **Follow-up.** This audit reduces backend automation risk, but public copy drift should still be protected separately with lightweight tests for forbidden required-monthly-retainer phrasing.

## Review checklist before merge

- [ ] Steve confirms that dormant-by-default monthly automation is the intended production behavior.
- [ ] If any existing customer should remain on a recurring service, their record has explicit approval metadata before enabling the legacy env flag.
- [ ] Netlify production does not set `STARTLINE_ENABLE_LEGACY_MONTHLY_SUBSCRIPTIONS=true` unless Steve approves it.
- [ ] Stripe webhook endpoint still includes `checkout.session.completed` and `invoice.paid` so deposits and final invoice paid status continue to process.
- [ ] No secrets, API keys, customer-specific payment IDs, or real customer data are committed.
