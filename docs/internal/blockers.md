# StartLine Sites operational blockers

This file tracks current setup items Steve may need to unblock before the first paid customer moves through the full flow.

## Current blockers for Steve

### 1. Confirm legal/service-agreement posture

Status: Steve blocker before sending contracts or requiring terms acknowledgement in Stripe.

Need decision:

- Use attorney-reviewed service agreement before first paid customer, or
- Start with simple proposal/payment language and add legal terms after attorney review.

Recommendation: do not enable Stripe terms acknowledgement until there is a reviewed URL to link.

### 2. Confirm final invoice wording

Status: Steve approval recommended before first customer invoice.

Default wording:

```text
Final 50% balance for StartLine Sites [Starter / Standard / Premium] website setup. Site launched at [Live URL] on [Launch Date]. Due net 7.
```

### 3. Confirm monthly subscription start policy

Status: default set, Steve can override.

Default: monthly subscription starts at go-live, not at deposit.

### 4. Confirm where customer records live

Status: Steve blocker for repeatable operations.

Need one operational home for customer/payment references outside committed repo docs:

- Stripe customer record
- CRM/Notion/Airtable/customer tracker
- Customer repo metadata file with no secrets

Recommendation: use a lightweight CRM/customer tracker; do not store Stripe IDs or private billing notes in public committed markdown.

## Not blockers

- Stripe deposit links exist for Starter, Standard, and Premium.
- The marketing site can surface the matching deposit CTA after lead capture.
- Manual kickoff after Stripe payment is acceptable for the first customers.
- Webhook automation is not required before first sales.