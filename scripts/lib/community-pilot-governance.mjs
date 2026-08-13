import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import { hashSuppressionRecipient as productionHashRecipient, normalizeSuppressionEmail } from './outreach-suppression-send-gate.mjs';

const loadExperimentConfig = () => JSON.parse(readFileSync(new URL('../../config/startline-community-pilot-v1.json', import.meta.url), 'utf8'));
export const experimentConfig = loadExperimentConfig();

const clean = (value, max = 1000) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const asArray = (value) => Array.isArray(value) ? value : (value == null ? [] : [value]);
const lc = (value) => clean(value, 500).toLowerCase();
const nowIso = () => new Date().toISOString();

export const EXPERIMENT_ID = experimentConfig.experiment_id;
export const CAMPAIGN_LANE = experimentConfig.campaign_lane;
export const MOCKUP_TEMPLATE_FAMILY = experimentConfig.mockup_template_family;
export const COMMERCIAL_OFFER_ID = experimentConfig.commercial_offer_id;
export const INITIAL_EMAIL_TEMPLATE_ID = experimentConfig.initial_email_template_id;
export const INITIAL_EMAIL_TEMPLATE_VERSION = experimentConfig.initial_email_template_version;
export const OPENED_FOLLOWUP_TEMPLATE_ID = experimentConfig.opened_followup_template_id;
export const CLICKED_FOLLOWUP_TEMPLATE_ID = experimentConfig.clicked_followup_template_id;
export const OPENED_FOLLOWUP_TEMPLATE_VERSION = experimentConfig.opened_followup_template_version;
export const CLICKED_FOLLOWUP_TEMPLATE_VERSION = experimentConfig.clicked_followup_template_version;
export const FOLLOWUP_TEMPLATE_VERSION = OPENED_FOLLOWUP_TEMPLATE_VERSION;
export const RECOMMENDED_TIER = experimentConfig.recommended_tier;
export const FALLBACK_TIER = experimentConfig.fallback_tier;
export const FOLLOWUP_CLICKED_DELAY_BUSINESS_DAYS = experimentConfig.followup_timing.clicked_signal_business_days;
export const FOLLOWUP_OPENED_DELAY_BUSINESS_DAYS = experimentConfig.followup_timing.opened_signal_business_days;
export const SIGNAL_CONFIDENCE = ['raw_unverified', 'possible_automation', 'moderate_signal', 'human_confirmed'];
export const FOLLOWUP_SIGNAL_EXPIRY_BUSINESS_DAYS = experimentConfig.followup_timing.followup_signal_expiry_business_days;

export const classifyCandidateUrl = (url = '') => {
  const value = clean(url, 1000);
  if (!value) return { platform: 'unknown', category: 'unknown' };
  let parsed;
  try { parsed = new URL(value); } catch { return { platform: 'unknown', category: 'unknown' }; }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const path = parsed.pathname.toLowerCase();
  if (host === 'runsignup.com' || host.endsWith('.runsignup.com')) {
    if (/\/race\/[^/]+\/[^/]+\/[^/]+/.test(path)) return { platform: 'runsignup', category: 'runsignup_race_page' };
    if (path.includes('/club/') || path.includes('/memberorg') || path.includes('/organization') || path.includes('/org/')) return { platform: 'runsignup', category: 'runsignup_member_org_page' };
    return { platform: 'runsignup', category: 'unknown' };
  }
  if (host.includes('raceroster.com')) return { platform: 'raceroster', category: 'other_registration_platform' };
  if (['facebook.com', 'instagram.com', 'x.com', 'twitter.com'].some((social) => host === social || host.endsWith(`.${social}`))) return { platform: 'social', category: 'social_page' };
  return { platform: 'official_or_other', category: 'official_operator_site' };
};

const addBusinessDaysChicago = (iso = nowIso(), businessDays = FOLLOWUP_SIGNAL_EXPIRY_BUSINESS_DAYS) => {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  let added = 0;
  while (added < businessDays) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short' }).formatToParts(date).find((part) => part.type === 'weekday') ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short' }).format(date)) : date.getUTCDay());
    if (![0, 6].includes(day)) added += 1;
  }
  return date;
};

export const isFollowupSignalExpired = ({ signalAt = '', now = nowIso(), businessDays = FOLLOWUP_SIGNAL_EXPIRY_BUSINESS_DAYS } = {}) => {
  const expiry = addBusinessDaysChicago(signalAt, businessDays);
  const nowTime = Date.parse(now);
  return !expiry || !Number.isFinite(nowTime) ? true : nowTime > expiry.getTime();
};

