# STARTLINESITES CTO PHASE 3B-1 CONTROLLED TRANSACTION SAFETY REMEDIATION REPORT

Status: PHASE 3B-1 CONTROLLED REMEDIATION — GO for independent CTO review
Branch/worktree: `phase3b1/controlled-transaction-safety-remediation` in `/Users/clawdbot/.openclaw/workspace/marketing-site-phase3b1`
Generated: 2026-08-09 18:25 CDT
Scope boundary: Phase 3B-1 only. Phase 3B-2 not started. Branch not merged.

## Executive Summary

Phase 3B-1 implemented the approved controlled transaction-safety remediation in an isolated worktree. The remediation preserves existing idempotency controls and adds minimal guarded state for high-risk transaction edges:

- Stripe webhook rows now distinguish processed duplicates from retryable/incomplete events, so completed duplicate events do not repeat fulfillment while failed/incomplete events can resume.
- Mockup outreach send flow now creates a durable pre-send attempt before calling Resend and treats provider-accepted/persistence-failed outcomes as `delivery_unknown`, blocking blind resend until reconciliation.
- Public audit submissions now carry an opaque submission idempotency token; same-token retries return the prior logical result instead of creating another checkout/notification path.
- A deterministic read-only transaction reconciliation monitor was added with minimal alert-dedupe state.
- Customer/site provisioning was mapped read-only as PARTIAL; no provisioning redesign or remediation was performed.

No real customer/prospect emails were sent during automated tests. No real Stripe charge/refund/subscription was created. A controlled Steve-facing Telegram smoke alert was sent to verify the alert path.

## Changes Made

- Added resumable Stripe webhook processing semantics around duplicate event claims.
- Added retryable/terminal processing status persistence for Stripe webhook failures.
- Added audit submission idempotency request token support in client form payload and server handling.
- Added durable outreach send-attempt claim before provider send.
- Added outreach ambiguous-delivery handling: if Resend accepts but persistence fails, the attempt is marked `delivery_unknown` and retries do not call the provider again.
- Added deterministic reconciliation finding builder and CLI monitor entrypoint.
- Added additive migration for Stripe claim fields, audit idempotency columns/index, outreach send attempts, and alert dedupe state.
- Added Phase 3B-1 regression tests covering Stripe replay/resume, audit same-token retry, outreach provider-accepted/persistence-failure, and reconciliation classification.
- Added npm script: `monitor:phase3b1-transactions`.

## Files / Schema / Configuration Changed

Code and tests changed:

- `netlify/functions/stripe-webhook.mjs`
- `netlify/functions/submit-audit-request.mjs`
- `scripts/lib/mockup-generation-send-gate.mjs`
- `scripts/lib/phase3b1-transaction-reconciliation.mjs`
- `scripts/phase3b1-transaction-reconciliation.mjs`
- `src/scripts/auditForm.ts`
- `tests/mockup-generation-send-gate.test.mjs`
- `tests/phase3b1-transaction-safety.test.mjs`
- `package.json`

Additive migration added:

- `supabase/migrations/20260809130000_phase3b1_transaction_safety.sql`

Schema additions in migration:

- `stripe_webhook_events.processing_claim_id`
- `stripe_webhook_events.processing_claimed_at`
- `stripe_webhook_events.processing_attempts`
- retryable-status index on `stripe_webhook_events`
- `audit_requests.submission_idempotency_key`
- `audit_requests.submission_idempotency_response`
- partial unique index on non-null `audit_requests.submission_idempotency_key`
- new `outreach_send_attempts` table with unique `business_key` and state constraint
- new `transaction_reconciliation_alerts` table for alert dedupe

No unrelated pricing, SEO, marketing copy, customer communication templates, schedules, credentials, or provisioning logic were intentionally changed.

## Stripe Resumability Remediation

Before:

- Stripe exact-event dedupe protected against duplicate completed events.
- If an event row was created before downstream fulfillment completed and fulfillment failed, a retry of the same Stripe event could be treated as duplicate success solely because the event ID existed.

After:

- Completed/processed duplicate events still exit without repeating fulfillment.
- Existing event rows with retryable/incomplete status are resumable rather than treated as completed duplicates.
- Failure paths update the webhook row to retryable/terminal status with error context.
- Existing downstream idempotency remains preserved, including audit update/customer-record behavior and kickoff state checks.
- Legacy monthly subscription behavior was not refactored; existing tests confirm it remains dormant unless explicitly enabled and approved.

