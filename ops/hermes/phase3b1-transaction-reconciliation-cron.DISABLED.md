# StartLine Phase 3B-1 Transaction Reconciliation Hermes Schedule — DISABLED MANIFEST

Status: **not active / do not schedule until migration + deployment sequence is explicitly approved.**

Purpose: deterministic Hermes scheduled path for the Phase 3B-1 reconciliation monitor after the additive Supabase migration has been applied and production environment variables are confirmed.

## Preconditions

1. PR #184 is approved and deployed.
2. Migration `supabase/migrations/20260809130000_phase3b1_transaction_safety.sql` has been applied to production Supabase.
3. Production env vars are present in the Netlify/Hermes runtime without exposing values:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - either `HERMES_SEND_MESSAGE_WEBHOOK_URL` + `HERMES_SEND_MESSAGE_WEBHOOK_TOKEN`, or no webhook vars for stdout-only dry-run behavior
   - optional `STARTLINE_TRANSACTION_ALERT_TARGET`
4. A one-shot dry run has completed against known-safe fixtures.

## Activation command — do not run before approval

```bash
hermes cron create '*/15 * * * *' \
  --name 'StartLine Phase 3B-1 transaction reconciliation monitor' \
  --workdir '/Users/clawdbot/.openclaw/workspace/marketing-site-phase3b1' \
  --script 'scripts/phase3b1-transaction-reconciliation.mjs' \
  --no-agent \
  --deliver origin
```

If the active production checkout is not `/Users/clawdbot/.openclaw/workspace/marketing-site-phase3b1`, substitute the deployed repo path before activation.

## Determinism and alert lifecycle

The scheduled script exits quietly on healthy state. On anomalies it:

1. Reads Stripe webhook events, customer records, outreach send attempts, and outreach rows.
2. Filters test-mode Stripe/customer fixtures out of production alerts.
3. Persists alert candidates without treating them as delivered.
4. Sends Telegram through the configured Hermes webhook path.
5. Marks `delivered_at` only after successful delivery.
6. Marks missing previously-open anomalies as resolved.
7. Allows the same anomaly key/state to alert again if it recurs after resolution.

## Manual dry run

```bash
npm run monitor:phase3b1-transactions
```

Expected healthy output: no stdout and exit code 0.
