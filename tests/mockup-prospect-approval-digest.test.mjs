import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMockupProspectApprovalDigest,
  extractDigestCandidates,
  validateDigestText,
} from '../scripts/lib/mockup-prospect-approval-digest.mjs';

const discoveryOutput = {
  source: 'runsignup_public_races_api',
  query: {
    city: 'Nashville',
    state: 'TN',
    startDate: '2026-10-01',
    endDate: '2027-05-01',
  },
  candidates: [
    {
      race_name: '9th Annual Nashville, TN Ostomy 5K',
      race_city: 'Nashville',
      race_state: 'TN',
      event_date: '2026-10-03',
      source_url: 'https://runsignup.com/Race/TN/Nashville/CookevilleOstomy5K',
      source_race_id: '50739',
      official_url: 'https://www.ostomy.org/5k',
      distances: ['5K', '1 Mile', 'Volunteer'],
      total_score: 82,
      qualification_status: 'qualified_for_mockup',
      qualification_reason: 'Strong local/community language. Cause, nonprofit, or fundraising language is present. No prior outreach flagged in input.',
      disqualifiers: [],
      lookup_filters: [
        'registration_platform=eq.runsignup&registration_race_id=eq.50739',
        'source_platform=eq.runsignup&source_race_id=eq.50739',
      ],
    },
    {
      race_name: 'Andrew Jackson 7K',
      race_city: 'Nashville',
      race_state: 'TN',
      event_date: '2026-10-17',
      source_url: 'https://runsignup.com/Race/TN/Nashville/AndrewJackson7thPresident7KRun',
      distances: ['7K', '2 Miles'],
      total_score: 85,
      qualification_status: 'needs_review',
      qualification_reason: 'Some local/community language. Contact form path found.',
      disqualifiers: ['Trail/ultra language is outside the current Community-first pilot.'],
      lookup_filters: ['source_url=eq.example'],
    },
  ],
};

test('extractDigestCandidates accepts discovery output or raw arrays', () => {
  assert.equal(extractDigestCandidates(discoveryOutput).length, 2);
  assert.equal(extractDigestCandidates(discoveryOutput.candidates).length, 2);
  assert.deepEqual(extractDigestCandidates({}), []);
});

test('approval digest is Telegram-readable and keeps Steve as the owner gate', () => {
  const digest = buildMockupProspectApprovalDigest(discoveryOutput, {
    generatedAt: '2026-07-15T12:00:00Z',
    limit: 1,
  });

  assert.match(digest, /StartLine mockup prospect approval digest/);
  assert.match(digest, /Generated: 2026-07-15T12:00:00Z/);
  assert.match(digest, /Source: runsignup_public_races_api \(Nashville \/ TN \/ 2026-10-01 \/ 2027-05-01\)/);
  assert.match(digest, /Owner gate: review only/);
  assert.match(digest, /1\. 9th Annual Nashville, TN Ostomy 5K/);
  assert.match(digest, /Score\/status: 82\/100 — qualified_for_mockup/);
  assert.match(digest, /Decision options: generate mockup \/ skip \/ needs edits \/ collect more info/);
  assert.doesNotMatch(digest, /2\. Andrew Jackson/);
});

test('approval digest includes risk checks and duplicate filters', () => {
  const digest = buildMockupProspectApprovalDigest(discoveryOutput, {
    generatedAt: '2026-07-15T12:00:00Z',
  });

  assert.match(digest, /Risks\/checks: No scoring disqualifiers flagged; verify source facts before generation\./);
  assert.match(digest, /Risks\/checks: Trail\/ultra language is outside the current Community-first pilot\./);
  assert.match(digest, /Duplicate checks: registration_platform=eq\.runsignup&registration_race_id=eq\.50739/);
  assert.match(digest, /Reply format: "Generate mockup for #N"/);
});

test('digest validation rejects Steve-rejected wording', () => {
  assert.deepEqual(validateDigestText('Private preview ready'), { ok: true, rejected_terms: [] });
  assert.equal(validateDigestText('This says no-index').ok, false);
  assert.equal(validateDigestText('Signed Bailey').ok, false);
});

test('empty digest is explicit instead of fabricating candidates', () => {
  const digest = buildMockupProspectApprovalDigest({ candidates: [] }, {
    generatedAt: '2026-07-15T12:00:00Z',
  });

  assert.match(digest, /No candidates found for this digest\./);
});
