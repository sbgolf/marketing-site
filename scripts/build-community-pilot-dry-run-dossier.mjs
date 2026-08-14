#!/usr/bin/env node
import fs from 'node:fs/promises';
import { createSupabaseRestRequester } from './lib/mockup-generation-send-gate.mjs';
import { buildDossierMarkdown, buildOwnerReviewDossierItem, extractVerifiedEmails, hashRecipient, redactPrivateUrl } from './lib/community-pilot-governance.mjs';
import {
  buildProductionDataMapMarkdown,
  buildProductionIndexes,
  findOutcomeEvidenceForCandidate,
  findPriorOutreachForCandidate,
  findSuppressionsForCandidate,
  normalizeAuditRequestRow,
  normalizeCustomerRecordRow,
  normalizeGenerationJobRow,
  normalizeProspectRow,
  normalizeStripeWebhookEventRow,
  normalizeSuppressionRow,
  normalizeOutreachRow,
  summarizeOutreachHistory,
} from './lib/community-pilot-production-adapter.mjs';

const USAGE = `Usage: node scripts/build-community-pilot-dry-run-dossier.mjs [--input fixture.json] [--output file.md] [--limit 10] [--exclusion-output file.md] [--data-map-output file.md] [--truth-table-output file.md] [--last-mile-output file.md] [--history-output file.md] [--schema-preflight-only]\n\nPreview-only Phase 2A-1 dossier generator. It reads data and writes only requested local output files. It never sends email, submits contact forms, persists send approvals, applies migrations, or mutates Supabase.`;
const PAGE_SIZE = 100;
const MAX_BULK_QUERY_COUNT = 20;

const parseArgs = (argv = process.argv.slice(2)) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) args[key] = true;
      else { args[key] = next; i += 1; }
    }
  }
  return args;
};

const readInput = async (path) => {
  if (!path) return null;
  const raw = path === '-' ? await new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  }) : await fs.readFile(path, 'utf8');
  return JSON.parse(raw);
};

const encode = (value) => encodeURIComponent(String(value ?? ''));

export const createReadOnlyRequester = (requester = createSupabaseRestRequester()) => async ({ path, method = 'GET', ...rest } = {}) => {
  if (String(method || 'GET').toUpperCase() !== 'GET') throw new Error(`read-only dossier requester rejected ${method} mutation attempt`);
  return requester({ path, method: 'GET', ...rest });
};

const withQueryCounter = (request) => {
  const calls = [];
  const counted = async (call) => {
    calls.push(call.path);
    return request(call);
  };
  counted.calls = calls;
  return counted;
};

const requireRows = async ({ request, path, stage }) => {
  try {
    const rows = await request({ path });
    if (!Array.isArray(rows)) throw new Error('Supabase response was not an array');
    return rows;
  } catch (error) {
    const wrapped = new Error(`required Supabase read failed at ${stage}: ${error?.message || error}`);
    wrapped.stage = stage;
    throw wrapped;
  }
};

export const loadPagedRows = async ({ request, table, select = '*', filters = '', order = 'updated_at.desc', pageSize = PAGE_SIZE, stage = table } = {}) => {
  const rows = [];
  let page = 0;
  for (;;) {
    const offset = page * pageSize;
    const pieces = [`select=${encode(select)}`];
    if (filters) pieces.push(filters);
    if (order) pieces.push(`order=${encode(order)}`);
    pieces.push(`limit=${pageSize}`, `offset=${offset}`);
    const batch = await requireRows({ request, path: `${table}?${pieces.join('&')}`, stage: `${stage}:page_${page + 1}` });
    rows.push(...batch);
    page += 1;
    if (batch.length < pageSize) break;
  }
  return { table, rows, pageCount: page, pageSize, deterministicSort: order, sourceQuery: `${table}${filters ? `?${filters}` : ''}` };
};

