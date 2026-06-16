import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeStripeEndpoints,
  analyzeWebhookRows,
  buildEventQueryPath,
  decideVerificationStatus,
  redactValue,
  validateRequiredEnv,
} from '../scripts/verify-stripe-webhook.mjs';

test('validateRequiredEnv reports missing required variables without exposing secrets', () => {
  const result = validateRequiredEnv({
    STRIPE_SECRET_KEY: 'sk_live_secret_wxyz',
    STRIPE_WEBHOOK_SECRET: '',
    SUPABASE_URL: 'https://example.supabase.co',
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['STRIPE_WEBHOOK_SECRET', 'SUPABASE_SERVICE_ROLE_KEY']);
  assert.match(result.lines.join('\n'), /STRIPE_SECRET_KEY: set \(sk_live…wxyz\)/);
  assert.doesNotMatch(result.lines.join('\n'), /sk_live_secret_wxyz/);
});

test('analyzeStripeEndpoints finds expected URL and required checkout event', () => {
  const result = analyzeStripeEndpoints([
    { id: 'we_1', url: 'https://other.example/webhook', enabled_events: ['checkout.session.completed'] },
    { id: 'we_2', url: 'https://startlinesites.com/.netlify/functions/stripe-webhook', enabled_events: ['charge.succeeded', 'checkout.session.completed'] },
  ], 'https://startlinesites.com/.netlify/functions/stripe-webhook');

  assert.equal(result.ok, true);
  assert.equal(result.matchedEndpoint.id, 'we_2');
  assert.equal(result.hasCheckoutCompleted, true);
});

test('analyzeStripeEndpoints fails when endpoint is missing required checkout event', () => {
  const result = analyzeStripeEndpoints([
    { id: 'we_2', url: 'https://startlinesites.com/.netlify/functions/stripe-webhook', enabled_events: ['charge.succeeded'] },
  ], 'https://startlinesites.com/.netlify/functions/stripe-webhook');

  assert.equal(result.ok, false);
  assert.equal(result.hasExpectedUrl, true);
  assert.equal(result.hasCheckoutCompleted, false);
});

test('decideVerificationStatus only fails recent event absence when a target event id was requested', () => {
  assert.equal(decideVerificationStatus({ envOk: true, endpointOk: true, eventFound: false, targetEventId: '' }).exitCode, 0);
  assert.equal(decideVerificationStatus({ envOk: true, endpointOk: true, eventFound: false, targetEventId: 'evt_123' }).exitCode, 1);
  assert.equal(decideVerificationStatus({ envOk: false, endpointOk: true, eventFound: true, targetEventId: '' }).exitCode, 1);
});

test('buildEventQueryPath limits recent checks to processed checkout events in a freshness window', () => {
  const path = buildEventQueryPath('', { now: new Date('2026-06-16T12:00:00Z'), recentHours: 24 });

  assert.match(path, /event_type=eq.checkout\.session\.completed/);
  assert.match(path, /processing_status=in\.\(processed,duplicate\)/);
  assert.match(path, /created_at=gte.2026-06-15T12%3A00%3A00\.000Z/);
  assert.match(path, /order=created_at\.desc/);
});

test('analyzeWebhookRows requires processed checkout.session.completed rows', () => {
  const result = analyzeWebhookRows([
    { stripe_event_id: 'evt_charge', event_type: 'charge.succeeded', processing_status: 'processed' },
    { stripe_event_id: 'evt_failed', event_type: 'checkout.session.completed', processing_status: 'failed' },
    { stripe_event_id: 'evt_ok', event_type: 'checkout.session.completed', processing_status: 'processed' },
  ]);

  assert.equal(result.eventFound, true);
  assert.deepEqual(result.verifiedRows.map((row) => row.stripe_event_id), ['evt_ok']);
});

test('analyzeWebhookRows rejects target rows with the wrong event type or status', () => {
  assert.equal(analyzeWebhookRows([{ stripe_event_id: 'evt_1', event_type: 'charge.succeeded', processing_status: 'processed' }]).eventFound, false);
  assert.equal(analyzeWebhookRows([{ stripe_event_id: 'evt_2', event_type: 'checkout.session.completed', processing_status: 'ignored' }]).eventFound, false);
});

test('redactValue keeps secrets out of checklist output', () => {
  assert.equal(redactValue('sk_live_secret_wxyz'), 'sk_live…wxyz');
  assert.equal(redactValue('short'), 'set');
  assert.equal(redactValue(''), 'missing');
});
