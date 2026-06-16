import test from 'node:test';
import assert from 'node:assert/strict';

const ORIGINAL_ENV = { ...process.env };

const restoreEnv = () => {
  process.env = { ...ORIGINAL_ENV };
};

const baseEnv = () => {
  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STARTLINE_LAUNCH_BILLING_TOKEN = 'launch-token';
};

const event = ({ body = { customer_record_id: 'customer-record-1' }, token = 'launch-token', method = 'POST' } = {}) => ({
  httpMethod: method,
  headers: { authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
});

const paidCustomer = (overrides = {}) => ({
  id: 'customer-record-1',
  race_name: 'River Run 10K',
  setup_tier: 'standard',
  monthly_tier: 'growth',
  deposit_status: 'paid',
  final_invoice_status: 'not_sent',
  stripe_customer_id: 'cus_123',
  final_invoice_amount_cents: 125000,
  monthly_amount_cents: 24900,
  currency: 'usd',
  metadata: { existing: true },
  ...overrides,
});

const installFetchMock = ({ customer = paidCustomer(), invoice = { id: 'in_123', status: 'open', hosted_invoice_url: 'https://stripe.example/in_123' } } = {}) => {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/rest/v1/customer_records?')) {
      if (options.method === 'PATCH') return new Response(null, { status: 204 });
      return new Response(JSON.stringify([customer]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (String(url) === 'https://api.stripe.com/v1/invoices') {
      const params = new URLSearchParams(options.body);
      assert.equal(params.get('customer'), 'cus_123');
      assert.equal(params.get('collection_method'), 'send_invoice');
      assert.equal(params.get('days_until_due'), '7');
      assert.equal(params.get('pending_invoice_items_behavior'), 'include');
      assert.equal(params.get('metadata[startline_payment_type]'), 'final_invoice');
      assert.equal(params.get('metadata[customer_record_id]'), 'customer-record-1');
      return new Response(JSON.stringify(invoice), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (String(url).startsWith('https://api.stripe.com/v1/invoiceitems')) {
      const params = new URLSearchParams(options.body);
      assert.equal(params.get('customer'), 'cus_123');
      assert.equal(params.get('amount'), '125000');
      assert.equal(params.get('currency'), 'usd');
      assert.match(params.get('description'), /Final 50% setup payment/);
      return new Response(JSON.stringify({ id: 'ii_123' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (String(url) === 'https://api.stripe.com/v1/invoices/in_123/send') {
      return new Response(JSON.stringify({ ...invoice, status: 'open' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`Unexpected fetch ${url}`);
  };
  return calls;
};

test.afterEach(() => {
  restoreEnv();
  delete global.fetch;
});

test('start launch billing creates and sends final invoice, then updates customer record', async () => {
  baseEnv();
  const { handler } = await import('../netlify/functions/start-launch-billing.mjs');
  const calls = installFetchMock();

  const response = await handler(event());
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.stripe_final_invoice_id, 'in_123');
  assert.equal(body.customer_record_id, 'customer-record-1');

  const update = calls.find((call) => call.options.method === 'PATCH');
  assert.ok(update, 'expected Supabase customer_records PATCH');
  const patch = JSON.parse(update.options.body);
  assert.equal(patch.customer_status, 'launch_billing');
  assert.equal(patch.final_invoice_status, 'sent');
  assert.equal(patch.stripe_final_invoice_id, 'in_123');
  assert.ok(patch.final_invoice_sent_at);
  assert.equal(patch.metadata.launch_billing.stripe_final_invoice_id, 'in_123');
});

test('start launch billing rejects missing bearer token before side effects', async () => {
  baseEnv();
  const { handler } = await import('../netlify/functions/start-launch-billing.mjs');
  let fetched = false;
  global.fetch = async () => {
    fetched = true;
    throw new Error('should not fetch');
  };

  const response = await handler(event({ token: 'wrong' }));

  assert.equal(response.statusCode, 401);
  assert.equal(JSON.parse(response.body).ok, false);
  assert.equal(fetched, false);
});

test('start launch billing validates env, method, payload, deposit and idempotency', async () => {
  const { handler } = await import('../netlify/functions/start-launch-billing.mjs');

  restoreEnv();
  assert.equal((await handler(event())).statusCode, 500);

  baseEnv();
  assert.equal((await handler(event({ method: 'GET' }))).statusCode, 405);
  assert.equal((await handler(event({ body: {} }))).statusCode, 400);

  installFetchMock({ customer: paidCustomer({ deposit_status: 'not_paid' }) });
  assert.equal((await handler(event())).statusCode, 409);

  installFetchMock({ customer: paidCustomer({ final_invoice_status: 'sent', stripe_final_invoice_id: 'in_existing' }) });
  const existing = await handler(event());
  assert.equal(existing.statusCode, 200);
  assert.equal(JSON.parse(existing.body).status, 'already_sent');
});
