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

test('Phase 3B-1 reconciliation distinguishes live failures from test-mode fixtures', () => {
  const findings = buildReconciliationFindings({
    now: new Date('2026-08-09T12:00:00Z'),
    stripeEvents: [
      { stripe_event_id: 'evt_live_failed', livemode: true, processing_status: 'failed_retryable', updated_at: '2026-08-09T10:00:00Z' },
      { stripe_event_id: 'evt_test_history', livemode: false, processing_status: 'processed', updated_at: '2026-07-01T10:00:00Z' },
    ],
    customerRecords: [
      { id: 'live-customer', stripe_livemode: true, deposit_status: 'paid', launch_readiness_status: 'ready_to_send', updated_at: '2026-08-09T09:00:00Z' },
      { id: 'test-customer', stripe_livemode: false, deposit_status: 'paid', launch_readiness_status: 'sent', updated_at: '2026-07-04T09:00:00Z' },
    ],
    outreachAttempts: [{ id: 'attempt-unknown', attempt_status: 'delivery_unknown', updated_at: '2026-08-09T11:00:00Z' }],
  });
  assert.equal(findings.some((f) => f.id === 'evt_live_failed'), true);
  assert.equal(findings.some((f) => f.id === 'test-customer' || f.id === 'evt_test_history'), false);
  assert.equal(findings.some((f) => f.id === 'attempt-unknown'), true);
});
