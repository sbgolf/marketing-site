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
  experimentConfig,
  CAMPAIGN_LANE,
  MOCKUP_TEMPLATE_FAMILY,
  COMMERCIAL_OFFER_ID,
  INITIAL_EMAIL_TEMPLATE_ID,
  INITIAL_EMAIL_TEMPLATE_VERSION,
  OPENED_FOLLOWUP_TEMPLATE_ID,
  CLICKED_FOLLOWUP_TEMPLATE_ID,
  FOLLOWUP_SIGNAL_EXPIRY_BUSINESS_DAYS,
  OPENED_FOLLOWUP_TEMPLATE_VERSION,
  CLICKED_FOLLOWUP_TEMPLATE_VERSION,
  requiredAttributionFields,
  requiredFollowupFields,
  hashRecipient,
} from '../scripts/lib/community-pilot-governance.mjs';

import {
  createReadOnlyRequester,
  loadPagedRows,
  loadReadOnlySupabaseCandidates,
  buildSuppressionFilters,
  buildExclusionWaterfall,
  buildExclusionWaterfallMarkdown,
  buildCommercialHistoryMarkdown,
  buildPrivateTruthTableMarkdown,
  buildLastMileCandidateCardMarkdown,
  classifyLastMileVisibility,
  selectLatestCommunityJobByProspect,
} from '../scripts/build-community-pilot-dry-run-dossier.mjs';

import {
  findOutcomeEvidenceForCandidate,
  findPriorOutreachForCandidate,
  normalizeGenerationJobRow,
  normalizeProspectRow,
  classifyOutreachHistoryRow,
  summarizeOutreachHistory,
  classifyCommercialHistory,
} from '../scripts/lib/community-pilot-production-adapter.mjs';

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
  official_site_assessment: 'no_meaningful_standalone_site',
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
  source_bundle: { source_platform: 'runsignup', source_race_id: '12345', registration_url: 'https://runsignup.com/Race/TX/Austin/RiverTown5K' },
  private_preview_current: true,
  private_preview_accessible: true,
  ...overrides,
});
const sourceOutreach = (overrides = {}) => ({
  id: 'outreach-1',
  recipient_email_hash: 'h',
  experiment_id: 'sls_community_lane_a_pilot_v1',
  campaign_lane: 'lane_a',
  initial_email_template_id: 'individual_mockup_v1',
  initial_email_template_version: 'pilot_no_credit_v1',
  commercial_offer_id: 'community_dedicated_race_site_v1',
  recommended_tier: 'standard',
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
  const result = validatePilotInitialSend({ prospect: prospect({ contact_sources: [{ email: 'a@example.test', confidence: 'source_backed' }, { email: 'b@example.test', confidence: 'source_backed' }] }), generationJob: job() });
  assert.equal(result.ok, false);
  assert.match(result.blockers.join('\n'), /multiple verified recipients/);
});

test('contact-form-only prospect is excluded', () => {
  const result = validatePilotInitialSend({ prospect: prospect({ contact_form_url: 'https://example.test/contact', contact_sources: [] }), generationJob: job() });
  assert.equal(result.ok, false);
  assert.match(result.blockers.join('\n'), /contact-form-only|verified direct/);
});

test('genuine standalone website excludes Lane A candidate', () => {
  const result = validatePilotInitialSend({ prospect: prospect({ official_url: 'https://race.example.test', official_site_assessment: 'credible dedicated standalone race website' }), generationJob: job() });
  assert.equal(result.ok, false);
  assert.match(result.blockers.join('\n'), /credible_standalone_race_site/);
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
  const signal = classifyEngagementSignal({ outreach: { id: 'outreach-a', recipient_email_hash: 'hash-a' }, events: [{ outreach_id: 'outreach-a', recipient_email_hash: 'hash-b', event_type: 'email.clicked' }], recipientEmailHash: 'hash-a' });
  assert.equal(signal.signal_type, 'no_signal');
});

test('click supersedes opened and opened cannot override clicked', () => {
  const signal = classifyEngagementSignal({ outreach: sourceOutreach({ delivered_at: '2026-01-01T00:00:00Z' }), events: [{ outreach_id: 'outreach-1', recipient_email_hash: 'h', event_type: 'email.opened', event_timestamp: '2026-01-02T00:00:00Z' }, { outreach_id: 'outreach-1', recipient_email_hash: 'h', event_type: 'email.clicked', event_timestamp: '2026-01-03T00:00:00Z' }], recipientEmailHash: 'h' });
  assert.equal(signal.signal_type, 'clicked_signal');
  assert.equal(signal.confidence, 'moderate_signal');
});

test('scanner-like immediate click remains possible automation and cannot auto-send', () => {
  const signal = classifyEngagementSignal({ outreach: sourceOutreach({ delivered_at: '2026-01-01T00:00:00Z' }), events: [{ outreach_id: 'outreach-1', recipient_email_hash: 'h', event_type: 'email.clicked', event_timestamp: '2026-01-01T00:00:30Z' }], recipientEmailHash: 'h' });
  assert.equal(signal.signal_type, 'clicked_signal');
  assert.equal(signal.confidence, 'possible_automation');
});

