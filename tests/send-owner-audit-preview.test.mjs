import test from 'node:test';
import assert from 'node:assert/strict';

import { handler, validatePreviewReady } from '../netlify/functions/send-owner-audit-preview.mjs';

const event = (body = {}, headers = {}) => ({
  httpMethod: 'POST',
  headers: {
    authorization: 'Bearer owner-token',
    ...headers,
  },
  body: JSON.stringify({ audit_id: '31ffdc07-cf19-47d9-bad5-282e11ec19ac', ...body }),
});

const readyRecord = (overrides = {}) => ({
  id: '31ffdc07-cf19-47d9-bad5-282e11ec19ac',
  race_name: 'Ashland City Half Marathon',
  current_url: 'https://ashlandcityhalf.example',
  contact_name: 'Race Director',
  contact_email: 'director@example.com',
  private_mockup_url: 'https://mockups.startlinesites.com/private/mockups/abcdef1234567890abcdef1234567890/',
  metadata: {
    audit_workflow: {
      customer_delivery_status: 'blocked_until_steve_approval',
    },
  },
  top_opportunities: [
    {
      title: 'Make the registration CTA visible above the fold.',
      recommendation: 'Keep the next registration action obvious on mobile and desktop.',
    },
    {
      title: 'Clarify race-day logistics before runners leave the page.',
      recommendation: 'Move parking, packet pickup, and schedule answers into a scannable runner FAQ.',
    },
    {
      title: 'Add social proof near the decision point.',
      recommendation: 'Use sponsor/community trust signals near the registration path.',
    },
  ],
  audit_summary: {
    customer_ready_draft: 'Hi Race Director — here is the owner-reviewed draft once Steve approves final delivery.',
  },
  ...overrides,
});

const parseRequestBody = (body) => (body ? JSON.parse(body) : null);

const withEnvAndFetch = async (fn) => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const calls = [];

  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.STARTLINE_OWNER_AUDIT_PREVIEW_TOKEN = 'owner-token';
  process.env.RESEND_API_KEY = 'resend-test-key';
  process.env.STARTLINE_OWNER_PREVIEW_EMAIL = 'owner@example.com';
  process.env.STARTLINE_ADMIN_EMAIL = 'steve@example.com';
  process.env.STARTLINE_NOTIFY_FROM = 'StartLine Sites <support@startlinesites.com>';

  global.fetch = async (url, options = {}) => {
    const call = {
      url: String(url),
      method: options.method || 'GET',
      headers: options.headers || {},
      body: parseRequestBody(options.body),
    };
    calls.push(call);

    if (call.url.includes('/audit_requests?id=eq.31ffdc07-cf19-47d9-bad5-282e11ec19ac&select=*') && call.method === 'GET') {
      return new Response(JSON.stringify([readyRecord()]), { status: 200 });
    }
    if (call.url === 'https://api.resend.com/emails' && call.method === 'POST') {
      return new Response(JSON.stringify({ id: 'email-owner-preview-123' }), { status: 200 });
    }
    if (call.url.includes('/audit_requests?id=eq.31ffdc07-cf19-47d9-bad5-282e11ec19ac') && call.method === 'PATCH') {
      return new Response(null, { status: 204 });
    }

    return new Response(JSON.stringify({ error: 'unexpected call' }), { status: 500 });
  };

  try {
    await fn(calls);
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
};

test('validatePreviewReady requires both a customer-ready draft and top 3 findings', () => {
  assert.deepEqual(validatePreviewReady(readyRecord()).missing, []);
  assert.equal(validatePreviewReady(readyRecord({ audit_summary: { top_3_findings: ['One', 'Two', 'Three'] }, top_opportunities: [] })).ok, false);
  assert.deepEqual(
    validatePreviewReady(readyRecord({ audit_summary: { customer_ready_draft: 'Draft only', top_3_findings: ['One', 'Two'] }, top_opportunities: [] })).missing,
    ['top 3 findings'],
  );
});

