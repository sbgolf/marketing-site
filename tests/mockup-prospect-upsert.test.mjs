import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProspectLookupFilters,
  buildRaceMockupProspectPayload,
  slugifyRace,
  validateRaceMockupProspectInput,
} from '../scripts/lib/mockup-prospect-upsert.mjs';

test('builds a scored Supabase payload for a RunSignup Community prospect', () => {
  const payload = buildRaceMockupProspectPayload(
    {
      raceName: 'Example Hometown 5K & Fun Run',
      raceCity: 'Nashville',
      raceState: 'TN',
      region: 'Middle Tennessee',
      eventDate: '2026-11-07',
      sourceUrl: 'https://runsignup.com/Race/TN/Nashville/ExampleHometown5K#details',
      sourceRaceId: '12345',
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
    { now: '2026-07-13T12:00:00Z', upsertSource: 'test' },
  );

  assert.equal(payload.race_name, 'Example Hometown 5K & Fun Run');
  assert.equal(payload.race_slug, 'example-hometown-5k-and-fun-run');
  assert.equal(payload.source_platform, 'runsignup');
  assert.equal(payload.registration_platform, 'runsignup');
  assert.equal(payload.source_race_id, '12345');
  assert.equal(payload.registration_race_id, '12345');
  assert.equal(payload.source_url, 'https://runsignup.com/Race/TN/Nashville/ExampleHometown5K');
  assert.equal(payload.qualification_status, 'qualified_for_mockup');
  assert.equal(payload.owner_approval_status, 'not_requested');
  assert.ok(payload.total_score >= 80);
  assert.deepEqual(payload.disqualifiers, []);
  assert.deepEqual(payload.extracted_facts.distances, ['5K', 'Kids Fun Run', 'Walk']);
  assert.equal(payload.metadata.upsert_source, 'test');
  assert.ok(payload.metadata.scoring_reasons.length > 0);
});

test('validates required race identity and http source URL', () => {
  assert.deepEqual(validateRaceMockupProspectInput({}), [
    'raceName is required.',
    'raceSlug could not be generated.',
    'sourceUrl or registrationUrl must be a valid http(s) URL.',
  ]);

  assert.deepEqual(
    validateRaceMockupProspectInput({ raceName: 'Bad URL 5K', sourceUrl: 'ftp://example.test/race' }),
    ['sourceUrl or registrationUrl must be a valid http(s) URL.'],
  );
});

test('builds deterministic duplicate lookup filters for upsert', () => {
  const payload = buildRaceMockupProspectPayload({
    raceName: 'Regional Charity 10K',
    sourceUrl: 'https://runsignup.com/Race/TN/Franklin/RegionalCharity10K',
    sourceRaceId: '67890',
    registrationRaceId: '67890',
  });

  assert.deepEqual(buildProspectLookupFilters(payload), [
    'registration_platform=eq.runsignup&registration_race_id=eq.67890',
    'source_platform=eq.runsignup&source_race_id=eq.67890',
    'source_url=eq.https%3A%2F%2Frunsignup.com%2FRace%2FTN%2FFranklin%2FRegionalCharity10K',
  ]);
});

test('slugifies race names for stable internal keys', () => {
  assert.equal(slugifyRace('St. Jude Walk/Run & Kids Dash!'), 'st-jude-walk-run-and-kids-dash');
});