const TABLE_SPECS = {
  prospects: { table: 'race_mockup_prospects', select: '*', normalizer: normalizeProspectRow, keysIndexed: ['id', 'registration_url', 'registration_platform|registration_race_id', 'race_slug|official_domain'] },
  generationJobs: { table: 'race_mockup_generation_jobs', select: 'id,prospect_id,job_status,qa_status,site_auditor_status,owner_approval_status,mockup_url,template,source_bundle,metadata,updated_at,created_at,outreach_id', filters: 'template=eq.community', normalizer: normalizeGenerationJobRow, keysIndexed: ['prospect_id', 'id', 'mockup_url'] },
  outreach: { table: 'race_mockup_outreach', select: 'id,race_name,race_slug,official_domain,registration_url,registration_platform,registration_race_id,mockup_url,mockup_template,outreach_status,response_status,to_emails,cc_emails,bcc_emails,sent_at,last_contacted_at,resend_email_id,engagement_status,bounced_at,complained_at,unsubscribed_at,suppressed_at,campaign_id,campaign_lane,metadata,created_at,updated_at', normalizer: normalizeOutreachRow, keysIndexed: ['metadata.generation_job_id', 'metadata.prospect_id', 'mockup_url', 'registration_platform|registration_race_id', 'race_slug|official_domain'] },
  suppressions: { table: 'outreach_suppressions', select: 'id,recipient_email_hash,reason,source_provider,source_outreach_id,created_at,updated_at', normalizer: normalizeSuppressionRow, keysIndexed: ['recipient_email_hash'] },
  auditRequests: { table: 'audit_requests', select: 'id,race_name,current_url,contact_email,race_date,registration_url,registration_platform,status,outreach_status,stripe_customer_id,stripe_checkout_session_id,stripe_payment_intent_id,deposit_status,deposit_paid_at,metadata,created_at,updated_at', normalizer: normalizeAuditRequestRow, keysIndexed: ['registration_url/current_url'] },
  customerRecords: { table: 'customer_records', select: 'id,audit_request_id,race_name,current_url,registration_url,primary_contact_email,billing_contact_email,customer_status,deposit_status,subscription_status,stripe_customer_id,stripe_checkout_session_id,stripe_deposit_payment_intent_id,deposit_paid_at,metadata,created_at,updated_at', normalizer: normalizeCustomerRecordRow, keysIndexed: ['registration_url/current_url', 'stripe ids'] },
  stripeWebhookEvents: { table: 'stripe_webhook_events', select: 'id,stripe_event_id,event_type,processing_status,checkout_session_id,payment_intent_id,stripe_customer_id,payload,processed_at,created_at,updated_at', normalizer: normalizeStripeWebhookEventRow, keysIndexed: ['checkout_session_id', 'payment_intent_id', 'stripe_customer_id', 'payload.livemode'] },
};

export const loadProductionTables = async ({ request } = {}) => {
  const scans = {};
  for (const [name, spec] of Object.entries(TABLE_SPECS)) {
    const scan = await loadPagedRows({ request, table: spec.table, select: spec.select, filters: spec.filters || '', order: 'updated_at.desc', stage: name });
    scan.rawColumns = [...new Set(scan.rows.flatMap((row) => Object.keys(row || {})))].sort();
    scan.rows = scan.rows.map(spec.normalizer);
    scan.canonicalFields = [...new Set(scan.rows.flatMap((row) => Object.keys(row || {})))].sort();
    scan.keysIndexed = spec.keysIndexed;
    scans[name] = scan;
  }
  return scans;
};

export const selectLatestCommunityJobByProspect = (jobs = []) => {
  const byProspect = new Map();
  const communityJobs = jobs.filter((job) => String(job.template || job.mockup_template || '').toLowerCase() === 'community');
  for (const job of communityJobs) {
    if (!job.prospect_id) continue;
    const current = byProspect.get(job.prospect_id);
    const key = Date.parse(job.updated_at || job.created_at || '') || 0;
    const currentKey = current ? (Date.parse(current.updated_at || current.created_at || '') || 0) : -1;
    if (!current || key >= currentKey) byProspect.set(job.prospect_id, job);
  }
  return { byProspect, generationJobsScanned: communityJobs.length, duplicateGenerationJobsCollapsed: communityJobs.length - byProspect.size };
};

