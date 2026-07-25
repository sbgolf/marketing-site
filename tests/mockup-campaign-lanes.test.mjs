import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyCampaignLane,
  scoreCampaignLaneCandidate,
  validateEmailTemplateForCampaignLane,
} from '../scripts/lib/mockup-campaign-lanes.mjs';
import { buildRaceMockupProspectPayload } from '../scripts/lib/mockup-prospect-upsert.mjs';
import { buildPreparedMockupOutreach } from '../scripts/lib/mockup-generation-outreach-handoff.mjs';

const now = '2026-07-25T12:00:00Z';

test('classifies RunSignup-only community prospects into lane A metadata', () => {
  const score = classifyCampaignLane({
    raceName: 'Example Hometown Gobble Jog 5K',
    eventDate: '2026-11-26',
    sourceUrl: 'https://runsignup.com/Race/GA/Example/HometownGobbleJog',
    registrationUrl: 'https://runsignup.com/Race/GA/Example/HometownGobbleJog',
    distances: ['5K', 'Kids Fun Run'],
    description: 'Annual hometown community family walk and fun run with packet pickup and race day details.',
    contactSources: [{ type: 'email', email: 'info@example-race.test' }],
    sourceCoverage: { date: true, location: true, distances: true, registration: true, contact: true },
  }, { now });

  assert.equal(score.campaignLane, 'A');
  assert.equal(score.emailTemplateKey, 'individual_mockup_v1');
  assert.equal(score.prospectType, 'runsignup_only_community_race');
  assert.equal(score.sendEligible, true);
});

test('classifies sponsor-heavy charity/community races into lane B when requested', () => {
  const score = scoreCampaignLaneCandidate({
    raceName: 'Example Memorial 5K',
    eventDate: '2026-10-10',
    sourceUrl: 'https://runsignup.com/Race/TN/Example/ExampleMemorial5K',
    registrationUrl: 'https://runsignup.com/Race/TN/Example/ExampleMemorial5K',
    distances: ['5K', 'Walk'],
    sponsorCount: 12,
    description: 'Annual foundation fundraiser benefiting student scholarships. Presented by local sponsors with donate and fundraising options.',
    contactSources: [{ type: 'email', email: 'director@example.test' }],
    sourceCoverage: { date: true, location: true, distances: true, registration: true, contact: true, sponsors: true, donations: true, fundraising: true, cause: true },
  }, 'B', { now });

  assert.equal(score.campaignLane, 'B');
  assert.equal(score.emailTemplateKey, 'sponsor_visibility_v1');
  assert.equal(score.sendEligible, true);
  assert.ok(score.segmentEvidence.some((item) => /sponsor/i.test(item)));
});

test('classifies outdated standalone race websites into lane C when requested', () => {
  const score = scoreCampaignLaneCandidate({
    raceName: 'Example River 10K',
    eventDate: '2026-10-17',
    officialUrl: 'https://exampleriver10k.test',
    registrationUrl: 'https://runsignup.com/Race/TN/Example/ExampleRiver10K',
    distances: ['10K', '5K'],
    description: 'Annual community race. Current WordPress site has old copyright, weak CTA, poor mobile layout, and registration buried below a flyer PDF.',
    contactSources: [{ type: 'email', email: 'race@example.test' }],
    sourceCoverage: { date: true, location: true, distances: true, registration: true, contact: true, outdated_site: true, weak_cta: true, poor_mobile: true, stale_content: true },
  }, 'C', { now });

  assert.equal(score.campaignLane, 'C');
  assert.equal(score.emailTemplateKey, 'outdated_site_modernization_v1');
  assert.equal(score.sendEligible, true);
});

