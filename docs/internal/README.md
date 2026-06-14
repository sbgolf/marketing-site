# StartLine Sites internal ops docs

Internal, sanitized operating docs for the StartLine Sites sales-to-billing path.

## Proposal and billing flow

- Proposal template: `proposals/proposal-one-pager-template.md`
- Billing SOP: `billing/deposit-final-invoice-monthly-billing-sop.md`
- Billing checklist: `billing/billing-checklist.md`
- Current blockers: `blockers.md`

## Standard flow

1. Recommend one setup tier and one monthly tier.
2. Send the matching Stripe deposit link as the proposal CTA.
3. Confirm deposit payment in Stripe before production work starts.
4. Kick off intake/assets collection.
5. At launch, send the customer-specific final 50% Stripe Invoice, due net 7.
6. Start the selected monthly subscription at go-live.

## Data hygiene

Do not commit customer-specific Stripe IDs, private billing notes, legal exceptions, or sensitive customer details to this repo. Store those in Stripe and the approved CRM/customer tracker instead.