test('open alone is raw_unverified and never human_confirmed', () => {
  const signal = classifyEngagementSignal({ outreach: sourceOutreach(), events: [{ outreach_id: 'outreach-1', recipient_email_hash: 'h', event_type: 'email.opened', event_timestamp: '2026-01-01T00:00:00Z' }], recipientEmailHash: 'h' });
  assert.equal(signal.signal_type, 'opened_signal');
  assert.equal(signal.confidence, 'raw_unverified');
});

test('human-confirmed state requires corroborating owner outcome and blocks automated follow-up', () => {
  const review = buildFollowupReview({ outreach: sourceOutreach(), events: [{ outreach_id: 'outreach-1', recipient_email_hash: 'h', event_type: 'email.clicked', event_timestamp: '2026-01-03T00:00:00Z' }], ownerState: { audit_request_id: 'audit-1' }, now: '2026-01-07T00:00:00Z' });
  assert.equal(review.eligible, false);
  assert.ok(review.blockers.includes('audit_proposal_checkout_or_purchase_already_exists'));
});

test('one behavioral follow-up cap is enforced', () => {
  const review = buildFollowupReview({ outreach: sourceOutreach(), events: [{ outreach_id: 'outreach-1', recipient_email_hash: 'h', event_type: 'email.clicked', event_timestamp: '2026-01-03T00:00:00Z' }], priorFollowups: [{ id: 'fu-1' }], now: '2026-01-07T00:00:00Z' });
  assert.equal(review.eligible, false);
  assert.ok(review.blockers.includes('one_behavioral_followup_cap_reached'));
});

test('eligible follow-up review emits all required attribution fields', () => {
  const review = buildFollowupReview({ outreach: sourceOutreach(), events: [{ outreach_id: 'outreach-1', recipient_email_hash: 'h', event_type: 'email.clicked', event_timestamp: '2026-01-03T00:00:00Z' }], now: '2026-01-07T00:00:00Z' });
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
  const review = buildFollowupReview({ outreach: sourceOutreach(), events: [{ outreach_id: 'outreach-1', recipient_email_hash: 'h', event_type: 'email.clicked', event_timestamp: '2026-08-03T15:00:00Z' }], now: '2026-08-18T15:00:00Z' });
  assert.equal(review.eligible, false);
  assert.match(review.blockers.join('\n'), /expired/);
});

test('missing lane, prospect type, source platform, registration URL, unknown date, and past date fail closed', () => {
  const cases = [
    [prospect({ campaign_lane: '' }), job(), /campaign_lane is required/],
    [prospect({ prospect_type: '' }), job(), /prospect_type is required/],
    [prospect({ source_platform: '' }), job({ source_bundle: { source_race_id: '12345', registration_url: 'https://runsignup.com/Race/TX/Austin/RiverTown5K' } }), /source_platform is required/],
    [prospect({ registration_url: '', source_url: 'https:\/\/runsignup.com\/Race\/TX\/Austin\/Fallback' }), job({ source_bundle: { source_platform: 'runsignup', source_race_id: '12345' } }), /registration_url is required/],
    [prospect({ event_date: '' }), job(), /valid future race date/],
    [prospect({ event_date: '2026-01-01' }), job(), /past/],
  ];
  for (const [p, j, rx] of cases) assert.match(validatePilotInitialSend({ prospect: p, generationJob: j, now: '2026-08-01T00:00:00Z' }).blockers.join('\n'), rx);
});

test('contact-form URL plus verified email is not contact-form-only', () => {
  const result = validatePilotInitialSend({ prospect: prospect({ contact_form_url: 'https://race.example/contact' }), generationJob: job() });
  assert.equal(result.ok, true);
  assert.doesNotMatch(result.blockers.join('\n'), /contact-form-only/);
});

test('multiple verified contacts produce NEEDS STEVE DECISION, not INCLUDE', () => {
  const item = buildOwnerReviewDossierItem({ prospect: prospect({ contact_sources: [{ email: 'a@example.test', confidence: 'source_backed' }, { email: 'b@example.test', confidence: 'source_backed' }] }), generationJob: job() });
  assert.equal(item.final_dry_run_recommendation, 'NEEDS_STEVE_DECISION — SELECT_ONE_RECIPIENT');
  assert.notEqual(item.final_dry_run_recommendation, 'INCLUDE');
});

test('no meaningful standalone site prose is not misclassified as credible without explicit classification', () => {
  const result = validatePilotInitialSend({ prospect: prospect({ official_site_assessment: 'no meaningful standalone website' }), generationJob: job() });
  assert.match(result.blockers.join('\n'), /official_site_requires_explicit_classification/);
  assert.doesNotMatch(result.blockers.join('\n'), /credible_standalone/);
});

test('HTTPS preview without explicit current/accessibility evidence fails', () => {
  const result = validatePilotInitialSend({ prospect: prospect(), generationJob: job({ private_preview_current: undefined, private_preview_accessible: undefined }) });
  assert.equal(result.ok, false);
  assert.match(result.blockers.join('\n'), /current evidence|accessibility evidence/);
});

