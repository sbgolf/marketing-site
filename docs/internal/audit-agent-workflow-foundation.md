# StartLine private audit agent workflow foundation

This is the owner-approved first-stage workflow for private audit requests submitted through the marketing site.

## Guardrails

- The public form continues to collect the same core fields and post to `/.netlify/functions/submit-audit-request`.
- The submitted `current_url` may be scraped or reviewed by agents only to draft internal audit findings.
- Agent-drafted findings must not be sent directly to the race director.
- Steve approval is required before any audit findings, package recommendations, or mockup notes are sent to the customer.
- No new paid services, heavy dependencies, or customer-facing AI delivery are introduced in this stage.

## Submission status foundation

New audit submissions are stored with:

- `status`: `queued_for_site_review`
- `outreach_status`: `steve_approval_required`
- `deposit_status`: `not_sent`
- `metadata.audit_workflow.current_url_scrape_status`: `queued`
- `metadata.audit_workflow.findings_draft_status`: `pending_url_review`
- `metadata.audit_workflow.steve_approval_status`: `required_before_customer_delivery`
- `metadata.audit_workflow.customer_delivery_status`: `blocked_until_steve_approval`
- `metadata.audit_workflow.automation_scope`: `internal_draft_only_no_customer_send`

These values use existing flexible status/metadata fields in `audit_requests`; no schema change is required for this first PR.

## Internal notification expectation

The team notification email should make the approval gate explicit:

1. Scrape/review the submitted public URL for internal findings only.
2. Draft the audit response and recommended next step.
3. Email Steve for approval before anything goes to the race director.

## Customer notification expectation

The customer receives a polished confirmation only. It confirms receipt and the written response timeline within 2 business days. It does not mention AI/agents or imply automated findings will be sent without review.
