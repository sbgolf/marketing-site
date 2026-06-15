import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCheckoutSessionParams, createDepositCheckoutSession } from '../netlify/functions/create-checkout-session.mjs';

test('buildCheckoutSessionParams creates exact Standard deposit metadata', () => {
  process.env.STARTLINE_SITE_URL = 'https://startlinesites.com';
  const params = buildCheckoutSessionParams({
    auditRequestId: 'audit-123',
    setupTier: 'standard',
    contactEmail: 'director@example.com',
    raceName: 'Example Marathon',
    currentUrl: 'https://example.com',
  });

  assert.equal(params.get('mode'), 'payment');
  assert.equal(params.get('client_reference_id'), 'audit-123');
  assert.equal(params.get('customer_email'), 'director@example.com');
  assert.equal(params.get('success_url'), 'https://startlinesites.com/?deposit=success&session_id={CHECKOUT_SESSION_ID}');
  assert.equal(params.get('cancel_url'), 'https://startlinesites.com/?deposit=cancelled#pricing');
  assert.equal(params.get('line_items[0][price_data][unit_amount]'), '125000');
  assert.equal(params.get('metadata[startline_payment_type]'), 'deposit');
  assert.equal(params.get('metadata[setup_tier]'), 'standard');
  assert.equal(params.get('metadata[audit_request_id]'), 'audit-123');
  assert.equal(params.get('payment_intent_data[metadata][audit_request_id]'), 'audit-123');
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
