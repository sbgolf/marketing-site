import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSafePrefill, handler, hashIntakeToken } from '../netlify/functions/get-customer-intake-prefill.mjs';

const withEnvAndFetch = async (fetchImpl, callback) => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  global.fetch = fetchImpl;
  try {
    await callback();
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
};

test('get-customer-intake-prefill rejects missing and invalid tokens', async () => {
  const missing = await handler({ httpMethod: 'GET', queryStringParameters: {} });
  assert.equal(missing.statusCode, 400);
  assert.equal(JSON.parse(missing.body).ok, false);

  const invalid = await handler({ httpMethod: 'GET', queryStringParameters: { token: 'email@example.com' } });
  assert.equal(invalid.statusCode, 400);
  assert.equal(JSON.parse(invalid.body).ok, false);
});

test('get-customer-intake-prefill rejects unsupported methods', async () => {
  const response = await handler({ httpMethod: 'POST', queryStringParameters: { token: 'a'.repeat(43) } });
  assert.equal(response.statusCode, 405);
});

test('get-customer-intake-prefill returns 404 without an email lookup when token hash is not found', async () => {
  const calls = [];
  await withEnvAndFetch(async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    assert.match(String(url), /intake_token_hash=eq\./);
    assert.doesNotMatch(String(url), /\bor=|billing_contact_email|contact_email=eq\.|email=eq\./);
    return new Response(JSON.stringify([]), { status: 200 });
  }, async () => {
    const response = await handler({ httpMethod: 'GET', queryStringParameters: { token: 'a'.repeat(43) } });
    assert.equal(response.statusCode, 404);
    assert.equal(JSON.parse(response.body).ok, false);
    assert.equal(calls.length, 1);
  });
});

test('get-customer-intake-prefill maps only safe customer and audit fields', async () => {
  const calls = [];
  const token = 'secure_token_abcdefghijklmnopqrstuvwxyz1234567890';
  const tokenHash = hashIntakeToken(token);

  await withEnvAndFetch(async (url, options = {}) => {
    const call = { url: String(url), method: options.method || 'GET' };
    calls.push(call);

    if (call.url.includes('/customer_records?')) {
      assert.match(call.url, new RegExp(`intake_token_hash=eq.${tokenHash}`));
      assert.match(call.url, /select=/);
      assert.doesNotMatch(call.url, /stripe|metadata|billing_contact/);
      return new Response(JSON.stringify([{
        id: 'customer-123',
        audit_request_id: 'audit-123',
        race_name: 'Example Marathon',
        organization_name: 'Example Race Events',
        current_url: 'https://examplemarathon.com',
        registration_url: 'https://runsignup.com/example',
        primary_contact_name: 'Race Director',
        primary_contact_email: 'director@example.com',
        setup_tier: 'standard',
        stripe_customer_id: 'cus_should_not_leak',
        metadata: { secret: 'do not return' },
        intake_token_hash: tokenHash,
      }]), { status: 200 });
    }

    if (call.url.includes('/audit_requests?')) {
      assert.match(call.url, /id=eq.audit-123/);
      assert.doesNotMatch(call.url, /metadata|private_mockup|stripe/);
      return new Response(JSON.stringify([{
        id: 'audit-123',
        race_name: 'Example Marathon',
        current_url: 'https://old.examplemarathon.com',
        contact_name: 'Audit Contact',
        contact_email: 'audit@example.com',
        contact_phone: '555-0100',
        race_date: '2026-10-18',
        registration_url: 'https://runsignup.com/audit-example',
        registration_platform: 'RunSignup',
        location: 'Example City, OR',
        private_mockup_url: 'https://private.example/mockup',
      }]), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'unexpected call' }), { status: 500 });
  }, async () => {
    const response = await handler({ httpMethod: 'GET', queryStringParameters: { token } });
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(body.ok, true);
    assert.deepEqual(body.source, {
      customer_record_id: 'customer-123',
      audit_request_id: 'audit-123',
      fields: ['organization_name', 'race_name', 'contact_name', 'contact_email', 'contact_phone', 'event_date', 'event_location', 'current_domain', 'registration_url', 'registration_platform', 'template_preference'],
    });
    assert.equal(body.prefill.race_name, 'Example Marathon');
    assert.equal(body.prefill.contact_name, 'Race Director');
    assert.equal(body.prefill.event_date, '2026-10-18');
    assert.equal(body.prefill.event_location, 'Example City, OR');
    assert.equal(body.prefill.registration_platform, 'RunSignup');
    assert.equal(body.prefill.template_preference, 'standard');
    const serialized = JSON.stringify(body);
    assert.doesNotMatch(serialized, /cus_should_not_leak|secret|private_mockup|intake_token_hash|secure_token/);
    assert.equal(calls.length, 2);
  });
});

test('buildSafePrefill falls back gracefully to ordinary empty prefill', () => {
  assert.deepEqual(buildSafePrefill({ customerRecord: { id: 'customer-empty' }, auditRequest: null }), {
    prefill: {},
    fields: [],
  });
});
