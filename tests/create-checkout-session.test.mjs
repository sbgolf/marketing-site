import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCheckoutSessionParams, createDepositCheckoutSession, handler } from '../netlify/functions/create-checkout-session.mjs';

test('buildCheckoutSessionParams creates exact Standard deposit metadata', () => {
  process.env.STARTLINE_SITE_URL = 'https://startlinesites.com';
  const params = buildCheckoutSessionParams({
    auditRequestId: 'audit-123',
    setupTier: 'standard',
    contactEmail: 'director@example.com',
    raceName: 'Example Marathon',
    currentUrl: 'https://example.com',
    preferredLaunchDate: '2026-07-24',
  });

  assert.equal(params.get('mode'), 'payment');
  assert.equal(params.get('client_reference_id'), 'audit-123');
  assert.equal(params.get('customer_email'), 'director@example.com');
  assert.equal(params.get('success_url'), 'https://startlinesites.com/?deposit=success&session_id={CHECKOUT_SESSION_ID}');
  assert.equal(params.get('cancel_url'), 'https://startlinesites.com/?deposit=cancelled#pricing');
  assert.equal(params.get('line_items[0][price_data][unit_amount]'), '125000');
  assert.equal(params.get('line_items[0][price_data][product_data][name]'), 'StartLine Sites Standard First-Year Package Deposit');
  assert.equal(params.get('line_items[0][price_data][product_data][description]'), '$1,250 first-year package deposit toward the $2,500 standard one-time first-year race-cycle package. Final package balance due at launch.');
  assert.equal(params.get('metadata[startline_payment_type]'), 'deposit');
  assert.equal(params.get('metadata[public_package_framing]'), 'one-time first-year race-cycle package');
  assert.equal(params.get('metadata[setup_tier]'), 'standard');
  assert.equal(params.get('metadata[audit_request_id]'), 'audit-123');
  assert.equal(params.get('metadata[preferred_launch_date]'), '2026-07-24');
  assert.equal(params.get('payment_intent_data[metadata][public_package_framing]'), 'one-time first-year race-cycle package');
  assert.equal(params.get('payment_intent_data[metadata][audit_request_id]'), 'audit-123');
  assert.equal(params.get('payment_intent_data[metadata][preferred_launch_date]'), '2026-07-24');
});

test('GET handler creates a fresh Checkout Session from an audit request and redirects', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const calls = [];

  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';

  global.fetch = async (url, options = {}) => {
    const call = { url: String(url), method: options.method || 'GET', body: options.body instanceof URLSearchParams ? Object.fromEntries(options.body.entries()) : null };
    calls.push(call);
    if (call.url.includes('/audit_requests') && call.method === 'GET') {
      return new Response(JSON.stringify([{
        id: 'audit-redirect-123',
        race_name: 'Example Marathon',
        current_url: 'https://example.com',
        contact_email: 'director@example.com',
        metadata: { selected_package: { tier: 'standard' }, preferred_launch_date: '2026-07-24' },
      }]), { status: 200 });
    }
    if (call.url === 'https://api.stripe.com/v1/checkout/sessions' && call.method === 'POST') {
      return new Response(JSON.stringify({ id: 'cs_test_redirect', url: 'https://checkout.stripe.com/c/pay/cs_test_redirect' }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'unexpected call' }), { status: 500 });
  };

  try {
    const response = await handler({
      httpMethod: 'GET',
      queryStringParameters: { audit_request_id: 'audit-redirect-123' },
    });

    assert.equal(response.statusCode, 303);
    assert.equal(response.headers.location, 'https://checkout.stripe.com/c/pay/cs_test_redirect');
    const stripeCall = calls.find((call) => call.url === 'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(stripeCall.body.client_reference_id, 'audit-redirect-123');
    assert.equal(stripeCall.body['metadata[preferred_launch_date]'], '2026-07-24');
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
});

test('buildCheckoutSessionParams blocks public Premium checkout sessions', () => {
  assert.throws(
    () => buildCheckoutSessionParams({
      auditRequestId: 'audit-123',
      setupTier: 'premium',
      contactEmail: 'director@example.com',
      raceName: 'Example Marathon',
      currentUrl: 'https://example.com',
    }),
    /proposal_required/,
  );
});

test('createDepositCheckoutSession calls Stripe REST without SDK dependency', async () => {
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method, body: String(options.body), auth: options.headers.authorization });
    return new Response(JSON.stringify({ id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' }), { status: 200 });
  };

  try {
    const session = await createDepositCheckoutSession({
      stripeSecretKey: 'sk_test_123',
      auditRequestId: 'audit-123',
      setupTier: 'starter',
      contactEmail: 'director@example.com',
      raceName: 'Example Marathon',
      currentUrl: 'https://example.com',
    });

    assert.deepEqual(session, { id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' });
    assert.equal(calls[0].url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].auth, 'Bearer sk_test_123');
    assert.match(calls[0].body, /metadata%5Baudit_request_id%5D=audit-123/);
    assert.match(calls[0].body, /line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=75000/);
  } finally {
    global.fetch = originalFetch;
  }
});