## Stripe Validation Evidence

Controlled tests:

- `npm test -- tests/phase3b1-transaction-safety.test.mjs` passed: 4/4.
- Full `npm test` passed: 241/241.
- Existing Stripe signature tests still pass:
  - valid Stripe-style signature accepted.
  - stale/tampered signature rejected.
- Existing deposit duplicate/idempotency tests still pass:
  - paid Standard deposit classified correctly.
  - public Premium checkout remains blocked without approved proposal metadata.
  - webhook records paid Standard deposit and creates kickoff-ready customer record.
  - repeated processing preserves existing intake token hash.

Before/after evidence:

- Completed duplicate event: after remediation returns `duplicate_processed` and does not touch fulfillment paths.
- Retryable event: after remediation can resume instead of exiting as duplicate success.
- Concurrent resume: guarded status semantics are represented in the state model and tests ensure duplicate completed replay does not fulfill; deeper DB-level concurrent RPC hardening remains a Phase 3B-2 candidate if CTO wants stronger atomicity than REST guarded patches.

Production read-only check:

- StartLine production `stripe_webhook_events` currently has 0 rows in `processing`, `failed_retryable`, `failed_terminal`, or legacy `failed` status.
- No live Stripe event was replayed.

## Outreach Send-Safety Remediation

Before:

- Send sequence was effectively: duplicate check → Resend provider call → persist outreach row.
- If Resend accepted a message but persistence failed, a retry could send again because durable pre-send state did not exist.

After:

- A deterministic business key is built from intended communication identity: generation job, prospect/race, mockup URL, recipient set, and template/campaign identity.
- `outreach_send_attempts` is claimed before provider call.
- A unique `business_key` prevents duplicate concurrent send attempts for the same intended communication.
- Provider ID is recorded on the attempt when available.
- If provider acceptance occurs but outreach persistence fails, the attempt is marked `delivery_unknown`; retries stop for reconciliation and do not call Resend again.
- Explicit provider rejection is recorded as failure rather than sent.
- Existing Steve approval gates, QA/Site Auditor gates, suppression gates, duplicate outreach checks, and rejected-copy validators remain in place.

## Outreach Historical Reconciliation Findings

Read-only production findings:

- One historical `race_mockup_outreach` row has `outreach_status = sent` with missing `resend_email_id`.
- One duplicate provider-message identity anomaly exists where a single provider ID appears on two outreach rows.
- These rows were not deleted, rewritten, or constrained in this phase.
- No unique constraint was added to `resend_email_id`, per approved instruction, because historical semantics are not fully reconciled.

Likely cause:

- Historical rows predate the new durable pre-send attempt model and can reflect earlier manual/scripted outreach recording behavior. Current automation is now protected by `outreach_send_attempts.business_key` before provider call.

## Outreach Validation Evidence

Controlled tests:

- Full `npm test` passed: 241/241.
- Existing mockup-generation send-gate tests pass.
- Phase 3B-1 added test confirms: provider accepted → outreach persistence failure → attempt becomes `delivery_unknown` → retry does not call provider again.

Before/after evidence:

- Send-before-persistence risk: mitigated by durable attempt before provider call.
- Provider accepted + persistence failure: after remediation returns `delivery_unknown_reconciliation_required` and provider call count remains 1 across retry.
- Concurrent provider-call count: business-key uniqueness blocks concurrent duplicate send; test stubs were updated for durable attempts, and existing duplicate/suppression tests still prove no provider call when blocked.
- Ambiguous delivery handling: ambiguous provider outcome is not treated as ordinary retryable failure; it requires reconciliation.

## Audit Submission Idempotency Remediation

Before:

- Repeated form POSTs could create duplicate audit requests, duplicate Stripe Checkout Sessions, and duplicate notifications.

After:

- Client form sends a random `submission_idempotency_token` per submission.
- Server persists it as `submission_idempotency_key` with no PII.
- Database migration adds partial unique index on non-null token.
- Same-token retry returns existing logical response and avoids another checkout path.
- New token with same business fields is still permitted for a legitimate new submission.
- Honeypot/validation and Phase 3A downstream workflow are preserved.

## Audit Submission Validation Evidence

Controlled tests:

- Phase 3B-1 audit submission same-token retry test passed.
- Existing `submit-audit-request` tests passed in full suite.

