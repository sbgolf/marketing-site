import assert from 'node:assert/strict';
import test from 'node:test';

import { scoreCommunityProspect } from '../scripts/lib/mockup-prospect-scoring.mjs';

test('scores a local RunSignup community race as qualified for mockup', () => {
  const score = scoreCommunityProspect(
    {
      raceName: 'Example Hometown 5K & Fun Run',
      raceCity: 'Nashville',
      raceState: 'TN',
      eventDate: '2026-11-07',
      sourcePlatform: 'runsignup',
      sourceUrl: 'https://runsignup.com/Race/TN/Nashville/ExampleHometown5K',
      registrationUrl: 'https://runsignup.com/Race/TN/Nashville/ExampleHometown5K',
      distances: ['5K', 'Kids Fun Run', 'Walk'],
      description:
        'A family-friendly community race and annual school fundraiser benefiting local students, with packet pickup, race day parking, sponsors, and a Contact the Race form.',
      contactSources: [{ type: 'form', url: 'https://runsignup.com/Race/Contact/TN/Nashville/ExampleHometown5K' }],
      sourceCoverage: {
        date: true,
        location: true,
        distances: true,
        registration: true,
        schedule: true,
        contact: true,
        cause: true,
      },
    },
    { now: '2026-07-13T12:00:00Z' },
  );

  assert.equal(score.recommendedTemplate, 'community');
  assert.equal(score.qualificationStatus, 'qualified_for_mockup');
  assert.equal(score.ownerApprovalStatus, 'not_requested');
  assert.ok(score.totalScore >= 80);
  assert.deepEqual(score.disqualifiers, []);
});

test('keeps high-score non-RunSignup races in review instead of send-ready qualification', () => {
  const score = scoreCommunityProspect(
    {
      raceName: 'Regional Charity 10K',
      raceCity: 'Franklin',
      raceState: 'TN',
      eventDate: '2026-10-10',
      sourcePlatform: 'other',
      sourceUrl: 'https://example-race.test/regional-charity-10k',
      registrationUrl: 'https://example-race.test/register',
      distances: ['10K', '5K', 'Kids Run'],
      description:
        'Annual community family fundraiser benefiting a local foundation with race day logistics, packet pickup, sponsors, and contact email.',
      contactSources: [{ type: 'email', value: 'director@example-race.test' }],
      sourceCoverage: {
        date: true,
        location: true,
        distances: true,
        registration: true,
        schedule: true,
        contact: true,
        cause: true,
      },
    },
    { now: '2026-07-13T12:00:00Z' },
  );

  assert.ok(score.totalScore >= 65);
  assert.notEqual(score.qualificationStatus, 'qualified_for_mockup');
  assert.ok(score.disqualifiers.some((item) => item.includes('RunSignup')));
});

test('skips likely performance or trail races for the Community-first pilot', () => {
  const performanceScore = scoreCommunityProspect(
    {
      raceName: 'Fast City Half Marathon',
      raceCity: 'Nashville',
      raceState: 'TN',
      eventDate: '2026-11-07',
      sourcePlatform: 'runsignup',
      sourceUrl: 'https://runsignup.com/Race/TN/Nashville/FastCityHalf',
      registrationUrl: 'https://runsignup.com/Race/TN/Nashville/FastCityHalf',
      distances: ['Half Marathon'],
      description: 'A certified PR course with elite fields, records, pacers, and Boston qualifier style positioning.',
      contactSources: [{ type: 'form', url: 'https://runsignup.com/Race/Contact/TN/Nashville/FastCityHalf' }],
      sourceCoverage: { date: true, location: true, distances: true, registration: true, contact: true },
    },
    { now: '2026-07-13T12:00:00Z' },
  );

  const trailScore = scoreCommunityProspect(
    {
      raceName: 'Mountain Trail 50K',
      raceCity: 'Chattanooga',
      raceState: 'TN',
      eventDate: '2026-11-07',
      sourcePlatform: 'runsignup',
      sourceUrl: 'https://runsignup.com/Race/TN/Chattanooga/MountainTrail50K',
      registrationUrl: 'https://runsignup.com/Race/TN/Chattanooga/MountainTrail50K',
      distances: ['50K', '25K'],
      description: 'A technical mountain trail ultra with rugged terrain.',
      contactSources: [{ type: 'form', url: 'https://runsignup.com/Race/Contact/TN/Chattanooga/MountainTrail50K' }],
      sourceCoverage: { date: true, location: true, distances: true, registration: true, contact: true },
    },
    { now: '2026-07-13T12:00:00Z' },
  );

  assert.ok(performanceScore.disqualifiers.some((item) => item.includes('Performance')));
  assert.ok(trailScore.disqualifiers.some((item) => item.includes('Trail')));
  assert.notEqual(performanceScore.qualificationStatus, 'qualified_for_mockup');
  assert.notEqual(trailScore.qualificationStatus, 'qualified_for_mockup');
});

test('performance keyword matching does not flag pr inside ordinary words', () => {
  const score = scoreCommunityProspect(
    {
      raceName: '7th President 7K Run',
      raceCity: 'Nashville',
      raceState: 'TN',
      eventDate: '2026-10-17',
      sourcePlatform: 'runsignup',
      sourceUrl: 'https://runsignup.com/Race/TN/Nashville/AndrewJackson7thPresident7KRun',
      registrationUrl: 'https://runsignup.com/Race/TN/Nashville/AndrewJackson7thPresident7KRun',
      distances: ['7K', '2 Miles'],
      description: 'Annual community fundraiser with local history, a walk option, packet pickup, and contact form.',
      contactSources: [{ type: 'form', url: 'https://runsignup.com/Race/TN/Nashville/AndrewJackson7thPresident7KRun/Contact' }],
      sourceCoverage: { date: true, location: true, distances: true, registration: true, schedule: true, contact: true, cause: true },
    },
    { now: '2026-07-13T12:00:00Z' },
  );

  assert.equal(score.disqualifiers.some((item) => item.includes('Performance')), false);
});
