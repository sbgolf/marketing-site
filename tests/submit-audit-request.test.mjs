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
  delete process.env.STRIPE_SECRET_KEY;

  global.fetch = async (url, options = {}) => {
    const call = {
      url: String(url),
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : null,
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
    assert.equal(insert.body.metadata.selected_package.tier, 'starter');

    const emailCalls = calls.filter((call) => call.url === 'https://api.resend.com/emails');
    assert.equal(emailCalls.length, 2);
    assert.deepEqual(emailCalls[0].body.to, ['steve@example.com']);
    assert.deepEqual(emailCalls[1].body.to, ['director@example.com']);
    assert.equal(emailCalls[1].body.reply_to, 'support@startlinesites.com');
    assert.match(emailCalls[1].body.text, /we received the private StartLine Sites audit request/);
    assert.match(emailCalls[1].body.text, /pay the setup deposit here: https:\/\/buy\.stripe\.com/);
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
  delete process.env.STRIPE_SECRET_KEY;

  global.fetch = async (url, options = {}) => {
    const call = {
      url: String(url),
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : null,
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

test('submit-audit-request works when Resend is not configured', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const calls = [];

  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  delete process.env.RESEND_API_KEY;
  delete process.env.STARTLINE_RESEND_API_KEY;
  delete process.env.STRIPE_SECRET_KEY;

  global.fetch = async (url, options = {}) => {
    const call = {
      url: String(url),
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : null,
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
