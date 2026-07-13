import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDuplicateFilters,
  buildMockupOutreachPayload,
  domainFromUrl,
  mockupTokenFromUrl,
  parseEmailList,
  slugifyRace,
  validateMockupOutreachInput,
} from '../scripts/lib/mockup-outreach-log.mjs';

test('mockup outreach payload records template, URLs, recipients, and provider metadata', () => {
  const payload = buildMockupOutreachPayload({
    raceName: 'Example 10K',
    raceCity: 'Nashville',
    raceState: 'TN',
    officialUrl: 'https://www.example-race.test/info',
    registrationUrl: 'https://runsignup.com/Race/TN/Nashville/Example10K',
    registrationPlatform: 'runsignup',
    registrationRaceId: '12345',
    mockupUrl: 'https://mockups.startlinesites.com/private/mockups/abc123def456/',
    mockupTemplate: 'community',
    toEmails: 'Director@Example-Race.test',
    ccEmails: 'events@example-race.test; helper@example-race.test',
    subject: 'A Nashville-local website mockup for Example 10K',
    resendEmailId: 'provider-id',
    fromEmail: 'steve@startlinesites.com',
    replyToEmail: 'support@startlinesites.com',
    sentAt: '2026-07-13T12:00:00.000Z',
  });

  assert.equal(payload.race_slug, 'example-10k');
  assert.equal(payload.official_domain, 'example-race.test');
  assert.equal(payload.mockup_token, 'abc123def456');
  assert.equal(payload.mockup_template, 'community');
  assert.deepEqual(payload.to_emails, ['director@example-race.test']);
  assert.deepEqual(payload.cc_emails, ['events@example-race.test', 'helper@example-race.test']);
  assert.equal(payload.resend_email_id, 'provider-id');
  assert.equal(payload.from_email, 'steve@startlinesites.com');
  assert.equal(payload.reply_to_email, 'support@startlinesites.com');
  assert.equal(payload.sent_at, '2026-07-13T12:00:00.000Z');
  assert.equal(payload.last_contacted_at, '2026-07-13T12:00:00.000Z');
});

test('mockup outreach validation requires template and at least one to recipient', () => {
  assert.deepEqual(validateMockupOutreachInput({}), [
    'raceName is required.',
    'mockupUrl is required.',
    'mockupTemplate is required.',
    'At least one To email is required.',
  ]);

  assert.deepEqual(validateMockupOutreachInput({
    raceName: 'Example',
    mockupUrl: 'https://mockups.startlinesites.com/private/mockups/token/',
    mockupTemplate: 'community',
    toEmails: 'director@example.test',
  }), []);
});

test('mockup outreach helpers normalize domains, slugs, tokens, and email lists', () => {
  assert.equal(slugifyRace('Richland Creek Run XX'), 'richland-creek-run-xx');
  assert.equal(domainFromUrl('https://www.greenwaysfornashville.org/richland-creek-run/'), 'greenwaysfornashville.org');
  assert.equal(mockupTokenFromUrl('https://mockups.startlinesites.com/private/mockups/221df003f466f745f7bb7119890f97f9/'), '221df003f466f745f7bb7119890f97f9');
  assert.deepEqual(parseEmailList('A@Example.test; b@example.test, c@example.test'), ['a@example.test', 'b@example.test', 'c@example.test']);
});

test('duplicate filters cover mockup URL, registration ID, race domain, and recipient overlap', () => {
  const payload = buildMockupOutreachPayload({
    raceName: 'Example 10K',
    officialUrl: 'https://example-race.test',
    registrationPlatform: 'runsignup',
    registrationRaceId: '12345',
    mockupUrl: 'https://mockups.startlinesites.com/private/mockups/token/',
    mockupTemplate: 'community',
    toEmails: 'director@example-race.test',
    ccEmails: 'events@example-race.test',
  });

  const filters = buildDuplicateFilters(payload).join('\n');
  assert.match(filters, /mockup_url=eq\.https%3A%2F%2Fmockups\.startlinesites\.com/);
  assert.match(filters, /registration_platform=eq\.runsignup/);
  assert.match(filters, /registration_race_id=eq\.12345/);
  assert.match(filters, /race_slug=eq\.example-10k/);
  assert.match(filters, /official_domain=eq\.example-race\.test/);
  assert.match(filters, /director%40example-race\.test/);
  assert.match(filters, /events%40example-race\.test/);
});