test('arbitrary contact_email is not verified without source-backed evidence', () => {
  const result = validatePilotInitialSend({ prospect: prospect({ contact_email: 'maybe@example.test', contact_sources: [] }), generationJob: job() });
  assert.equal(result.recommendation, 'NEEDS_STEVE_DECISION — CONTACT_VERIFICATION');
  assert.match(result.blockers.join('\n'), /unverified email|verified direct/);
});

test('required Supabase query failure exits nonzero through required read wrapper', async () => {
  await assert.rejects(() => loadPagedRows({ request: async () => { throw new Error('boom'); }, table: 'race_mockup_generation_jobs', stage: 'generation_jobs' }), /required Supabase read failed at generation_jobs:page_1/);
});

test('pagination reconciles the full universe beyond one page', async () => {
  const calls = [];
  const request = async ({ path }) => {
    calls.push(path);
    if (path.includes('offset=0')) return Array.from({ length: 100 }, (_, i) => ({ id: `row-${i}` }));
    if (path.includes('offset=100')) return Array.from({ length: 23 }, (_, i) => ({ id: `row-${i + 100}` }));
    return [];
  };
  const result = await loadPagedRows({ request, table: 'race_mockup_generation_jobs', pageSize: 100 });
  assert.equal(result.rows.length, 123);
  assert.equal(result.pageCount, 2);
  assert.equal(calls.length, 2);
});

test('suppression and broader duplicate evidence block during full scan', async () => {
  const calls = [];
  const requester = async ({ path }) => {
    calls.push(path);
    if (path.startsWith('race_mockup_generation_jobs')) return calls.filter((p) => p.startsWith('race_mockup_generation_jobs')).length === 1 ? [job()] : [];
    if (path.startsWith('race_mockup_prospects')) return [prospect()];
    if (path.startsWith('race_mockup_outreach')) return [{ id: 'prior-prospect', metadata: { prospect_id: 'prospect-1', generation_job_id: 'job-1' } }];
    if (path.startsWith('outreach_suppressions')) return [{ id: 'suppression-1' }];
    return [];
  };
  const result = await loadReadOnlySupabaseCandidates({ requester });
  assert.equal(result.items[0].final_dry_run_recommendation, 'NEEDS_STEVE_DECISION — MANUAL_HISTORY_CONFIRMATION');
  assert.match(result.items[0].owner_concerns.join('\n'), /manual history confirmation|ambiguous_prior_outreach/);
  assert.ok(!calls.some((p) => p.includes('mockup_generation_job_id=eq')));
  assert.ok(!calls.some((p) => p.includes('prospect_id=eq')));
});

test('aggregate outreach status alone cannot qualify a different recipient or source', () => {
  const signal = classifyEngagementSignal({ outreach: sourceOutreach({ engagement_status: 'clicked' }), events: [{ outreach_id: 'other-outreach', recipient_email_hash: 'h', event_type: 'email.clicked', event_timestamp: '2026-01-03T00:00:00Z' }], recipientEmailHash: 'h' });
  assert.equal(signal.signal_type, 'no_signal');
});

test('click and open follow-up timing use scenario-specific timestamps and delays', () => {
  const clickedTooEarly = buildFollowupReview({ outreach: sourceOutreach(), events: [{ outreach_id: 'outreach-1', recipient_email_hash: 'h', event_type: 'email.opened', event_timestamp: '2026-01-10T00:00:00Z' }, { outreach_id: 'outreach-1', recipient_email_hash: 'h', event_type: 'email.clicked', event_timestamp: '2026-01-05T00:00:00Z' }], now: '2026-01-06T00:00:00Z' });
  assert.match(clickedTooEarly.blockers.join('\n'), /delay_not_met_2_business_days/);
  assert.match(clickedTooEarly.followup_eligibility_at, /2026-01-07/);
  const openedTooEarly = buildFollowupReview({ outreach: sourceOutreach(), events: [{ outreach_id: 'outreach-1', recipient_email_hash: 'h', event_type: 'email.opened', event_timestamp: '2026-01-05T00:00:00Z' }], now: '2026-01-08T00:00:00Z' });
  assert.match(openedTooEarly.blockers.join('\n'), /delay_not_met_4_business_days/);
  assert.match(openedTooEarly.followup_eligibility_at, /2026-01-09/);
});

test('missing source outreach attribution blocks follow-up', () => {
  const review = buildFollowupReview({ outreach: { id: 'outreach-1', recipient_email_hash: 'h' }, events: [{ outreach_id: 'outreach-1', recipient_email_hash: 'h', event_type: 'email.clicked', event_timestamp: '2026-01-03T00:00:00Z' }], now: '2026-01-07T00:00:00Z' });
  assert.equal(review.eligible, false);
  assert.match(review.blockers.join('\n'), /missing source outreach attribution/);
});

