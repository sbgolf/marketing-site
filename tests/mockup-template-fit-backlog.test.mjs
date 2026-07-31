import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyTemplateFits, summarizeContactViability } from '../scripts/lib/mockup-template-fit.mjs';
import { prioritizeMockupBacklog, prioritizeMockupCandidate } from '../scripts/lib/mockup-backlog-prioritization.mjs';

const baseCandidate = {
  raceName: 'Example Community Scholarship 5K & Fun Run',
  raceCity: 'Franklin',
  raceState: 'TN',
  eventDate: '2026-11-14',
  sourcePlatform: 'runsignup',
  sourceUrl: 'https://runsignup.com/Race/TN/Franklin/ExampleCommunityScholarship5K',
  registrationUrl: 'https://runsignup.com/Race/TN/Franklin/ExampleCommunityScholarship5K',
  officialUrl: 'https://examplecommunity5k.org',
  distances: ['5K', 'Kids Fun Run', 'Walk'],
  description:
    'Annual community family fundraiser and scholarship run with packet pickup, race day parking, sponsor opportunities, and a festival atmosphere.',
  contactSources: [{ type: 'email', value: 'events@examplecommunity5k.org', source_url: 'https://examplecommunity5k.org/contact' }],
  sourceCoverage: {
    date: true,
    location: true,
    distances: true,
    registration: true,
    schedule: true,
    contact: true,
    cause: true,
    sponsors: true,
    official_url: true,
  },
};

test('classifies high-value source-rich direct-email races as ready to generate', () => {
  const result = classifyTemplateFits(baseCandidate, { now: '2026-07-31T12:00:00Z' });

  assert.equal(result.primaryTemplateFit, 'community');
  assert.ok(result.secondaryTemplateFits.includes('charity_cause'));
  assert.equal(result.recommendedLane, 'B_cause_sponsor');
  assert.equal(result.contactQuality, 'routing_email');
  assert.equal(result.templateReadinessStatus, 'ready_to_generate');
  assert.ok(result.startlineValueScore >= 80);
});

test('keeps contact-form-only candidates out of generate-now even when otherwise strong', () => {
  const result = prioritizeMockupCandidate(
    {
      ...baseCandidate,
      raceName: 'Example Contact Form Only 5K',
      contactSources: [{ type: 'form', url: 'https://runsignup.com/Race/TN/Franklin/ExampleContactFormOnly/Contact' }],
    },
    { now: '2026-07-31T12:00:00Z' },
  );

  assert.equal(result.contactQuality, 'form_only');
  assert.equal(result.backlogBucket, 'research_contact_first');
  assert.ok(result.reasons.some((reason) => reason.includes('Verified direct/routing email')));
});

test('separates performance and trail candidates into their own template queues', () => {
  const performance = classifyTemplateFits(
    {
      ...baseCandidate,
      raceName: 'Fast City Certified Half Marathon',
      distances: ['Half Marathon', '10K'],
      description: 'Certified USATF fast course with pacers, elite field, records, and PR potential.',
    },
    { now: '2026-07-31T12:00:00Z' },
  );
  const trail = classifyTemplateFits(
    {
      ...baseCandidate,
      raceName: 'Mountain Ridge Trail 50K',
      distances: ['50K', '25K'],
      description: 'Technical mountain trail ultra adventure with aid stations and rugged terrain.',
    },
    { now: '2026-07-31T12:00:00Z' },
  );

  assert.equal(performance.primaryTemplateFit, 'performance');
  assert.equal(performance.recommendedLane, 'performance_candidate');
  assert.equal(trail.primaryTemplateFit, 'trail_adventure');
  assert.equal(trail.recommendedLane, 'trail_adventure_candidate');
});

test('dedupes against existing outreach or generation before active backlog promotion', () => {
  const result = prioritizeMockupCandidate(baseCandidate, {
    now: '2026-07-31T12:00:00Z',
    jobs: [
      {
        registrationPlatform: 'runsignup',
        registrationRaceId: '12345',
        sourceUrl: baseCandidate.sourceUrl,
        job_status: 'outreach_sent',
        outreach_id: 'outreach-1',
      },
    ],
  });

  assert.equal(result.duplicateState, 'already_generated_or_contacted');
  assert.equal(result.backlogBucket, 'exclude_existing');
});

test('prioritizes ranked buckets for the production queue', () => {
  const ranked = prioritizeMockupBacklog(
    [
      baseCandidate,
      {
        ...baseCandidate,
        raceName: 'Lower Value Form Only 5K',
        officialUrl: null,
        contactSources: [{ type: 'form', url: 'https://runsignup.com/Race/TN/Franklin/LowerValue/Contact' }],
      },
    ],
    { now: '2026-07-31T12:00:00Z' },
  );

  assert.equal(ranked.counts.generate_now, 1);
  assert.equal(ranked.counts.research_contact_first, 1);
  assert.equal(ranked.byBucket.generate_now[0].raceName, baseCandidate.raceName);
});

test('summarizes contact viability conservatively', () => {
  assert.equal(summarizeContactViability({ contactSources: [] }).contactQuality, 'none');
  assert.equal(summarizeContactViability({ contactSources: [{ type: 'form', url: 'https://example.test/contact' }] }).contactQuality, 'form_only');
  assert.equal(summarizeContactViability({ contactSources: [{ type: 'email', value: 'director@example.test', role: 'Race Director' }] }).contactQuality, 'named_email');
});
