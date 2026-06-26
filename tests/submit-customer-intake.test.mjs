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
  event_timezone: 'America/Los_Angeles',
  current_domain: 'https://www.examplemarathon.com',
  template_preference: 'Destination Major',
  distances_pricing: 'Marathon $120, Half Marathon $95, 5K $35.',
  registration_url: 'https://runsignup.com/example-marathon',
  registration_platform: 'RunSignup',
  course_logistics: 'Loop course from downtown with aid every 2 miles.',
  bq_certification: 'USATF certified and Boston qualifier.',
  race_schedule: 'Expo Saturday, marathon Sunday at 7:00 AM.',
  sponsors: 'Example Running Store, Example Health.',
  faqs: 'Are headphones allowed? Yes where safe. Is there gear check? Yes.',
  volunteer_info: 'Volunteer signup opens in August.',
  email_capture: 'No email capture needed for launch.',
  identity_hero_image: 'finish-line-crowd.jpg',
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
    if (call.url.includes('https://supabase.example/rest/v1/customer_records?') && call.method === 'GET') {
      assert.match(call.url, /primary_contact_email|billing_contact_email/);
      assert.match(call.url, /race_name/);
      return new Response(JSON.stringify([
        {
          id: 'customer-123',
          race_name: 'Example Marathon',
          primary_contact_email: 'director@example.com',
          billing_contact_email: 'billing@example.com',
          customer_status: 'kickoff_ready',
          deposit_status: 'paid',
          intake_status: 'sent',
          kickoff_status: 'started',
          created_at: '2026-06-16T10:00:00Z',
        },
      ]), { status: 200 });
    }
    if (call.url === 'https://supabase.example/rest/v1/customer_records?id=eq.customer-123' && call.method === 'PATCH') {
      return new Response(JSON.stringify([{ id: 'customer-123' }]), { status: 200 });
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
    assert.equal(insert.body.metadata.event_timezone, 'America/Los_Angeles');
    assert.equal(insert.body.metadata.current_domain, 'https://www.examplemarathon.com');
    assert.equal(insert.body.metadata.derived_current_domain_host, 'examplemarathon.com');
    assert.equal(insert.body.metadata.volunteer_info, 'Volunteer signup opens in August.');
    assert.equal(insert.body.metadata.email_capture, 'No email capture needed for launch.');
    assert.equal(insert.body.metadata.identity_hero_image, 'finish-line-crowd.jpg');
    assert.equal(insert.body.metadata.submitted_from, 'startlinesites.com/intake');

    const update = calls.find((call) => call.url.endsWith('/customer_records?id=eq.customer-123') && call.method === 'PATCH');
    assert.equal(update.body.intake_status, 'received');
    assert.equal(update.body.customer_status, 'build_queued');
    assert.equal(update.body.build_status, 'ready_for_build');
    assert.equal(update.body.customer_intake_submission_id, 'intake-123');
    assert.equal(update.body.build_handoff_checklist.assets_link_present, true);
    assert.equal(update.body.build_handoff_checklist.event_timezone_present, true);
    assert.equal(update.body.build_handoff_checklist.current_domain_present, true);
    assert.equal(update.body.build_handoff_checklist.missing_critical_inputs.length, 0);

    const emailCalls = calls.filter((call) => call.url === 'https://api.resend.com/emails');
    assert.equal(emailCalls.length, 2);
    assert.deepEqual(emailCalls[0].body.to, ['support@startlinesites.com']);
    assert.match(emailCalls[0].body.subject, /New StartLine customer intake: Example Marathon/);
    assert.match(emailCalls[0].body.text, /Build handoff checklist/);
    assert.match(emailCalls[0].body.text, /Customer record ID: customer-123/);
    assert.match(emailCalls[0].body.text, /Missing critical inputs: None/);
    assert.match(emailCalls[0].body.text, /Suggested next steps/);
    assert.match(emailCalls[0].body.text, /RunSignup/);
    assert.match(emailCalls[0].body.text, /Current domain: https:\/\/www.examplemarathon.com/);
    assert.match(emailCalls[0].body.text, /Volunteer info: Volunteer signup opens in August/);
    assert.deepEqual(emailCalls[1].body.to, ['director@example.com']);
    assert.equal(emailCalls[1].body.reply_to, 'kickoff@startlinesites.com');
    assert.match(emailCalls[1].body.text, /20–30 minute intake/);
    assert.match(emailCalls[1].body.text, /asset checklist/i);
  });
});

