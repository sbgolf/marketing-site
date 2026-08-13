import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPERIMENT_ID,
  validatePilotInitialSend,
  classifyEngagementSignal,
  buildFollowupReview,
  buildInitialEmailPreview,
  buildOpenedFollowupPreview,
  buildClickedFollowupPreview,
  validateNoSendText,
  buildOwnerReviewDossierItem,
  validateFollowupPayload,
  terminologyContract,
  classifyCandidateUrl,
  isFollowupSignalExpired,
} from '../scripts/lib/community-pilot-governance.mjs';

import {
  createReadOnlyRequester,
} from '../scripts/build-community-pilot-dry-run-dossier.mjs';

const prospect = (overrides = {}) => ({
  id: 'prospect-1',
  race_name: 'River Town 5K',
  race_city: 'Austin',
  race_state: 'TX',
  event_date: '2026-11-14',
  source_platform: 'runsignup',
  source_race_id: '12345',
  registration_url: 'https://runsignup.com/Race/TX/Austin/RiverTown5K',
  prospect_type: 'runsignup_first_community_race',
  campaign_lane: 'lane_a',
  recommended_template: 'community',
  official_url: '',
  official_site_assessment: 'verified no meaningful standalone website; RunSignup-first public race page only',
  contact_sources: [{ type: 'email', email: 'director@example.test', confidence: 'source_backed', role: 'race_director' }],
  ...overrides,
});
const job = (overrides = {}) => ({
  id: 'job-1',
  prospect_id: 'prospect-1',
  template: 'community',
  mockup_url: 'https://mockups.startlinesites.com/private/mockups/token/',
  qa_status: 'passed',
  site_auditor_status: 'passed',
  source_bundle: { source_platform: 'runsignup', source_race_id: '12345' },
  ...overrides,
});

test('terminology contract distinguishes template, lane, offer, tier, experiment, and signal confidence terms', () => {
  for (const key of ['mockup_template_family', 'campaign_lane', 'initial_email_template_id', 'followup_scenario', 'followup_template_id', 'commercial_offer_id', 'recommended_tier', 'experiment_id', 'engagement_signal_confidence']) assert.ok(terminologyContract[key]);
});

test('valid Lane A Community dry-run candidate produces complete attribution and no send approval', () => {
  const result = validatePilotInitialSend({ prospect: prospect(), generationJob: job() });
  assert.equal(result.ok, true);
  assert.equal(result.attribution_payload.experiment_id, EXPERIMENT_ID);
  assert.equal(result.attribution_payload.campaign_lane, 'lane_a');
  assert.equal(result.attribution_payload.mockup_template_family, 'community');
  assert.equal(result.attribution_payload.owner_approval_status, 'not_requested_phase_2a1_preview_only');
  assert.equal(result.attribution_payload.test_live_classification, 'dry_run_no_send');
});

test('missing experiment-critical attribution blocks send preparation', () => {
  const result = validatePilotInitialSend({ prospect: prospect({ id: '', source_race_id: '' }), generationJob: job({ id: '', mockup_url: '' }) });
  assert.equal(result.ok, false);
  assert.match(result.blockers.join('\n'), /missing attribution fields|Community mockup URL/);
});

test('more than one recipient blocks pilot send preparation', () => {
  const result = validatePilotInitialSend({ prospect: prospect({ contact_sources: [{ email: 'a@example.test' }, { email: 'b@example.test' }] }), generationJob: job() });
  assert.equal(result.ok, false);
  assert.match(result.blockers.join('\n'), /one recipient/);
});

test('contact-form-only prospect is excluded', () => {
  const result = validatePilotInitialSend({ prospect: prospect({ contact_form_url: 'https://example.test/contact', contact_sources: [] }), generationJob: job() });
  assert.equal(result.ok, false);
  assert.match(result.blockers.join('\n'), /contact-form-only|verified direct/);
});

test('genuine standalone website excludes Lane A candidate', () => {
  const result = validatePilotInitialSend({ prospect: prospect({ official_url: 'https://race.example.test', official_site_assessment: 'credible dedicated standalone race website' }), generationJob: job() });
  assert.equal(result.ok, false);
  assert.match(result.blockers.join('\n'), /credible_standalone_website/);
});

test('missing official-site assessment and too-close race date fail closed', () => {
  const missingSite = validatePilotInitialSend({ prospect: prospect({ official_url: '', official_site_assessment: '' }), generationJob: job(), now: '2026-08-01T00:00:00Z' });
  assert.equal(missingSite.ok, false);
  assert.match(missingSite.blockers.join('\n'), /missing_official_site_assessment/);
  const tooClose = validatePilotInitialSend({ prospect: prospect({ event_date: '2026-08-15' }), generationJob: job(), now: '2026-08-01T00:00:00Z' });
  assert.equal(tooClose.ok, false);
  assert.match(tooClose.blockers.join('\n'), /race_too_close_to_event_day/);
});

test('private preview must be current and externally accessible', () => {
  const result = validatePilotInitialSend({ prospect: prospect(), generationJob: job({ mockup_url: 'http://localhost/private/mockups/token/', private_preview_current: false }) });
  assert.equal(result.ok, false);
  assert.match(result.blockers.join('\n'), /https URL|not current/);
});

