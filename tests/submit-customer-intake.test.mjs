import test from 'node:test';
import assert from 'node:assert/strict';

import { handler } from '../netlify/functions/submit-customer-intake.mjs';

const validPayload = (overrides = {}) => ({
  organization_name: 'Example Race Events',
  race_name: 'Example Marathon',
  contact_name: 'Race Director',
  contact_email: 'director@example.com',
  contact_phone: '555-0100',
  event_date: '2026-10-18',
  event_location: 'Example City, OR',
  template_preference: 'Destination Major',
  distances_pricing: 'Marathon $120, Half Marathon $95, 5K $35.',
  registration_url: 'https://runsignup.com/example-marathon',
  registration_platform: 'RunSignup',
  course_logistics: 'Loop course from downtown with aid every 2 miles.',
  bq_certification: 'USATF certified and Boston qualifier.',
  race_schedule: 'Expo Saturday, marathon Sunday at 7:00 AM.',
  sponsors: 'Example Running Store, Example Health.',
  faqs: 'Are headphones allowed? Yes where safe. Is there gear check? Yes.',
  assets_link: 'https://drive.google.com/drive/folders/example',
  analytics_access_notes: 'GA4 access can be shared after kickoff.',
  optional_notes: 'Please use generic placeholder copy where details are missing.',
  landing_page: 'https://startlinesites.com/intake',
  referrer: 'https://startlinesites.com/',
  company_website: '',
  ...overrides,
});

const validEvent = (body = {}) => ({
  httpMethod: 'POST',
  headers: {
    'user-agent': 'node-test',
    'x-nf-client-connection-ip': '203.0.113.20',
  },
  body: JSON.stringify(validPayload(body)),
});

const parseRequestBody = (body) => {
  if (!body) return null;
  return JSON.parse(body);
};

const withEnvAndFetch = async (fetchImpl, callback) => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.RESEND_API_KEY = 're_test';
  process.env.STARTLINE_NOTIFY_FROM = 'StartLine Sites <hello@startlinesites.com>';
  process.env.STARTLINE_LEAD_NOTIFY_EMAIL = 'support@startlinesites.com';
  process.env.STARTLINE_ADMIN_EMAIL = 'admin@startlinesites.com';
  process.env.STARTLINE_KICKOFF_REPLY_TO = 'kickoff@startlinesites.com';
  global.fetch = fetchImpl;
  try {
    await callback();
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
};

test('submit-customer-intake stores intake and sends support plus customer emails', async () => {
  const calls = [];

  await withEnvAndFetch(async (url, options = {}) => {
    const call = {
      url: String(url),
      method: options.method || 'GET',
      body: options.body ? parseRequestBody(options.body) : null,
    };
    calls.push(call);

    if (call.url === 'https://supabase.example/rest/v1/customer_intake_submissions' && call.method === 'POST') {
      return new Response(JSON.stringify([{ id: 'intake-123' }]), { status: 201 });
    }
    if (call.url === 'https://api.resend.com/emails' && call.method === 'POST') {
      return new Response(JSON.stringify({ id: `email-${calls.length}` }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'unexpected call' }), { status: 500 });
  }, async () => {
    const response = await handler(validEvent());
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 201);
    assert.equal(body.ok, true);
    assert.equal(body.id, 'intake-123');
    assert.match(body.message, /intake/i);

    const insert = calls.find((call) => call.url.endsWith('/customer_intake_submissions') && call.method === 'POST');
    assert.equal(insert.body.race_name, 'Example Marathon');
    assert.equal(insert.body.contact_email, 'director@example.com');
    assert.equal(insert.body.registration_url, 'https://runsignup.com/example-marathon');
    assert.equal(insert.body.metadata.form_version, 'customer_intake_v1');
    assert.equal(insert.body.metadata.assets_link, 'https://drive.google.com/drive/folders/example');
    assert.equal(insert.body.metadata.submitted_from, 'startlinesites.com/intake');

    const emailCalls = calls.filter((call) => call.url === 'https://api.resend.com/emails');
    assert.equal(emailCalls.length, 2);
    assert.deepEqual(emailCalls[0].body.to, ['support@startlinesites.com']);
    assert.match(emailCalls[0].body.subject, /New StartLine customer intake: Example Marathon/);
    assert.match(emailCalls[0].body.text, /RunSignup/);
    assert.deepEqual(emailCalls[1].body.to, ['director@example.com']);
    assert.equal(emailCalls[1].body.reply_to, 'kickoff@startlinesites.com');
    assert.match(emailCalls[1].body.text, /20–30 minute intake/);
    assert.match(emailCalls[1].body.text, /asset checklist/i);
  });
});

test('submit-customer-intake returns validation errors for required fields', async () => {
  await withEnvAndFetch(async () => {
    throw new Error('fetch should not be called for invalid intake');
  }, async () => {
    const response = await handler(validEvent({ race_name: '', contact_email: 'not-an-email', registration_url: 'not-a-url' }));
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 422);
    assert.equal(body.ok, false);
    assert.equal(body.fields.race_name, 'Race name is required.');
    assert.equal(body.fields.contact_email, 'A valid contact email is required.');
    assert.equal(body.fields.registration_url, 'A valid registration URL is required.');
  });
});

test('submit-customer-intake quietly accepts honeypot spam without persistence or email', async () => {
  const calls = [];

  await withEnvAndFetch(async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    return new Response(JSON.stringify({ error: 'unexpected call' }), { status: 500 });
  }, async () => {
    const response = await handler(validEvent({ company_website: 'https://spam.example' }));
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(calls.length, 0);
  });
});

test('customer intake email failures do not fail persisted submission', async () => {
  const calls = [];
  const originalConsoleError = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args);

  try {
    await withEnvAndFetch(async (url, options = {}) => {
      const call = {
        url: String(url),
        method: options.method || 'GET',
        body: options.body ? parseRequestBody(options.body) : null,
      };
      calls.push(call);

      if (call.url === 'https://supabase.example/rest/v1/customer_intake_submissions' && call.method === 'POST') {
        return new Response(JSON.stringify([{ id: 'intake-456' }]), { status: 201 });
      }
      if (call.url === 'https://api.resend.com/emails' && call.method === 'POST') {
        return new Response('temporary resend failure', { status: 503 });
      }

      return new Response(JSON.stringify({ error: 'unexpected call' }), { status: 500 });
    }, async () => {
      const response = await handler(validEvent());
      const body = JSON.parse(response.body);

      assert.equal(response.statusCode, 201);
      assert.equal(body.ok, true);
      assert.equal(body.id, 'intake-456');
      assert.equal(calls.filter((call) => call.url === 'https://api.resend.com/emails').length, 2);
      assert.equal(errors[0][0], 'Customer intake support notification failed');
      assert.equal(errors[1][0], 'Customer intake confirmation failed');
    });
  } finally {
    console.error = originalConsoleError;
  }
});

test('submit-customer-intake supports OPTIONS preflight', async () => {
  const response = await handler({ httpMethod: 'OPTIONS', headers: {}, body: '' });
  assert.equal(response.statusCode, 204);
});