export const buildSuppressionFilters = ({ prospect = {} }) => {
  const emails = extractVerifiedEmails(prospect).map((item) => item.email);
  const hashes = [...new Set(emails.map((email) => hashRecipient(email)).filter(Boolean))];
  return hashes.length ? [`recipient_email_hash=in.(${hashes.map(encode).join(',')})`] : [];
};

const recipientHashesForProspect = (prospect = {}) => [...new Set(extractVerifiedEmails(prospect).map((item) => hashRecipient(item.email)).filter(Boolean))];

const exclusionGateStages = [
  ['all_prospect_rows', () => true],
  ['approved_prospect_type_candidates', ({ item }) => item.eligibility_evidence.prospect_type_valid],
  ['lane_a', ({ item }) => item.eligibility_evidence.lane_valid],
  ['race_level_runsignup_registration_url', ({ item }) => item.eligibility_evidence.registration_url_valid],
  ['known_future_date', ({ item }) => item.eligibility_evidence.race_date_valid],
  ['sufficient_lead_time', ({ item }) => item.eligibility_evidence.lead_time_valid],
  ['commercial_truth_real_external_prior_outreach', ({ item }) => !(item.prior_history_classification || {}).REAL_EXTERNAL_OUTREACH],
  ['commercial_truth_real_contact_form_submission', ({ item }) => !(item.prior_history_classification || {}).REAL_EXTERNAL_CONTACT_FORM_SUBMISSION],
  ['commercial_truth_internal_smoke_test_only', () => true],
  ['commercial_truth_historical_real_contact_backfill', ({ item }) => !(item.prior_history_classification || {}).HISTORICAL_BACKFILL_OF_REAL_CONTACT],
  ['commercial_truth_live_audit_customer_payment_outcome', ({ item }) => item.eligibility_evidence.outcome_history_state !== 'DETERMINISTICALLY_BLOCKED'],
  ['commercial_truth_ambiguous_manual_history_confirmation', ({ item }) => item.eligibility_evidence.outcome_history_state !== 'OWNER_HISTORY_CONFIRMATION_REQUIRED'],
  ['one_verified_recipient_or_owner_resolvable_contact_decision', ({ item }) => ['ONE_VERIFIED_RECIPIENT', 'MULTIPLE_VERIFIED_RECIPIENTS', 'PLAUSIBLE_UNVERIFIED_CONTACT'].includes(item.eligibility_evidence.contact_state)],
  ['unsuppressed', ({ item }) => item.eligibility_evidence.suppression_clear],
  ['current_accessible_community_mockup', ({ item }) => item.eligibility_evidence.community_mockup_present && item.eligibility_evidence.preview_ready],
  ['completed_quality_reviews', ({ item }) => item.eligibility_evidence.qa_valid && item.eligibility_evidence.site_auditor_valid],
  ['explicit_official_site_classification', ({ item }) => item.eligibility_evidence.official_site_valid],
  ['complete_attribution', ({ item }) => item.eligibility_evidence.attribution_complete],
];

export const buildExclusionWaterfall = (candidates = []) => {
  let remaining = candidates.slice();
  const rows = [];
  const stages = exclusionGateStages;
  for (const [stage, predicate] of stages) {
    const before = remaining.length;
    const passed = remaining.filter(predicate);
    rows.push({ stage, before, excluded: before - passed.length, remaining: passed.length });
    remaining = passed;
  }
  const includeCount = candidates.filter((row) => row.item.final_dry_run_recommendation === 'INCLUDE').length;
  const needsCount = candidates.filter((row) => String(row.item.final_dry_run_recommendation).startsWith('NEEDS_STEVE_DECISION')).length;
  const excludeCount = candidates.filter((row) => row.item.final_dry_run_recommendation === 'EXCLUDE').length;
  rows.push({ stage: 'INCLUDE', before: candidates.length, excluded: candidates.length - includeCount, remaining: includeCount });
  rows.push({ stage: 'NEEDS_STEVE_DECISION', before: candidates.length, excluded: candidates.length - needsCount, remaining: needsCount });
  rows.push({ stage: 'EXCLUDE', before: candidates.length, excluded: candidates.length - excludeCount, remaining: excludeCount });
  rows.push({ stage: 'DENOMINATOR_RECONCILIATION', before: candidates.length, excluded: 0, remaining: includeCount + needsCount + excludeCount });
  return rows;
};

