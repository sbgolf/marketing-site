const clean = (value, max = 500) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '');

const ageMinutes = (now, updatedAt) => {
  const t = new Date(updatedAt || 0).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 60000));
};

const stripeModeLabel = (record = {}) => {
  if (record?.livemode === true) return 'live';
  if (record?.livemode === false) return 'test';
  if (record?.metadata?.stripe_livemode === true || record?.metadata?.stripe_livemode === 'true') return 'live';
  if (record?.metadata?.stripe_livemode === false || record?.metadata?.stripe_livemode === 'false') return 'test';
  if (record?.metadata?.stripe_mode === 'live' || record?.metadata?.checkout_mode === 'live') return 'live';
  if (record?.metadata?.stripe_mode === 'test' || record?.metadata?.checkout_mode === 'test') return 'test';
  return 'unknown';
};

export const anomalyKey = (finding) => `${finding.workflow}:${finding.id}:${finding.reason}`;

export const filterDeliverableFindings = async ({ findings = [], request }) => {
  const fresh = [];
  for (const finding of findings) {
    const key = anomalyKey(finding);
    const existingDelivered = await request(`transaction_reconciliation_alerts?select=id,delivered_at&anomaly_key=eq.${encodeURIComponent(key)}&anomaly_state=eq.${encodeURIComponent(finding.state)}&resolved_at=is.null&delivered_at=not.is.null&limit=1`).catch(() => []);
    if (existingDelivered?.length) continue;
    await request('transaction_reconciliation_alerts', {
      method: 'POST',
      body: {
        anomaly_key: key,
        anomaly_state: finding.state,
        metadata: finding,
      },
      prefer: 'return=representation',
    }).catch((error) => {
      console.error(`Alert candidate persistence failed for ${key}: ${error.message}`);
    });
    fresh.push(finding);
  }
  return fresh;
};

export const isConfirmedAlertDelivery = (delivery = {}) => Boolean(
  delivery.delivered === true
  && delivery.platform
  && delivery.platform !== 'stdout'
);

export const deliverReconciliationAlert = async ({
  message,
  fetchImpl = globalThis.fetch,
  env = process.env,
  stdout = console.log,
} = {}) => {
  const endpoint = env.HERMES_SEND_MESSAGE_WEBHOOK_URL;
  const token = env.HERMES_SEND_MESSAGE_WEBHOOK_TOKEN;
  const allowStdout = env.PHASE3B1_RECONCILIATION_STDOUT_DRY_RUN === '1';

  if (!endpoint || !token) {
    if (allowStdout) {
      stdout(message);
      return { platform: 'stdout', delivered: false, dry_run: true };
    }
    throw new Error('Hermes direct notification configuration is required before marking reconciliation alerts delivered.');
  }
  if (typeof fetchImpl !== 'function') throw new Error('fetch is required for Hermes direct notification delivery.');

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ target: env.STARTLINE_TRANSACTION_ALERT_TARGET || 'origin', message }),
  });
  const responseText = await response.text().catch(() => '');
  if (!response.ok) throw new Error(`Telegram alert delivery failed: ${response.status} ${responseText}`);
  return { platform: 'telegram', delivered: true, response: responseText };
};

export const markDeliveredAlerts = async ({ findings = [], request, delivery = {} }) => {
  if (!isConfirmedAlertDelivery(delivery)) {
    throw new Error(`Refusing to mark reconciliation alert delivered without confirmed non-stdout delivery: ${delivery.platform || 'missing_platform'}`);
  }
  const deliveredAt = new Date().toISOString();
  for (const finding of findings) {
    const key = anomalyKey(finding);
    await request(`transaction_reconciliation_alerts?anomaly_key=eq.${encodeURIComponent(key)}&anomaly_state=eq.${encodeURIComponent(finding.state)}&resolved_at=is.null`, {
      method: 'PATCH',
      body: {
        delivered_at: deliveredAt,
        last_alerted_at: deliveredAt,
        metadata: { ...finding, delivery },
      },
      prefer: 'return=minimal',
    });
  }
};