test('suppressed, unsubscribed, bounced, complaint and prior outcomes block', () => {
  const cases = [
    { suppressions: [{ reason: 'complaint' }] },
    { prospect: prospect({ unsubscribed_at: '2026-01-01' }) },
    { prospect: prospect({ bounced_at: '2026-01-01' }) },
    { prospect: prospect({ complained_at: '2026-01-01' }) },
    { prospect: prospect({ prior_reply_at: '2026-01-01' }) },
    { prospect: prospect({ manual_contacted_at: '2026-01-01' }) },
    { prospect: prospect({ audit_request_id: 'audit-1' }) },
    { prospect: prospect({ proposal_id: 'proposal-1' }) },
    { prospect: prospect({ checkout_session_id: 'cs_test_1' }) },
    { prospect: prospect({ customer_record_id: 'customer-1' }) },
  ];
  for (const c of cases) assert.equal(validatePilotInitialSend({ prospect: c.prospect || prospect(), generationJob: job(), suppressions: c.suppressions || [] }).ok, false);
});

test('prior outreach and generation job outreach_id block duplicate sends', () => {
  assert.equal(validatePilotInitialSend({ prospect: prospect(), generationJob: job(), priorOutreach: [{ id: 'old' }] }).ok, false);
  assert.equal(validatePilotInitialSend({ prospect: prospect(), generationJob: job({ outreach_id: 'old' }) }).ok, false);
});

test('recipient-level matching prevents one recipient signal from qualifying another', () => {
  const signal = classifyEngagementSignal({ outreach: { recipient_email_hash: 'hash-a' }, events: [{ recipient_email_hash: 'hash-b', event_type: 'email.clicked' }], recipientEmailHash: 'hash-a' });
  assert.equal(signal.signal_type, 'no_signal');
});

test('click supersedes opened and opened cannot override clicked', () => {
  const signal = classifyEngagementSignal({ outreach: { recipient_email_hash: 'h', delivered_at: '2026-01-01T00:00:00Z' }, events: [{ recipient_email_hash: 'h', event_type: 'email.opened' }, { recipient_email_hash: 'h', event_type: 'email.clicked', event_timestamp: '2026-01-03T00:00:00Z' }], recipientEmailHash: 'h' });
  assert.equal(signal.signal_type, 'clicked_signal');
  assert.equal(signal.confidence, 'moderate_signal');
});

test('scanner-like immediate click remains possible automation and cannot auto-send', () => {
  const signal = classifyEngagementSignal({ outreach: { recipient_email_hash: 'h', delivered_at: '2026-01-01T00:00:00Z' }, events: [{ recipient_email_hash: 'h', event_type: 'email.clicked', event_timestamp: '2026-01-01T00:00:30Z' }], recipientEmailHash: 'h' });
  assert.equal(signal.signal_type, 'clicked_signal');
  assert.equal(signal.confidence, 'possible_automation');
});

test('open alone is raw_unverified and never human_confirmed', () => {
  const signal = classifyEngagementSignal({ outreach: { recipient_email_hash: 'h' }, events: [{ recipient_email_hash: 'h', event_type: 'email.opened' }], recipientEmailHash: 'h' });
  assert.equal(signal.signal_type, 'opened_signal');
  assert.equal(signal.confidence, 'raw_unverified');
});

test('human-confirmed state requires corroborating owner outcome and blocks automated follow-up', () => {
  const review = buildFollowupReview({ outreach: { recipient_email_hash: 'h' }, events: [{ recipient_email_hash: 'h', event_type: 'email.clicked' }], ownerState: { audit_request_id: 'audit-1' } });
  assert.equal(review.eligible, false);
  assert.ok(review.blockers.includes('audit_proposal_checkout_or_purchase_already_exists'));
});

test('one behavioral follow-up cap is enforced', () => {
  const review = buildFollowupReview({ outreach: { id: 'outreach-1', recipient_email_hash: 'h' }, events: [{ recipient_email_hash: 'h', event_type: 'email.clicked' }], priorFollowups: [{ id: 'fu-1' }] });
  assert.equal(review.eligible, false);
  assert.ok(review.blockers.includes('one_behavioral_followup_cap_reached'));
});

test('eligible follow-up review emits all required attribution fields', () => {
  const review = buildFollowupReview({ outreach: { id: 'outreach-1', recipient_email_hash: 'h' }, events: [{ recipient_email_hash: 'h', event_type: 'email.clicked', event_timestamp: '2026-01-03T00:00:00Z' }], now: '2026-01-04T00:00:00Z' });
  assert.equal(review.eligible, true);
  assert.deepEqual(validateFollowupPayload(review), []);
  assert.equal(review.source_outreach_id, 'outreach-1');
  assert.equal(review.engagement_recipient_hash, 'h');
  assert.equal(review.engagement_signal_type, 'clicked_signal');
  assert.equal(review.engagement_signal_confidence, 'moderate_signal');
});