test('excluded records receive no email preview', () => {
  const item = buildOwnerReviewDossierItem({ prospect: prospect({ campaign_lane: 'lane_d', contact_sources: [] }), generationJob: job() });
  assert.equal(item.final_dry_run_recommendation, 'EXCLUDE');
  assert.equal(item.initial_email_preview, '');
  assert.equal(item.opened_followup_preview, '');
  assert.equal(item.clicked_followup_preview, '');
});

test('public config contains no internal job IDs and constants cannot drift from config', () => {
  assert.deepEqual(experimentConfig.jobs_that_must_remain_paused, ['weekly_cdo_audit_paused', 'runsignup_prospect_pipeline_paused', 'lane_d_candidate_review_paused', 'engagement_followup_watchdog_paused']);
  assert.doesNotMatch(JSON.stringify(experimentConfig), /\b[0-9a-f]{12}\b/i);
  assert.equal(CAMPAIGN_LANE, experimentConfig.campaign_lane);
  assert.equal(MOCKUP_TEMPLATE_FAMILY, experimentConfig.mockup_template_family);
  assert.equal(COMMERCIAL_OFFER_ID, experimentConfig.commercial_offer_id);
  assert.equal(INITIAL_EMAIL_TEMPLATE_ID, experimentConfig.initial_email_template_id);
  assert.equal(INITIAL_EMAIL_TEMPLATE_VERSION, experimentConfig.initial_email_template_version);
  assert.equal(OPENED_FOLLOWUP_TEMPLATE_ID, experimentConfig.opened_followup_template_id);
  assert.equal(CLICKED_FOLLOWUP_TEMPLATE_ID, experimentConfig.clicked_followup_template_id);
  assert.equal(FOLLOWUP_SIGNAL_EXPIRY_BUSINESS_DAYS, experimentConfig.followup_timing.followup_signal_expiry_business_days);
});


test('review correction: wrong lane plus multiple contacts remains EXCLUDE with no preview', () => {
  const item = buildOwnerReviewDossierItem({
    prospect: prospect({ campaign_lane: 'lane_d', contact_sources: [{ email: 'a@example.test', confidence: 'source_backed' }, { email: 'b@example.test', confidence: 'source_backed' }] }),
    generationJob: job(),
  });
  assert.equal(item.final_dry_run_recommendation, 'EXCLUDE');
  assert.equal(item.initial_email_preview, '');
});

test('review correction: credible standalone site plus unverified contact remains EXCLUDE with no preview', () => {
  const item = buildOwnerReviewDossierItem({
    prospect: prospect({ official_site_assessment: 'credible_standalone_race_site', contact_sources: [], contact_email: 'maybe@example.test' }),
    generationJob: job(),
  });
  assert.equal(item.final_dry_run_recommendation, 'EXCLUDE');
  assert.equal(item.initial_email_preview, '');
});

test('review correction: otherwise-valid candidate with two verified contacts needs Steve recipient decision', () => {
  const result = validatePilotInitialSend({ prospect: prospect({ contact_sources: [{ email: 'a@example.test', confidence: 'source_backed' }, { email: 'b@example.test', confidence: 'source_backed' }] }), generationJob: job() });
  assert.equal(result.recommendation, 'NEEDS_STEVE_DECISION — SELECT_ONE_RECIPIENT');
});

test('review correction: raw caller-provided recipient cannot bypass verification', () => {
  const result = validatePilotInitialSend({ prospect: prospect({ contact_sources: [], contact_email: '' }), generationJob: job(), recipientEmails: ['raw@example.test'] });
  assert.equal(result.ok, false);
  assert.notEqual(result.recommendation, 'INCLUDE');
  assert.match(result.blockers.join('\n'), /selected recipient must be present|verified direct/);
});

test('review correction: selected recipient must exist in verified-contact set', () => {
  const valid = validatePilotInitialSend({ prospect: prospect(), generationJob: job(), recipientEmails: ['director@example.test'] });
  assert.equal(valid.ok, true);
  const invalid = validatePilotInitialSend({ prospect: prospect(), generationJob: job(), recipientEmails: ['other@example.test'] });
  assert.equal(invalid.ok, false);
  assert.match(invalid.blockers.join('\n'), /selected recipient must be present/);
});

test('review correction: non-approved prospect type fails despite source_platform runsignup', () => {
  const result = validatePilotInitialSend({ prospect: prospect({ prospect_type: 'official_site_modernization' }), generationJob: job() });
  assert.equal(result.ok, false);
  assert.match(result.blockers.join('\n'), /approved Lane A/);
});

test('review correction: legacy Lane A override cannot bypass official-site classification', () => {
  const result = validatePilotInitialSend({ prospect: prospect({ official_site_assessment: 'manual_review_required', metadata: { lane_a_override: true }, lane_a_qualified: true }), generationJob: job() });
  assert.equal(result.ok, false);
  assert.match(result.blockers.join('\n'), /official_site_requires_explicit_classification/);
});

