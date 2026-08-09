const clean = (value, max = 500) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '');

const ageMinutes = (now, updatedAt) => {
  const t = new Date(updatedAt || 0).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 60000));
};

const isLiveRecord = (record) => record?.livemode === true || record?.stripe_livemode === true || record?.metadata?.stripe_livemode === true;

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
    // Explicit test-mode history is not a production failure. If livemode is absent, surface it;
    // the monitor must not hardcode row IDs, but unknown mode is still actionable.
    if (row.livemode === false && status === 'processed') continue;
    const age = ageMinutes(now, row.updated_at || row.created_at);
    if (status === 'processing' && age !== null && age < staleMinutes) continue;
    findings.push({
      workflow: 'stripe_webhook',
      id: row.stripe_event_id,
      state: status,
      age_minutes: age,
      reason: status === 'processing' ? 'stripe_event_stale_processing' : 'stripe_event_failed_or_terminal',
      first_action: 'Inspect stripe_webhook_events row, Stripe dashboard event, and fulfillment state before replay/retry.',
      live_mode: row.livemode === true ? 'live' : row.livemode === false ? 'test' : 'unknown',
    });
  }

  for (const row of customerRecords || []) {
    if (row.stripe_livemode === false) continue;
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
      live_mode: isLiveRecord(row) ? 'live' : 'unknown',
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
