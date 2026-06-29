# Audit-request smoke gate

This is the first-customer readiness gate for the public `/#audit` conversion path and Netlify function at `/.netlify/functions/submit-audit-request`.

Run it before first real outreach/prospect sends, after any audit-form/function change, and before reporting the path as production-ready.

## Safety rules

- Use only fictional/generic race data and an owner-controlled inbox.
- Do not use a real race director's email address.
- Do not put secrets in commits, PR comments, or screenshots.
- Do not send customer-facing audit findings automatically. The expected workflow remains owner approval first:
  - `status: queued_for_site_review`
  - `outreach_status: steve_approval_required`
  - `metadata.audit_workflow.steve_approval_status: required_before_customer_delivery`
  - `metadata.audit_workflow.customer_delivery_status: blocked_until_steve_approval`
  - `metadata.audit_workflow.automation_scope: internal_draft_only_no_customer_send`
- The public promise remains unchanged: StartLine emails the written audit within 2 business days.

## Safe payloads

The smoke script posts two payloads.

### Normal request payload

```json
{
  "race_name": "StartLine Smoke Test <run-id>",
  "current_url": "https://example.com/startline-smoke-test-race",
  "contact_name": "StartLine Smoke Test",
  "contact_email": "<owner-controlled test inbox>",
  "notes": "SAFE SMOKE TEST <run-id>: owner-controlled inbox only; delete/ignore before real outreach.",
  "company_website": "",
  "package_tier": "",
  "landing_page": "<site origin>/#audit?smoke=<run-id>",
  "referrer": "https://startlinesites.com/internal-smoke-gate"
}
```

Expected result:

- HTTP `201`.
- JSON body includes `ok: true`, an `id`, and `message: "Thanks — your private audit request was received."`.
- Supabase `audit_requests` row exists when service credentials are available.
- Row has owner-review statuses listed in the safety rules above.
- Owner notification/customer confirmation may be sent by the function to configured owner-controlled addresses; verify inbox or provider logs where credentials/access allow.

### Honeypot/spam payload

Same payload as the normal request, except:

```json
{
  "race_name": "StartLine Honeypot Smoke <run-id>",
  "company_website": "https://spam.example/honeypot-filled"
}
```

Expected result:

- HTTP `200`.
- JSON body includes `ok: true` only.
- No `id` and no success `message`.
- No Supabase insert or email side effect is expected.

## Commands

### Production smoke

```bash
STARTLINE_SMOKE_CONTACT_EMAIL="<owner-controlled inbox>" \
STARTLINE_SMOKE_VERIFY_SUPABASE=true \
npm run smoke:audit-request
```

Optional cleanup if Steve wants the smoke row removed immediately instead of preserving it for inbox/provider-log verification:

```bash
STARTLINE_SMOKE_CONTACT_EMAIL="<owner-controlled inbox>" \
STARTLINE_SMOKE_VERIFY_SUPABASE=true \
STARTLINE_SMOKE_DELETE_RECORD=true \
npm run smoke:audit-request
```

### Deploy-preview smoke

After Netlify creates a deploy preview for a PR, target that preview explicitly:

```bash
STARTLINE_AUDIT_SMOKE_ENDPOINT="https://deploy-preview-<pr-number>--<site-name>.netlify.app/.netlify/functions/submit-audit-request" \
STARTLINE_SMOKE_CONTACT_EMAIL="<owner-controlled inbox>" \
STARTLINE_SMOKE_VERIFY_SUPABASE=true \
npm run smoke:audit-request
```

## Required evidence in PR

Record redacted output for:

- `npm run build`
- `npm run test`
- production or deploy-preview `npm run smoke:audit-request`
- `git diff --check`

If credentials/access are missing, name the exact missing item and do not claim production readiness. Exact blocker examples:

- `STARTLINE_SMOKE_CONTACT_EMAIL` missing: no owner-controlled recipient for safe normal smoke.
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` missing: cannot verify the persisted `audit_requests` row.
- Resend/provider inbox access missing: cannot verify owner notification delivery beyond function success/Supabase workflow state.
- Netlify deploy preview unavailable: cannot run preview smoke; production smoke may still be recorded separately.
