import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { handler as stripeHandler } from '../netlify/functions/stripe-webhook.mjs';
import { handler as auditHandler } from '../netlify/functions/submit-audit-request.mjs';
import { sendMockupOutreachFromGenerationJob } from '../scripts/lib/mockup-generation-send-gate.mjs';
import { buildReconciliationFindings } from '../scripts/lib/phase3b1-transaction-reconciliation.mjs';

const sign = ({ rawBody, secret, timestamp }) => {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
  return `t=${timestamp},v1=${signature}`;
};

const paidCheckoutEvent = (id = 'evt_retryable') => ({
  id,
  type: 'checkout.session.completed',
  created: 1_700_000_000,
  livemode: false,
  data: { object: {
    id: 'cs_retryable', mode: 'payment', payment_status: 'paid', amount_total: 125_000, currency: 'usd',
    customer: 'cus_retry', payment_intent: 'pi_retry', customer_details: { email: 'director@example.com', name: 'Race Director' },
    metadata: { startline_payment_type: 'deposit', setup_tier: 'standard', audit_request_id: 'audit-retry' },
  } },
});

const stripeEnv = () => {
  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS = '999999999';
  delete process.env.RESEND_API_KEY;
  delete process.env.STARTLINE_RESEND_API_KEY;
};

test('Phase 3B-1 Stripe duplicate processed event exits without fulfillment while retryable duplicate resumes', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const calls = [];
  const event = paidCheckoutEvent();
  const rawBody = JSON.stringify(event);
  stripeEnv();

  let postAttempts = 0;
  global.fetch = async (url, options = {}) => {
    const call = { url: String(url), method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null };
    calls.push(call);
    if (call.url.includes('/stripe_webhook_events') && call.method === 'POST') {
      postAttempts += 1;
      return postAttempts === 1
        ? new Response(JSON.stringify({ code: '23505' }), { status: 409 })
        : new Response(JSON.stringify([{ id: 'webhook-row' }]), { status: 201 });
    }
    if (call.url.includes('/stripe_webhook_events?select=') && call.method === 'GET') {
      return new Response(JSON.stringify([{ stripe_event_id: event.id, processing_status: 'processed', processed_at: '2026-08-01T00:00:00Z' }]), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  };

  try {
    const duplicate = await stripeHandler({ httpMethod: 'POST', body: rawBody, headers: { 'stripe-signature': sign({ rawBody, secret: 'whsec_test', timestamp: 1_700_000_000 }) } });
    assert.equal(duplicate.statusCode, 200);
    assert.equal(JSON.parse(duplicate.body).status, 'duplicate_processed');
    assert.equal(calls.some((call) => call.url.includes('/audit_requests') || call.url.includes('/customer_records')), false);
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
});

test('Phase 3B-1 audit submission same idempotency token returns existing result without second checkout or notification', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const calls = [];
  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.STRIPE_SECRET_KEY = 'sk_test';
  process.env.RESEND_API_KEY = 're_test';
  process.env.STARTLINE_POSTAL_ADDRESS = 'PO Box 123, Nashville, TN 37201';

  let auditCreated = false;
  global.fetch = async (url, options = {}) => {
    const body = options.body ? (options.body instanceof URLSearchParams ? Object.fromEntries(options.body.entries()) : JSON.parse(options.body)) : null;
    const call = { url: String(url), method: options.method || 'GET', body };
    calls.push(call);
    if (call.url.includes('/audit_requests') && call.method === 'POST') {
      auditCreated = true;
      return new Response(JSON.stringify([{ id: 'audit-idem-1', submission_idempotency_key: 'tok-abc' }]), { status: 201 });
    }
    if (call.url === 'https://api.stripe.com/v1/checkout/sessions') return new Response(JSON.stringify({ id: 'cs_test_idem', url: 'https://checkout.stripe.com/c/pay/cs_test_idem' }), { status: 200 });
    if (call.url.includes('/audit_requests?id=eq.audit-idem-1') && call.method === 'PATCH') return new Response(null, { status: 200 });
    if (call.url === 'https://api.resend.com/emails') return new Response(JSON.stringify({ id: 'email-idem' }), { status: 200 });
    if (call.url.includes('/audit_requests?select=') && call.url.includes('submission_idempotency_key=eq.tok-abc') && auditCreated) {
      return new Response(JSON.stringify([{ id: 'audit-idem-1', submission_idempotency_key: 'tok-abc', submission_idempotency_response: { ok: true, id: 'audit-idem-1', checkout_url: 'https://checkout.stripe.com/c/pay/cs_test_idem', checkout_url_source: 'dynamic_checkout_session' } }]), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  };

  const event = (token) => ({ httpMethod: 'POST', headers: { 'user-agent': 'test' }, body: JSON.stringify({ race_name: 'Example Marathon', current_url: 'https://example.com', contact_name: 'Race Director', contact_email: 'director@example.com', package_tier: 'starter', submission_idempotency_token: token }) });
  try {
    assert.equal((await auditHandler(event('tok-abc'))).statusCode, 201);
    const retry = await auditHandler(event('tok-abc'));
    assert.equal(retry.statusCode, 200);
    assert.equal(calls.filter((call) => call.url === 'https://api.stripe.com/v1/checkout/sessions').length, 1);
    assert.equal(calls.filter((call) => call.url === 'https://api.resend.com/emails').length, 2);
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
});

test('Phase 3B-1 outreach accepted then persistence failure marks delivery_unknown and retry does not call provider again', async () => {
  const originalEnv = { ...process.env };
  process.env.STARTLINE_POSTAL_ADDRESS = 'PO Box 123, Nashville, TN 37201';
  const calls = [];
  let attemptCreated = false;
  const generationJob = { id: 'job-1', prospect_id: 'prospect-1', job_status: 'ready_for_owner_review', qa_status: 'passed', site_auditor_status: 'passed', owner_approval_status: 'approved_to_send', mockup_url: 'https://mockups.startlinesites.com/example', mockup_template: 'community', race_name: 'Example 5K', metadata: { email_template_key: 'individual_mockup_v1', campaign_lane: 'A', prospect_type: 'runsignup_only_community_race' } };
  const prospect = { id: 'prospect-1', race_name: 'Example 5K', race_slug: 'example-5k', contact_sources: [{ type: 'email', value: 'director@example.com' }] };
  const supabaseRequest = async (request) => {
    calls.push({ ...request });
    if (request.path.startsWith('race_mockup_generation_jobs?')) return [generationJob];
    if (request.path.startsWith('race_mockup_prospects?')) return [prospect];
    if (request.path.startsWith('outreach_send_attempts?select=')) return attemptCreated ? [{ id: 'attempt-1', attempt_status: 'delivery_unknown', business_key: 'existing' }] : [];
    if (request.path === 'outreach_send_attempts' && request.method === 'POST') { attemptCreated = true; return [{ id: 'attempt-1', attempt_status: 'claimed' }]; }
    if (request.path.startsWith('outreach_send_attempts?id=eq.attempt-1') && request.method === 'PATCH') return [{ id: 'attempt-1', attempt_status: request.body.attempt_status }];
    if (request.path.startsWith('race_mockup_outreach?')) return [];
    if (request.path === 'race_mockup_outreach' && request.method === 'POST') throw new Error('forced persistence failure');
    return [];
  };
  let providerCalls = 0;
  const send = async () => { providerCalls += 1; return { id: 'email-accepted' }; };
  const first = await sendMockupOutreachFromGenerationJob({ generationJobId: 'job-1', ownerApprovedSend: true, supabaseRequest, sendWithResend: send, overrides: { toEmails: 'director@example.com' } });
  assert.equal(first.ok, false);
  assert.equal(first.reason, 'delivery_unknown_reconciliation_required');
  assert.equal(providerCalls, 1);
  const second = await sendMockupOutreachFromGenerationJob({ generationJobId: 'job-1', ownerApprovedSend: true, supabaseRequest, sendWithResend: send, overrides: { toEmails: 'director@example.com' } });
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'delivery_unknown_reconciliation_required');
  assert.equal(providerCalls, 1);
  process.env = originalEnv;
});

test('Phase 3B-1 reconciliation includes test-mode Stripe failures and does not require customer stripe_livemode', () => {
  const findings = buildReconciliationFindings({
    now: new Date('2026-08-09T12:00:00Z'),
    stripeEvents: [
      { stripe_event_id: 'evt_live_failed', livemode: true, processing_status: 'failed_retryable', updated_at: '2026-08-09T10:00:00Z' },
      { stripe_event_id: 'evt_test_failed', livemode: false, processing_status: 'failed_retryable', updated_at: '2026-08-09T10:10:00Z' },
      { stripe_event_id: 'evt_test_history', livemode: false, processing_status: 'processed', updated_at: '2026-07-01T10:00:00Z' },
    ],
    customerRecords: [
      { id: 'customer-without-mode-column', deposit_status: 'paid', kickoff_status: 'not_started', intake_status: 'not_sent', updated_at: '2026-08-09T09:00:00Z' },
      { id: 'healthy-test-customer', deposit_status: 'paid', kickoff_status: 'sent', intake_status: 'sent', metadata: { stripe_mode: 'test' }, updated_at: '2026-07-04T09:00:00Z' },
    ],
    outreachAttempts: [{ id: 'attempt-unknown', attempt_status: 'delivery_unknown', updated_at: '2026-08-09T11:00:00Z' }],
  });
  assert.equal(findings.some((f) => f.id === 'evt_live_failed' && f.stripe_mode === 'live'), true);
  assert.equal(findings.some((f) => f.id === 'evt_test_failed' && f.stripe_mode === 'test'), true);
  assert.equal(findings.some((f) => f.id === 'customer-without-mode-column' && f.reason === 'paid_customer_missing_expected_downstream_fulfillment'), true);
  assert.equal(findings.some((f) => f.id === 'evt_test_history' || f.id === 'healthy-test-customer'), false);
  assert.equal(findings.some((f) => f.id === 'attempt-unknown'), true);
});


test('Phase 3B-1 audit submission existing token without persisted response returns pending without duplicate side effects', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const calls = [];
  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.STRIPE_SECRET_KEY = 'sk_test';
  process.env.RESEND_API_KEY = 're_test';
  process.env.STARTLINE_POSTAL_ADDRESS = 'PO Box 123, Nashville, TN 37201';

  global.fetch = async (url, options = {}) => {
    const call = { url: String(url), method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null };
    calls.push(call);
    if (call.url.includes('/audit_requests?select=') && call.url.includes('submission_idempotency_key=eq.tok-pending')) {
      return new Response(JSON.stringify([{ id: 'audit-pending', submission_idempotency_key: 'tok-pending', submission_idempotency_response: null }]), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  };

  const event = { httpMethod: 'POST', headers: { 'user-agent': 'test' }, body: JSON.stringify({ race_name: 'Example Marathon', current_url: 'https://example.com', contact_name: 'Race Director', contact_email: 'director@example.com', package_tier: 'starter', submission_idempotency_token: 'tok-pending' }) };
  try {
    const response = await auditHandler(event);
    assert.equal(response.statusCode, 202);
    assert.equal(JSON.parse(response.body).pending, true);
    assert.equal(calls.filter((call) => call.method === 'POST' && call.url.includes('/audit_requests')).length, 0);
    assert.equal(calls.filter((call) => call.url === 'https://api.stripe.com/v1/checkout/sessions').length, 0);
    assert.equal(calls.filter((call) => call.url === 'https://api.resend.com/emails').length, 0);
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
});

test('Phase 3B-1 Stripe failed_terminal duplicate does not automatically resume fulfillment', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const calls = [];
  const event = paidCheckoutEvent('evt_terminal');
  const rawBody = JSON.stringify(event);
  stripeEnv();
  global.fetch = async (url, options = {}) => {
    const call = { url: String(url), method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null };
    calls.push(call);
    if (call.url.includes('/stripe_webhook_events') && call.method === 'POST') return new Response(JSON.stringify({ code: '23505' }), { status: 409 });
    if (call.url.includes('/stripe_webhook_events?select=') && call.method === 'GET') return new Response(JSON.stringify([{ stripe_event_id: event.id, processing_status: 'failed_terminal' }]), { status: 200 });
    if (call.url.includes('/stripe_webhook_events?stripe_event_id=eq.') && call.method === 'PATCH') return new Response(JSON.stringify([]), { status: 200 });
    return new Response(JSON.stringify([]), { status: 200 });
  };
  try {
    const response = await stripeHandler({ httpMethod: 'POST', body: rawBody, headers: { 'stripe-signature': sign({ rawBody, secret: 'whsec_test', timestamp: 1_700_000_000 }) } });
    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).status, 'duplicate_terminal_not_resumed');
    assert.equal(calls.some((call) => call.url.includes('/audit_requests') || call.url.includes('/customer_records')), false);
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
});

test('Phase 3B-1 outreach retry claim allows only one concurrent provider call', async () => {
  const originalEnv = { ...process.env };
  process.env.STARTLINE_POSTAL_ADDRESS = 'PO Box 123, Nashville, TN 37201';
  const generationJob = { id: 'job-concurrent', prospect_id: 'prospect-concurrent', job_status: 'ready_for_owner_review', qa_status: 'passed', site_auditor_status: 'passed', owner_approval_status: 'approved_to_send', mockup_url: 'https://mockups.startlinesites.com/example', mockup_template: 'community', race_name: 'Example 5K', metadata: { email_template_key: 'individual_mockup_v1', campaign_lane: 'A', prospect_type: 'runsignup_only_community_race' } };
  const prospect = { id: 'prospect-concurrent', race_name: 'Example 5K', race_slug: 'example-5k', contact_sources: [{ type: 'email', value: 'director@example.com' }] };
  let attempt = { id: 'attempt-concurrent', attempt_status: 'failed_safe_to_retry', business_key: 'existing' };
  let claimed = false;
  const supabaseRequest = async (request) => {
    if (request.path.startsWith('race_mockup_generation_jobs?')) return [generationJob];
    if (request.path.startsWith('race_mockup_prospects?')) return [prospect];
    if (request.path.startsWith('outreach_send_attempts?select=')) return [attempt];
    if (request.path.startsWith('outreach_send_attempts?id=eq.attempt-concurrent') && request.method === 'PATCH' && request.path.includes('attempt_status=in.')) {
      if (claimed) return [];
      claimed = true;
      attempt = { ...attempt, attempt_status: request.body.attempt_status };
      return [attempt];
    }
    if (request.path.startsWith('outreach_send_attempts?id=eq.attempt-concurrent') && request.method === 'PATCH') { attempt = { ...attempt, ...request.body }; return [attempt]; }
    if (request.path.startsWith('race_mockup_outreach?')) return [];
    if (request.path === 'race_mockup_outreach' && request.method === 'POST') return [{ id: 'outreach-1', resend_email_id: 'email-1', race_name: 'Example 5K', mockup_url: generationJob.mockup_url, mockup_template: 'community' }];
    return [];
  };
  let providerCalls = 0;
  const send = async () => { providerCalls += 1; return { id: 'email-1' }; };
  const [first, second] = await Promise.all([
    sendMockupOutreachFromGenerationJob({ generationJobId: generationJob.id, ownerApprovedSend: true, supabaseRequest, sendWithResend: send, overrides: { toEmails: 'director@example.com' } }),
    sendMockupOutreachFromGenerationJob({ generationJobId: generationJob.id, ownerApprovedSend: true, supabaseRequest, sendWithResend: send, overrides: { toEmails: 'director@example.com' } }),
  ]);
  assert.equal(providerCalls, 1);
  assert.equal([first.ok, second.ok].filter(Boolean).length, 1);
  process.env = originalEnv;
});

test('Phase 3B-1 reconciliation alert lifecycle only dedupes after delivery and allows recurrence after resolution', async () => {
  const { filterDeliverableFindings, markDeliveredAlerts, markResolvedAlerts } = await import('../scripts/lib/phase3b1-transaction-reconciliation.mjs');
  const finding = { workflow: 'stripe_webhook', id: 'evt_live_failed', state: 'failed_retryable', reason: 'stripe_event_failed_or_terminal' };
  const rows = [];
  const request = async (path, options = {}) => {
    if (path.startsWith('transaction_reconciliation_alerts?select=')) return rows.filter((row) => row.anomaly_key === 'stripe_webhook:evt_live_failed:stripe_event_failed_or_terminal' && row.anomaly_state === finding.state && !row.resolved_at && row.delivered_at);
    if (path === 'transaction_reconciliation_alerts' && options.method === 'POST') { rows.push({ id: `alert-${rows.length + 1}`, ...options.body }); return [{ id: rows.at(-1).id }]; }
    if (path.startsWith('transaction_reconciliation_alerts?id=eq.') && options.method === 'PATCH') { const row = rows.find((r) => path.includes(r.id)); Object.assign(row, options.body); return [row]; }
    if (path.startsWith('transaction_reconciliation_alerts?anomaly_key=eq.') && options.method === 'PATCH') { rows.filter((r) => !r.resolved_at).forEach((r) => Object.assign(r, options.body)); return rows; }
    return [];
  };
  let fresh = await filterDeliverableFindings({ findings: [finding], request });
  assert.equal(fresh.length, 1);
  fresh = await filterDeliverableFindings({ findings: [finding], request });
  assert.equal(fresh.length, 1, 'undelivered dedupe row must not suppress alert');
  await markDeliveredAlerts({ findings: [finding], request, delivery: { platform: 'telegram', delivered: true, message_id: 'msg-1' } });
  fresh = await filterDeliverableFindings({ findings: [finding], request });
  assert.equal(fresh.length, 0);
  await markResolvedAlerts({ activeFindings: [], request });
  assert.ok(rows.some((row) => row.resolved_at));
  fresh = await filterDeliverableFindings({ findings: [finding], request });
  assert.equal(fresh.length, 1, 'same anomaly recurring after resolution should alert again');
});


test('Phase 3B-1 outreach confirmed provider rejection is safe to retry without delivery_unknown', async () => {
  const originalEnv = { ...process.env };
  process.env.STARTLINE_POSTAL_ADDRESS = 'PO Box 123, Nashville, TN 37201';
  const generationJob = { id: 'job-reject', prospect_id: 'prospect-reject', job_status: 'ready_for_owner_review', qa_status: 'passed', site_auditor_status: 'passed', owner_approval_status: 'approved_to_send', mockup_url: 'https://mockups.startlinesites.com/example', mockup_template: 'community', race_name: 'Rejected 5K', metadata: { email_template_key: 'individual_mockup_v1', campaign_lane: 'A', prospect_type: 'runsignup_only_community_race' } };
  const prospect = { id: 'prospect-reject', race_name: 'Rejected 5K', race_slug: 'rejected-5k', contact_sources: [{ type: 'email', value: 'director@example.com' }] };
  let attempt = null;
  const supabaseRequest = async (request) => {
    if (request.path.startsWith('race_mockup_generation_jobs?')) return [generationJob];
    if (request.path.startsWith('race_mockup_prospects?')) return [prospect];
    if (request.path.startsWith('outreach_send_attempts?select=')) return attempt ? [attempt] : [];
    if (request.path === 'outreach_send_attempts' && request.method === 'POST') { attempt = { id: 'attempt-reject', attempt_status: 'claimed' }; return [attempt]; }
    if (request.path.startsWith('outreach_send_attempts?id=eq.attempt-reject') && request.method === 'PATCH') { attempt = { ...attempt, ...request.body }; return [attempt]; }
    if (request.path.startsWith('race_mockup_outreach?')) return [];
    return [];
  };
  const error = new Error('provider rejected before acceptance');
  error.status = 422;
  await assert.rejects(
    sendMockupOutreachFromGenerationJob({ generationJobId: generationJob.id, ownerApprovedSend: true, supabaseRequest, sendWithResend: async () => { throw error; }, overrides: { toEmails: 'director@example.com' } }),
    /provider rejected/,
  );
  assert.equal(attempt.attempt_status, 'failed_safe_to_retry');
  process.env = originalEnv;
});

test('Phase 3B-1 outreach network timeout is delivery_unknown and not safe-to-retry', async () => {
  const originalEnv = { ...process.env };
  process.env.STARTLINE_POSTAL_ADDRESS = 'PO Box 123, Nashville, TN 37201';
  const generationJob = { id: 'job-timeout', prospect_id: 'prospect-timeout', job_status: 'ready_for_owner_review', qa_status: 'passed', site_auditor_status: 'passed', owner_approval_status: 'approved_to_send', mockup_url: 'https://mockups.startlinesites.com/example', mockup_template: 'community', race_name: 'Timeout 5K', metadata: { email_template_key: 'individual_mockup_v1', campaign_lane: 'A', prospect_type: 'runsignup_only_community_race' } };
  const prospect = { id: 'prospect-timeout', race_name: 'Timeout 5K', race_slug: 'timeout-5k', contact_sources: [{ type: 'email', value: 'director@example.com' }] };
  let attempt = null;
  const supabaseRequest = async (request) => {
    if (request.path.startsWith('race_mockup_generation_jobs?')) return [generationJob];
    if (request.path.startsWith('race_mockup_prospects?')) return [prospect];
    if (request.path.startsWith('outreach_send_attempts?select=')) return attempt ? [attempt] : [];
    if (request.path === 'outreach_send_attempts' && request.method === 'POST') { attempt = { id: 'attempt-timeout', attempt_status: 'claimed' }; return [attempt]; }
    if (request.path.startsWith('outreach_send_attempts?id=eq.attempt-timeout') && request.method === 'PATCH') { attempt = { ...attempt, ...request.body }; return [attempt]; }
    if (request.path.startsWith('race_mockup_outreach?')) return [];
    return [];
  };
  const result = await sendMockupOutreachFromGenerationJob({ generationJobId: generationJob.id, ownerApprovedSend: true, supabaseRequest, sendWithResend: async () => { throw new Error('network timeout after provider request'); }, overrides: { toEmails: 'director@example.com' } });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'delivery_unknown_reconciliation_required');
  assert.equal(attempt.attempt_status, 'delivery_unknown');
  process.env = originalEnv;
});


test('Phase 3B-1 Stripe ambiguous kickoff-email outcome does not auto-resend on resume', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const calls = [];
  const event = paidCheckoutEvent('evt_ambiguous_kickoff');
  const rawBody = JSON.stringify(event);
  stripeEnv();
  process.env.RESEND_API_KEY = 're_test';
  process.env.STARTLINE_INTAKE_FORM_URL = 'https://startlinesites.com/intake?source=kickoff';
  process.env.STARTLINE_ASSET_CHECKLIST_URL = 'https://startlinesites.com/asset-checklist';
  process.env.STARTLINE_POSTAL_ADDRESS = 'PO Box 123, Nashville, TN 37201';
  global.fetch = async (url, options = {}) => {
    const call = { url: String(url), method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null };
    calls.push(call);
    if (call.url.includes('/stripe_webhook_events') && call.method === 'POST') return new Response(JSON.stringify({ code: '23505' }), { status: 409 });
    if (call.url.includes('/stripe_webhook_events?select=') && call.method === 'GET') return new Response(JSON.stringify([{ stripe_event_id: event.id, processing_status: 'failed_retryable' }]), { status: 200 });
    if (call.url.includes('/stripe_webhook_events?stripe_event_id=eq.') && call.method === 'PATCH') return new Response(JSON.stringify([{ id: 'webhook-row-ambiguous', stripe_event_id: event.id, processing_status: call.body.processing_status }]), { status: 200 });
    if (call.url.includes('/audit_requests?id=eq.audit-retry') && call.method === 'GET') return new Response(JSON.stringify([{ id: 'audit-retry', race_name: 'Ambiguous Marathon', current_url: 'https://example.com', contact_name: 'Race Director', contact_email: 'director@example.com', metadata: { selected_package: { tier: 'standard' } } }]), { status: 200 });
    if (call.url.includes('/audit_requests?id=eq.audit-retry') && call.method === 'PATCH') return new Response('', { status: 200 });
    if (call.url.includes('/customer_records?select=') && call.url.includes('stripe_checkout_session_id=eq.cs_retryable')) return new Response(JSON.stringify([{ id: 'customer-ambiguous', primary_contact_email: 'director@example.com', race_name: 'Ambiguous Marathon', primary_contact_name: 'Race Director', launch_readiness_status: 'delivery_unknown', metadata: { stripe_deposit: { checkout_session_id: 'cs_retryable' }, kickoff_email: { attempt_status: 'delivery_unknown' } } }]), { status: 200 });
    if (call.url.includes('/customer_records') && call.method === 'POST') return new Response(JSON.stringify([{ id: 'customer-ambiguous', primary_contact_email: 'director@example.com', race_name: 'Ambiguous Marathon', primary_contact_name: 'Race Director', launch_readiness_status: 'delivery_unknown', metadata: { kickoff_email: { attempt_status: 'delivery_unknown' } } }]), { status: 201 });
    if (call.url === 'https://api.resend.com/emails') return new Response(JSON.stringify({ id: 'admin-notification-only' }), { status: 200 });
    return new Response(JSON.stringify([]), { status: 200 });
  };
  try {
    const response = await stripeHandler({ httpMethod: 'POST', body: rawBody, headers: { 'stripe-signature': sign({ rawBody, secret: 'whsec_test', timestamp: 1_700_000_000 }) } });
    assert.equal(response.statusCode, 500);
    assert.equal(calls.some((call) => call.url === 'https://api.resend.com/emails' && call.body?.subject === 'Next steps for Ambiguous Marathon'), false);
    assert.equal(calls.some((call) => call.url.includes('/stripe_webhook_events?stripe_event_id=eq.') && call.body?.processing_status === 'failed_retryable'), true);
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
});


test('Phase 3B-1 reconciliation stdout dry-run does not count as delivered', async () => {
  const {
    deliverReconciliationAlert,
    markDeliveredAlerts,
    isConfirmedAlertDelivery,
  } = await import('../scripts/lib/phase3b1-transaction-reconciliation.mjs');
  const output = [];
  const delivery = await deliverReconciliationAlert({
    message: 'safe fixture alert',
    env: { PHASE3B1_RECONCILIATION_STDOUT_DRY_RUN: '1' },
    stdout: (message) => output.push(message),
  });
  assert.equal(output[0], 'safe fixture alert');
  assert.equal(delivery.platform, 'stdout');
  assert.equal(delivery.delivered, false);
  assert.equal(isConfirmedAlertDelivery(delivery), false);
  await assert.rejects(
    markDeliveredAlerts({ findings: [{ workflow: 'fixture', id: 'stdout', state: 'open', reason: 'dry_run' }], request: async () => [] , delivery }),
    /Refusing to mark reconciliation alert delivered/,
  );
});

test('Phase 3B-1 reconciliation failed notification remains retryable and undelivered', async () => {
  const { deliverReconciliationAlert, filterDeliverableFindings } = await import('../scripts/lib/phase3b1-transaction-reconciliation.mjs');
  const finding = { workflow: 'fixture', id: 'delivery-fail', state: 'open', reason: 'safe_fixture' };
  const rows = [];
  const request = async (path, options = {}) => {
    if (path.startsWith('transaction_reconciliation_alerts?select=')) return rows.filter((row) => row.delivered_at && !row.resolved_at);
    if (path === 'transaction_reconciliation_alerts' && options.method === 'POST') { rows.push({ id: `alert-${rows.length + 1}`, ...options.body }); return [rows.at(-1)]; }
    return [];
  };
  const first = await filterDeliverableFindings({ findings: [finding], request });
  assert.equal(first.length, 1);
  await assert.rejects(
    deliverReconciliationAlert({
      message: 'safe fixture alert',
      env: { HERMES_SEND_MESSAGE_WEBHOOK_URL: 'https://example.invalid/webhook', HERMES_SEND_MESSAGE_WEBHOOK_TOKEN: 'token' },
      fetchImpl: async () => ({ ok: false, status: 503, text: async () => 'temporary failure' }),
    }),
    /Telegram alert delivery failed: 503/,
  );
  assert.equal(rows.some((row) => row.delivered_at), false);
  const retry = await filterDeliverableFindings({ findings: [finding], request });
  assert.equal(retry.length, 1, 'failed notification must remain deliverable for retry');
});
