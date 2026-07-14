import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRunSignupRacesUrl,
  normalizeRunSignupRaceToProspectInput,
  scoreRunSignupDiscoveryResponse,
} from '../scripts/lib/runsignup-prospect-discovery.mjs';

test('buildRunSignupRacesUrl keeps discovery focused on public JSON races API', () => {
  const url = buildRunSignupRacesUrl({ state: 'TN', city: 'Nashville', startDate: '2026-10-01', endDate: '2027-05-01', resultsPerPage: 10 });
  assert.equal(url.origin + url.pathname, 'https://api.runsignup.com/rest/races');
  assert.equal(url.searchParams.get('format'), 'json');
  assert.equal(url.searchParams.get('events'), 'T');
  assert.equal(url.searchParams.get('state'), 'TN');
  assert.equal(url.searchParams.get('city'), 'Nashville');
  assert.equal(url.searchParams.get('results_per_page'), '10');
});

test('normalizeRunSignupRaceToProspectInput extracts source-backed prospect fields', () => {
  const prospect = normalizeRunSignupRaceToProspectInput({ race: sampleCommunityRace() }, { query: { state: 'TN' } });
  assert.equal(prospect.raceName, 'Hometown Harvest 5K & Fun Run');
  assert.equal(prospect.sourcePlatform, 'runsignup');
  assert.equal(prospect.sourceRaceId, '98765');
  assert.equal(prospect.registrationUrl, 'https://runsignup.com/Race/TN/Franklin/HometownHarvest5K');
  assert.equal(prospect.officialUrl, 'https://hometownharvest.org/');
  assert.equal(prospect.raceCity, 'Franklin');
  assert.equal(prospect.raceState, 'TN');
  assert.equal(prospect.eventDate, '2026-11-14');
  assert.deepEqual(prospect.distances, ['5K', '1 Mile', 'Kids Dash']);
  assert.equal(prospect.sourceCoverage.contact, true);
  assert.match(prospect.description, /local school foundation/);
});

test('scoreRunSignupDiscoveryResponse sorts candidates by Community prospect score', () => {
  const results = scoreRunSignupDiscoveryResponse({
    races: [
      { race: sampleTrailRace() },
      { race: sampleCommunityRace() },
    ],
  }, { now: '2026-07-15T12:00:00Z' });

  assert.equal(results.length, 2);
  assert.equal(results[0].payload.race_name, 'Hometown Harvest 5K & Fun Run');
  assert.equal(results[0].payload.qualification_status, 'qualified_for_mockup');
  assert.ok(results[0].payload.total_score > results[1].payload.total_score);
  assert.match(results[1].payload.disqualifiers.join(' '), /Trail\/ultra/);
  assert.ok(results[0].lookup_filters.some((filter) => filter.includes('source_race_id=eq.98765')));
});

const sampleCommunityRace = () => ({
  race_id: 98765,
  name: 'Hometown Harvest 5K & Fun Run',
  next_date: '11/14/2026',
  description: '<p>Annual community fundraiser supporting the local school foundation. Families can run, walk, and join the kids dash. Race day schedule and parking details are posted.</p>',
  url: 'https://runsignup.com/Race/TN/Franklin/HometownHarvest5K',
  external_race_url: 'https://hometownharvest.org',
  is_registration_open: 'T',
  timezone: 'America/Chicago',
  address: {
    city: 'Franklin',
    state: 'TN',
    street: '100 Main St',
    zipcode: '37064',
    country_code: 'US',
  },
  events: [
    { name: '5K Run/Walk', distance: '5K', start_time: '11/14/2026 08:00' },
    { name: 'One Mile Fun Run', distance: '1 Mile', start_time: '11/14/2026 09:00' },
    { name: 'Kids Dash', distance: 'Kids Dash', start_time: '11/14/2026 09:30' },
  ],
});

const sampleTrailRace = () => ({
  race_id: 333,
  name: 'Mountain Ridge Trail 50K',
  next_date: '10/03/2026',
  description: '<p>Technical mountain trail ultra with 50K and 100K distances.</p>',
  url: 'https://runsignup.com/Race/TN/Chattanooga/MountainRidgeTrail50K',
  external_race_url: null,
  address: { city: 'Chattanooga', state: 'TN', country_code: 'US' },
  events: [
    { name: '50K', distance: '50K', start_time: '10/03/2026 07:00' },
    { name: '100K', distance: '100K', start_time: '10/03/2026 06:00' },
  ],
});
