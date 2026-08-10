#!/usr/bin/env node
import {
  formatReconciliationAlert,
  buildReconciliationFindings,
  filterDeliverableFindings,
  markDeliveredAlerts,
  markResolvedAlerts,
} from './lib/phase3b1-transaction-reconciliation.mjs';

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const request = async (path, options = {}) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
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

const sendTelegramAlert = async (message) => {
  const endpoint = process.env.HERMES_SEND_MESSAGE_WEBHOOK_URL;
  const token = process.env.HERMES_SEND_MESSAGE_WEBHOOK_TOKEN;
  if (!endpoint || !token) {
    console.log(message);
    return { platform: 'stdout', delivered: true };
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ target: process.env.STARTLINE_TRANSACTION_ALERT_TARGET || 'origin', message }),
  });
  if (!response.ok) throw new Error(`Telegram alert delivery failed: ${response.status} ${await response.text()}`);
  return { platform: 'telegram', delivered: true, response: await response.text().catch(() => '') };
};

const main = async () => {
  if (!supabaseUrl || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  const stripeEvents = await request('stripe_webhook_events?select=stripe_event_id,livemode,processing_status,created_at,updated_at,error_message&processing_status=in.(processing,failed_retryable,failed_terminal)&order=updated_at.asc&limit=100');
  const customerRecords = await request('customer_records?select=id,deposit_status,kickoff_status,intake_status,build_status,stripe_livemode,created_at,updated_at,metadata&deposit_status=eq.paid&order=updated_at.asc&limit=100');
  const outreachAttempts = await request('outreach_send_attempts?select=id,business_key,attempt_status,created_at,updated_at,provider_message_id&attempt_status=in.(sending,delivery_unknown)&order=updated_at.asc&limit=100').catch(() => []);
  const outreachRows = await request('race_mockup_outreach?select=id,outreach_status,resend_email_id,created_at,updated_at&outreach_status=eq.sent&resend_email_id=is.null&order=updated_at.asc&limit=100');
  const findings = buildReconciliationFindings({ stripeEvents, customerRecords, outreachAttempts, outreachRows });
  await markResolvedAlerts({ activeFindings: findings, request });
  const newFindings = await filterDeliverableFindings({ findings, request });
  if (!newFindings.length) return;
  const message = formatReconciliationAlert(newFindings);
  const delivery = await sendTelegramAlert(message);
  await markDeliveredAlerts({ findings: newFindings, request, delivery });
};

main().catch((error) => {
  console.error(`StartLine Phase 3B-1 reconciliation monitor failed: ${error.message}`);
  process.exitCode = 1;
});