test('lane D requires verified operator evidence and company recipient guardrails', () => {
  const operator = scoreCampaignLaneCandidate({
    companyName: 'Example Race Management Co.',
    raceName: 'Example Portfolio Race',
    eventDate: '2026-11-07',
    officialUrl: 'https://exampleracemanagement.test/events',
    registrationUrl: 'https://runsignup.com/Race/TN/Example/PortfolioRace',
    operatorEventCount: 8,
    description: 'Race management and timing services company with an event calendar for events we manage across the region.',
    contactSources: [{ type: 'routing_email', email: 'events@example.test' }],
    sourceCoverage: { date: true, location: true, distances: true, registration: true, contact: true, operator_event_count: 8 },
  }, 'D', { now });

  assert.equal(operator.campaignLane, 'D');
  assert.equal(operator.emailTemplateKey, 'operator_portfolio_v1');
  assert.equal(operator.sendEligible, true);
  assert.equal(validateEmailTemplateForCampaignLane({
    emailTemplateKey: 'operator_portfolio_v1',
    campaignLane: 'D',
    prospectType: 'race_management_company',
    operatorEventCount: 8,
    segmentEvidence: operator.segmentEvidence,
    recipientType: 'company_routing_email',
  }).length, 0);

  const wrongLaneErrors = validateEmailTemplateForCampaignLane({
    emailTemplateKey: 'operator_portfolio_v1',
    campaignLane: 'A',
    prospectType: 'runsignup_only_community_race',
    operatorEventCount: 1,
    segmentEvidence: ['RunSignup-only community race.'],
    recipientType: 'race_director',
  });
  assert.ok(wrongLaneErrors.some((error) => error.includes('only allowed for lane')));
  assert.ok(wrongLaneErrors.some((error) => error.includes('operator_event_count')));
  assert.ok(wrongLaneErrors.some((error) => error.includes('company/org/routing')));
});

test('prospect upsert payload stores campaign lane metadata without requiring new DB columns', () => {
  const payload = buildRaceMockupProspectPayload({
    raceName: 'Example Memorial 5K',
    eventDate: '2026-10-10',
    sourceUrl: 'https://runsignup.com/Race/TN/Example/ExampleMemorial5K',
    registrationUrl: 'https://runsignup.com/Race/TN/Example/ExampleMemorial5K',
    distances: ['5K', 'Walk'],
    campaignLane: 'B',
    sponsorCount: 10,
    description: 'Foundation fundraiser with sponsors, donate, and scholarship language.',
    contactSources: [{ type: 'email', email: 'director@example.test' }],
    sourceCoverage: { date: true, location: true, distances: true, registration: true, contact: true, sponsors: true, donations: true },
  }, { now });

  assert.equal(payload.metadata.campaign_lane, 'B');
  assert.equal(payload.metadata.prospect_type, 'sponsor_heavy_charity_race');
  assert.equal(payload.metadata.email_template_key, 'sponsor_visibility_v1');
  assert.ok(Array.isArray(payload.metadata.segment_evidence));
});

test('outreach handoff blocks operator template unless lane D evidence is present', () => {
  const generationJob = {
    id: 'job-abc',
    prospect_id: 'prospect-abc',
    template: 'community',
    mockup_url: 'https://mockups.startlinesites.com/private/mockups/exampletoken/',
    qa_status: 'passed',
    site_auditor_status: 'passed',
    owner_approval_status: 'approved',
    source_bundle: { race_name: 'Example Hometown 5K', registration_url: 'https://runsignup.com/Race/TN/Example/Hometown5K' },
  };
  const prospect = {
    id: 'prospect-abc',
    race_name: 'Example Hometown 5K',
    contact_sources: [{ type: 'email', email: 'director@example.test' }],
    metadata: {
      campaign_lane: 'A',
      prospect_type: 'runsignup_only_community_race',
      email_template_key: 'operator_portfolio_v1',
      segment_evidence: ['RunSignup-only community race.'],
      operator_event_count: 1,
      recipient_type: 'race_director',
    },
  };

  const prepared = buildPreparedMockupOutreach({ generationJob, prospect, ownerApprovedSend: true });
  assert.equal(prepared.ok, false);
  assert.ok(prepared.errors.some((error) => error.includes('operator_portfolio_v1')));
});