test('send-owner-audit-preview sends owner/admin preview only and patches final approval gate', async () => {
  await withEnvAndFetch(async (calls) => {
    const response = await handler(event());
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.sent_to, 'owner@example.com');
    assert.equal(body.status, 'owner_preview_sent');
    assert.equal(body.outreach_status, 'final_approval_required');
    assert.equal(body.customer_delivery_status, 'blocked_until_final_approval');

    const emailCalls = calls.filter((call) => call.url === 'https://api.resend.com/emails');
    assert.equal(emailCalls.length, 1);
    assert.deepEqual(emailCalls[0].body.to, ['owner@example.com']);
    assert.equal(emailCalls[0].body.reply_to, undefined);
    assert.notDeepEqual(emailCalls[0].body.to, ['director@example.com']);
    assert.match(emailCalls[0].body.subject, /Owner audit preview ready: Ashland City Half Marathon/);
    assert.match(emailCalls[0].body.text, /Owner\/admin preview only/);
    assert.match(emailCalls[0].body.text, /Customer delivery remains blocked until Steve gives final approval/);
    assert.match(emailCalls[0].body.text, /Top 3 customer-ready findings/);
    assert.match(emailCalls[0].body.html, /StartLine owner audit gate/);

    const patch = calls.find((call) => call.method === 'PATCH');
    assert.equal(patch.body.status, 'owner_preview_sent');
    assert.equal(patch.body.outreach_status, 'final_approval_required');
    assert.equal(patch.body.metadata.audit_workflow.owner_preview_status, 'sent');
    assert.equal(patch.body.metadata.audit_workflow.owner_preview_sent_to, 'owner@example.com');
    assert.equal(patch.body.metadata.audit_workflow.owner_preview_resend_id, 'email-owner-preview-123');
    assert.equal(patch.body.metadata.audit_workflow.final_approval_status, 'required_before_customer_delivery');
    assert.equal(patch.body.metadata.audit_workflow.customer_delivery_status, 'blocked_until_final_approval');
  });
});

test('send-owner-audit-preview blocks when customer-ready draft/top 3 are missing and does not send email', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const calls = [];

  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.STARTLINE_OWNER_AUDIT_PREVIEW_TOKEN = 'owner-token';
  process.env.RESEND_API_KEY = 'resend-test-key';
  process.env.STARTLINE_OWNER_PREVIEW_EMAIL = 'owner@example.com';

  global.fetch = async (url, options = {}) => {
    const call = {
      url: String(url),
      method: options.method || 'GET',
      body: parseRequestBody(options.body),
    };
    calls.push(call);

    if (call.url.includes('/audit_requests') && call.method === 'GET') {
      return new Response(JSON.stringify([readyRecord({ audit_summary: { customer_ready_draft: '', top_3_findings: ['Only one'] }, top_opportunities: [] })]), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'unexpected call' }), { status: 500 });
  };

  try {
    const response = await handler(event());
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 409);
    assert.equal(body.ok, false);
    assert.deepEqual(body.missing, ['customer-ready draft', 'top 3 findings']);
    assert.equal(calls.filter((call) => call.url === 'https://api.resend.com/emails').length, 0);
    assert.equal(calls.filter((call) => call.method === 'PATCH').length, 0);
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
});

test('send-owner-audit-preview rejects missing internal token before touching Supabase', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const calls = [];

  process.env.STARTLINE_OWNER_AUDIT_PREVIEW_TOKEN = 'owner-token';
  process.env.RESEND_API_KEY = 'resend-test-key';
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    return new Response('{}', { status: 500 });
  };

  try {
    const response = await handler(event({}, { authorization: 'Bearer wrong-token' }));
    const body = JSON.parse(response.body);
    assert.equal(response.statusCode, 401);
    assert.equal(body.ok, false);
    assert.equal(calls.length, 0);
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
});
