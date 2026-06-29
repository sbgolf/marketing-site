import test from 'node:test';
import assert from 'node:assert/strict';

import { handler } from '../netlify/functions/submit-audit-request.mjs';

const validEvent = (body = {}) => ({
  httpMethod: 'POST',
  headers: {
    'user-agent': 'node-test',
    'x-nf-client-connection-ip': '203.0.113.10',
  },
  body: JSON.stringify({
    race_name: 'Example Marathon',
    current_url: 'https://examplemarathon.com',
    contact_name: 'Race Director',
    contact_email: 'director@example.com',
    package_tier: 'starter',
    notes: 'Race is in October and uses RunSignup.',
    landing_page: 'https://startlinesites.com/#audit',
    referrer: 'https://google.com',
    ...body,
  }),
});

const parseRequestBody = (body) => {
  if (!body) return null;
  if (body instanceof URLSearchParams) return Object.fromEntries(body.entries());
  return JSON.parse(body);
};

test('submit-audit-request stores notes and sends admin plus customer confirmation emails', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const calls = [];

  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.RESEND_API_KEY = 're_test';
  process.env.STARTLINE_NOTIFY_FROM = 'StartLine Sites <hello@startlinesites.com>';
  process.env.STARTLINE_ADMIN_EMAIL = 'steve@example.com';
  process.env.STARTLINE_KICKOFF_REPLY_TO = 'support@startlinesites.com';
  delete process.env['STRIPE_SECRET_KEY'];

  global.fetch = async (url, options = {}) => {
    const call = {
      url: String(url),
      method: options.method || 'GET',
      body: options.body ? parseRequestBody(options.body) : null,
    };
    calls.push(call);

    if (call.url.includes('/audit_requests') && call.method === 'POST') {
      return new Response(JSON.stringify([{ id: 'audit-123' }]), { status: 201 });
    }
    if (call.url === 'https://api.resend.com/emails' && call.method === 'POST') {
      return new Response(JSON.stringify({ id: `email-${calls.length}` }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'unexpected call' }), { status: 500 });
  };

  try {
    const response = await handler(validEvent());
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 201);
    assert.equal(body.ok, true);
    assert.equal(body.id, 'audit-123');
    assert.equal(body.checkout_url_source, 'static_payment_link');

    const insert = calls.find((call) => call.url.includes('/audit_requests') && call.method === 'POST');
    assert.equal(insert.body.notes, 'Race is in October and uses RunSignup.');
    assert.equal(insert.body.status, 'queued_for_site_review');
    assert.equal(insert.body.outreach_status, 'steve_approval_required');
    assert.equal(insert.body.metadata.audit_workflow.current_url_scrape_status, 'queued');
    assert.equal(insert.body.metadata.audit_workflow.steve_approval_status, 'required_before_customer_delivery');
    assert.equal(insert.body.metadata.audit_workflow.customer_delivery_status, 'blocked_until_steve_approval');
    assert.equal(insert.body.metadata.audit_workflow.automation_scope, 'internal_draft_only_no_customer_send');
    assert.equal(insert.body.metadata.selected_package.tier, 'starter');

    const emailCalls = calls.filter((call) => call.url === 'https://api.resend.com/emails');
    assert.equal(emailCalls.length, 2);
    assert.deepEqual(emailCalls[0].body.to, ['steve@example.com']);
    assert.deepEqual(emailCalls[1].body.to, ['director@example.com']);
    assert.equal(emailCalls[1].body.reply_to, 'support@startlinesites.com');
    assert.match(emailCalls[0].body.text, /Owner-approved workflow foundation/);
    assert.match(emailCalls[0].body.text, /Steve approval is required before any findings/);
    assert.match(emailCalls[0].body.html, /Agent-audit workflow foundation/);
    assert.match(emailCalls[1].body.text, /we received the private StartLine Sites audit request/);
    assert.match(emailCalls[1].body.text, /Steve reviews the findings before your response is sent/);
    assert.match(emailCalls[1].body.text, /pay the first-year package deposit here: https:\/\/buy\.stripe\.com/);
    assert.doesNotMatch(emailCalls[1].body.text, /agent|\bAI\b|scrape/i);
    assert.match(emailCalls[1].body.html, /Your private audit request is in/);
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
});

test('customer confirmation failure does not fail audit submission', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const calls = [];

  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.RESEND_API_KEY = 're_test';
  process.env.STARTLINE_ADMIN_EMAIL = 'steve@example.com';
  delete process.env['STRIPE_SECRET_KEY'];

  global.fetch = async (url, options = {}) => {
    const call = {
      url: String(url),
      method: options.method || 'GET',
      body: options.body ? parseRequestBody(options.body) : null,
    };
    calls.push(call);

    if (call.url.includes('/audit_requests') && call.method === 'POST') {
      return new Response(JSON.stringify([{ id: 'audit-456' }]), { status: 201 });
    }
    if (call.url === 'https://api.resend.com/emails' && call.method === 'POST') {
      const isCustomerEmail = call.body.to?.includes('director@example.com');
      return isCustomerEmail
        ? new Response('temporary resend failure', { status: 503 })
        : new Response(JSON.stringify({ id: 'admin-email' }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'unexpected call' }), { status: 500 });
  };

  try {
    const response = await handler(validEvent({ package_tier: 'premium' }));
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 201);
    assert.equal(body.ok, true);
    assert.equal(body.checkout_url, null);
    assert.equal(body.checkout_url_source, null);
    assert.equal(calls.filter((call) => call.url === 'https://api.resend.com/emails').length, 2);
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
});

