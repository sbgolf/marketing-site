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

test('appendIntakeToken preserves existing intake query params and refuses unapproved URLs', () => {
  assert.equal(
    appendIntakeToken('https://startlinesites.com/intake?source=kickoff', 'tok_123'),
    'https://startlinesites.com/intake?source=kickoff&token=tok_123',
  );
  assert.equal(
    appendIntakeToken('/intake', 'tok_123'),
    '/intake?token=tok_123',
  );
  assert.equal(
    appendIntakeToken('https://deploy-preview-128--startline-sites.netlify.app/intake/', 'tok_123'),
    'https://deploy-preview-128--startline-sites.netlify.app/intake/?token=tok_123',
  );
  assert.equal(
    appendIntakeToken('https://example.com/intake?source=kickoff', 'tok_123'),
    'https://example.com/intake?source=kickoff',
  );
  assert.equal(
    appendIntakeToken('https://startlinesites.com/pricing', 'tok_123'),
    'https://startlinesites.com/pricing',
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
    assert.equal(customerInsert.body.launch_readiness_status, 'ready_to_send');
    assert.match(customerInsert.body.launch_readiness_updated_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(customerInsert.body.registration_confirmation_status, 'unknown');
    assert.equal(customerInsert.body.asset_permission_status, 'requested');
    assert.equal(customerInsert.body.domain_dns_status, 'unknown');
    assert.equal(customerInsert.body.analytics_status, 'unknown');
    assert.equal(customerInsert.body.search_console_status, 'unknown');
    assert.equal(customerInsert.body.final_approver_status, 'unknown');
    assert.equal(customerInsert.body.launch_readiness_dependencies.assets_permissions.status, 'requested');
    assert.equal(customerInsert.body.setup_tier, 'standard');
    assert.match(customerInsert.body.intake_token_hash, /^[a-f0-9]{64}$/);
    assert.match(customerInsert.body.intake_token_created_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(JSON.stringify(customerInsert.body.metadata).includes(customerInsert.body.intake_token_hash), false);

    const kickoffEmail = calls.find((call) => call.url === 'https://api.resend.com/emails' && call.body?.subject === 'Next steps for Example Marathon');
    assert.ok(kickoffEmail);
    assert.match(kickoffEmail.body.text, /Open Launch Readiness Checklist: https:\/\/startlinesites\.com\/intake\?source=kickoff&token=[A-Za-z0-9_-]{32,200}/);
    assert.match(kickoffEmail.body.text, /Review the Asset Hub: https:\/\/startlinesites\.com\/asset-checklist/);
    assert.match(kickoffEmail.body.text, /Open access guides: https:\/\/startlinesites\.com\/access-guides/);
    assert.match(kickoffEmail.body.html, /Launch Readiness Kit/);
    assert.match(kickoffEmail.body.html, /Open Launch Readiness Checklist/);
    const rawToken = kickoffEmail.body.text.match(/token=([A-Za-z0-9_-]{32,200})/)?.[1];
    assert.ok(rawToken);
    assert.equal(hashIntakeToken(rawToken), customerInsert.body.intake_token_hash);
    assert.doesNotMatch(JSON.stringify(customerInsert.body), new RegExp(rawToken));
    assert.doesNotMatch(JSON.stringify(kickoffEmail.body), /intake_token_hash|stripe_customer_id|cus_123|pi_123/);

    const kickoffUpdate = calls.find((call) => call.url.includes('/customer_records?id=eq.customer-123') && call.method === 'PATCH');
    assert.equal(kickoffUpdate.body.kickoff_status, 'started');
    assert.equal(kickoffUpdate.body.intake_status, 'sent');
    assert.equal(kickoffUpdate.body.launch_readiness_status, 'sent');
    assert.match(kickoffUpdate.body.launch_readiness_sent_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(kickoffUpdate.body.launch_readiness_updated_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(kickoffUpdate.body.metadata.kickoff_email.template, 'depositKickoff');
    assert.equal(kickoffUpdate.body.metadata.kickoff_email.provider, 'resend');
    assert.equal(kickoffUpdate.body.metadata.kickoff_email.provider_message_id, 'email-123');
    assert.equal(kickoffUpdate.body.metadata.kickoff_email.access_guides_url, 'https://startlinesites.com/access-guides');
    assert.doesNotMatch(JSON.stringify(kickoffUpdate.body.metadata), /service-role|re_test|whsec|intake_token_hash|cus_123|pi_123/);
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
});

test('webhook handler skips Launch Readiness Kit resend when customer record was already sent', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const calls = [];
  const secret = 'whsec_test';
  const stripeEvent = {
    id: 'evt_standard_paid_second_event',
    type: 'checkout.session.completed',
    created: 1_700_000_000,
    livemode: false,
    data: {
      object: {
        id: 'cs_standard_existing_sent',
        mode: 'payment',
        payment_status: 'paid',
        amount_total: 125_000,
        currency: 'usd',
        customer: 'cus_789',
        payment_intent: 'pi_789',
        customer_details: { email: 'director@example.com', name: 'Race Director' },
        metadata: { startline_payment_type: 'deposit', setup_tier: 'standard', audit_request_id: 'audit-789' },
      },
    },
  };
  const rawBody = JSON.stringify(stripeEvent);

  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS = '999999999';
  process.env.RESEND_API_KEY = 're_test';
  process.env.STARTLINE_INTAKE_FORM_URL = 'https://startlinesites.com/intake?source=kickoff';
  process.env.STARTLINE_ASSET_CHECKLIST_URL = 'https://startlinesites.com/asset-checklist';

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });

    if (String(url).includes('/stripe_webhook_events') && options.method === 'POST') {
      return new Response(JSON.stringify([{ id: 'webhook-row-second-event' }]), { status: 201 });
    }
    if (String(url).includes('/audit_requests?id=eq.audit-789') && (options.method || 'GET') === 'GET') {
      return new Response(JSON.stringify([{
        id: 'audit-789',
        race_name: 'Already Sent Marathon',
        current_url: 'https://example.com',
        contact_name: 'Race Director',
        contact_email: 'director@example.com',
        metadata: { selected_package: { tier: 'standard' } },
      }]), { status: 200 });
    }
    if (String(url).includes('/customer_records?select=') && String(url).includes('stripe_checkout_session_id=eq.cs_standard_existing_sent')) {
      return new Response(JSON.stringify([{
        id: 'customer-existing-sent',
        intake_token_hash: 'b'.repeat(64),
        intake_token_created_at: '2026-07-01T00:00:00.000Z',
        intake_status: 'sent',
        launch_readiness_status: 'sent',
        launch_readiness_sent_at: '2026-07-01T00:00:00.000Z',
        metadata: { kickoff_email: { sent_at: '2026-07-01T00:00:00.000Z', provider_message_id: 'email-original' } },
      }]), { status: 200 });
    }
    if (String(url).includes('/audit_requests?id=eq.audit-789') && options.method === 'PATCH') {
      return new Response('', { status: 200 });
    }
    if (String(url).includes('/customer_records') && options.method === 'POST') {
      return new Response(JSON.stringify([{
        id: 'customer-existing-sent',
        primary_contact_email: 'director@example.com',
        race_name: 'Already Sent Marathon',
        primary_contact_name: 'Race Director',
        launch_readiness_status: 'ready_to_send',
        metadata: { stripe_deposit: { checkout_session_id: 'cs_standard_existing_sent' } },
      }]), { status: 201 });
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
    assert.equal(calls.some((call) => call.url === 'https://api.resend.com/emails' && call.body?.subject === 'Next steps for Already Sent Marathon'), false);
    assert.equal(calls.some((call) => call.url.includes('/customer_records?id=eq.customer-existing-sent') && call.method === 'PATCH'), false);
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
});

test('webhook handler preserves an existing intake token hash on checkout reprocessing', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const calls = [];
  const secret = 'whsec_test';
  const existingHash = 'a'.repeat(64);
  const stripeEvent = {
    id: 'evt_standard_paid_reprocess',
    type: 'checkout.session.completed',
    created: 1_700_000_000,
    livemode: false,
    data: {
      object: {
        id: 'cs_standard_reprocess',
        mode: 'payment',
        payment_status: 'paid',
        amount_total: 125_000,
        currency: 'usd',
        customer: 'cus_456',
        payment_intent: 'pi_456',
        customer_details: { email: 'director@example.com', name: 'Race Director' },
        metadata: { startline_payment_type: 'deposit', setup_tier: 'standard', audit_request_id: 'audit-456' },
      },
    },
  };
  const rawBody = JSON.stringify(stripeEvent);

  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS = '999999999';
  delete process.env.RESEND_API_KEY;
  delete process.env.STARTLINE_RESEND_API_KEY;

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });

    if (String(url).includes('/stripe_webhook_events') && options.method === 'POST') {
      return new Response(JSON.stringify([{ id: 'webhook-row-reprocess' }]), { status: 201 });
    }
    if (String(url).includes('/audit_requests?id=eq.audit-456') && (options.method || 'GET') === 'GET') {
      return new Response(JSON.stringify([{
        id: 'audit-456',
        race_name: 'Replay Marathon',
        current_url: 'https://example.com',
        contact_name: 'Race Director',
        contact_email: 'director@example.com',
        metadata: { selected_package: { tier: 'standard' } },
      }]), { status: 200 });
    }
    if (String(url).includes('/customer_records?select=') && String(url).includes('stripe_checkout_session_id=eq.cs_standard_reprocess')) {
      return new Response(JSON.stringify([{
        id: 'customer-existing',
        intake_token_hash: existingHash,
        intake_token_created_at: '2026-07-01T00:00:00.000Z',
        intake_status: 'sent',
      }]), { status: 200 });
    }
    if (String(url).includes('/audit_requests?id=eq.audit-456') && options.method === 'PATCH') {
      return new Response('', { status: 200 });
    }
    if (String(url).includes('/customer_records') && options.method === 'POST') {
      return new Response(JSON.stringify([{ id: 'customer-existing', primary_contact_email: 'director@example.com', race_name: 'Replay Marathon', primary_contact_name: 'Race Director' }]), { status: 201 });
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
    const customerUpsert = calls.find((call) => call.url.includes('/customer_records?on_conflict=') && call.method === 'POST');
    assert.ok(customerUpsert);
    assert.equal(Object.hasOwn(customerUpsert.body, 'intake_token_hash'), false);
    assert.equal(Object.hasOwn(customerUpsert.body, 'intake_token_created_at'), false);
    assert.doesNotMatch(JSON.stringify(customerUpsert.body), new RegExp(existingHash));
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
});