test('submit-customer-intake does not fail when no matching customer record exists', async () => {
  const calls = [];
  const originalConsoleWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);

  try {
    await withEnvAndFetch(async (url, options = {}) => {
      const call = {
        url: String(url),
        method: options.method || 'GET',
        body: options.body ? parseRequestBody(options.body) : null,
      };
      calls.push(call);

      if (call.url === 'https://supabase.example/rest/v1/customer_intake_submissions' && call.method === 'POST') {
        return new Response(JSON.stringify([{ id: 'intake-no-match' }]), { status: 201 });
      }
      if (call.url.includes('https://supabase.example/rest/v1/customer_records?') && call.method === 'GET') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (call.url === 'https://api.resend.com/emails' && call.method === 'POST') {
        return new Response(JSON.stringify({ id: 'email' }), { status: 200 });
      }

      return new Response(JSON.stringify({ error: 'unexpected call' }), { status: 500 });
    }, async () => {
      const response = await handler(validEvent());
      const body = JSON.parse(response.body);

      assert.equal(response.statusCode, 201);
      assert.equal(body.ok, true);
      assert.equal(body.id, 'intake-no-match');
      assert.equal(calls.some((call) => call.method === 'PATCH' && call.url.includes('/customer_records')), false);
      assert.equal(warnings[0][0], 'Customer intake build handoff skipped: no matching customer record found');
      const supportEmail = calls.find((call) => call.url === 'https://api.resend.com/emails')?.body;
      assert.match(supportEmail.text, /Customer record ID: Not matched/);
    });
  } finally {
    console.warn = originalConsoleWarn;
  }
});

test('submit-customer-intake does not fail when matching customer record update fails', async () => {
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
        return new Response(JSON.stringify([{ id: 'intake-update-fail' }]), { status: 201 });
      }
      if (call.url.includes('https://supabase.example/rest/v1/customer_records?') && call.method === 'GET') {
        return new Response(JSON.stringify([{ id: 'customer-fail', race_name: 'Example Marathon', primary_contact_email: 'director@example.com', customer_status: 'kickoff_ready', deposit_status: 'paid', intake_status: 'sent', created_at: '2026-06-16T10:00:00Z' }]), { status: 200 });
      }
      if (call.url === 'https://supabase.example/rest/v1/customer_records?id=eq.customer-fail' && call.method === 'PATCH') {
        return new Response('temporary supabase failure', { status: 503 });
      }
      if (call.url === 'https://api.resend.com/emails' && call.method === 'POST') {
        return new Response(JSON.stringify({ id: 'email' }), { status: 200 });
      }

      return new Response(JSON.stringify({ error: 'unexpected call' }), { status: 500 });
    }, async () => {
      const response = await handler(validEvent());
      const body = JSON.parse(response.body);

      assert.equal(response.statusCode, 201);
      assert.equal(body.ok, true);
      assert.equal(body.id, 'intake-update-fail');
      assert.equal(errors[0][0], 'Customer intake build handoff update failed');
      const supportEmail = calls.find((call) => call.url === 'https://api.resend.com/emails')?.body;
      assert.match(supportEmail.text, /Customer record ID: customer-fail/);
    });
  } finally {
    console.error = originalConsoleError;
  }
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
      if (call.url.includes('https://supabase.example/rest/v1/customer_records?') && call.method === 'GET') {
        return new Response(JSON.stringify([]), { status: 200 });
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