test('submit-audit-request quietly accepts honeypot spam without persistence or email', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const calls = [];

  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.RESEND_API_KEY = 're_test';
  delete process.env['STRIPE_SECRET_KEY'];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    return new Response(JSON.stringify({ error: 'honeypot should not call downstream services' }), { status: 500 });
  };

  try {
    const response = await handler(validEvent({ company_website: 'https://spam.example' }));
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(calls.length, 0);
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
});

test('submit-audit-request works when Resend is not configured', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const calls = [];

  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  delete process.env.RESEND_API_KEY;
  delete process.env.STARTLINE_RESEND_API_KEY;
  delete process.env['STRIPE_SECRET_KEY'];

  global.fetch = async (url, options = {}) => {
    const call = {
      url: String(url),
      method: options.method || 'GET',
      body: options.body ? parseRequestBody(options.body) : null,
    };
    calls.push(call);

    if (call.url.includes('/audit_requests') && call.method === 'POST') {
      return new Response(JSON.stringify([{ id: 'audit-789' }]), { status: 201 });
    }

    return new Response(JSON.stringify({ error: 'unexpected call' }), { status: 500 });
  };

  try {
    const response = await handler(validEvent({ package_tier: '' }));
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 201);
    assert.equal(body.ok, true);
    assert.equal(calls.filter((call) => call.url === 'https://api.resend.com/emails').length, 0);
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
});

test('submit-audit-request persists dynamic Stripe Checkout Session metadata to audit_requests', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const calls = [];

  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.STRIPE_SECRET_KEY = 'sk_test_dynamic';
  delete process.env.RESEND_API_KEY;
  delete process.env.STARTLINE_RESEND_API_KEY;

  global.fetch = async (url, options = {}) => {
    const call = {
      url: String(url),
      method: options.method || 'GET',
      body: options.body ? parseRequestBody(options.body) : null,
    };
    calls.push(call);

    if (call.url.includes('/audit_requests') && call.method === 'POST') {
      return new Response(JSON.stringify([{ id: 'audit-dynamic-123' }]), { status: 201 });
    }
    if (call.url === 'https://api.stripe.com/v1/checkout/sessions' && call.method === 'POST') {
      return new Response(JSON.stringify({
        id: 'cs_test_dynamic_123',
        url: 'https://checkout.stripe.com/c/pay/cs_test_dynamic_123',
      }), { status: 200 });
    }
    if (call.url === 'https://supabase.example/rest/v1/audit_requests?id=eq.audit-dynamic-123' && call.method === 'PATCH') {
      return new Response(null, { status: 204 });
    }

    return new Response(JSON.stringify({ error: 'unexpected call' }), { status: 500 });
  };

  try {
    const response = await handler(validEvent({ package_tier: 'standard' }));
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 201);
    assert.equal(body.ok, true);
    assert.equal(body.checkout_url, 'https://checkout.stripe.com/c/pay/cs_test_dynamic_123');
    assert.equal(body.checkout_url_source, 'dynamic_checkout_session');

    const stripeCall = calls.find((call) => call.url === 'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(stripeCall.body.client_reference_id, 'audit-dynamic-123');
    assert.equal(stripeCall.body['metadata[audit_request_id]'], 'audit-dynamic-123');

    const patch = calls.find((call) => call.url.includes('/audit_requests?id=eq.audit-dynamic-123') && call.method === 'PATCH');
    assert.equal(patch.body.stripe_checkout_session_id, 'cs_test_dynamic_123');
    assert.equal(patch.body.metadata.selected_package.tier, 'standard');
    assert.equal(patch.body.metadata.selected_package.checkout_session_id, 'cs_test_dynamic_123');
    assert.equal(patch.body.metadata.selected_package.url, 'https://checkout.stripe.com/c/pay/cs_test_dynamic_123');
    assert.equal(patch.body.metadata.selected_package.url_source, 'dynamic_checkout_session');
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
});

test('dynamic Checkout Session metadata patch failure does not fail audit submission', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;
  const calls = [];
  const errors = [];

  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.STRIPE_SECRET_KEY = 'sk_test_dynamic';
  delete process.env.RESEND_API_KEY;
  delete process.env.STARTLINE_RESEND_API_KEY;
  console.error = (...args) => errors.push(args);

  global.fetch = async (url, options = {}) => {
    const call = {
      url: String(url),
      method: options.method || 'GET',
      body: options.body ? parseRequestBody(options.body) : null,
    };
    calls.push(call);

    if (call.url.includes('/audit_requests') && call.method === 'POST') {
      return new Response(JSON.stringify([{ id: 'audit-patch-fails' }]), { status: 201 });
    }
    if (call.url === 'https://api.stripe.com/v1/checkout/sessions' && call.method === 'POST') {
      return new Response(JSON.stringify({
        id: 'cs_test_patch_failure',
        url: 'https://checkout.stripe.com/c/pay/cs_test_patch_failure',
      }), { status: 200 });
    }
    if (call.url.includes('/audit_requests?id=eq.audit-patch-fails') && call.method === 'PATCH') {
      return new Response('temporary supabase failure', { status: 503 });
    }

    return new Response(JSON.stringify({ error: 'unexpected call' }), { status: 500 });
  };

  try {
    const response = await handler(validEvent({ package_tier: 'starter' }));
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 201);
    assert.equal(body.ok, true);
    assert.equal(body.checkout_url, 'https://checkout.stripe.com/c/pay/cs_test_patch_failure');
    assert.equal(body.checkout_url_source, 'dynamic_checkout_session');
    assert.equal(calls.filter((call) => call.method === 'PATCH').length, 1);
    assert.equal(errors[0][0], 'Checkout Session metadata persistence failed');
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});
