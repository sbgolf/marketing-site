import { createHmac } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { appendIntakeToken, classifyCheckoutSession, getRawBody, handler, hashIntakeToken, verifyStripeSignature } from '../netlify/functions/stripe-webhook.mjs';

const sign = ({ rawBody, secret, timestamp }) => {
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
};

test('verifyStripeSignature accepts a valid Stripe-style signature', () => {
  const rawBody = JSON.stringify({ id: 'evt_test' });
  const secret = 'whsec_test';
  const timestamp = 1_700_000_000;

  assert.equal(
    verifyStripeSignature({
      rawBody,
      secret,
      signatureHeader: sign({ rawBody, secret, timestamp }),
      nowSeconds: timestamp,
    }),
    true,
  );
});

test('verifyStripeSignature rejects stale or tampered payloads', () => {
  const rawBody = JSON.stringify({ id: 'evt_test' });
  const secret = 'whsec_test';
  const timestamp = 1_700_000_000;
  const signatureHeader = sign({ rawBody, secret, timestamp });

  assert.equal(
    verifyStripeSignature({ rawBody: JSON.stringify({ id: 'evt_other' }), secret, signatureHeader, nowSeconds: timestamp }),
    false,
  );
  assert.equal(
    verifyStripeSignature({ rawBody, secret, signatureHeader, nowSeconds: timestamp + 301 }),
    false,
  );
});

test('getRawBody decodes Netlify base64 bodies', () => {
  const body = Buffer.from('hello webhook').toString('base64');
  assert.equal(getRawBody({ body, isBase64Encoded: true }), 'hello webhook');
});

