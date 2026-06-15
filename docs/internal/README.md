# StartLine Sites internal ops docs

Internal, sanitized operating docs for the StartLine Sites sales-to-billing path.

## Proposal and billing flow

- Proposal template: `proposals/proposal-one-pager-template.md`
- Billing SOP: `billing/deposit-final-invoice-monthly-billing-sop.md`
- Billing checklist: `billing/billing-checklist.md`
- Invoice wording and monthly start policy: `billing/invoice-wording-and-monthly-start-policy.md`
- Automation audit/status: `automation-audit-deposit-to-kickoff.md`
- Service agreement draft: `legal/service-agreement-draft.md`
- Service agreement source notes: `legal/source-notes.md`
- Current blockers: `blockers.md`

## Current implementation status

- `main` is the production/source-of-truth branch.
- Dynamic Checkout Session creation and Stripe deposit webhook automation are implemented in code.
- Remaining production readiness work is verification of Netlify env vars, remote Supabase migrations, Stripe webhook secret/delivery, and Resend deliverability.

## Standard flow

1. Recommend one setup tier and one monthly tier.
2. Send the matching Stripe deposit link as the proposal CTA.
3. Confirm deposit payment in Stripe before production work starts.
4. Kick off intake/assets collection.
5. At launch, send the customer-specific final 50% Stripe Invoice, due net 7.
6. Start the selected monthly subscription at go-live.

## Data hygiene

Do not commit customer-specific Stripe IDs, private billing notes, legal exceptions, or sensitive customer details to this repo. Store those in Stripe and the dedicated private Supabase customer records table instead.