Before/after evidence:

- Concurrent/same-token POST: one logical audit request path is created by token uniqueness.
- Checkout duplication: same-token retry does not create another Stripe Checkout Session in test evidence.
- Notification duplication: same-token retry avoids a second logical submission path; first successful request still emits the expected first-request notifications.
- New-token behavior: schema and handler allow a new token for legitimate later submission with same business fields.

## Transaction Reconciliation Monitor

New monitor components:

- `scripts/lib/phase3b1-transaction-reconciliation.mjs`
- `scripts/phase3b1-transaction-reconciliation.mjs`
- npm script: `monitor:phase3b1-transactions`
- alert dedupe table: `transaction_reconciliation_alerts`

Implemented anomaly classes:

- Stripe event stale in `processing`.
- Stripe event `failed_retryable` or `failed_terminal`.
- Paid customer record missing expected kickoff/intake downstream fulfillment state.
- Outreach send attempt stuck in `sending`.
- Outreach send attempt in `delivery_unknown`.
- Sent outreach missing provider ID.

Monitor behavior:

- Deterministic; no LLM.
- Read-only against operational tables.
- Writes only minimal alert-dedupe state.
- Healthy/no-new-anomaly run is quiet.
- Alert message includes workflow, ID, state, age, reason, and first action.

## Alert Delivery Evidence

Telegram alert path verified with controlled internal smoke:

- Tool result: `send_message` returned success.
- Platform: Telegram home channel.
- Chat ID: `8285712655`.
- Message ID: `9079`.
- Message began: `Steve action needed — StartLine Phase 3B-1 internal alert-delivery smoke.`
- No customer/prospect email and no Stripe action was triggered.

Alert dedupe evidence:

- Unit-level reconciliation classification test passed.
- Dedupe persistence is implemented through `transaction_reconciliation_alerts` keyed by anomaly key and state.
- Production monitor dedupe table will be available after the additive migration is applied.

## Customer/Site Provisioning Map

PROVISIONING MAP — PARTIAL

Verified in inspected repository:

1. Payment/customer approval
   - Trigger: Stripe `checkout.session.completed` deposit webhook and later final invoice flow.
   - Implementation: `netlify/functions/stripe-webhook.mjs`, `netlify/functions/start-launch-billing.mjs`.
   - Business/idempotency key: Stripe event ID plus checkout session/customer/payment intent IDs.
   - DB status: `customer_records.deposit_status`, `kickoff_status`, `intake_status`, `final_invoice_status`, `build_status`.
   - Retry behavior: webhook exact-event dedupe plus Phase 3B-1 retryable status model.
   - Boundary: provider/customer-email ambiguity should not be blindly repeated.

2. Customer record
   - Trigger: paid deposit webhook.
   - Implementation: `stripe-webhook.mjs` upserts/updates `customer_records`.
   - Duplicate prevention: Stripe checkout/payment metadata and existing customer record matching.
   - Current production snapshot: 3 paid customer records, all with `kickoff_status=started`, `intake_status=sent`, `build_status=not_ready`.

3. Project/site creation
   - Trigger: not fully verified in this repo.
   - Implementation location: likely outside inspected marketing-site repo or manual/semi-automated process.
   - DB status: `customer_records.build_status` and `build_handoff_*` columns appear to be handoff indicators, not a full provisioning state machine.
   - Ownership: PARTIAL/UNVERIFIED.

4. Repo/branch/worktree
   - Trigger: not implemented for paid customer provisioning in this repo.
   - Known related but separate flow: mockup generation jobs can reference config path, PR URL, deploy preview URL, QA status, and Site Auditor status.
   - Ownership: PARTIAL/UNVERIFIED for actual customer site builds.

5. Deploy/domain/customer notification
   - Deploy provider: Netlify is used for StartLine marketing and mockup sites.
   - Domain step: not fully mapped in this repo for customer-specific sites.
   - Customer notification: kickoff/intake/customer email templates exist; final provisioning launch notification path is not fully verified.

No provisioning code was changed.

## Production Regression Results

Commands and observed results:

- `npm test -- tests/phase3b1-transaction-safety.test.mjs`: pass, 4/4.
- `npm test`: pass, 241/241.
- `npm run build`: pass, Astro check/build 0 errors, 0 warnings, 13 pages built.
- `git diff --check`: pass, no whitespace errors.
- Production homepage health: `curl https://startlinesites.com/` returned HTTP 200, 0.276s, 62,471 bytes.
- Production submit-audit GET method smoke: `https://startlinesites.com/.netlify/functions/submit-audit-request` returned HTTP 405, expected method guard for GET.
- Netlify site lookup verified production site `startline-sites` at `startlinesites.com`.
- Production Supabase env from Netlify resolves to `hscafigfjlzdmbpeyrti.supabase.co`.
- Production current failed/incomplete transaction check found 0 unfinished Stripe webhook events.

Notes:

- `npm ci` was required in the isolated worktree before build because `astro` was initially unavailable. After installing dependencies, build passed.
- npm audit reports existing dependency advisories: 37 vulnerabilities (3 low, 24 moderate, 10 high). These were not remediated because dependency upgrades are outside Phase 3B-1 scope.
- Test output includes expected simulated error logs for controlled failure cases (`card problem`, Resend 503), while all assertions passed.

## Before vs After Transaction-Safety Score

Qualitative score for the scoped transaction-integrity surfaces:

- Before Phase 3B-1: 6.5/10
  - Strong exact-event dedupe existed, but partial-failure resumability and send-before-persistence safety had known gaps.
- After Phase 3B-1 implementation: 8.4/10
  - Major duplicate/ambiguous-side-effect gaps are controlled.
  - Remaining risk is mostly around production deployment sequencing, historical outreach reconciliation, and whether CTO wants stronger DB-RPC atomic claims beyond REST-level guarded updates.

## Rollback / Recovery Information

Code rollback:

- Revert the PR/branch commit(s) before merge, or revert the merge commit if already deployed.

Migration rollback considerations:

- Migration is additive. Safe operational rollback is to deploy prior code while leaving additive nullable columns/tables in place.
- Destructive rollback is not recommended unless CTO explicitly approves and confirms no new rows rely on:
  - `audit_requests.submission_idempotency_key`
  - `audit_requests.submission_idempotency_response`
  - `outreach_send_attempts`
  - `transaction_reconciliation_alerts`
  - new Stripe webhook claim columns

Forward-fix procedure:

- If a Stripe webhook row is `failed_retryable`, inspect the Stripe event and downstream records, then allow safe replay/resume.
- If an outreach attempt is `delivery_unknown`, inspect Resend/provider state before any resend.
- If audit idempotency returns a stale response, inspect the audit row and token-specific `submission_idempotency_response`.
- If monitor alerts, follow first-action guidance in the alert before manual repair.

## Remaining Risks

- Production migration has not been applied by this branch alone; deployment must apply `20260809130000_phase3b1_transaction_safety.sql` before relying on new columns/tables.
- Historical outreach anomalies remain read-only findings: one sent outreach without provider ID and one duplicated provider ID pair.
- Monitor alert dedupe depends on the new alert table existing after migration.
- Customer/site provisioning remains only PARTIAL from the inspected repo; actual project/site creation path may live outside this repo or be manual.
- REST-level guarded updates improve safety, but CTO may still prefer dedicated Postgres RPCs for stronger atomic claim semantics in a future phase.

## Deferred Items

Explicitly not done in Phase 3B-1:

- Phase 3B-2.
- Customer-intake idempotency.
- Lane D canonical identity.
- Broad RunSignup dedupe.
- Broad Resend webhook ordering.
- Phase 3A Netlify credential dependency remediation.
- External host dead-man monitoring.
- General database cleanup.
- Dormant subscription refactor.
- Provisioning redesign.
- Historical data rewrite/delete.
- Unique constraint on `resend_email_id`.
- Dependency vulnerability upgrades.

## Recommendation for Phase 3B-2, if any

Recommended next independent review items, after CTO approval only:

1. Apply and verify the additive migration in production/staging with schema-cache refresh.
2. Run the deterministic transaction reconciliation monitor after migration and confirm quiet/no-new-anomaly behavior or handle reported anomalies.
3. Decide whether to convert REST-level guarded claim updates into Postgres RPCs for stronger concurrent claim guarantees.
4. Complete a verified provisioning map outside this repo, including project/site creation, domain, deploy, and customer launch notification boundaries.
5. Reconcile historical outreach provider-ID anomalies before adding any future provider-ID uniqueness constraint.

Do not begin Phase 3B-2 until Steve explicitly approves after independent CTO review.
