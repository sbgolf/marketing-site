import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import {
  addChicagoBusinessDays,
  buildOutreachEngagementUpdate,
  handler,
  maskEmail,
  normalizeResendEvent,
  sanitizePayload,
  sanitizeUrl,
  verifyResendSignature,
} from '../netlify/functions/resend-webhook.mjs';

const secretBytes = Buffer.from('resend webhook test secret');
const webhookSecret = `whsec_${secretBytes.toString('base64')}`;
const fixedTimestamp = 1_800_000_000;
const currentTimestamp = () => Math.floor(Date.now() / 1000);

const sign = ({ rawBody, id = 'msg_test_123', secret = secretBytes, at = currentTimestamp() }) => {
  const signature = createHmac('sha256', secret)
    .update(`${id}.${at}.${rawBody}`, 'utf8')
    .digest('base64');
  return {
    'svix-id': id,
    'svix-timestamp': String(at),
    'svix-signature': `v1,${signature}`,
  };
};

const payload = (overrides = {}) => ({
  id: 'evt_resend_123',
  type: 'email.clicked',
  created_at: '2026-08-04T21:00:00.000Z',
  data: {
    email_id: 're_123',
    to: ['director@example.org'],
    click: { link: 'https://mockups.startlinesites.com/ocean-marathon?t=private' },
    tags: { campaign_id: 'community-2026-08-w1' },
  },
  ...overrides,
});

const event = ({ body = payload(), headers, isBase64Encoded = false } = {}) => {
  const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    httpMethod: 'POST',
    headers: headers || sign({ rawBody }),
    body: isBase64Encoded ? Buffer.from(rawBody).toString('base64') : rawBody,
    isBase64Encoded,
  };
};

const withEnv = async (fn) => {
  const oldEnv = { ...process.env };
  process.env.RESEND_WEBHOOK_SECRET = webhookSecret;
  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.STARTLINE_RECIPIENT_HASH_SALT = 'test-salt';
  try {
    return await fn();
  } finally {
    process.env = oldEnv;
  }
};