test('review correction: conflicting outreach/provider IDs do not match', () => {
  const providerConflict = classifyEngagementSignal({ outreach: sourceOutreach({ id: 'outreach-1', provider_message_id: 'msg-1' }), events: [{ outreach_id: 'other-outreach', provider_message_id: 'msg-1', recipient_email_hash: 'h', event_type: 'email.clicked' }], recipientEmailHash: 'h' });
  assert.equal(providerConflict.signal_type, 'no_signal');
  const outreachConflict = classifyEngagementSignal({ outreach: sourceOutreach({ id: 'outreach-1', provider_message_id: 'msg-1' }), events: [{ outreach_id: 'outreach-1', provider_message_id: 'other-msg', recipient_email_hash: 'h', event_type: 'email.clicked' }], recipientEmailHash: 'h' });
  assert.equal(outreachConflict.signal_type, 'no_signal');
});

test('review correction: clicked follow-up uses clicked template version', () => {
  assert.equal(OPENED_FOLLOWUP_TEMPLATE_VERSION, experimentConfig.opened_followup_template_version);
  assert.equal(CLICKED_FOLLOWUP_TEMPLATE_VERSION, experimentConfig.clicked_followup_template_version);
  const review = buildFollowupReview({ outreach: sourceOutreach(), events: [{ outreach_id: 'outreach-1', recipient_email_hash: 'h', event_type: 'email.clicked', event_timestamp: '2026-01-03T00:00:00Z' }], now: '2026-01-07T00:00:00Z' });
  assert.equal(review.followup_template_id, experimentConfig.clicked_followup_template_id);
  assert.equal(review.followup_template_version, experimentConfig.clicked_followup_template_version);
});

test('review correction: required attribution and follow-up fields cannot drift from config', () => {
  assert.deepEqual(requiredAttributionFields, experimentConfig.attribution_required_fields);
  assert.deepEqual(requiredFollowupFields, experimentConfig.followup_required_fields);
});

test('review correction: prospect-anchored pagination includes prospects without generation jobs', async () => {
  const calls = [];
  const requester = async ({ path }) => {
    calls.push(path);
    if (path.startsWith('race_mockup_prospects')) return calls.filter((p) => p.startsWith('race_mockup_prospects')).length === 1 ? [prospect({ id: 'p1' }), prospect({ id: 'p2' })] : [];
    if (path.startsWith('race_mockup_generation_jobs')) return calls.filter((p) => p.startsWith('race_mockup_generation_jobs')).length === 1 ? [job({ id: 'j1', prospect_id: 'p1' })] : [];
    return [];
  };
  const result = await loadReadOnlySupabaseCandidates({ requester });
  assert.equal(result.scanEvidence.prospectRowsScanned, 2);
  assert.equal(result.scanEvidence.finalOneRowPerProspectCandidateCount, 2);
  assert.equal(result.items.length, 2);
});

test('review correction: multiple Community jobs for one prospect collapse deterministically', () => {
  const result = selectLatestCommunityJobByProspect([
    job({ id: 'old', prospect_id: 'p1', updated_at: '2026-01-01T00:00:00Z' }),
    job({ id: 'new', prospect_id: 'p1', updated_at: '2026-01-02T00:00:00Z' }),
    job({ id: 'other-template', prospect_id: 'p1', template: 'performance', updated_at: '2026-01-03T00:00:00Z' }),
  ]);
  assert.equal(result.byProspect.get('p1').id, 'new');
  assert.equal(result.duplicateGenerationJobsCollapsed, 1);
});

test('review correction: suppression lookup uses canonical verified-contact hash path', () => {
  const filters = buildSuppressionFilters({ prospect: prospect({ contact_email: 'raw@example.test', contact_sources: [{ email: 'director@example.test', confidence: 'source_backed' }] }) });
  assert.equal(filters.length, 1);
  assert.match(filters[0], new RegExp(hashRecipient('director@example.test')));
  assert.doesNotMatch(filters[0], new RegExp(hashRecipient('raw@example.test')));
});

test('review correction: production suppression hash helper compatibility vector', () => {
  assert.equal(hashRecipient('Director@Example.Test', { env: { STARTLINE_RECIPIENT_HASH_SALT: 'salt:' } }), '85600712c6d45281bf3e47262867f5f34896b9666434570bc4650ed624d9ba75');
});

test('review correction: full sequential waterfall reconciles to denominator', () => {
  const include = buildOwnerReviewDossierItem({ prospect: prospect(), generationJob: job() });
  const excluded = buildOwnerReviewDossierItem({ prospect: prospect({ campaign_lane: 'lane_d' }), generationJob: job() });
  const rows = buildExclusionWaterfall([{ prospect: prospect(), job: job(), item: include }, { prospect: prospect({ campaign_lane: 'lane_d' }), job: job(), item: excluded }]);
  assert.equal(rows[0].stage, 'all_prospect_rows');
  assert.equal(rows[0].before, 2);
  assert.equal(rows.at(-2).stage, 'EXCLUDE');
  assert.equal(rows.at(-2).remaining, 1);
  assert.equal(rows.at(-1).stage, 'DENOMINATOR_RECONCILIATION');
  assert.equal(rows.at(-1).remaining, 2);
});

