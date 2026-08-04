import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOutreachDigestQuery,
  buildOutreachEngagementOwnerDigest,
  loadOutreachEngagementDigestData,
  maskEmailForOwnerDigest,
  summarizeOutreachEngagementRows,
  validateOwnerDigestText,
} from '../scripts/lib/outreach-engagement-owner-digest.mjs';

const fixtureRows = [
  {
    id: 'outreach-clicked',
    race_name: 'Sample River 5K',
    race_domain: 'sampleriver5k.org',
    mockup_url: 'https://mockups.startlinesites.com/private/sample-river-5k?t=abc',
    outreach_status: 'sent',
    sent_at: '2026-08-01T14:00:00Z',
    to_emails: ['director@example.com'],
    campaign_id: 'community-wave-1',
    delivered_at: '2026-08-01T14:01:00Z',
    first_opened_at: '2026-08-01T15:00:00Z',
    open_count: 2,
    first_clicked_at: '2026-08-01T15:03:00Z',
    click_count: 1,
    clicked_urls: ['https://mockups.startlinesites.com/private/sample-river-5k?t=redacted'],
    engagement_status: 'clicked',
    next_follow_up_at: '2026-08-03T15:03:00Z',
    follow_up_reason: 'Recommended owner-reviewed personalized follow-up after private mockup click; do not mention tracking.',
  },
  {
    id: 'outreach-opened',
    race_name: 'Example Town 10K',
    race_domain: 'exampletown10k.org',
    outreach_status: 'sent',
    sent_at: '2026-08-01T14:00:00Z',
    to_emails: 'info@exampletown10k.org',
    delivered_at: '2026-08-01T14:01:00Z',
    first_opened_at: '2026-08-02T16:00:00Z',
    open_count: 1,
    engagement_status: 'opened',
    next_follow_up_at: '2026-08-06T16:00:00Z',
    follow_up_reason: 'Recommended owner-reviewed soft follow-up after open without click; do not mention tracking.',
  },
  {
    id: 'outreach-suppressed',
    race_name: 'Blocked Sprint',
    race_domain: 'blockedsprint.org',
    outreach_status: 'sent',
    sent_at: '2026-08-01T14:00:00Z',
    to_emails: ['blocked@example.com'],
    delivered_at: '2026-08-01T14:01:00Z',
    bounced_at: '2026-08-01T14:02:00Z',
    engagement_status: 'bounced',
    next_follow_up_at: null,
    follow_up_reason: 'Do not follow up: recipient is suppressed or generated a negative deliverability signal.',
  },
];

const fixtureEvents = [
  { id: 'evt-1', outreach_id: 'outreach-clicked', event_type: 'delivered', event_timestamp: '2026-08-01T14:01:00Z' },
  { id: 'evt-2', outreach_id: 'outreach-clicked', event_type: 'opened', event_timestamp: '2026-08-01T15:00:00Z' },
  { id: 'evt-3', outreach_id: 'outreach-clicked', event_type: 'clicked', event_timestamp: '2026-08-01T15:03:00Z', clicked_url: 'https://mockups.startlinesites.com/private/sample-river-5k' },
  { id: 'evt-4', outreach_id: 'outreach-suppressed', event_type: 'bounced', event_timestamp: '2026-08-01T14:02:00Z' },
];

test('owner engagement digest summarizes counts and masks recipient emails', () => {
  const digest = buildOutreachEngagementOwnerDigest(fixtureRows, fixtureEvents, {
    generatedAt: '2026-08-04T22:30:00Z',
    campaignId: 'community-wave-1',
    now: '2026-08-07T12:00:00Z',
  });

  assert.match(digest, /StartLine outreach engagement owner digest/);
  assert.match(digest, /Delivered: 3 \(100%\)/);
  assert.match(digest, /Opened: 2 \(67%, directional\)/);
  assert.match(digest, /Clicked: 1 \(33%\)/);
  assert.match(digest, /Private mockup clicks: 1 \(33%\)/);
  assert.match(digest, /Suppression blockers: 1/);
  assert.match(digest, /di\*\*\*\[at\]example\.com/);
  assert.doesNotMatch(digest, /director@example\.com/);
  assert.doesNotMatch(digest, /I saw you opened|you clicked/i);
  assert.equal(validateOwnerDigestText(digest).ok, true);
});

test('empty digest does not fabricate engagement or recommendations', () => {
  const digest = buildOutreachEngagementOwnerDigest([], [], { generatedAt: '2026-08-04T22:30:00Z' });
  assert.match(digest, /No outreach rows matched this digest/);
  assert.doesNotMatch(digest, /Recommended owner-reviewed actions\n1\./);
});

test('summarizer classifies open, click, and suppression recommendations', () => {
  const summary = summarizeOutreachEngagementRows(fixtureRows, fixtureEvents, { now: '2026-08-07T12:00:00Z' });
  assert.equal(summary.sent_count, 3);
  assert.equal(summary.delivered_count, 3);
  assert.equal(summary.open_count, 2);
  assert.equal(summary.click_count, 1);
  assert.equal(summary.private_mockup_click_count, 1);
  assert.equal(summary.suppression_count, 1);
  assert.deepEqual(summary.events_by_type, { delivered: 1, opened: 1, clicked: 1, bounced: 1 });
  assert.deepEqual(summary.follow_up_rows.map((row) => row.id), ['outreach-clicked', 'outreach-opened']);
  assert.deepEqual(summary.suppressed_rows.map((row) => row.id), ['outreach-suppressed']);
});

test('owner digest validator rejects surveillance phrasing and visible email addresses', () => {
  assert.equal(validateOwnerDigestText('I saw you opened the mockup').ok, false);
  assert.equal(validateOwnerDigestText('recipient director@example.com').ok, false);
  assert.equal(validateOwnerDigestText('recipient di***[at]example.com').ok, true);
});

test('query builders and loader read outreach rows then matching raw events', async () => {
  const paths = [];
  const result = await loadOutreachEngagementDigestData({
    campaignId: 'community-wave-1',
    limit: 5,
    supabaseRequest: async ({ path }) => {
      paths.push(path);
      if (path.startsWith('race_mockup_outreach')) return fixtureRows.slice(0, 2);
      if (path.startsWith('outreach_engagement_events')) return fixtureEvents.slice(0, 3);
      return [];
    },
  });

  assert.equal(result.outreach.length, 2);
  assert.equal(result.events.length, 3);
  assert.match(paths[0], /^race_mockup_outreach\?/);
  assert.match(paths[0], /campaign_id=eq\.community-wave-1/);
  assert.match(paths[1], /^outreach_engagement_events\?/);
  assert.match(paths[1], /outreach_id=in\.%28outreach-clicked%2Coutreach-opened%29/);
  assert.match(buildOutreachDigestQuery({ campaignId: 'abc', since: '2026-08-01T00:00:00Z' }), /sent_at=gte\.2026-08-01T00%3A00%3A00Z/);
});

test('email masking keeps owner reports useful without exposing full addresses', () => {
  assert.equal(maskEmailForOwnerDigest('RaceDirector@Example.com'), 'ra***[at]example.com');
  assert.equal(maskEmailForOwnerDigest('x@example.com'), 'x***[at]example.com');
  assert.equal(maskEmailForOwnerDigest('not-an-email'), '');
});
