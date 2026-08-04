import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSmokeEventsQuery,
  buildSmokeFixture,
  buildSmokeOutreachQuery,
  buildSuppressionQuery,
  hashRecipient,
  parseSmokeArgs,
  redactEmails,
  renderSmokeReport,
  summarizeSmokeEvidence,
  validateSmokeOptions,
} from '../scripts/lib/outreach-engagement-smoke-test.mjs';

const env = {
  STARTLINE_INTERNAL_SMOKE_RECIPIENT: 'support@startlinesites.com',
  RESEND_API_KEY: 're_test_key',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
};

test('smoke harness refuses to run without explicit internal confirmation', () => {
  const result = validateSmokeOptions({ internalRecipient: 'support@startlinesites.com' }, env);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /--confirm-internal-smoke/);
});

test('smoke harness refuses non-StartLine recipient domains by default', () => {
  const result = validateSmokeOptions({
    internalRecipient: 'director@example.org',
    confirmInternalSmoke: true,
  }, env);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /allowlisted StartLine domain/);
  assert.doesNotMatch(result.errors.join('\n'), /director@example\.org/);
  assert.match(result.errors.join('\n'), /di\*\*\*@example\.org/);
});

test('smoke harness refuses live customer/prospect context notes', () => {
  const result = validateSmokeOptions({
    internalRecipient: 'support@startlinesites.com',
    confirmInternalSmoke: true,
    contextNote: 'real prospect follow-up campaign',
  }, env);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /live customer\/prospect context/);
});

test('smoke fixture builds branded internal-only payload and masks recipient evidence', () => {
  const fixture = buildSmokeFixture({
    internalRecipient: 'support@startlinesites.com',
    confirmInternalSmoke: true,
    smokeId: 'PR-7 Smoke',
  }, env);

  assert.equal(fixture.ok, true);
  assert.equal(fixture.smoke_id, 'pr-7-smoke');
  assert.equal(fixture.masked_recipient, 'su***@startlinesites.com');
  assert.equal(fixture.payload.metadata.smoke_test, true);
  assert.equal(fixture.payload.metadata.exclude_from_campaign_metrics, true);
  assert.equal(fixture.payload.metadata.customer_outreach, false);
  assert.equal(fixture.payload.registration_platform, 'internal_smoke');
  assert.equal(fixture.payload.race_slug, 'internal-smoke-pr-7-smoke');
  assert.match(fixture.email.html, /email-card/);
  assert.match(fixture.email.html, /email-button-link/);
  assert.match(fixture.email.subject, /^\[Internal smoke\]/);
});

test('query builders target only internal smoke rows and engagement evidence', () => {
  assert.match(buildSmokeOutreachQuery({ smokeId: 'abc 123' }), /race_slug=eq\.internal-smoke-abc-123/);
  assert.match(buildSmokeOutreachQuery({ outreachId: 'outreach-1' }), /id=eq\.outreach-1/);
  assert.match(buildSmokeEventsQuery('outreach-1'), /outreach_engagement_events/);
  assert.match(buildSmokeEventsQuery('outreach-1'), /outreach_id=eq\.outreach-1/);
  assert.match(buildSuppressionQuery(hashRecipient('support@startlinesites.com')), /outreach_suppressions/);
});

test('smoke evidence report masks emails and classifies missing events as blocker', () => {
  const summary = summarizeSmokeEvidence({
    outreach: {
      id: 'outreach-1',
      resend_email_id: 'email-1',
      to_emails: ['support@startlinesites.com'],
      engagement_status: 'sent',
      open_count: 0,
      click_count: 0,
    },
    events: [],
    suppressions: [],
  });
  const report = renderSmokeReport(summary);

  assert.equal(summary.passed, false);
  assert.match(summary.caveats.join('\n'), /No webhook events/);
  assert.match(report, /su\*\*\*@startlinesites\.com/);
  assert.doesNotMatch(report, /support@startlinesites\.com/);
});

test('smoke evidence passes when provider id and raw events exist', () => {
  const summary = summarizeSmokeEvidence({
    outreach: {
      id: 'outreach-1',
      resend_email_id: 'email-1',
      to_emails: ['support@startlinesites.com'],
      engagement_status: 'clicked',
      open_count: 1,
      click_count: 1,
    },
    events: [
      { event_type: 'email.opened' },
      { event_type: 'email.clicked' },
    ],
    suppressions: [{ id: 'suppression-1' }],
  });

  assert.equal(summary.passed, true);
  assert.deepEqual(summary.event_counts, { 'email.opened': 1, 'email.clicked': 1 });
  assert.equal(summary.suppression_rows, 1);
});

test('argument parser supports plan/send/verify/mark modes', () => {
  assert.equal(parseSmokeArgs(['--plan']).mode, 'plan');
  assert.equal(parseSmokeArgs(['--send-internal-smoke']).mode, 'send');
  assert.equal(parseSmokeArgs(['--verify', '--smoke-id', 'x']).mode, 'verify');
  assert.equal(parseSmokeArgs(['--mark-complete', '--outreach-id', 'y']).mode, 'mark-complete');
  assert.throws(() => parseSmokeArgs(['--surprise']), /Unknown option/);
});

test('redaction masks visible addresses in arbitrary error output', () => {
  const redacted = redactEmails('failed sending to support@startlinesites.com and director@example.org');
  assert.doesNotMatch(redacted, /support@startlinesites\.com/);
  assert.doesNotMatch(redacted, /director@example\.org/);
  assert.match(redacted, /su\*\*\*@startlinesites\.com/);
  assert.match(redacted, /di\*\*\*@example\.org/);
});