test('review correction: limit caps only owner-review dossier and not scan counts', async () => {
  const requester = async ({ path }) => {
    if (path.startsWith('race_mockup_prospects')) return path.includes('offset=0') ? [prospect({ id: 'p1' }), prospect({ id: 'p2', source_race_id: '2' })] : [];
    if (path.startsWith('race_mockup_generation_jobs')) return path.includes('offset=0') ? [job({ id: 'j1', prospect_id: 'p1' }), job({ id: 'j2', prospect_id: 'p2', source_bundle: { source_platform: 'runsignup', source_race_id: '2', registration_url: 'https://runsignup.com/Race/TX/Austin/RiverTown5K' } })] : [];
    return [];
  };
  const result = await loadReadOnlySupabaseCandidates({ requester, limit: 1 });
  assert.equal(result.scanEvidence.prospectRowsScanned, 2);
  assert.equal(result.items.length, 2);
  assert.equal(result.selectedItems.length, 1);
});

test('review correction: invalid registration-url-to-mockup-url duplicate comparison is absent', async () => {
  const calls = [];
  const requester = async ({ path }) => { calls.push(path); return []; };
  await loadReadOnlySupabaseCandidates({ requester });
  assert.ok(!calls.some((path) => path.includes('mockup_url=eq.https%3A%2F%2Frunsignup')));
});

test('data adapter: actual schema metadata supplies prospect type, lane, event date, and contacts', () => {
  const row = normalizeProspectRow({
    id: 'actual-p1',
    race_name: 'Actual Shape 5K',
    event_date: '2026-12-01',
    source_platform: 'runsignup',
    source_race_id: 'rsu-1',
    registration_url: 'https://runsignup.com/Race/TX/Austin/ActualShape5K',
    contact_sources: [{ email: 'director@example.test', confidence: 'source_backed' }],
    metadata: { prospect_type: 'runsignup_first_community_race', campaign_lane: 'lane_a', official_site_assessment: 'no_meaningful_standalone_site' },
  });
  assert.equal(row.prospect_type, 'runsignup_first_community_race');
  assert.equal(row.campaign_lane, 'lane_a');
  assert.equal(row.event_date, '2026-12-01');
  assert.equal(row.contact_sources.length, 1);
  assert.equal(row.field_provenance.prospect_type, 'prospect.metadata.prospect_type');
});

test('data adapter: duplicate outreach links through actual metadata and stable keys', () => {
  const p = normalizeProspectRow(prospect({ id: 'p-actual', race_slug: 'actual-5k', official_domain: 'actual.test', registration_platform: 'runsignup', registration_race_id: '42' }));
  const j = normalizeGenerationJobRow(job({ id: 'j-actual', prospect_id: 'p-actual' }));
  const indexes = {
    outreachByGenerationJobId: new Map([['j-actual', [{ id: 'by-job', metadata: { generation_job_id: 'j-actual' } }]]]),
    outreachByProspectId: new Map(),
    outreachByMockupUrl: new Map(),
    outreachByRegistrationKey: new Map([['runsignup|42', [{ id: 'by-registration' }]]]),
    outreachByRegistrationUrl: new Map(),
    outreachByRaceDomain: new Map([['actual-5k|actual.test', [{ id: 'by-domain' }]]]),
  };
  const matches = findPriorOutreachForCandidate({ prospect: p, generationJob: j, indexes });
  assert.deepEqual(matches.map((row) => row.id).sort(), ['by-domain', 'by-job', 'by-registration']);
});

test('data adapter: unavailable proposal source requires owner history confirmation, not false clear', () => {
  const p = prospect();
  const item = buildOwnerReviewDossierItem({ prospect: p, generationJob: job(), outcomeEvidence: { unavailableSources: ['proposal_evidence_source_unavailable'], sourceSummary: { proposal_evidence_source: 'unavailable' } } });
  assert.equal(item.final_dry_run_recommendation, 'NEEDS_STEVE_DECISION — MANUAL_HISTORY_CONFIRMATION');
  assert.equal(item.owner_history_confirmation_required, true);
});

test('data adapter: customer/payment evidence uses verified existing sources', () => {
  const p = normalizeProspectRow(prospect({ registration_url: 'https://runsignup.com/Race/TX/Austin/RiverTown5K' }));
  const indexes = {
    auditRequestsByRegistrationUrl: new Map(),
    customerRecordsByRegistrationUrl: new Map([['https://runsignup.com/race/tx/austin/rivertown5k', [{ id: 'customer-1', stripe_checkout_session_id: 'cs_1' }]]]),
    stripeEventsByCheckout: new Map([['cs_1', [{ id: 'evt-1', event_type: 'checkout.session.completed' }]]]),
    stripeEventsByPaymentIntent: new Map(),
    stripeEventsByCustomer: new Map(),
  };
  const evidence = findOutcomeEvidenceForCandidate({ prospect: p, generationJob: job(), indexes });
  assert.equal(evidence.customerRecords.length, 0);
  assert.equal(evidence.checkouts.length, 0);
  assert.equal(evidence.commercialHistoryClassification.state, 'OWNER_CONFIRMATION_REQUIRED');
});