const makeFetch = ({ duplicate = false, outreach = [{
  id: 'outreach-1',
  prospect_id: 'prospect-1',
  generation_job_id: 'job-1',
  campaign_id: 'community-2026-08-w1',
}], aggregateRow = {
  id: 'outreach-1',
  engagement_status: 'no_activity',
  open_count: 0,
  click_count: 0,
  clicked_urls: [],
}, failOnWrite = false } = {}) => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const path = String(url);
    if (path.includes('/rest/v1/race_mockup_outreach?') && path.includes('resend_email_id=')) {
      return new Response(JSON.stringify(outreach), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (path.includes('/rest/v1/race_mockup_outreach?') && path.includes('id=eq.')) {
      if (options.method === 'PATCH') return new Response(null, { status: 204 });
      return new Response(JSON.stringify([aggregateRow]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (path.includes('/rest/v1/outreach_engagement_events')) {
      if (failOnWrite) return new Response('database unavailable', { status: 500 });
      return new Response(JSON.stringify(duplicate ? [] : [{ id: 'engagement-event-1' }]), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (path.includes('/rest/v1/outreach_suppressions')) {
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected fetch: ${path}`);
  };
  return { calls, fetchImpl };
};

test('verifyResendSignature accepts Svix-style Resend headers and rejects tampering', () => {
  const rawBody = JSON.stringify(payload());
  const headers = sign({ rawBody, at: fixedTimestamp });

  assert.deepEqual(
    verifyResendSignature({ rawBody, headers, secret: webhookSecret, nowSeconds: fixedTimestamp }).ok,
    true,
  );
  assert.equal(
    verifyResendSignature({ rawBody: JSON.stringify(payload({ id: 'other' })), headers, secret: webhookSecret, nowSeconds: fixedTimestamp }).ok,
    false,
  );
  assert.equal(
    verifyResendSignature({ rawBody, headers, secret: webhookSecret, nowSeconds: fixedTimestamp + 301 }).reason,
    'stale_signature',
  );
});

test('normalizeResendEvent maps click events to the StartLine canonical row shape', () => {
  const result = normalizeResendEvent({ payload: payload(), svixId: 'msg_test_123' });
  assert.equal(result.ok, true);
  assert.equal(result.event.provider, 'resend');
  assert.equal(result.event.provider_event_id, 'evt_resend_123');
  assert.equal(result.event.provider_message_id, 're_123');
  assert.equal(result.event.resend_email_id, 're_123');
  assert.equal(result.event.event_type, 'clicked');
  assert.equal(result.event.clicked_url, 'https://mockups.startlinesites.com/ocean-marathon?t=%5Bredacted%5D');
  assert.equal(result.event.recipient_email_masked, 'di***[at]example.org');
  assert.match(result.event.recipient_email_hash, /^[a-f0-9]{64}$/);
  assert.equal(result.event.raw_event.data.to[0], 'di***[at]example.org');
});

test('sanitizePayload masks full recipients and strips sensitive keys before storage', () => {
  const sanitized = sanitizePayload({
    authorization: 'Bearer should-not-store',
    nested: {
      email: 'director@example.org',
      signature: 'should-not-store',
      webhookSecret: 'should-not-store',
      privateMockupUrl: 'https://mockups.startlinesites.com/race?token=secret-token&source=email',
      note: 'Send to other@example.org',
    },
  });
  assert.equal(sanitized.authorization, undefined);
  assert.equal(sanitized.nested.signature, undefined);
  assert.equal(sanitized.nested.webhookSecret, undefined);
  assert.equal(sanitized.nested.email, 'di***[at]example.org');
  assert.equal(sanitized.nested.privateMockupUrl, 'https://mockups.startlinesites.com/race?token=%5Bredacted%5D&source=email');
  assert.equal(sanitized.nested.note, 'Send to ot***[at]example.org');
});

test('sanitizeUrl redacts private mockup token query parameters while preserving useful path context', () => {
  assert.equal(
    sanitizeUrl('https://mockups.startlinesites.com/race?t=abc123&utm_source=email'),
    'https://mockups.startlinesites.com/race?t=%5Bredacted%5D&utm_source=email',
  );
});

test('handler stores a valid signed Resend event, links outreach, and preserves no-send side effects', async () => withEnv(async () => {
  const originalFetch = globalThis.fetch;
  const { calls, fetchImpl } = makeFetch();
  globalThis.fetch = fetchImpl;
  try {
    const response = await handler(event());
    const body = JSON.parse(response.body);
    assert.equal(response.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.event_type, 'clicked');
    assert.equal(body.outreach_matched, true);
    assert.equal(body.suppression_prepared, false);
    assert.equal(body.engagement_status, 'clicked');
    assert.equal(body.aggregation_skipped, false);

    const insertCall = calls.find((call) => call.url.includes('/outreach_engagement_events'));
    assert.ok(insertCall);
    assert.match(insertCall.url, /on_conflict=provider%2Cprovider_event_id|on_conflict=provider,provider_event_id/);
    const inserted = JSON.parse(insertCall.options.body);
    assert.equal(inserted.outreach_id, 'outreach-1');
    assert.equal(inserted.prospect_id, 'prospect-1');
    assert.equal(inserted.generation_job_id, 'job-1');
    assert.equal(inserted.raw_event.data.to[0], 'di***[at]example.org');
    assert.equal(inserted.raw_event.data.click.link, 'https://mockups.startlinesites.com/ocean-marathon?t=%5Bredacted%5D');
    const aggregatePatch = calls.find((call) => call.url.includes('/race_mockup_outreach?id=eq.outreach-1') && call.options.method === 'PATCH');
    assert.ok(aggregatePatch);
    const aggregateBody = JSON.parse(aggregatePatch.options.body);
    assert.equal(aggregateBody.engagement_status, 'clicked');
    assert.equal(aggregateBody.click_count, 1);
    assert.equal(aggregateBody.clicked_urls[0], 'https://mockups.startlinesites.com/ocean-marathon?t=%5Bredacted%5D');
    assert.match(aggregateBody.next_follow_up_at, /^2026-08-/);
    assert.equal(calls.some((call) => String(call.url).includes('api.resend.com')), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
}));

test('handler rejects invalid signatures before any Supabase write', async () => withEnv(async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (...args) => {
    calls.push(args);
    throw new Error('should not fetch');
  };
  try {
    const rawBody = JSON.stringify(payload());
    const response = await handler(event({
      body: rawBody,
      headers: { ...sign({ rawBody }), 'svix-signature': 'v1,invalid' },
    }));
    assert.equal(response.statusCode, 401);
    assert.equal(calls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
}));

test('handler fails closed when the webhook secret is missing', async () => {
  const oldEnv = { ...process.env };
  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  delete process.env.RESEND_WEBHOOK_SECRET;
  try {
    const response = await handler(event());
    assert.equal(response.statusCode, 500);
    assert.match(response.body, /RESEND_WEBHOOK_SECRET/);
  } finally {
    process.env = oldEnv;
  }
});

test('handler treats duplicate valid provider events as successful dedupes', async () => withEnv(async () => {
  const originalFetch = globalThis.fetch;
  const { calls, fetchImpl } = makeFetch({ duplicate: true });
  globalThis.fetch = fetchImpl;
  try {
    const response = await handler(event());
    const body = JSON.parse(response.body);
    assert.equal(response.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.duplicate, true);
    assert.equal(body.aggregation_skipped, true);
    assert.equal(calls.some((call) => call.url.includes('/race_mockup_outreach?id=eq.') && call.options.method === 'PATCH'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
}));

test('handler ignores unsupported events without crashing or writing', async () => withEnv(async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (...args) => {
    calls.push(args);
    throw new Error('should not fetch');
  };
  try {
    const body = payload({ id: 'evt_ignored', type: 'email.sent' });
    const response = await handler(event({ body }));
    const parsed = JSON.parse(response.body);
    assert.equal(response.statusCode, 200);
    assert.equal(parsed.ignored, true);
    assert.equal(calls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
}));

test('handler prepares suppression rows for bounce and complaint-class events', async () => withEnv(async () => {
  const originalFetch = globalThis.fetch;
  const { calls, fetchImpl } = makeFetch();
  globalThis.fetch = fetchImpl;
  try {
    const body = payload({ id: 'evt_bounce', type: 'email.bounced', data: { email_id: 're_123', to: 'director@example.org' } });
    const response = await handler(event({ body }));
    const parsed = JSON.parse(response.body);
    assert.equal(response.statusCode, 200);
    assert.equal(parsed.suppression_prepared, true);
    assert.equal(parsed.engagement_status, 'bounced');

    const suppressionCall = calls.find((call) => call.url.includes('/outreach_suppressions'));
    assert.ok(suppressionCall);
    const suppression = JSON.parse(suppressionCall.options.body);
    assert.equal(suppression.reason, 'bounce');
    assert.equal(suppression.recipient_email_masked, 'di***[at]example.org');
    assert.equal(suppression.source_outreach_id, 'outreach-1');
  } finally {
    globalThis.fetch = originalFetch;
  }
}));

test('buildOutreachEngagementUpdate applies precedence, counts, and owner-reviewed cadence', () => {
  const delivered = buildOutreachEngagementUpdate({
    current: { engagement_status: 'no_activity', open_count: 0, click_count: 0, clicked_urls: [] },
    event: { event_type: 'delivered', event_timestamp: '2026-08-03T15:00:00.000Z' },
  }).update;
  assert.equal(delivered.engagement_status, 'delivered');
  assert.equal(delivered.delivered_at, '2026-08-03T15:00:00.000Z');
  assert.equal(delivered.next_follow_up_at, addChicagoBusinessDays('2026-08-03T15:00:00.000Z', 8));

  const opened = buildOutreachEngagementUpdate({
    current: { ...delivered, open_count: 1, click_count: 0, clicked_urls: [] },
    event: { event_type: 'opened', event_timestamp: '2026-08-04T15:00:00.000Z' },
  }).update;
  assert.equal(opened.engagement_status, 'opened');
  assert.equal(opened.open_count, 2);
  assert.equal(opened.first_opened_at, '2026-08-04T15:00:00.000Z');

  const clicked = buildOutreachEngagementUpdate({
    current: { ...delivered, ...opened, click_count: 0, clicked_urls: [] },
    event: { event_type: 'clicked', event_timestamp: '2026-08-05T15:00:00.000Z', clicked_url: 'https://mockups.startlinesites.com/race?t=%5Bredacted%5D' },
  }).update;
  assert.equal(clicked.engagement_status, 'clicked');
  assert.equal(clicked.click_count, 1);
  assert.deepEqual(clicked.clicked_urls, ['https://mockups.startlinesites.com/race?t=%5Bredacted%5D']);
  assert.match(clicked.follow_up_reason, /do not mention tracking/i);

  const bounced = buildOutreachEngagementUpdate({
    current: { ...delivered, ...opened, ...clicked },
    event: { event_type: 'bounced', event_timestamp: '2026-08-06T15:00:00.000Z' },
  }).update;
  assert.equal(bounced.engagement_status, 'bounced');
  assert.equal(bounced.next_follow_up_at, null);
  assert.match(bounced.follow_up_reason, /Do not follow up/);

  const suppressed = buildOutreachEngagementUpdate({
    current: { ...delivered, ...opened, ...clicked },
    event: { event_type: 'complained', event_timestamp: '2026-08-06T15:00:00.000Z' },
  }).update;
  assert.equal(suppressed.engagement_status, 'suppressed');
  assert.equal(suppressed.next_follow_up_at, null);
});

test('maskEmail keeps owner reports useful without revealing full addresses', () => {
  assert.equal(maskEmail('director@example.org'), 'di***[at]example.org');
  assert.equal(maskEmail('x@example.org'), 'x***[at]example.org');
});
