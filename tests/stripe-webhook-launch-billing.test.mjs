import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

const ORIGINAL_ENV = { ...process.env };

const restoreEnv = () => {
  process.env = { ...ORIGINAL_ENV };
};

const configureEnv = () => {
  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
};

const signEvent = (payload, timestamp = Math.floor(Date.now() / 1000)) => {
  const rawBody = JSON.stringify(payload);
  const signature = createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  return {
    httpMethod: 'POST',
    headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` },
    body: rawBody,
  };
};

const invoicePaidEvent = (overrides = {}) => ({
  id: 'evt_invoice_paid_final',
  type: 'invoice.paid',
  created: 1781611200,
  livemode: false,
  data: {
    object: {
      id: 'in_final_123',
      customer: 'cus_123',
      status: 'paid',
      metadata: {
        startline_payment_type: 'final_invoice',
        customer_record_id: 'customer-record-1',
        setup_tier: 'standard',
        race_name: 'River Run 10K',
      },
      ...overrides,
    },
  },
});

const customerRecord = (overrides = {}) => ({
  id: 'customer-record-1',
  race_name: 'River Run 10K',
  setup_tier: 'standard',
  monthly_tier: 'growth',
  deposit_status: 'paid',
  final_invoice_status: 'sent',
  subscription_status: 'not_started',
  stripe_customer_id: 'cus_123',
  stripe_final_invoice_id: 'in_final_123',
  final_invoice_amount_cents: 125000,
  monthly_amount_cents: 24900,
  currency: 'usd',
  metadata: { existing: true },
  ...overrides,
});

const installWebhookFetchMock = ({ customer = customerRecord(), subscription = { id: 'sub_123', status: 'active' } } = {}) => {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url) === 'https://supabase.example/rest/v1/stripe_webhook_events') {
      return new Response(JSON.stringify([{ id: 'webhook-row-1' }]), { status: 201, headers: { 'content-type': 'application/json' } });
    }
    if (String(url).includes('/rest/v1/stripe_webhook_events?')) {
      return new Response(null, { status: 204 });
    }
    if (String(url).includes('/rest/v1/customer_records?') && options.method !== 'PATCH') {
      return new Response(JSON.stringify([customer]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (String(url).includes('/rest/v1/customer_records?') && options.method === 'PATCH') {
      return new Response(null, { status: 204 });
    }
    if (String(url) === 'https://api.stripe.com/v1/subscriptions') {
      const params = new URLSearchParams(options.body);
      assert.equal(params.get('customer'), 'cus_123');
      assert.equal(params.get('items[0][price_data][currency]'), 'usd');
      assert.equal(params.get('items[0][price_data][unit_amount]'), '24900');
      assert.equal(params.get('items[0][price_data][recurring][interval]'), 'month');
      assert.equal(params.get('collection_method'), 'send_invoice');
      assert.equal(params.get('days_until_due'), '7');
      assert.equal(params.get('metadata[startline_payment_type]'), 'monthly_subscription');
      assert.equal(params.get('metadata[customer_record_id]'), 'customer-record-1');
      return new Response(JSON.stringify(subscription), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`Unexpected fetch ${url}`);
  };
  return calls;
};

test.afterEach(() => {
  restoreEnv();
  delete global.fetch;
});

test('stripe webhook processes final invoice.paid and leaves legacy monthly subscription dormant by default', async () => {
  configureEnv();
  const { handler } = await import('../netlify/functions/stripe-webhook.mjs');
  const calls = installWebhookFetchMock();

  const response = await handler(signEvent(invoicePaidEvent()));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.status, 'processed');
  assert.equal(body.customer_record_id, 'customer-record-1');
  assert.equal(body.subscription_status, 'dormant');
  assert.equal(body.monthly_subscription_reason, 'legacy_monthly_subscription_automation_disabled');
  assert.equal(calls.some((call) => call.url === 'https://api.stripe.com/v1/subscriptions'), false);

  const patches = calls
    .filter((call) => call.options.method === 'PATCH' && call.url.includes('/rest/v1/customer_records?'))
    .map((call) => JSON.parse(call.options.body));
  assert.equal(patches.length, 2);
  assert.equal(patches[0].final_invoice_status, 'paid');
  assert.ok(patches[0].final_invoice_paid_at);
  assert.equal(patches[1].customer_status, 'active');
  assert.equal(patches[1].subscription_status, 'dormant');
  assert.equal(patches[1].metadata.monthly_subscription.status, 'dormant');
});

test('stripe webhook starts legacy monthly subscription only when enabled and recurring service is approved', async () => {
  configureEnv();
  process.env.STARTLINE_ENABLE_LEGACY_MONTHLY_SUBSCRIPTIONS = 'true';
  const { handler } = await import('../netlify/functions/stripe-webhook.mjs');
  const calls = installWebhookFetchMock({ customer: customerRecord({ metadata: { recurring_service_approved: true } }) });

  const response = await handler(signEvent(invoicePaidEvent()));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.status, 'processed');
  assert.equal(body.customer_record_id, 'customer-record-1');
  assert.equal(body.stripe_subscription_id, 'sub_123');

  const patches = calls
    .filter((call) => call.options.method === 'PATCH' && call.url.includes('/rest/v1/customer_records?'))
    .map((call) => JSON.parse(call.options.body));
  assert.equal(patches.length, 2);
  assert.equal(patches[0].final_invoice_status, 'paid');
  assert.ok(patches[0].final_invoice_paid_at);
  assert.equal(patches[1].customer_status, 'active');
  assert.equal(patches[1].subscription_status, 'active');
  assert.equal(patches[1].stripe_subscription_id, 'sub_123');
  assert.ok(patches[1].first_monthly_report_due_at);
});

test('stripe webhook ignores invoice.paid events that are not StartLine final invoices', async () => {
  configureEnv();
  const { handler } = await import('../netlify/functions/stripe-webhook.mjs');
  const calls = installWebhookFetchMock();
  const event = invoicePaidEvent({ metadata: { startline_payment_type: 'other' } });

  const response = await handler(signEvent(event));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.status, 'ignored');
  assert.equal(body.reason, 'not_final_invoice');
  assert.equal(calls.some((call) => call.url === 'https://api.stripe.com/v1/subscriptions'), false);
  assert.equal(calls.some((call) => call.url.includes('/rest/v1/customer_records?') && call.options.method === 'PATCH'), false);
});

test('stripe webhook marks final invoice paid processing failed when subscription creation fails', async () => {
  configureEnv();
  process.env.STARTLINE_ENABLE_LEGACY_MONTHLY_SUBSCRIPTIONS = 'true';
  const { handler } = await import('../netlify/functions/stripe-webhook.mjs');
  const calls = installWebhookFetchMock();
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url) === 'https://api.stripe.com/v1/subscriptions') {
      return new Response(JSON.stringify({ error: { message: 'card problem' } }), { status: 402, headers: { 'content-type': 'application/json' } });
    }
    if (String(url) === 'https://supabase.example/rest/v1/stripe_webhook_events') {
      return new Response(JSON.stringify([{ id: 'webhook-row-1' }]), { status: 201, headers: { 'content-type': 'application/json' } });
    }
    if (String(url).includes('/rest/v1/stripe_webhook_events?')) return new Response(null, { status: 204 });
    if (String(url).includes('/rest/v1/customer_records?') && options.method !== 'PATCH') {
      return new Response(JSON.stringify([customerRecord({ metadata: { recurring_service_approved: true } })]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (String(url).includes('/rest/v1/customer_records?') && options.method === 'PATCH') return new Response(null, { status: 204 });
    throw new Error(`Unexpected fetch ${url}`);
  };

  const response = await handler(signEvent(invoicePaidEvent()));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 500);
  assert.equal(body.ok, false);
  const customerFailurePatch = calls
    .filter((call) => call.url.includes('/rest/v1/customer_records?') && call.options.method === 'PATCH')
    .map((call) => JSON.parse(call.options.body))
    .find((patch) => patch.subscription_status === 'failed');
  assert.ok(customerFailurePatch, 'expected subscription_status failed patch');
});