test('final truth gate: no verified or plausible contact is EXCLUDE NO CONTACT, not Steve verification', () => {
  const result = validatePilotInitialSend({ prospect: prospect({ contact_sources: [], contact_email: '', contact_form_url: '' }), generationJob: job() });
  assert.equal(result.recommendation, 'EXCLUDE');
  assert.match(result.blockers.join('\n'), /EXCLUDE — NO CONTACT/);
  assert.doesNotMatch(result.recommendation, /CONTACT_VERIFICATION/);
});

test('private last-mile report includes EXCLUDE-at-contact candidate with redacted gate details', () => {
  const item = buildOwnerReviewDossierItem({
    prospect: prospect({ id: 'prospect-contact-exclude-123456', contact_sources: [], contact_email: '', contact_form_url: '' }),
    generationJob: job({ prospect_id: 'prospect-contact-exclude-123456' }),
  });
  item.prospect_snapshot = { id: 'prospect-contact-exclude-123456' };
  const lastMile = classifyLastMileVisibility(item);
  assert.equal(item.final_dry_run_recommendation, 'EXCLUDE');
  assert.equal(lastMile.visible, true);
  assert.equal(lastMile.lastGatePassed, 'commercial_truth_ambiguous_manual_history_confirmation');
  assert.equal(lastMile.finalExclusionStage, 'one_verified_recipient_or_owner_resolvable_contact_decision');
  assert.equal(lastMile.contactState, 'NO_VERIFIED_CONTACT');
  assert.match(lastMile.exclusionReason, /EXCLUDE — NO CONTACT/);

  const markdown = buildExclusionWaterfallMarkdown({ items: [item], scanEvidence: { uniqueProspectIds: 1 }, generatedAt: '2026-08-14T00:00:00.000Z' });
  assert.match(markdown, /## Last-mile candidates/);
  assert.match(markdown, /id=prospe\*\*\*3456/);
  assert.match(markdown, /last_gate_passed=commercial_truth_ambiguous_manual_history_confirmation/);
  assert.match(markdown, /final_exclusion_stage=one_verified_recipient_or_owner_resolvable_contact_decision/);
  assert.match(markdown, /contact_state=NO_VERIFIED_CONTACT/);
  assert.match(markdown, /EXCLUDE — NO CONTACT/);
});

test('final truth gate: plausible unverified routing contact may require Steve contact verification', () => {
  const result = validatePilotInitialSend({ prospect: prospect({ contact_sources: [{ candidate_email: 'routing@example.test', status: 'candidate_unconfirmed', type: 'candidate_email' }], contact_email: '' }), generationJob: job() });
  assert.equal(result.recommendation, 'NEEDS_STEVE_DECISION — CONTACT_VERIFICATION');
});

test('final truth gate: contact form plus plausible email is not contact-form-only', () => {
  const result = validatePilotInitialSend({ prospect: prospect({ contact_sources: [{ candidate_email: 'routing@example.test', status: 'candidate_unconfirmed', type: 'candidate_email' }], contact_email: '', contact_form_url: 'https://race.example/contact' }), generationJob: job() });
  assert.equal(result.recommendation, 'NEEDS_STEVE_DECISION — CONTACT_VERIFICATION');
  assert.doesNotMatch(result.blockers.join('\n'), /contact-form-only/);
});

test('final truth gate: Site Auditor not_requested or missing blocks pilot readiness', () => {
  for (const site_auditor_status of ['not_requested', '', undefined, 'failed', 'timed_out']) {
    const result = validatePilotInitialSend({ prospect: prospect(), generationJob: job({ site_auditor_status }) });
    assert.equal(result.ok, false);
    assert.match(result.blockers.join('\n'), /Site Auditor review must be passed\/approved/);
  }
});

test('final truth gate: internal smoke outreach does not count as real prior outreach but real channels block', () => {
  assert.equal(classifyOutreachHistoryRow({ id: 'smoke-1', internal_only: true, sent_at: '2026-01-01' }).classification, 'INTERNAL_SMOKE_OR_TEST');
  assert.equal(classifyOutreachHistoryRow({ id: 'real-1', resend_email_id: 're_123', sent_at: '2026-01-01' }).classification, 'REAL_EXTERNAL_OUTREACH');
  assert.equal(classifyOutreachHistoryRow({ id: 'form-1', submission_channel: 'runsignup_contact_form', sent_at: '2026-01-01' }).classification, 'REAL_EXTERNAL_CONTACT_FORM_SUBMISSION');
  assert.equal(classifyOutreachHistoryRow({ id: 'backfill-1', metadata: { historical_backfill_of_real_contact: true } }).classification, 'HISTORICAL_BACKFILL_OF_REAL_CONTACT');
  const summary = summarizeOutreachHistory([{ id: 'smoke-1', smoke_test: true }, { id: 'real-1', resend_email_id: 're_123', sent_at: '2026-01-01' }]);
  assert.equal(summary.blockingRows.length, 1);
  assert.equal(summary.breakdown.INTERNAL_SMOKE_OR_TEST, 1);
});

test('final truth gate: controlled test commercial history does not block, live or ambiguous history does', () => {
  const controlled = classifyCommercialHistory({ auditRequests: [{ id: 'audit-test', metadata: { phase3a_controlled_test: true } }] });
  assert.equal(controlled.state, 'CLEAR');
  assert.equal(controlled.breakdown.CONTROLLED_TEST_OUTCOME, 1);
  const live = classifyCommercialHistory({ stripeEvents: [{ id: 'evt-live', event_type: 'checkout.session.completed', payload: { livemode: true, data: { object: { livemode: true } } } }] });
  assert.equal(live.state, 'BLOCKS');
  const liveCustomer = classifyCommercialHistory({ customerRecords: [{ id: 'cust-live', metadata: { note: 'customer' }, payload: { livemode: true } }] });
  assert.equal(liveCustomer.state, 'BLOCKS');
  const ambiguous = classifyCommercialHistory({ auditRequests: [{ id: 'audit-manual', status: 'manual_conversation' }] });
  assert.equal(ambiguous.state, 'OWNER_CONFIRMATION_REQUIRED');
  const ambiguousTestManual = classifyCommercialHistory({ auditRequests: [{ id: 'audit-test-manual', status: 'manual_conversation', metadata: { phase3a_controlled_test: true } }] });
  assert.equal(ambiguousTestManual.state, 'OWNER_CONFIRMATION_REQUIRED');
  assert.equal(ambiguousTestManual.breakdown.AMBIGUOUS_MANUAL_HISTORY_CONFIRMATION, 1);
  const testModeRevenue = classifyCommercialHistory({ stripeEvents: [{ id: 'evt-test', event_type: 'checkout.session.completed', livemode: false, metadata: { phase3a_controlled_test: true } }] });
  assert.equal(testModeRevenue.state, 'CLEAR');
  assert.equal(testModeRevenue.breakdown.CONTROLLED_TEST_OUTCOME, 1);
});

test('final truth gate: private reports split real/test history and last-mile details', () => {
  const base = buildOwnerReviewDossierItem({
    prospect: prospect({ id: 'prospect-history-card-123456', contact_sources: [], contact_email: '', contact_form_url: '' }),
    generationJob: job({ prospect_id: 'prospect-history-card-123456' }),
  });
  base.prospect_snapshot = { id: 'prospect-history-card-123456' };
  base.prior_history_classification = { REAL_EXTERNAL_OUTREACH: 1, CONTROLLED_TEST_OUTCOME: 1, AMBIGUOUS_MANUAL_HISTORY_CONFIRMATION: 1 };
  base.deterministic_history_blocker = true;
  base.owner_confirmation_reason = 'ambiguous_commercial_history_requires_owner_confirmation';

  const history = buildCommercialHistoryMarkdown({ items: [base], scanEvidence: { uniqueProspectIds: 1, totalRestQueryCount: 7 }, generatedAt: '2026-08-14T00:00:00.000Z' });
  assert.match(history, /REAL_EXTERNAL_OUTREACH: 1/);
  assert.match(history, /CONTROLLED_TEST_OUTCOME: 1/);
  assert.match(history, /AMBIGUOUS_MANUAL_HISTORY_CONFIRMATION: 1/);
  assert.match(history, /test-mode\/internal controlled records remain excluded from live revenue\/customer claims/);

  const truthTable = buildPrivateTruthTableMarkdown({ items: [base], scanEvidence: { uniqueProspectIds: 1 }, generatedAt: '2026-08-14T00:00:00.000Z' });
  assert.match(truthTable, /Private Lane A Commercial-Truth Table/);
  assert.match(truthTable, /id=prospe\*\*\*3456/);
  assert.match(truthTable, /deterministic_blocker=true/);
  assert.doesNotMatch(truthTable, /director@example\.test/);

  const lastMileItem = buildOwnerReviewDossierItem({
    prospect: prospect({ id: 'prospect-history-card-123456', contact_sources: [], contact_email: '', contact_form_url: '' }),
    generationJob: job({ prospect_id: 'prospect-history-card-123456' }),
  });
  lastMileItem.prospect_snapshot = { id: 'prospect-history-card-123456' };
  lastMileItem.prior_history_classification = { NO_HISTORICAL_BLOCKER: 1 };
  const lastMile = buildLastMileCandidateCardMarkdown({ items: [lastMileItem], scanEvidence: { uniqueProspectIds: 1 }, generatedAt: '2026-08-14T00:00:00.000Z' });
  assert.match(lastMile, /Exact final exclusion stage: one_verified_recipient_or_owner_resolvable_contact_decision/);
  assert.match(lastMile, /Contact path: zero verified contacts and zero plausible direct\/routing contacts/);
  assert.match(lastMile, /Mockup\/Site Auditor state:/);
  assert.match(lastMile, /Required change to qualify:/);
});
