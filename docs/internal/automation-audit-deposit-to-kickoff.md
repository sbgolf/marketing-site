# StartLine automation audit — deposit to kickoff

Date: 2026-06-14

## Scope

Audited the StartLine Sites lead-to-deposit path for manual steps that can be automated safely without turning the business into a fragile custom app.

## Highest-risk manual gaps found

1. **Paid deposits were not connected to customer records.**
   - Risk: a customer pays and kickoff depends on manual Stripe/Supabase reconciliation.
   - Fix in this branch: Stripe webhook records paid deposits, updates `audit_requests`, and creates/updates `customer_records`.

2. **Stripe webhook retries were not idempotent.**
   - Risk: duplicate Stripe retries could create duplicate customer records or conflicting states.
   - Fix in this branch: `stripe_webhook_events` stores Stripe event IDs with a unique index; duplicate deliveries return success without reprocessing.

3. **Premium deposit link could be exposed internally.**
   - Risk: Premium requires reviewed scope/proposal but the backend still carried a public deposit URL.
   - Fix in this branch: Premium is proposal-only in backend metadata and docs; webhook ignores Premium payments unless Stripe metadata says `proposal_approved=true` or `deposit_source=approved_proposal`.

4. **Kickoff and intake state were implicit.**
   - Risk: after payment, the team still has to remember whether intake is ready, sent, or complete.
   - Fix in this branch: customer records now include `kickoff_status` and `intake_status`; paid deposits become `kickoff_status=ready` and `intake_status=ready_to_send`.

5. **Payment matching was brittle with static Payment Links.**
   - Risk: static links do not always carry the Supabase lead ID.
   - Fix now implemented: the audit form can create customer-specific Stripe Checkout Sessions after lead capture when `STRIPE_SECRET_KEY` is configured, and those sessions carry `audit_request_id` / `client_reference_id` for exact webhook matching.
   - Fallback retained: webhook still supports email/package matching for legacy/static links when exact metadata is unavailable.

## Implemented safeguards

- Stripe signature verification using Node `crypto`; no Stripe SDK dependency.
- Raw Netlify body handling, including base64-encoded requests.
- Max webhook body size guard.
- Paid-deposit classification by mode, payment status, tier, currency, and exact amount.
- Amount mismatch records failure instead of silently creating a customer.
- Unsupported Stripe events are recorded and ignored cleanly.
- Resend deposit notification is best-effort only; notification failure does not roll back the payment record.
- Dynamic Checkout Session creation is implemented in `netlify/functions/create-checkout-session.mjs` and covered by tests.
- Unit/smoke tests cover signature verification, Premium gating, amount mismatch, and a mocked Standard deposit webhook.

## Remaining production verification blockers

- **Netlify production env vars:** confirm Supabase, Stripe, Resend, site URL, and kickoff/intake variables are present in production and not exposed client-side.
- **Remote Supabase migrations:** apply/confirm migrations through `20260614190000_add_stripe_deposit_webhook_support.sql` in the production Supabase project.
- **Stripe webhook secret and delivery:** add the production `STRIPE_WEBHOOK_SECRET`, configure Stripe to send `checkout.session.completed` to `https://startlinesites.com/.netlify/functions/stripe-webhook`, and run one live/test-mode delivery smoke test.
- **Resend deliverability:** verify the production sender/domain and delivery to Steve/customer inboxes for lead notifications, customer confirmations, and kickoff emails.

## Private mockup owner-preview bridge

The audit workflow now has a manual bridge for the post-submission private mockup handoff without adding a schema-breaking migration.

Use it after an audit row exists and a race-templates branch/deploy preview origin is known:

```bash
# From marketing-site
STARTLINE_PRIVATE_MOCKUP_BASE_URL=https://<race-templates-branch-or-deploy-preview-host> \
  npm run audit:private-mockup -- --audit-id <audit_requests.id>
```

What the script does:

1. Fetches the `audit_requests` row from Supabase using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
2. Runs the sibling race-templates generator by default:
   `npm run mockup:private -- --url <audit current_url> --slug <generated-slug>`.
3. Builds the private route URL as `/private/mockups/<slug>/` on `STARTLINE_PRIVATE_MOCKUP_BASE_URL`, or stores an explicit `--mockup-url` if generation/deploy already happened elsewhere.
4. Stores the URL in all currently available JSON/record surfaces:
   - `private_mockup_url`
   - `metadata.audit_workflow.private_mockup_url`
   - `audit_summary.private_mockup_url`
5. Adds `metadata.audit_workflow.private_mockup_status=steve_review_only` and `customer_delivery_blocked_until=steve_approval` so the customer handoff remains blocked until Steve approves.
6. Prints a Steve owner-preview handoff that includes the private mockup URL and the delivery block. Passing `--send-owner-preview` also sends it through configured owner email/Telegram channels when those env vars are present.

Useful options:

- `--slug <slug>`: force a stable private mockup slug.
- `--template community|performance|destination-major`: forward a template choice to race-templates.
- `--race-templates-dir ../race-templates`: override the sibling repo path.
- `--mockup-url https://.../private/mockups/<slug>/`: store a known deployed URL instead of deriving one from `STARTLINE_PRIVATE_MOCKUP_BASE_URL`.
- `--no-generate`: skip race-templates generation and only store/preview the URL.
- `--dry-run`: print the owner handoff without patching Supabase.
- `--send-owner-preview`: send the owner preview through Resend and/or Telegram if `STARTLINE_OWNER_PREVIEW_EMAIL`, `STARTLINE_ADMIN_EMAIL`, `STARTLINE_TELEGRAM_BOT_TOKEN`, and `STARTLINE_TELEGRAM_OWNER_CHAT_ID` are configured.

Guardrails:

- Do not use localhost as the stored mockup URL.
- Do not send the private mockup URL to the race director until Steve approves it.
- Use public race data/assets only; race-templates falls back safely when public image capture is unavailable.
- The private race-templates route is expected to remain noindex/nofollow.

## Implemented automation increment

The server-side `create-checkout-session` path is implemented. With `STRIPE_SECRET_KEY` configured, the audit flow returns a customer-specific Stripe Checkout URL instead of relying only on static Payment Links, making lead-to-payment matching exact while preserving fallback behavior.