test('follow-up requires opened or clicked signal and missing recipient is blocked', () => {
  const review = buildFollowupReview({ outreach: {}, events: [] });
  assert.equal(review.eligible, false);
  assert.ok(review.blockers.includes('missing_recipient_level_match'));
  assert.ok(review.blockers.includes('no_opened_or_clicked_signal_for_behavioral_followup'));
});

test('selected-race credit and prohibited wording are absent from pilot templates', () => {
  const text = [buildInitialEmailPreview({ raceName: 'River Town 5K' }), buildOpenedFollowupPreview({ raceName: 'River Town 5K' }), buildClickedFollowupPreview({ raceName: 'River Town 5K' })].join('\n');
  const validation = validateNoSendText(text);
  assert.equal(validation.ok, true);
  assert.doesNotMatch(text, /25%|\$750|selected-race credit|Premium|Custom growth|I saw you|we saw you/i);
  assert.doesNotMatch(text, /[—–]/);
});

test('dossier masks recipient and private token', () => {
  const item = buildOwnerReviewDossierItem({ prospect: prospect(), generationJob: job() });
  assert.equal(item.masked_recipient, 'di***[at]example.test');
  assert.match(item.community_mockup_url_redacted, /\[redacted-token\]/);
  assert.equal(item.final_dry_run_recommendation, 'INCLUDE');
});

test('Lane D/operator and non-community template are excluded', () => {
  assert.equal(validatePilotInitialSend({ prospect: prospect({ campaign_lane: 'D' }), generationJob: job() }).ok, false);
  assert.equal(validatePilotInitialSend({ prospect: prospect(), generationJob: job({ template: 'performance' }) }).ok, false);
});

test('Phase 2A-1 validation result contains no executable send path', () => {
  const item = buildOwnerReviewDossierItem({ prospect: prospect(), generationJob: job() });
  assert.equal(item.experiment_attribution_payload.owner_action_status, 'preview_only_steve_decision_required');
  assert.equal(item.experiment_attribution_payload.test_live_classification, 'dry_run_no_send');
});

test('dossier Supabase requester is read-only', async () => {
  const calls = [];
  const requester = createReadOnlyRequester(async (call) => {
    calls.push(call);
    return [];
  });
  await requester({ path: 'race_mockup_generation_jobs?select=id' });
  assert.equal(calls[0].method, 'GET');
  await assert.rejects(() => requester({ path: 'race_mockup_generation_jobs', method: 'POST', body: { id: 'x' } }), /read-only/);
});

test('URL semantics require a RunSignup race page, not RaceRoster, MemberOrg, or official operator URL', () => {
  assert.equal(classifyCandidateUrl('https://runsignup.com/Race/TX/Austin/RiverTown5K').category, 'runsignup_race_page');
  assert.equal(classifyCandidateUrl('https://runsignup.com/Club/TX/Austin/SomeOrg').category, 'runsignup_member_org_page');
  assert.equal(classifyCandidateUrl('https://raceroster.com/events/2026/123/river-town').category, 'other_registration_platform');
  assert.equal(classifyCandidateUrl('https://example-race-operator.org/events').category, 'official_operator_site');
  assert.equal(validatePilotInitialSend({ prospect: prospect({ registration_url: 'https://raceroster.com/events/2026/123/river-town' }), generationJob: job() }).ok, false);
  assert.match(validatePilotInitialSend({ prospect: prospect({ registration_url: 'https://runsignup.com/Club/TX/Austin/SomeOrg' }), generationJob: job() }).blockers.join('\n'), /runsignup_member_org_page/);
});

test('single synthetic non-production valid Lane A fixture proves INCLUDE path only', () => {
  const synthetic = buildOwnerReviewDossierItem({
    prospect: prospect({ id: 'synthetic-prospect-non-production', race_name: 'Synthetic Community 5K', source_race_id: 'synthetic-123' }),
    generationJob: job({ id: 'synthetic-job-non-production', prospect_id: 'synthetic-prospect-non-production' }),
  });
  assert.equal(synthetic.final_dry_run_recommendation, 'INCLUDE');
  assert.equal(synthetic.experiment_attribution_payload.recommended_tier, 'standard');
  assert.equal(synthetic.experiment_attribution_payload.fallback_tier, 'starter');
  assert.equal(synthetic.experiment_attribution_payload.test_live_classification, 'dry_run_no_send');
  assert.doesNotMatch(synthetic.initial_email_preview, /25%|Premium|Custom|BMQR/i);
});

test('ten Chicago business-day follow-up signal expiry is enforced', () => {
  assert.equal(isFollowupSignalExpired({ signalAt: '2026-08-03T15:00:00Z', now: '2026-08-14T15:00:00Z' }), false);
  assert.equal(isFollowupSignalExpired({ signalAt: '2026-08-03T15:00:00Z', now: '2026-08-18T15:00:00Z' }), true);
  const review = buildFollowupReview({ outreach: { id: 'outreach-1', recipient_email_hash: 'h' }, events: [{ recipient_email_hash: 'h', event_type: 'email.clicked', event_timestamp: '2026-08-03T15:00:00Z' }], now: '2026-08-18T15:00:00Z' });
  assert.equal(review.eligible, false);
  assert.match(review.blockers.join('\n'), /expired/);
});
