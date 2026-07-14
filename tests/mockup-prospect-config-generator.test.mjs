import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCommunityMockupConfig,
  extractConfigCandidates,
  selectConfigCandidate,
} from '../scripts/lib/mockup-prospect-config-generator.mjs';

const discoveryOutput = {
  candidates: [
    {
      race_name: 'Andrew Jackson 7K',
      race_city: 'Nashville',
      race_state: 'TN',
      event_date: '2026-10-17',
      source_url: 'https://runsignup.com/Race/TN/Nashville/AndrewJackson7thPresident7KRun',
      source_race_id: '193775',
      registration_url: 'https://runsignup.com/Race/TN/Nashville/AndrewJackson7thPresident7KRun',
      registration_platform: 'runsignup',
      distances: ['7K', '2 Miles'],
      total_score: 85,
      qualification_status: 'needs_review',
      qualification_reason: 'Some local/community language.',
      disqualifiers: ['Trail/ultra language is outside the current Community-first pilot.'],
    },
    {
      race_name: '9th Annual Nashville, TN Ostomy 5K',
      race_city: 'Nashville',
      race_state: 'TN',
      event_date: '2026-10-03',
      source_url: 'https://runsignup.com/Race/TN/Nashville/CookevilleOstomy5K',
      source_race_id: '50739',
      registration_url: 'https://runsignup.com/Race/TN/Nashville/CookevilleOstomy5K',
      registration_platform: 'runsignup',
      registration_race_id: '50739',
      official_url: 'https://www.ostomy.org/5k',
      distances: ['5K', '1 Mile', 'Volunteer'],
      description: 'A community 5K supporting ostomy awareness.',
      total_score: 82,
      qualification_status: 'qualified_for_mockup',
      qualification_reason: 'Strong local/community language. Cause, nonprofit, or fundraising language is present.',
      disqualifiers: [],
      source_coverage: {
        date: true,
        location: true,
        distances: true,
        registration: true,
        contact: true,
      },
    },
  ],
};

const token = '0123456789abcdef0123456789abcdef';

test('extractConfigCandidates accepts digest/discovery candidate arrays', () => {
  assert.equal(extractConfigCandidates(discoveryOutput).length, 2);
  assert.equal(extractConfigCandidates(discoveryOutput.candidates).length, 2);
  assert.deepEqual(extractConfigCandidates({}), []);
});

test('selectConfigCandidate defaults to the first qualified candidate', () => {
  const candidate = selectConfigCandidate(discoveryOutput);
  assert.equal(candidate.raceName, '9th Annual Nashville, TN Ostomy 5K');
});

test('community mockup config is race-template compatible and source-backed', () => {
  const config = buildCommunityMockupConfig(selectConfigCandidate(discoveryOutput), {
    ownerApproved: true,
    token,
  });

  assert.equal(config.identity.template, 'community');
  assert.equal(config.identity.name, '9th Annual Nashville, TN Ostomy 5K');
  assert.equal(config.event.date, '2026-10-03');
  assert.equal(config.event.location, 'Nashville, TN');
  assert.equal(config.registration.url, 'https://runsignup.com/Race/TN/Nashville/CookevilleOstomy5K');
  assert.equal(config.private_mockup.access_token, token);
  assert.equal(config.private_mockup.route, `/private/mockups/${token}/`);
  assert.equal(config.private_mockup.noindex, true);
  assert.equal(config.private_mockup.owner_approved_for_generation, true);
  assert.deepEqual(config.distances.map((distance) => distance.name), ['5K', '1 Mile', 'Volunteer']);
  assert.deepEqual(config.runner_decision_checklist.items.map((item) => item.id), ['date', 'distance', 'location']);
  assert.doesNotMatch(JSON.stringify(config), /no-index|Bailey/i);
});

test('config generation remains owner-gated and blocks disqualified candidates', () => {
  assert.throws(
    () => buildCommunityMockupConfig(selectConfigCandidate(discoveryOutput), { token }),
    /Owner approval is required/
  );
  assert.throws(
    () => buildCommunityMockupConfig(selectConfigCandidate(discoveryOutput, { candidateIndex: 1 }), { ownerApproved: true, token }),
    /not qualified_for_mockup|disqualifiers/
  );
});

test('config generation omits unavailable optional sections instead of placeholders', () => {
  const config = buildCommunityMockupConfig(selectConfigCandidate(discoveryOutput), { ownerApproved: true, token });
  assert.equal(config.course, undefined);
  assert.equal(config.schedule, undefined);
  assert.equal(config.sponsors, undefined);
  assert.equal(config.photo_galleries, undefined);
  assert.doesNotMatch(JSON.stringify(config), /TBD|coming soon|unknown/i);
});