test('classifyCheckoutSession accepts a paid Standard deposit', () => {
  const result = classifyCheckoutSession({
    mode: 'payment',
    payment_status: 'paid',
    amount_total: 125_000,
    currency: 'usd',
    metadata: {
      startline_payment_type: 'deposit',
      setup_tier: 'standard',
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.tier, 'standard');
  assert.equal(result.pkg.monthly_tier, 'growth');
});

test('classifyCheckoutSession rejects public Premium deposits without proposal approval metadata', () => {
  const result = classifyCheckoutSession({
    mode: 'payment',
    payment_status: 'paid',
    amount_total: 225_000,
    currency: 'usd',
    metadata: {
      startline_payment_type: 'deposit',
      setup_tier: 'premium',
    },
  });

  assert.deepEqual(result, { ok: false, status: 'ignored', reason: 'premium_requires_proposal' });
});

test('classifyCheckoutSession accepts Premium only from an approved proposal', () => {
  const result = classifyCheckoutSession({
    mode: 'payment',
    payment_status: 'paid',
    amount_total: 225_000,
    currency: 'usd',
    metadata: {
      startline_payment_type: 'deposit',
      setup_tier: 'premium',
      proposal_approved: 'true',
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.tier, 'premium');
});

test('classifyCheckoutSession fails on deposit amount mismatch', () => {
  const result = classifyCheckoutSession({
    mode: 'payment',
    payment_status: 'paid',
    amount_total: 100_000,
    currency: 'usd',
    metadata: {
      startline_payment_type: 'deposit',
      setup_tier: 'standard',
    },
  });

  assert.deepEqual(result, { ok: false, status: 'failed', reason: 'deposit_amount_mismatch' });
});

test('appendIntakeToken preserves existing intake query params', () => {
  assert.equal(
    appendIntakeToken('https://startlinesites.com/intake?source=kickoff', 'tok_123'),
    'https://startlinesites.com/intake?source=kickoff&token=tok_123',
  );
  assert.equal(
    appendIntakeToken('/intake', 'tok_123'),
    '/intake?token=tok_123',
  );
});

test('webhook handler records a paid Standard deposit and creates kickoff-ready customer record', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const calls = [];
  const secret = 'whsec_test';
  const stripeEvent = {
    id: 'evt_standard_paid',
    type: 'checkout.session.completed',
    created: 1_700_000_000,
    livemode: false,
    data: {
      object: {
        id: 'cs_standard',
        mode: 'payment',
        payment_status: 'paid',
        amount_total: 125_000,
        currency: 'usd',
        customer: 'cus_123',
        payment_intent: 'pi_123',
        customer_details: { email: 'director@example.com', name: 'Race Director' },
        metadata: { startline_payment_type: 'deposit', setup_tier: 'standard', audit_request_id: 'audit-123' },
      },
    },
  };
  const rawBody = JSON.stringify(stripeEvent);

  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS = '999999999';
  process.env.RESEND_API_KEY = 're_test';
  delete process.env.STARTLINE_RESEND_API_KEY;
  process.env.STARTLINE_INTAKE_FORM_URL = 'https://startlinesites.com/intake?source=kickoff';
  process.env.STARTLINE_ASSET_CHECKLIST_URL = 'https://startlinesites.com/asset-checklist';

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });

    if (String(url).includes('/stripe_webhook_events') && options.method === 'POST') {
      return new Response(JSON.stringify([{ id: 'webhook-row' }]), { status: 201 });
    }
    if (String(url).includes('/audit_requests?id=eq.audit-123') && (options.method || 'GET') === 'GET') {
      return new Response(JSON.stringify([{
        id: 'audit-123',
        race_name: 'Example Marathon',
        current_url: 'https://example.com',
        contact_name: 'Race Director',
        contact_email: 'director@example.com',
        metadata: { selected_package: { tier: 'standard' } },
      }]), { status: 200 });
    }
    if (String(url).includes('/audit_requests?id=eq.audit-123') && options.method === 'PATCH') {
      return new Response('', { status: 200 });
    }
    if (String(url).includes('/customer_records') && options.method === 'POST') {
      return new Response(JSON.stringify([{ id: 'customer-123', primary_contact_email: 'director@example.com', race_name: 'Example Marathon', primary_contact_name: 'Race Director' }]), { status: 201 });
    }
    if (String(url).includes('/customer_records?id=eq.customer-123') && options.method === 'PATCH') {
      return new Response('', { status: 200 });
    }
    if (String(url) === 'https://api.resend.com/emails' && options.method === 'POST') {
      return new Response(JSON.stringify({ id: 'email-123' }), { status: 200 });
    }
    if (String(url).includes('/stripe_webhook_events') && options.method === 'PATCH') {
      return new Response('', { status: 200 });
    }

    return new Response(JSON.stringify([]), { status: 200 });
  };

  try {
    const response = await handler({
      httpMethod: 'POST',
      body: rawBody,
      headers: { 'stripe-signature': sign({ rawBody, secret, timestamp: 1_700_000_000 }) },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      ok: true,
      status: 'processed',
      audit_request_id: 'audit-123',
      customer_record_id: 'customer-123',
      mapping_method: 'metadata.audit_request_id',
    });

    const customerInsert = calls.find((call) => call.url.includes('/customer_records') && call.method === 'POST');
    assert.equal(customerInsert.body.customer_status, 'kickoff_ready');
    assert.equal(customerInsert.body.deposit_status, 'paid');
    assert.equal(customerInsert.body.kickoff_status, 'ready');
    assert.equal(customerInsert.body.intake_status, 'ready_to_send');
    assert.equal(customerInsert.body.setup_tier, 'standard');
    assert.match(customerInsert.body.intake_token_hash, /^[a-f0-9]{64}$/);
    assert.match(customerInsert.body.intake_token_created_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(JSON.stringify(customerInsert.body.metadata).includes(customerInsert.body.intake_token_hash), false);

    const kickoffEmail = calls.find((call) => call.url === 'https://api.resend.com/emails' && call.body?.subject === 'Next steps for Example Marathon');
    assert.ok(kickoffEmail);
    assert.match(kickoffEmail.body.text, /Intake form: https:\/\/startlinesites\.com\/intake\?source=kickoff&token=[A-Za-z0-9_-]{32,200}/);
    const rawToken = kickoffEmail.body.text.match(/token=([A-Za-z0-9_-]{32,200})/)?.[1];
    assert.ok(rawToken);
    assert.equal(hashIntakeToken(rawToken), customerInsert.body.intake_token_hash);
    assert.doesNotMatch(JSON.stringify(customerInsert.body), new RegExp(rawToken));
    assert.doesNotMatch(JSON.stringify(kickoffEmail.body), /intake_token_hash|stripe_customer_id|cus_123|pi_123/);
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
});
