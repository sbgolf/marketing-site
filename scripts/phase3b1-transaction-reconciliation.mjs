#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import {
  formatReconciliationAlert,
  buildReconciliationFindings,
  filterDeliverableFindings,
  markDeliveredAlerts,
  markResolvedAlerts,
  deliverReconciliationAlert,
  validateSupabaseRuntimeConfig,
  planOperationalFailureAlert,
  planOperationalRecoveryAlert,
} from './lib/phase3b1-transaction-reconciliation.mjs';

const alertStatePath = process.env.STARTLINE_PHASE3B1_ALERT_STATE_PATH
  || join(homedir(), '.hermes/state/startline_phase3b1_reconciliation_alert_state.json');

const loadAlertState = async () => {
  try {
    return JSON.parse(await readFile(alertStatePath, 'utf8'));
  } catch {
    return null;
  }
};

const saveAlertState = async (state) => {
  if (!state) return;
  await mkdir(dirname(alertStatePath), { recursive: true });
  await writeFile(alertStatePath, `${JSON.stringify(state, null, 2)}\n`);
};

const runtimeConfig = validateSupabaseRuntimeConfig({
  supabaseUrl: process.env.SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

const request = async (path, options = {}) => {
  const response = await fetch(`${runtimeConfig.supabaseUrl}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers: {
      apikey: runtimeConfig.serviceKey,
      authorization: `Bearer ${runtimeConfig.serviceKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
      ...(options.prefer ? { prefer: options.prefer } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) throw new Error(`Supabase ${path} failed: ${response.status} ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const main = async () => {
  const previousAlertState = await loadAlertState();
  if (!runtimeConfig.ok) {
    const planned = planOperationalFailureAlert({ failure: runtimeConfig.failure, previousState: previousAlertState });
    await saveAlertState(planned.nextState);
    if (planned.shouldAlert) console.log(planned.message);
    return;
  }

  const recovery = planOperationalRecoveryAlert({ previousState: previousAlertState });
  if (recovery.shouldAlert) {
    await saveAlertState(recovery.nextState);
    console.log(recovery.message);
    return;
  }

  const stripeEvents = await request('stripe_webhook_events?select=stripe_event_id,livemode,processing_status,created_at,updated_at,error_message&processing_status=in.(processing,failed_retryable,failed_terminal)&order=updated_at.asc&limit=100');
  const customerRecords = await request('customer_records?select=id,deposit_status,kickoff_status,intake_status,build_status,created_at,updated_at,metadata,stripe_checkout_session_id,stripe_deposit_payment_intent_id&deposit_status=eq.paid&order=updated_at.asc&limit=100');
  const outreachAttempts = await request('outreach_send_attempts?select=id,business_key,attempt_status,created_at,updated_at,provider_message_id&attempt_status=in.(sending,delivery_unknown)&order=updated_at.asc&limit=100').catch(() => []);
  const outreachRows = await request('race_mockup_outreach?select=id,outreach_status,resend_email_id,created_at,updated_at,metadata&outreach_status=eq.sent&resend_email_id=is.null&order=updated_at.asc&limit=100');
  const findings = buildReconciliationFindings({ stripeEvents, customerRecords, outreachAttempts, outreachRows });
  await markResolvedAlerts({ activeFindings: findings, request });
  const newFindings = await filterDeliverableFindings({ findings, request });
  if (!newFindings.length) return;
  const message = formatReconciliationAlert(newFindings);
  const delivery = await deliverReconciliationAlert({ message });
  await markDeliveredAlerts({ findings: newFindings, request, delivery });
};

main().catch((error) => {
  console.error(`StartLine Phase 3B-1 reconciliation monitor failed: ${error.message}`);
  process.exitCode = 1;
});