export const markResolvedAlerts = async ({ activeFindings = [], request }) => {
  const active = new Set(activeFindings.map((finding) => `${anomalyKey(finding)}|${finding.state}`));
  const open = await request('transaction_reconciliation_alerts?select=id,anomaly_key,anomaly_state&resolved_at=is.null&limit=1000').catch(() => []);
  const resolvedAt = new Date().toISOString();
  for (const row of open || []) {
    if (active.has(`${row.anomaly_key}|${row.anomaly_state}`)) continue;
    await request(`transaction_reconciliation_alerts?id=eq.${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      body: { resolved_at: resolvedAt },
      prefer: 'return=minimal',
    });
  }
};

export const buildReconciliationFindings = ({
  now = new Date(),
  stripeEvents = [],
  customerRecords = [],
  outreachAttempts = [],
  outreachRows = [],
  staleMinutes = 30,
} = {}) => {
  const findings = [];

  for (const row of stripeEvents || []) {
    const status = clean(row.processing_status, 80);
    if (!['processing', 'failed_retryable', 'failed_terminal'].includes(status)) continue;
    const age = ageMinutes(now, row.updated_at || row.created_at);
    if (status === 'processing' && age !== null && age < staleMinutes) continue;
    findings.push({
      workflow: 'stripe_webhook',
      id: row.stripe_event_id,
      state: status,
      age_minutes: age,
      reason: status === 'processing' ? 'stripe_event_stale_processing' : 'stripe_event_failed_or_terminal',
      first_action: 'Inspect stripe_webhook_events row, Stripe dashboard event, and fulfillment state before replay/retry.',
      stripe_mode: stripeModeLabel(row),
    });
  }

  for (const row of customerRecords || []) {
    const paid = row.deposit_status === 'paid';
    const kickoffStatus = clean(row.kickoff_status, 80);
    const intakeStatus = clean(row.intake_status, 80);
    const buildStatus = clean(row.build_status, 80);
    const kickoffStarted = ['started', 'sent', 'complete'].includes(kickoffStatus);
    const intakeSent = ['sent', 'complete', 'received'].includes(intakeStatus);
    const incomplete = paid && (!kickoffStarted || !intakeSent);
    if (!incomplete) continue;
    findings.push({
      workflow: 'customer_fulfillment',
      id: row.id,
      state: `kickoff=${kickoffStatus || 'unknown'}; intake=${intakeStatus || 'unknown'}; build=${buildStatus || 'unknown'}`,
      age_minutes: ageMinutes(now, row.updated_at || row.created_at),
      reason: 'paid_customer_missing_expected_downstream_fulfillment',
      first_action: 'Verify payment mode and customer record; send/repair Launch Readiness only after confirming no prior ambiguous customer email.',
      stripe_mode: stripeModeLabel(row),
    });
  }

  for (const row of outreachAttempts || []) {
    const status = clean(row.attempt_status, 80);
    if (status === 'delivery_unknown' || status === 'sending') {
      findings.push({
        workflow: 'outreach_send_attempt',
        id: row.id || row.business_key,
        state: status,
        age_minutes: ageMinutes(now, row.updated_at || row.created_at),
        reason: status === 'delivery_unknown' ? 'ambiguous_provider_outcome_requires_reconciliation' : 'outreach_attempt_stale_sending',
        first_action: 'Check Resend dashboard/provider ID and outreach row before any resend.',
        live_mode: 'n/a',
      });
    }
  }

  for (const row of outreachRows || []) {
    if (row.outreach_status === 'sent' && !row.resend_email_id) {
      findings.push({
        workflow: 'race_mockup_outreach',
        id: row.id,
        state: 'sent_missing_provider_id',
        age_minutes: ageMinutes(now, row.updated_at || row.created_at),
        reason: 'sent_outreach_missing_provider_id',
        first_action: 'Reconcile historical row against Resend before adding provider-ID uniqueness assumptions.',
        live_mode: 'n/a',
      });
    }
  }

  return findings;
};

export const formatReconciliationAlert = (findings) => {
  if (!findings?.length) return '';
  return [
    'Steve action needed — StartLine transaction reconciliation anomaly detected.',
    '',
    ...findings.map((finding, index) => [
      `${index + 1}. ${finding.workflow}`,
      `ID: ${finding.id}`,
      `State: ${finding.state}`,
      `Age: ${finding.age_minutes ?? 'unknown'} minutes`,
      `Reason: ${finding.reason}`,
      `First action: ${finding.first_action}`,
    ].join('\n')),
  ].join('\n\n');
};