export const classifyLastMileVisibility = (item = {}) => {
  const contactStage = 'one_verified_recipient_or_owner_resolvable_contact_decision';
  const qualityStage = 'completed_quality_reviews';
  const contactIndex = exclusionGateStages.findIndex(([stage]) => stage === contactStage);
  const qualityIndex = exclusionGateStages.findIndex(([stage]) => stage === qualityStage);
  let lastGatePassed = 'none';
  let lastPassedIndex = -1;
  let finalExclusionStage = item.final_dry_run_recommendation || 'unknown';
  for (const [index, [stage, predicate]] of exclusionGateStages.entries()) {
    if (predicate({ item })) {
      lastGatePassed = stage;
      lastPassedIndex = index;
      continue;
    }
    finalExclusionStage = stage;
    break;
  }
  const reachedFinalContactOrQualityGate = finalExclusionStage === contactStage || lastPassedIndex >= contactIndex || finalExclusionStage === qualityStage || lastPassedIndex >= qualityIndex;
  const reasons = item.hard_blockers?.length ? item.hard_blockers : item.owner_concerns || [];
  return {
    visible: item.final_dry_run_recommendation !== 'EXCLUDE' || reachedFinalContactOrQualityGate,
    reachedFinalContactOrQualityGate,
    lastGatePassed,
    finalExclusionStage: item.final_dry_run_recommendation === 'EXCLUDE' ? finalExclusionStage : item.final_dry_run_recommendation,
    contactState: item.eligibility_evidence?.contact_state || 'unknown',
    exclusionReason: reasons.join('; ') || 'none',
  };
};

const redactedLastMileIdentifier = (item = {}) => {
  const id = item.prospect_snapshot?.id || item.generation_job_snapshot?.prospect_id || item.generation_job_snapshot?.id || item.race_name || 'unknown';
  const text = String(id);
  if (text.length <= 8) return `${text.slice(0, 2)}***`;
  return `${text.slice(0, 6)}***${text.slice(-4)}`;
};

const summarizeCounts = (items = [], field = 'prior_history_classification') => items.reduce((acc, item) => {
  for (const [key, value] of Object.entries(item[field] || {})) acc[key] = (acc[key] || 0) + Number(value || 0);
  return acc;
}, {});

export const buildCommercialHistoryMarkdown = ({ items = [], scanEvidence = {}, generatedAt = new Date().toISOString() } = {}) => {
  const prior = summarizeCounts(items, 'prior_history_classification');
  const lines = [
    '# StartLineSites CMO Phase 2A-1 Real/Test Commercial History Summary',
    '',
    `Generated: ${generatedAt}`,
    `Unique prospect denominator: ${scanEvidence.uniqueProspectIds ?? items.length}`,
    `Total REST query count: ${scanEvidence.totalRestQueryCount ?? 'unknown'}`,
    '',
    'Private classification summary. Identities, raw email addresses, private tokens, database URLs, and environment values are excluded.',
    '',
    '## Classification counts',
  ];
  for (const key of ['REAL_EXTERNAL_OUTREACH', 'REAL_EXTERNAL_CONTACT_FORM_SUBMISSION', 'INTERNAL_SMOKE_OR_TEST', 'HISTORICAL_BACKFILL_OF_REAL_CONTACT', 'LIVE_AUDIT_CUSTOMER_PAYMENT_OUTCOME', 'CONTROLLED_TEST_OUTCOME', 'AMBIGUOUS_REQUIRES_OWNER_CONFIRMATION', 'AMBIGUOUS_MANUAL_HISTORY_CONFIRMATION', 'NO_HISTORICAL_BLOCKER']) {
    lines.push(`- ${key}: ${prior[key] || 0}`);
  }
  const includeCount = items.filter((item) => item.final_dry_run_recommendation === 'INCLUDE').length;
  const needsCount = items.filter((item) => String(item.final_dry_run_recommendation).startsWith('NEEDS_STEVE_DECISION')).length;
  const excludeCount = items.filter((item) => item.final_dry_run_recommendation === 'EXCLUDE').length;
  lines.push('', '## Final recommendations', `- INCLUDE: ${includeCount}`, `- NEEDS_STEVE_DECISION: ${needsCount}`, `- EXCLUDE: ${excludeCount}`);
  lines.push('', 'Revenue claim guardrail: test-mode/internal controlled records remain excluded from live revenue/customer claims. Ambiguous manual/test history requires owner confirmation rather than deterministic clear.');
  return `${lines.join('\n')}\n`;
};

