# StartLine Sites internal ops docs

Internal, sanitized operating docs for the StartLine Sites sales-to-billing path.

## Proposal and billing flow

- Proposal template: `proposals/proposal-one-pager-template.md`
- Default Standard + Growth customer packet: `proposals/standard-growth-customer-packet.md`
- Billing SOP: `billing/deposit-final-invoice-monthly-billing-sop.md`
- Billing checklist: `billing/billing-checklist.md`
- Invoice wording and legacy monthly start policy: `billing/invoice-wording-and-monthly-start-policy.md`
- Stripe/monthly billing automation audit: `billing/stripe-monthly-billing-automation-audit.md`
- Automation audit/status: `automation-audit-deposit-to-kickoff.md`
- StartLine UX conversion audit backlog: `startline-ux-conversion-audit-backlog.md`
- Service agreement draft: `legal/service-agreement-draft.md`
- Service agreement source notes: `legal/source-notes.md`
- Current blockers: `blockers.md`

## Current implementation status

- `main` is the production/source-of-truth branch.
- Dynamic Checkout Session creation, Stripe deposit webhook automation, StartLine-owned intake pages, and kickoff email handoff are implemented and have production smoke coverage.
- Remaining readiness work should focus on first-customer sales packet polish, fulfillment-template readiness, and public trust proof before scaling outreach.

## Standard flow

1. Recommend one first-year package tier.
2. Send the matching Stripe deposit link as the proposal CTA.
3. Confirm deposit payment in Stripe before production work starts.
4. Kick off intake/assets collection.
5. At launch, send the customer-specific final 50% Stripe Invoice, due net 7.
6. Mark the final invoice paid when Stripe sends `invoice.paid`; leave monthly subscription fields dormant unless Steve explicitly approved a customer-specific recurring service.

## Data hygiene

Do not commit customer-specific Stripe IDs, private billing notes, legal exceptions, or sensitive customer details to this repo. Store those in Stripe and the dedicated private Supabase customer records table instead.