export const terminologyContract = {
  mockup_template_family: 'Website/mockup family such as community, destination-major, or performance.',
  campaign_lane: 'Marketing/prospect lane such as lane_a through lane_d.',
  initial_email_template_id: 'Canonical initial outreach email identifier.',
  initial_email_template_version: 'Version of the initial outreach email.',
  followup_scenario: 'Behavioral scenario such as opened_signal or clicked_signal.',
  followup_template_id: 'Canonical follow-up email template identifier.',
  followup_template_version: 'Version of the follow-up email template.',
  commercial_offer_id: 'Commercial offer being tested.',
  recommended_tier: 'Primary package recommendation.',
  fallback_tier: 'Fallback package if Standard is too large.',
  experiment_id: 'Stable experiment identity linking prospect through revenue.',
  engagement_signal_confidence: 'Confidence classification; human_confirmed requires reply/audit/proposal/checkout/purchase or explicit manual confirmation.',
};

export const requiredAttributionFields = [...experimentConfig.attribution_required_fields];

export const requiredFollowupFields = [...experimentConfig.followup_required_fields];

export const normalizeRecipientEmail = (email = '') => normalizeSuppressionEmail(email);
export const hashRecipient = (email = '', options = {}) => productionHashRecipient(email, options);
export const maskEmail = (email = '') => {
  const [local, domain] = lc(email).split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, Math.min(2, local.length))}***[at]${domain}`;
};

export const parseEmailList = (value) => {
  if (Array.isArray(value)) return value.flatMap(parseEmailList);
  return clean(value, 2000).split(/[;,\s]+/).map((item) => lc(item)).filter(Boolean);
};

const metadata = (row = {}) => row && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {};
const contactSources = (prospect = {}) => asArray(prospect.contact_sources || metadata(prospect).contact_sources);
const sourceBundle = (job = {}) => job.source_bundle && typeof job.source_bundle === 'object' ? job.source_bundle : {};

export const extractVerifiedEmails = (prospect = {}) => {
  const emails = [];
  const add = (email, source = {}) => {
    const e = lc(email);
    if (!e || !e.includes('@')) return;
    const status = lc(source.status || source.confidence || source.verification_status || source.classification || 'unverified');
    const type = lc(source.type || 'email');
    const verified = ['source_backed', 'verified', 'confirmed', 'official_source', 'routing_verified', 'direct_verified'].some((token) => status === token || status.includes(`${token}_`) || status.includes(`_${token}`));
    if (!verified || type.includes('form') || status.includes('unconfirmed') || status.includes('candidate')) return;
    if (!emails.some((item) => item.email === e)) emails.push({
      email: e,
      role: clean(source.role || source.classification || source.type || 'routing_email', 120),
      source_url: clean(source.source_url || prospect.source_url || prospect.registration_url, 500),
    });
  };
  add(prospect.contact_email, { type: 'direct_email', role: prospect.contact_role });
  for (const source of contactSources(prospect)) {
    if (typeof source === 'string') add(source, { type: 'email' });
    else if (source && typeof source === 'object') add(source.email || source.value || source.address, source);
  }
  return emails;
};

export const classifyOfficialSite = (prospect = {}) => {
  const assessment = lc(prospect.official_site_assessment || metadata(prospect).official_site_assessment || metadata(prospect).official_site_status || '');
  const accepted = new Set(['no_meaningful_standalone_site', 'runsignup_platform_only', 'social_only']);
  const blocked = new Set(['credible_standalone_race_site', 'credible_standalone_website', 'operator_page_only', 'unverified_access_failure']);
  const explicit = assessment.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (!explicit) return { qualifies: false, reason: 'missing_official_site_assessment' };
  if (accepted.has(explicit)) return { qualifies: true, reason: explicit };
  if (blocked.has(explicit) || assessment.includes('credible') || assessment.includes('dedicated')) return { qualifies: false, reason: explicit === 'credible_standalone_website' ? 'credible_standalone_race_site' : 'credible_standalone_race_site' };
  return { qualifies: false, reason: 'official_site_requires_explicit_classification' };
};

export const extractPlausibleContactEmails = (prospect = {}) => {
  const emails = [];
  const add = (email, source = {}) => {
    const e = normalizeRecipientEmail(email);
    if (!e || !e.includes('@')) return;
    const type = lc(source.type || 'email');
    const status = lc(source.status || source.confidence || source.verification_status || source.classification || 'unverified');
    if (type.includes('form') || status.includes('unconfirmed') || status.includes('candidate')) return;
    if (!emails.includes(e)) emails.push(e);
  };
  add(prospect.contact_email, { type: 'direct_email' });
  for (const source of contactSources(prospect)) {
    if (typeof source === 'string') add(source, { type: 'email' });
    else if (source && typeof source === 'object') add(source.email || source.value || source.address, source);
  }
  return emails;
};

const normalizeLane = (value = '') => ({ a: 'lane_a', lanea: 'lane_a', lane_a: 'lane_a' }[lc(value).replace(/[-\s]/g, '_')] || lc(value));
const normalizeProspectType = (value = '') => lc(value).replace(/[-\s]/g, '_');
export const APPROVED_LANE_A_PROSPECT_TYPES = new Set(['runsignup_first_community_race', 'runsignup_only_community_race', 'community_runsignup_first_race']);

export const isRaceTooClose = ({ raceDate = '', now = nowIso(), minimumLeadDays = 45 } = {}) => {
  const raceTime = Date.parse(raceDate);
  const nowTime = Date.parse(now);
  if (!Number.isFinite(raceTime) || !Number.isFinite(nowTime)) return false;
  return raceTime - nowTime < minimumLeadDays * 24 * 60 * 60 * 1000;
};

export const validatePrivatePreview = (url = '', row = {}) => {
  const blockers = [];
  const previewUrl = clean(url, 600);
  if (!/^https:\/\//i.test(previewUrl)) blockers.push('private preview must be an externally accessible https URL.');
  const current = row.private_preview_current ?? metadata(row).private_preview_current ?? metadata(row).private_preview_current_and_accessible;
  const accessible = row.private_preview_accessible ?? metadata(row).private_preview_accessible ?? metadata(row).private_preview_current_and_accessible;
  if (current !== true && lc(current) !== 'true' && lc(current) !== 'current') blockers.push('private preview current evidence is required.');
  if (accessible !== true && lc(accessible) !== 'true' && lc(accessible) !== 'accessible') blockers.push('private preview accessibility evidence is required.');
  return blockers;
};

export const redactPrivateUrl = (url = '') => clean(url, 1000)
  .replace(/(private\/mockups\/)[^/?#]+/ig, '$1[redacted-token]')
  .replace(/([?&](?:token|preview_token|mockup_token|access_token|signature|sig)=)[^&#]+/ig, '$1[redacted]');

const hasAny = (row = {}, keys = []) => keys.some((key) => {
  const value = row[key] ?? metadata(row)[key];
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
});

export const buildAttributionPayload = ({ prospect = {}, generationJob = {}, recipientEmail = '', now = nowIso() } = {}) => ({
  experiment_id: EXPERIMENT_ID,
  prospect_id: clean(prospect.id || generationJob.prospect_id, 120),
  source_platform: clean(prospect.source_platform || sourceBundle(generationJob).source_platform, 80),
  source_external_id: clean(prospect.source_race_id || prospect.registration_race_id || sourceBundle(generationJob).source_race_id || sourceBundle(generationJob).registration_race_id, 120),
  campaign_id: EXPERIMENT_ID,
  campaign_lane: CAMPAIGN_LANE,
  mockup_template_family: MOCKUP_TEMPLATE_FAMILY,
  mockup_generation_job_id: clean(generationJob.id, 120),
  mockup_url: clean(generationJob.mockup_url || prospect.mockup_url || metadata(prospect).mockup_url, 600),
  initial_email_template_id: INITIAL_EMAIL_TEMPLATE_ID,
  initial_email_template_version: INITIAL_EMAIL_TEMPLATE_VERSION,
  commercial_offer_id: COMMERCIAL_OFFER_ID,
  recommended_tier: RECOMMENDED_TIER,
  fallback_tier: FALLBACK_TIER,
  recipient_email_hash: recipientEmail ? hashRecipient(recipientEmail) : '',
  recipient_role: clean(extractVerifiedEmails(prospect).find((item) => item.email === lc(recipientEmail))?.role || 'routing_email', 120),
  owner_approval_status: 'not_requested_phase_2a1_preview_only',
  owner_approved_at: 'not_applicable_phase_2a1_preview_only',
  send_gate_version: 'phase2a1_dry_run_only_v1',
  test_live_classification: 'dry_run_no_send',
  response_status: 'no_response_known',
  owner_action_status: 'preview_only_steve_decision_required',
  prepared_at: now,
});

export const validateAttributionPayload = (payload = {}) => requiredAttributionFields.filter((field) => !clean(payload[field]));

export const validatePilotInitialSend = ({ prospect = {}, generationJob = {}, recipientEmails = [], suppressions = [], priorOutreach = [], now = nowIso() } = {}) => {
  const blockers = [];
  const warnings = [];
  const bundle = sourceBundle(generationJob);
  const lane = normalizeLane(prospect.campaign_lane || generationJob.campaign_lane || metadata(prospect).campaign_lane || bundle.campaign_lane || metadata(generationJob).campaign_lane || '');
  const prospectType = normalizeProspectType(prospect.prospect_type || metadata(prospect).prospect_type || '');
  const explicitSourcePlatform = clean(prospect.source_platform || sourceBundle(generationJob).source_platform, 80);
  const explicitRegistrationUrl = clean(prospect.registration_url || sourceBundle(generationJob).registration_url, 1000);
  const verifiedContacts = extractVerifiedEmails(prospect);
  const verifiedSet = new Set(verifiedContacts.map((item) => normalizeRecipientEmail(item.email)));
  const requestedRecipients = parseEmailList(recipientEmails);
  const invalidRequestedRecipients = requestedRecipients.filter((email) => !verifiedSet.has(normalizeRecipientEmail(email)));
  const emails = requestedRecipients.length ? requestedRecipients.filter((email) => verifiedSet.has(normalizeRecipientEmail(email))) : verifiedContacts.map((item) => item.email);
  const site = classifyOfficialSite(prospect);
  const attribution = buildAttributionPayload({ prospect, generationJob, recipientEmail: emails[0], now });

  if (!lane) blockers.push('campaign_lane is required.');
  else if (lane !== CAMPAIGN_LANE) blockers.push(`campaign_lane must be lane_a; received ${lane}.`);
  if (!prospectType) blockers.push('prospect_type is required.');
  else if (!APPROVED_LANE_A_PROSPECT_TYPES.has(prospectType)) blockers.push(`prospect_type must be an approved Lane A RunSignup Community race type; received ${prospectType}.`);
  if (!explicitSourcePlatform) blockers.push('source_platform is required.');
  else if (lc(explicitSourcePlatform) !== 'runsignup') blockers.push(`source_platform must be runsignup; received ${lc(explicitSourcePlatform)}.`);
  if (!explicitRegistrationUrl) blockers.push('registration_url is required; source_url is not a substitute.');
  const urlClassification = classifyCandidateUrl(explicitRegistrationUrl);
  if (urlClassification.category !== 'runsignup_race_page') blockers.push(`registration_url must be a RunSignup race page; received ${urlClassification.category}.`);
  if (lc(generationJob.template || generationJob.mockup_template || prospect.recommended_template) !== MOCKUP_TEMPLATE_FAMILY) blockers.push('mockup_template_family must be community.');
  const previewUrl = clean(generationJob.mockup_url || prospect.mockup_url || metadata(prospect).mockup_url, 600);
  if (!previewUrl) blockers.push('Community mockup URL is required.');
  blockers.push(...validatePrivatePreview(previewUrl, generationJob));
  const raceDate = prospect.event_date || prospect.race_date || bundle.event_date;
  const raceTime = Date.parse(raceDate || '');
  const nowTime = Date.parse(now);
  if (!raceDate || !Number.isFinite(raceTime)) blockers.push('valid future race date is required.');
  else if (Number.isFinite(nowTime) && raceTime <= nowTime) blockers.push('race date is in the past.');
  else if (isRaceTooClose({ raceDate, now })) blockers.push('race_too_close_to_event_day.');
  if (!['passed', 'pass', 'approved', 'ready'].includes(lc(generationJob.qa_status))) blockers.push('Community mockup QA must be passed.');
  if (generationJob.site_auditor_status && !['passed', 'pass', 'approved', 'ready', 'not_requested'].includes(lc(generationJob.site_auditor_status))) blockers.push('site auditor status is not acceptable for review.');
  if (!site.qualifies) blockers.push(`Lane A excluded: ${site.reason}.`);
  if (!site.reason || ['official_site_requires_manual_review', 'missing_official_site_assessment'].includes(site.reason)) warnings.push('Official-site assessment requires manual CMO review before inclusion.');
  const categoricalBlockersBeforeContact = blockers.length;
  if (invalidRequestedRecipients.length) blockers.push('selected recipient must be present in source-backed verified contact evidence.');
  if (emails.length === 0) blockers.push('verified direct or routing email is required; missing or unverified email is excluded.');
  if (emails.length > 1) blockers.push('multiple verified recipients require Steve to select exactly one recipient.');
  if (parseEmailList(prospect.cc_emails).length || parseEmailList(prospect.bcc_emails).length) blockers.push('CC/BCC are not allowed for pilot sends.');
  const contactFormOnly = prospect.contact_form_only === true || lc(prospect.contact_method || metadata(prospect).contact_method) === 'contact_form_only' || (Boolean(prospect.contact_form_url || metadata(prospect).contact_form_url) && emails.length === 0);
  if (contactFormOnly) blockers.push('contact-form-only prospect is excluded.');
  if (hasAny(prospect, ['prior_reply_at', 'manual_contacted_at', 'audit_request_id', 'proposal_id', 'checkout_session_id', 'customer_record_id', 'purchase_at'])) blockers.push('prior reply/manual contact/audit/proposal/checkout/purchase blocks pilot send.');
  if (priorOutreach.length || generationJob.outreach_id || metadata(prospect).outreach_id || metadata(prospect).outreach?.outreach_id) blockers.push('duplicate/prior outreach exists for this prospect/mockup.');
  if (suppressions.length || hasAny(prospect, ['suppressed_at', 'bounced_at', 'complained_at', 'unsubscribed_at'])) blockers.push('suppression or negative delivery signal blocks pilot send.');
  const missing = validateAttributionPayload(attribution);
  if (missing.length) blockers.push(`missing attribution fields: ${missing.join(', ')}.`);

  const onlyContactNeedsDecision = categoricalBlockersBeforeContact === 0
    && !invalidRequestedRecipients.length
    && !parseEmailList(prospect.cc_emails).length
    && !parseEmailList(prospect.bcc_emails).length;
  let recommendation = blockers.length === 0 ? 'INCLUDE' : 'EXCLUDE';
  if (onlyContactNeedsDecision && emails.length > 1) recommendation = 'NEEDS_STEVE_DECISION — SELECT_ONE_RECIPIENT';
  else if (onlyContactNeedsDecision && emails.length === 0 && extractPlausibleContactEmails(prospect).length) recommendation = 'NEEDS_STEVE_DECISION — CONTACT_VERIFICATION';
  return { ok: blockers.length === 0, blockers, warnings, recommendation, selected_recipient_masked: maskEmail(emails[0]), attribution_payload: attribution, official_site_assessment: site };
};

export const classifyEngagementSignal = ({ outreach = {}, events = [], recipientEmailHash = '' } = {}) => {
  const targetHash = clean(recipientEmailHash || outreach.recipient_email_hash || outreach.to_email_hash, 200);
  const sourceOutreachId = clean(outreach.id || outreach.outreach_id, 200);
  const sourceProviderId = clean(outreach.resend_email_id || outreach.provider_message_id || outreach.provider_id, 200);
  const matched = asArray(events).filter((event) => {
    if (clean(event.recipient_email_hash, 200) !== targetHash) return false;
    const eventOutreachId = clean(event.outreach_id || event.source_outreach_id || event.metadata?.outreach_id, 200);
    const eventProviderId = clean(event.provider_message_id || event.resend_email_id || event.email_id || event.metadata?.provider_message_id, 200);
    if (sourceOutreachId && eventOutreachId && sourceOutreachId !== eventOutreachId) return false;
    if (sourceProviderId && eventProviderId && sourceProviderId !== eventProviderId) return false;
    const outreachMatches = sourceOutreachId && eventOutreachId && sourceOutreachId === eventOutreachId;
    const providerMatches = sourceProviderId && eventProviderId && sourceProviderId === eventProviderId;
    return outreachMatches || providerMatches;
  });
  const eventTypes = matched.map((event) => lc(event.event_type));
  const clickedEvents = matched.filter((event) => lc(event.event_type).includes('click'));
  const openedEvents = matched.filter((event) => lc(event.event_type).includes('open'));
  const deliveredEvents = matched.filter((event) => lc(event.event_type).includes('deliver'));
  const clicked = clickedEvents.length > 0;
  const opened = openedEvents.length > 0;
  const delivered = deliveredEvents.length > 0;
  const negative = eventTypes.find((type) => ['email.bounced', 'bounced', 'complained', 'complaint', 'unsubscribed', 'suppressed'].includes(type));
  const immediateClick = clickedEvents.some((event) => {
    const deliveredAt = Date.parse(outreach.delivered_at || outreach.sent_at || '');
    const clickedAt = Date.parse(event.event_timestamp || event.created_at || '');
    return Number.isFinite(deliveredAt) && Number.isFinite(clickedAt) && clickedAt - deliveredAt >= 0 && clickedAt - deliveredAt < 120000;
  });
  const latestOf = (rows) => rows.map((event) => event.event_timestamp || event.created_at || event.timestamp).filter(Boolean).sort().at(-1) || '';
  if (negative) return { signal_type: 'negative_delivery', confidence: 'raw_unverified', matched_event_count: matched.length, signal_at: latestOf(matched), scanner_caveat: false };
  if (clicked) return { signal_type: 'clicked_signal', confidence: immediateClick ? 'possible_automation' : 'moderate_signal', matched_event_count: matched.length, signal_at: latestOf(clickedEvents), scanner_caveat: immediateClick };
  if (opened) return { signal_type: 'opened_signal', confidence: 'raw_unverified', matched_event_count: matched.length, signal_at: latestOf(openedEvents), scanner_caveat: true };
  if (delivered) return { signal_type: 'delivered_signal', confidence: 'raw_unverified', matched_event_count: matched.length, signal_at: latestOf(deliveredEvents), scanner_caveat: false };
  return { signal_type: matched.length ? 'ambiguous' : 'no_signal', confidence: 'raw_unverified', matched_event_count: matched.length, scanner_caveat: false };
};

export const validateFollowupPayload = (payload = {}) => requiredFollowupFields.filter((field) => {
  const value = payload[field];
  if (field === 'suppression_snapshot') return !value || typeof value !== 'object';
  return !clean(value);
});

export const buildFollowupReview = ({ outreach = {}, events = [], suppressions = [], ownerState = {}, priorFollowups = [], now = nowIso() } = {}) => {
  const firstRecipientEmail = parseEmailList(outreach.to_emails)[0] || '';
  const recipientHash = clean(outreach.recipient_email_hash || outreach.to_email_hash || (firstRecipientEmail ? hashRecipient(firstRecipientEmail) : ''), 200);
  const signal = classifyEngagementSignal({ outreach, events, recipientEmailHash: recipientHash });
  const blockers = [];
  if (suppressions.length || ['negative_delivery', 'suppressed'].includes(signal.signal_type)) blockers.push('suppression_or_negative_delivery');
  if (ownerState.positive_reply || ownerState.negative_reply || ownerState.reply_requires_owner_handling) blockers.push('reply_requires_owner_handling');
  if (ownerState.manual_contacted) blockers.push('manual_contact_already_occurred');
  if (ownerState.audit_request_id || ownerState.proposal_id || ownerState.checkout_session_id || ownerState.customer_record_id || ownerState.purchase_at) blockers.push('audit_proposal_checkout_or_purchase_already_exists');
  if (priorFollowups.length || outreach.followup_sent_at || outreach.behavioral_followup_sent_at) blockers.push('one_behavioral_followup_cap_reached');
  if (!recipientHash) blockers.push('missing_recipient_level_match');
  if (!['clicked_signal', 'opened_signal'].includes(signal.signal_type)) blockers.push('no_opened_or_clicked_signal_for_behavioral_followup');
  const sourceMissing = ['experiment_id', 'campaign_lane', 'recipient_email_hash', 'initial_email_template_id', 'initial_email_template_version', 'commercial_offer_id', 'recommended_tier'].filter((field) => !clean(outreach[field] || outreach.metadata?.[field]));
  if (sourceMissing.length) blockers.push(`missing source outreach attribution: ${sourceMissing.join(', ')}`);
  const latestSignalAt = signal.signal_at;
  if (!latestSignalAt) blockers.push('missing scenario-specific signal timestamp');
  if (isFollowupSignalExpired({ signalAt: latestSignalAt, now })) blockers.push(`behavioral_signal_expired_after_${FOLLOWUP_SIGNAL_EXPIRY_BUSINESS_DAYS}_business_days`);
  const scenario = signal.signal_type === 'clicked_signal' ? 'clicked_signal' : signal.signal_type === 'opened_signal' ? 'opened_signal' : null;
  const delayDays = scenario === 'clicked_signal' ? FOLLOWUP_CLICKED_DELAY_BUSINESS_DAYS : scenario === 'opened_signal' ? FOLLOWUP_OPENED_DELAY_BUSINESS_DAYS : null;
  const eligibilityAtDate = delayDays == null ? null : addBusinessDaysChicago(latestSignalAt, delayDays);
  const eligibilityAt = eligibilityAtDate ? eligibilityAtDate.toISOString() : '';
  if (eligibilityAtDate && Date.parse(now) < eligibilityAtDate.getTime()) blockers.push(`behavioral_followup_delay_not_met_${delayDays}_business_days`);
  const templateId = scenario === 'clicked_signal' ? CLICKED_FOLLOWUP_TEMPLATE_ID : scenario === 'opened_signal' ? OPENED_FOLLOWUP_TEMPLATE_ID : null;
  const templateVersion = scenario === 'clicked_signal' ? CLICKED_FOLLOWUP_TEMPLATE_VERSION : scenario === 'opened_signal' ? OPENED_FOLLOWUP_TEMPLATE_VERSION : null;
  const payload = {
    source_outreach_id: clean(outreach.id || outreach.outreach_id, 120),
    engagement_recipient_hash: recipientHash,
    engagement_signal_type: signal.signal_type,
    engagement_signal_confidence: signal.confidence,
    followup_scenario: scenario,
    followup_template_id: templateId,
    followup_template_version: templateVersion,
    followup_owner_decision: 'preview_only_steve_decision_required',
    followup_eligibility_at: eligibilityAt,
    suppression_snapshot: { suppressions: suppressions.length, checked_at: now },
  };
  const missing = validateFollowupPayload(payload);
  if (missing.length) blockers.push(`missing follow-up attribution fields: ${missing.join(', ')}.`);
  return {
    eligible: blockers.length === 0,
    blockers,
    signal,
    ...payload,
  };
};

export const buildInitialEmailPreview = ({ raceName = 'your race', mockupUrl = '[private mockup URL]' } = {}) => [
  `Subject: A free private website mockup for ${clean(raceName, 120)}`,
  '',
  `Hi, I put together a private StartLine Sites mockup for ${clean(raceName, 120)} showing how a dedicated race-marketing website could complement your RunSignup registration page, make the key runner decisions easier to scan, and give sponsors/community details a clearer home.`,
  '',
  `Private preview: ${clean(mockupUrl, 600)}`,
  '',
  'If it looks useful, the recommended next step would be a Standard race website build, with Starter as the smaller fallback. RunSignup would remain the registration and payment path.',
].join('\n');

export const buildOpenedFollowupPreview = ({ raceName = 'your race', mockupUrl = '[private mockup URL]' } = {}) => [
  `Subject: One quick note on the ${clean(raceName, 120)} mockup`,
  '',
  `Hi, one practical reason I thought the ${clean(raceName, 120)} preview may be useful is that it separates runner decision details from the registration transaction, while still sending registration clicks back to RunSignup.`,
  '',
  `Private preview: ${clean(mockupUrl, 600)}`,
].join('\n');

export const buildClickedFollowupPreview = ({ raceName = 'your race', mockupUrl = '[private mockup URL]' } = {}) => [
  `Subject: A possible next step for ${clean(raceName, 120)}`,
  '',
  `Hi, if the private ${clean(raceName, 120)} preview feels directionally useful, the clean next step would be choosing whether a Standard StartLine race site makes sense for this race cycle, with Starter as the smaller fallback.`,
  '',
  `Private preview: ${clean(mockupUrl, 600)}`,
].join('\n');

export const validateNoSendText = (text = '') => {
  const rejected = [/selected[- ]race credit/i, /25% off/i, /\$750/i, /I saw you opened/i, /I saw you clicked/i, /we saw you opened/i, /we saw you clicked/i, /guarantee(d)? (registration|growth|ranking)/i, /premium/i, /custom growth/i, /early partner/i, /new company/i, /beta/i];
  const hits = rejected.filter((rx) => rx.test(String(text)));
  return { ok: hits.length === 0, rejected_terms: hits.map((rx) => rx.source) };
};

export const buildOwnerReviewDossierItem = ({ prospect = {}, generationJob = {}, suppressions = [], priorOutreach = [], now = nowIso() } = {}) => {
  const emails = extractVerifiedEmails(prospect);
  const validation = validatePilotInitialSend({ prospect, generationJob, recipientEmails: emails.map((item) => item.email), suppressions, priorOutreach, now });
  const raceName = clean(prospect.race_name || sourceBundle(generationJob).race_name || 'Unknown race', 160);
  const mockupUrl = clean(generationJob.mockup_url || metadata(prospect).mockup_url, 600);
  const recommendation = validation.recommendation;
  const includePreview = recommendation === 'INCLUDE' || recommendation.startsWith('NEEDS_STEVE_DECISION');
  return {
    race_name: raceName,
    location: [prospect.race_city, prospect.race_state].filter(Boolean).join(', '),
    race_date: prospect.event_date || prospect.race_date || sourceBundle(generationJob).event_date || 'unknown',
    runsignup_url: prospect.registration_url || prospect.source_url || sourceBundle(generationJob).registration_url || sourceBundle(generationJob).source_url || '',
    official_site_assessment: validation.official_site_assessment,
    contact_role: emails[0]?.role || 'none_verified',
    masked_recipient: validation.selected_recipient_masked || 'none',
    duplicate_suppression_checks: { prior_outreach_count: priorOutreach.length, suppression_count: suppressions.length },
    community_mockup_url_redacted: mockupUrl ? redactPrivateUrl(mockupUrl) : '',
    mockup_qa_status: generationJob.qa_status || 'unknown',
    initial_email_preview: includePreview ? buildInitialEmailPreview({ raceName, mockupUrl: '[private mockup URL redacted]' }) : '',
    opened_followup_preview: includePreview ? buildOpenedFollowupPreview({ raceName, mockupUrl: '[private mockup URL redacted]' }) : '',
    clicked_followup_preview: includePreview ? buildClickedFollowupPreview({ raceName, mockupUrl: '[private mockup URL redacted]' }) : '',
    experiment_attribution_payload: validation.attribution_payload,
    recommended_tier: RECOMMENDED_TIER,
    owner_concerns: [...validation.blockers, ...validation.warnings],
    final_dry_run_recommendation: recommendation,
  };
};

export const buildDossierMarkdown = (items = [], { generatedAt = nowIso(), source = 'read-only dry-run evidence' } = {}) => {
  const reviewItems = items.filter((item) => item.final_dry_run_recommendation === 'INCLUDE' || String(item.final_dry_run_recommendation).startsWith('NEEDS_STEVE_DECISION'));
  const lines = [
    '# StartLineSites CMO Phase 2A-1 Community Pilot Dry-Run Dossier',
    '',
    `Generated: ${generatedAt}`,
    `Source: ${source}`,
    '',
    'No race-director outreach, customer email, contact form submission, send approval persistence, production migration, or growth-job activation occurred while generating this dossier.',
    '',
    `Qualified INCLUDE count: ${reviewItems.filter((item) => item.final_dry_run_recommendation === 'INCLUDE').length}`,
    `Needs Steve decision count: ${reviewItems.filter((item) => String(item.final_dry_run_recommendation).startsWith('NEEDS_STEVE_DECISION')).length}`,
    `Categorical exclusions withheld from owner dossier: ${items.length - reviewItems.length}`,
    '',
  ];
  if (!reviewItems.length) lines.push('No INCLUDE or NEEDS_STEVE_DECISION rows were selected. Categorical exclusions are reported only in the separate private exclusion waterfall.');
  reviewItems.forEach((item, index) => {
    lines.push(`## ${index + 1}. ${item.race_name}`);
    lines.push(`- Recommendation: ${item.final_dry_run_recommendation}`);
    lines.push(`- Location: ${item.location || 'unknown'}`);
    lines.push(`- Race date: ${item.race_date}`);
    lines.push(`- RunSignup URL: ${item.runsignup_url || 'missing'}`);
    lines.push(`- Official-site assessment: ${item.official_site_assessment.reason}`);
    lines.push(`- Contact: ${item.contact_role}; ${item.masked_recipient}`);
    lines.push(`- Duplicate/suppression checks: ${JSON.stringify(item.duplicate_suppression_checks)}`);
    lines.push(`- Community mockup: ${item.community_mockup_url_redacted || 'missing'}`);
    lines.push(`- Mockup QA: ${item.mockup_qa_status}`);
    lines.push(`- Recommended tier: ${item.recommended_tier}`);
    if (item.owner_concerns.length) lines.push(`- Owner concerns/blockers: ${item.owner_concerns.join('; ')}`);
    lines.push('- Initial email preview:');
    lines.push('```'); lines.push(item.initial_email_preview); lines.push('```');
    lines.push('- Opened follow-up preview:');
    lines.push('```'); lines.push(item.opened_followup_preview); lines.push('```');
    lines.push('- Clicked follow-up preview:');
    lines.push('```'); lines.push(item.clicked_followup_preview); lines.push('```');
    lines.push('');
  });
  return `${lines.join('\n')}\n`;
};

export const loadJson = async (path) => JSON.parse(await fs.readFile(path, 'utf8'));