export const buildPrivateTruthTableMarkdown = ({ items = [], scanEvidence = {}, generatedAt = new Date().toISOString() } = {}) => {
  const approvedLaneItems = items.filter((item) => item.eligibility_evidence?.prospect_type_valid && item.eligibility_evidence?.lane_valid);
  const lines = [
    '# StartLineSites CMO Phase 2A-1 Private Lane A Commercial-Truth Table',
    '',
    `Generated: ${generatedAt}`,
    `Approved Lane A rows: ${approvedLaneItems.length}`,
    `Full denominator: ${scanEvidence.uniqueProspectIds ?? items.length}`,
    '',
    'No raw email addresses, private preview tokens, database URLs, or environment values are included.',
    '',
  ];
  if (!approvedLaneItems.length) lines.push('- none');
  for (const item of approvedLaneItems) {
    lines.push(`- id=${redactedLastMileIdentifier(item)}; prior_history=${JSON.stringify(item.prior_history_classification || {})}; deterministic_blocker=${Boolean(item.deterministic_history_blocker)}; owner_confirmation_reason=${item.owner_confirmation_reason || 'none'}; contact_state=${item.eligibility_evidence?.contact_state || 'unknown'}; final_recommendation=${item.final_dry_run_recommendation}`);
  }
  return `${lines.join('\n')}\n`;
};

const contactPathSummary = (item = {}) => {
  const e = item.eligibility_evidence || {};
  if (e.contact_state === 'NO_VERIFIED_CONTACT') return 'zero verified contacts and zero plausible direct/routing contacts';
  if (e.contact_state === 'MULTIPLE_VERIFIED_RECIPIENTS') return `${e.verified_contacts_count || 0} verified contacts require Steve to select one`;
  if (e.contact_state === 'PLAUSIBLE_UNVERIFIED_CONTACT') return `${e.plausible_contacts_count || 0} plausible unverified direct/routing contact candidate(s)`;
  if (e.contact_state === 'ONE_VERIFIED_RECIPIENT') return 'one verified contact';
  return e.contact_state || 'unknown contact state';
};

