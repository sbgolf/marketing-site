# StartLine Sites operational blockers

This file tracks current setup items Steve may need to review before the first paid customer moves through the full flow.

## Current review items for Steve

### 1. Service agreement draft

Status: draft created for Steve review.

Files:

- `docs/internal/legal/service-agreement-draft.md`
- `docs/internal/legal/source-notes.md`

Current approach:

- Draft our own plain-English agreement based on public web design, hosting, maintenance, and subscription-service examples.
- Do not copy external legal text verbatim.
- Keep legal placeholders visible: legal entity, governing law, venue/arbitration, cure period, correction period, and final liability language.

Recommendation: review the draft internally first; optionally have counsel review before requiring customer signature or Stripe terms acknowledgement.

### 2. Final invoice wording

Status: draft created for Steve review.

File: `docs/internal/billing/invoice-wording-and-monthly-start-policy.md`

Default wording:

```text
Final 50% balance for StartLine Sites [Starter / Standard / Premium] website setup for [Race Name]. Site launched at [Live URL] on [Launch Date]. Due net 7.
```

### 3. Monthly subscription start policy

Status: draft created for Steve review.

Default policy:

```text
The StartLine Sites monthly plan starts on the go-live date. The go-live date is the date the customer site is made available on the production domain or otherwise launched under the approved launch plan. Monthly billing renews each month until cancelled under the agreement.
```

### 4. Customer records system

Status: Steve decided customer records should live in Stripe plus a dedicated Supabase table.

Implementation:

- Stripe remains the billing source of truth.
- Supabase `customer_records` stores non-secret customer lifecycle/billing references and status.
- RLS is enabled with no public policies; access should stay server-side through the service-role key.

Migration:

- `supabase/migrations/20260614131939_create_customer_records.sql`

## Not blockers

- Stripe deposit links exist for Starter, Standard, and Premium.
- The marketing site can surface the matching deposit CTA after lead capture.
- Manual kickoff after Stripe payment is acceptable for the first customers.
- Webhook automation is not required before first sales.