export const buildLastMileCandidateCardMarkdown = ({ items = [], scanEvidence = {}, generatedAt = new Date().toISOString() } = {}) => {
  const lastMileItems = items.map((item) => ({ item, lastMile: classifyLastMileVisibility(item) })).filter(({ lastMile }) => lastMile.visible);
  const lines = [
    '# StartLineSites CMO Phase 2A-1 Private Last-Mile Candidate Card',
    '',
    `Generated: ${generatedAt}`,
    `Full denominator: ${scanEvidence.uniqueProspectIds ?? items.length}`,
    `Last-mile candidates rendered: ${lastMileItems.length}`,
    '',
    'No outreach, contact-form submission, send approval persistence, production migration, or Supabase mutation occurred.',
    '',
  ];
  if (!lastMileItems.length) lines.push('No candidates reached final contact or quality gates.');
  for (const { item, lastMile } of lastMileItems) {
    const e = item.eligibility_evidence || {};
    lines.push(`## ${item.race_name}`);
    lines.push(`- Redacted identifier: ${redactedLastMileIdentifier(item)}`);
    lines.push(`- Final recommendation: ${item.final_dry_run_recommendation}`);
    lines.push(`- Last gate passed: ${lastMile.lastGatePassed}`);
    lines.push(`- Exact final exclusion stage: ${lastMile.finalExclusionStage}`);
    lines.push(`- Contact state: ${lastMile.contactState}`);
    lines.push(`- Contact path: ${contactPathSummary(item)}`);
    lines.push(`- Verified-contact source evidence: verified=${e.verified_contacts_count || 0}; plausible=${e.plausible_contacts_count || 0}; selected_masked=${item.masked_recipient || 'none'}`);
    lines.push(`- Contact-form availability: ${e.contact_form_only ? 'contact_form_only' : e.contact_form_only === false ? 'not_contact_form_only' : 'unknown'}`);
    lines.push(`- Prior external/test history: ${JSON.stringify(item.prior_history_classification || {})}; deterministic_blocker=${Boolean(item.deterministic_history_blocker)}; owner_confirmation_reason=${item.owner_confirmation_reason || 'none'}`);
    lines.push(`- Mockup/Site Auditor state: mockup_present=${Boolean(e.community_mockup_present)}; preview_ready=${Boolean(e.preview_ready)}; qa_valid=${Boolean(e.qa_valid)}; site_auditor_valid=${Boolean(e.site_auditor_valid)}`);
    lines.push(`- Official-site state: ${e.official_site_reason || 'unknown'}`);
    lines.push(`- Exclusion reason: ${lastMile.exclusionReason}`);
    lines.push(`- Required change to qualify: ${lastMile.contactState === 'NO_VERIFIED_CONTACT' ? 'source-backed direct/routing email evidence plus all other quality, official-site, attribution, suppression, and history gates passing' : 'clear listed blockers while preserving no-send and owner approval gates'}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
};

export const buildExclusionWaterfallMarkdown = ({ items = [], scanEvidence = {}, generatedAt = new Date().toISOString() } = {}) => {
  const lines = [
    '# StartLineSites CMO Phase 2A-1 Candidate Exclusion Waterfall',
    '',
    `Generated: ${generatedAt}`,
    `Source table/query: ${scanEvidence.sourceQuery || 'unknown'}`,
    `Deterministic sort: ${scanEvidence.deterministicSort || 'unknown'}`,
    `Unique prospect denominator: ${scanEvidence.uniqueProspectIds ?? items.length}`,
    `Total REST query count: ${scanEvidence.totalRestQueryCount ?? 'unknown'}`,
    '',
    'No outreach, contact form submission, send approval persistence, production migration, or Supabase mutation occurred.',
    '',
    '## Structured sequential waterfall',
  ];
  const candidates = items.map((item) => ({ item, prospect: item.prospect_snapshot || {}, job: item.generation_job_snapshot || {} }));
  for (const row of buildExclusionWaterfall(candidates)) lines.push(`- ${row.stage}: before=${row.before}; excluded=${row.excluded}; remaining=${row.remaining}`);
  lines.push('', '## Last-mile candidates', '');
  const lastMileItems = items
    .map((item) => ({ item, lastMile: classifyLastMileVisibility(item) }))
    .filter(({ lastMile }) => lastMile.visible);
  if (!lastMileItems.length) lines.push('- none');
  for (const { item, lastMile } of lastMileItems) {
    lines.push(`- id=${redactedLastMileIdentifier(item)}; race=${item.race_name}; recommendation=${item.final_dry_run_recommendation}; last_gate_passed=${lastMile.lastGatePassed}; final_exclusion_stage=${lastMile.finalExclusionStage}; contact_state=${lastMile.contactState}; reason=${lastMile.exclusionReason}; contact=${item.contact_role}; mockup=${redactPrivateUrl(item.community_mockup_url_redacted || '') || 'redacted'}; history=${item.owner_history_confirmation_state}`);
  }
  return `${lines.join('\n')}\n`;
};

export const loadReadOnlySupabaseCandidates = async ({ limit = 10, requester } = {}) => {
  const request = withQueryCounter(createReadOnlyRequester(requester));
  const scans = await loadProductionTables({ request });
  const indexes = buildProductionIndexes({
    prospects: scans.prospects.rows,
    generationJobs: scans.generationJobs.rows,
    outreach: scans.outreach.rows,
    suppressions: scans.suppressions.rows,
    auditRequests: scans.auditRequests.rows,
    customerRecords: scans.customerRecords.rows,
    stripeWebhookEvents: scans.stripeWebhookEvents.rows,
  });
  if (request.calls.length > MAX_BULK_QUERY_COUNT) throw new Error(`bounded bulk scan exceeded query cap: ${request.calls.length} > ${MAX_BULK_QUERY_COUNT}`);
  const collapsed = selectLatestCommunityJobByProspect(scans.generationJobs.rows);
  const candidates = [];
  for (const prospect of scans.prospects.rows) {
    const job = collapsed.byProspect.get(prospect.id) || {};
    const priorOutreachRows = findPriorOutreachForCandidate({ prospect, generationJob: job, indexes });
    const outreachHistory = summarizeOutreachHistory(priorOutreachRows);
    const suppressions = findSuppressionsForCandidate({ recipientHashes: recipientHashesForProspect(prospect), indexes });
    const outcomeEvidence = findOutcomeEvidenceForCandidate({ prospect, generationJob: job, indexes });
    if (outreachHistory.ambiguousRows.length) outcomeEvidence.unavailableSources = [...(outcomeEvidence.unavailableSources || []), 'ambiguous_prior_outreach_requires_owner_confirmation'];
    outcomeEvidence.sourceSummary = { ...(outcomeEvidence.sourceSummary || {}), outreach_history_breakdown: outreachHistory.breakdown, prior_outreach_rows: priorOutreachRows.length, real_prior_outreach_blockers: outreachHistory.blockingRows.length, ambiguous_prior_outreach_rows: outreachHistory.ambiguousRows.length };
    const item = buildOwnerReviewDossierItem({ prospect, generationJob: job, priorOutreach: outreachHistory.blockingRows, suppressions, outcomeEvidence });
    const outreachBreakdown = Object.keys(outreachHistory.breakdown).length ? outreachHistory.breakdown : {};
    const commercialBreakdown = outcomeEvidence.commercialHistoryClassification?.breakdown || {};
    item.prior_history_classification = Object.keys({ ...outreachBreakdown, ...commercialBreakdown }).length ? { ...outreachBreakdown, ...commercialBreakdown } : { NO_HISTORICAL_BLOCKER: 1 };
    item.deterministic_history_blocker = outreachHistory.blockingRows.length > 0 || outcomeEvidence.commercialHistoryClassification?.state === 'BLOCKS';
    item.owner_confirmation_reason = [...(outreachHistory.ambiguousRows.length ? ['ambiguous_prior_outreach_requires_owner_confirmation'] : []), ...(outcomeEvidence.unavailableSources || []), ...(outcomeEvidence.unverifiedLinkages || [])].join('; ');
    item.prospect_snapshot = { id: prospect.id, prospect_type: prospect.prospect_type, campaign_lane: prospect.campaign_lane, registration_url: prospect.registration_url, race_date: prospect.race_date || prospect.event_date, field_provenance: prospect.field_provenance };
    item.generation_job_snapshot = { id: job.id || '', prospect_id: job.prospect_id || '', template: job.template || '', updated_at: job.updated_at || '' };
    candidates.push({ prospect, job, item });
  }
  const items = candidates.map((candidate) => candidate.item);
  const reviewItems = items.filter((item) => item.final_dry_run_recommendation === 'INCLUDE' || item.final_dry_run_recommendation.startsWith('NEEDS_STEVE_DECISION'));
  const tableReports = Object.fromEntries(Object.entries(scans).map(([name, scan]) => [name, { table: scan.table, rowsLoaded: scan.rows.length, pages: scan.pageCount, queryCount: scan.pageCount, keysIndexed: scan.keysIndexed }]));
  return {
    items,
    dataMapMarkdown: buildProductionDataMapMarkdown({ tableScans: scans }),
    scanEvidence: {
      tableReports,
      prospectRowsScanned: scans.prospects.rows.length,
      uniqueProspectIds: new Set(scans.prospects.rows.map((row) => row.id)).size,
      generationJobsScanned: collapsed.generationJobsScanned,
      duplicateGenerationJobsCollapsed: collapsed.duplicateGenerationJobsCollapsed,
      outreachRows: scans.outreach.rows.length,
      suppressionRows: scans.suppressions.rows.length,
      auditOutcomeRows: scans.auditRequests.rows.length + scans.customerRecords.rows.length + scans.stripeWebhookEvents.rows.length,
      finalOneRowPerProspectCandidateCount: candidates.length,
      pageCount: scans.prospects.pageCount,
      prospectPageCount: scans.prospects.pageCount,
      generationJobPageCount: scans.generationJobs.pageCount,
      totalRestQueryCount: request.calls.length,
      totalRowsScanned: scans.prospects.rows.length,
      sourceQuery: 'bounded bulk read of race_mockup_prospects plus actual production adapter tables; no per-prospect lookups',
      deterministicSort: scans.prospects.deterministicSort,
      sourceTable: 'race_mockup_prospects authoritative prospect universe',
      exclusionWaterfall: buildExclusionWaterfall(candidates),
    },
    selectedItems: reviewItems.slice(0, Number(limit || 10)),
  };
};

const main = async () => {
  const args = parseArgs();
  if (args.help) { console.log(USAGE); return; }
  const input = await readInput(args.input);
  const result = input
    ? { items: (input.items || []).map((item) => buildOwnerReviewDossierItem(item)), scanEvidence: { totalRowsScanned: (input.items || []).length, pageCount: 0, sourceQuery: `fixture ${args.input}`, deterministicSort: 'fixture order', uniqueProspectIds: (input.items || []).length, totalRestQueryCount: 0 } }
    : await loadReadOnlySupabaseCandidates({ limit: args.limit || 10 });
  if (args['schema-preflight-only']) {
    if (args['data-map-output'] && result.dataMapMarkdown) await fs.writeFile(args['data-map-output'], result.dataMapMarkdown);
    console.log(JSON.stringify({ scanEvidence: result.scanEvidence }, null, 2));
    return;
  }
  const selected = result.selectedItems || result.items;
  const fullItems = result.items || selected;
  const markdown = buildDossierMarkdown(selected, {
    source: input ? `fixture ${args.input}` : 'read-only production Supabase candidate scan',
    denominator: result.scanEvidence?.uniqueProspectIds ?? fullItems.length,
    includeCount: fullItems.filter((item) => item.final_dry_run_recommendation === 'INCLUDE').length,
    needsDecisionCount: fullItems.filter((item) => String(item.final_dry_run_recommendation).startsWith('NEEDS_STEVE_DECISION')).length,
    excludeCount: fullItems.filter((item) => item.final_dry_run_recommendation === 'EXCLUDE').length,
    displayLimit: args.limit || 10,
  });
  if (args.output) await fs.writeFile(args.output, markdown);
  if (args['exclusion-output']) await fs.writeFile(args['exclusion-output'], buildExclusionWaterfallMarkdown({ items: fullItems, scanEvidence: result.scanEvidence }));
  if (args['data-map-output'] && result.dataMapMarkdown) await fs.writeFile(args['data-map-output'], result.dataMapMarkdown);
  if (args['truth-table-output']) await fs.writeFile(args['truth-table-output'], buildPrivateTruthTableMarkdown({ items: fullItems, scanEvidence: result.scanEvidence }));
  if (args['last-mile-output']) await fs.writeFile(args['last-mile-output'], buildLastMileCandidateCardMarkdown({ items: fullItems, scanEvidence: result.scanEvidence }));
  if (args['history-output']) await fs.writeFile(args['history-output'], buildCommercialHistoryMarkdown({ items: fullItems, scanEvidence: result.scanEvidence }));
  console.log(markdown);
  console.error(JSON.stringify({ scanEvidence: result.scanEvidence }, null, 2));
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { console.error(error?.message || error); process.exit(1); });
}
