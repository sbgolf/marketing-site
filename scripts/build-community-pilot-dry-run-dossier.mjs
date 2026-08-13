#!/usr/bin/env node
import fs from 'node:fs/promises';
import { createSupabaseRestRequester } from './lib/mockup-generation-send-gate.mjs';
import { buildDossierMarkdown, buildOwnerReviewDossierItem, extractVerifiedEmails, hashRecipient, redactPrivateUrl, validatePilotInitialSend } from './lib/community-pilot-governance.mjs';

const USAGE = `Usage: node scripts/build-community-pilot-dry-run-dossier.mjs [--input fixture.json] [--output file.md] [--limit 10]\n\nPreview-only Phase 2A-1 dossier generator. It reads data and writes only the requested local output file. It never sends email, submits contact forms, persists send approvals, applies migrations, or mutates Supabase.`;

const PAGE_SIZE = 100;

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
const uniqById = (rows = []) => [...new Map((rows || []).filter(Boolean).map((row) => [row.id || JSON.stringify(row), row])).values()];

export const createReadOnlyRequester = (requester = createSupabaseRestRequester()) => async ({ path, method = 'GET', ...rest } = {}) => {
  if (String(method || 'GET').toUpperCase() !== 'GET') throw new Error(`read-only dossier requester rejected ${method} mutation attempt`);
  return requester({ path, method: 'GET', ...rest });
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
  return { rows, pageCount: page, pageSize, deterministicSort: order, sourceQuery: `${table}${filters ? `?${filters}` : ''}` };
};

const lookupRows = async ({ request, table, select = 'id', filters = [], stage }) => {
  const all = [];
  for (const filter of filters.filter(Boolean)) {
    all.push(...await requireRows({ request, path: `${table}?select=${encode(select)}&${filter}&limit=25`, stage }));
  }
  return uniqById(all);
};

const buildPriorOutreachFilters = ({ job = {}, prospect = {} }) => [
  job.id ? `metadata->>generation_job_id=eq.${encode(job.id)}` : '',
  job.id ? `mockup_generation_job_id=eq.${encode(job.id)}` : '',
  job.prospect_id ? `prospect_id=eq.${encode(job.prospect_id)}` : '',
  prospect.id ? `prospect_id=eq.${encode(prospect.id)}` : '',
  job.mockup_url ? `mockup_url=eq.${encode(job.mockup_url)}` : '',
  prospect.source_race_id ? `metadata->>source_race_id=eq.${encode(prospect.source_race_id)}` : '',
  prospect.registration_race_id ? `metadata->>registration_race_id=eq.${encode(prospect.registration_race_id)}` : '',
  prospect.registration_url ? `metadata->>registration_url=eq.${encode(prospect.registration_url)}` : '',
];

export const buildSuppressionFilters = ({ prospect = {} }) => {
  const emails = extractVerifiedEmails(prospect).map((item) => item.email);
  const hashes = [...new Set(emails.map((email) => hashRecipient(email)).filter(Boolean))];
  return hashes.length ? [`recipient_email_hash=in.(${hashes.map(encode).join(',')})`] : [];
};

const buildOutcomeEvidence = async ({ request, prospect = {}, job = {} }) => {
  const sourceRaceId = prospect.source_race_id || prospect.registration_race_id || job.source_bundle?.source_race_id || job.source_bundle?.registration_race_id;
  const prospectId = prospect.id || job.prospect_id;
  const filters = [
    prospectId ? `prospect_id=eq.${encode(prospectId)}` : '',
    sourceRaceId ? `metadata->>source_race_id=eq.${encode(sourceRaceId)}` : '',
  ];
  const [auditRequests, proposals, checkouts, customers] = await Promise.all([
    lookupRows({ request, table: 'audit_requests', filters, stage: 'outcome:audit_requests' }),
    lookupRows({ request, table: 'startline_proposals', filters, stage: 'outcome:proposals' }),
    lookupRows({ request, table: 'stripe_checkout_sessions', filters, stage: 'outcome:checkouts' }),
    lookupRows({ request, table: 'startline_customers', filters, stage: 'outcome:customers' }),
  ]);
  return { auditRequests, proposals, checkouts, customers };
};

export const WATERFALL_STAGES = [
  ['all_prospect_rows', () => true],
  ['approved_prospect_type_candidates', ({ prospect }) => Boolean(prospect.prospect_type)],
  ['lane_a', ({ prospect, job }) => ['lane_a', 'a'].includes(String(prospect.campaign_lane || job?.campaign_lane || '').toLowerCase())],
  ['race_level_runsignup_registration_url', ({ prospect }) => Boolean(prospect.registration_url)],
  ['known_future_date', ({ prospect }) => Boolean(prospect.event_date || prospect.race_date)],
  ['sufficient_lead_time', ({ item }) => !item.owner_concerns.some((c) => /race_too_close|past|future race date/.test(c))],
  ['no_prior_outreach_or_outcome_blocker', ({ item }) => !item.owner_concerns.some((c) => /prior|duplicate|reply|audit|proposal|checkout|purchase/.test(c))],
  ['one_verified_recipient_or_owner_resolvable_contact_decision', ({ item }) => item.final_dry_run_recommendation === 'INCLUDE' || item.final_dry_run_recommendation.startsWith('NEEDS_STEVE_DECISION') || !item.owner_concerns.some((c) => /verified direct|selected recipient|multiple verified/.test(c))],
  ['unsuppressed', ({ item }) => !item.owner_concerns.some((c) => /suppression|negative delivery/.test(c))],
  ['current_accessible_community_mockup', ({ item }) => !item.owner_concerns.some((c) => /Community mockup|private preview|mockup_template_family/.test(c))],
  ['qa_requirements', ({ item }) => !item.owner_concerns.some((c) => /QA|auditor/.test(c))],
  ['explicit_official_site_classification', ({ item }) => !item.owner_concerns.some((c) => /official_site|Lane A excluded/.test(c))],
  ['complete_attribution', ({ item }) => !item.owner_concerns.some((c) => /missing attribution/.test(c))],
];

export const buildExclusionWaterfall = (candidates = []) => {
  let remaining = candidates.slice();
  const rows = [];
  for (const [stage, predicate] of WATERFALL_STAGES) {
    const before = remaining.length;
    const passed = remaining.filter(predicate);
    rows.push({ stage, before, excluded: before - passed.length, remaining: passed.length });
    remaining = passed;
  }
  rows.push({ stage: 'INCLUDE', before: remaining.length, excluded: remaining.filter((row) => row.item.final_dry_run_recommendation !== 'INCLUDE').length, remaining: remaining.filter((row) => row.item.final_dry_run_recommendation === 'INCLUDE').length });
  rows.push({ stage: 'NEEDS_STEVE_DECISION', before: candidates.length, excluded: candidates.filter((row) => !row.item.final_dry_run_recommendation.startsWith('NEEDS_STEVE_DECISION')).length, remaining: candidates.filter((row) => row.item.final_dry_run_recommendation.startsWith('NEEDS_STEVE_DECISION')).length });
  rows.push({ stage: 'EXCLUDE', before: candidates.length, excluded: candidates.filter((row) => row.item.final_dry_run_recommendation !== 'EXCLUDE').length, remaining: candidates.filter((row) => row.item.final_dry_run_recommendation === 'EXCLUDE').length });
  return rows;
};

export const buildExclusionWaterfallMarkdown = ({ items = [], scanEvidence = {}, generatedAt = new Date().toISOString() } = {}) => {
  const lines = [
    '# StartLineSites CMO Phase 2A-1 Candidate Exclusion Waterfall',
    '',
    `Generated: ${generatedAt}`,
    `Source table/query: ${scanEvidence.sourceQuery || 'unknown'}`,
    `Deterministic sort: ${scanEvidence.deterministicSort || 'unknown'}`,
    `Total rows scanned: ${scanEvidence.totalRowsScanned ?? items.length}`,
    `Page count: ${scanEvidence.pageCount || 0}`,
    '',
    'No outreach, contact form submission, send approval persistence, production migration, or Supabase mutation occurred.',
    '',
    '## Reason counts',
  ];
  for (const row of buildExclusionWaterfall(items.map((item) => ({ item, prospect: item.prospect_snapshot || {}, job: item.generation_job_snapshot || {} })))) lines.push(`- ${row.stage}: before=${row.before}; excluded=${row.excluded}; remaining=${row.remaining}`);
  lines.push('', '## Last-mile candidates', '');
  for (const item of items.filter((i) => i.final_dry_run_recommendation !== 'EXCLUDE')) lines.push(`- ${item.race_name}: ${item.final_dry_run_recommendation}; contact=${item.contact_role}; mockup=${redactPrivateUrl(item.community_mockup_url_redacted || '') || 'redacted'}`);
  return `${lines.join('\n')}\n`;
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

export const loadReadOnlySupabaseCandidates = async ({ limit = 10, requester } = {}) => {
  const request = createReadOnlyRequester(requester);
  const [prospectScan, jobScan] = await Promise.all([
    loadPagedRows({ request, table: 'race_mockup_prospects', select: '*', order: 'updated_at.desc', stage: 'prospects' }),
    loadPagedRows({ request, table: 'race_mockup_generation_jobs', select: 'id,prospect_id,job_status,qa_status,site_auditor_status,owner_approval_status,mockup_url,template,source_bundle,metadata,updated_at,created_at,outreach_id', filters: 'template=eq.community', order: 'updated_at.desc', stage: 'generation_jobs' }),
  ]);
  const collapsed = selectLatestCommunityJobByProspect(jobScan.rows);
  const candidates = [];
  for (const prospect of prospectScan.rows) {
    const job = collapsed.byProspect.get(prospect.id) || {};
    const [priorOutreach, suppressions, outcomes] = await Promise.all([
      lookupRows({ request, table: 'race_mockup_outreach', filters: buildPriorOutreachFilters({ job, prospect }), stage: 'prior_outreach' }),
      lookupRows({ request, table: 'outreach_suppressions', filters: buildSuppressionFilters({ prospect }), stage: 'suppressions' }),
      buildOutcomeEvidence({ request, prospect, job }),
    ]);
    const enrichedProspect = {
      ...prospect,
      audit_request_id: outcomes.auditRequests[0]?.id || prospect.audit_request_id,
      proposal_id: outcomes.proposals[0]?.id || prospect.proposal_id,
      checkout_session_id: outcomes.checkouts[0]?.id || prospect.checkout_session_id,
      customer_record_id: outcomes.customers[0]?.id || prospect.customer_record_id,
    };
    const item = buildOwnerReviewDossierItem({ prospect: enrichedProspect, generationJob: job, priorOutreach, suppressions });
    item.prospect_snapshot = { id: prospect.id, prospect_type: prospect.prospect_type, campaign_lane: prospect.campaign_lane, registration_url: prospect.registration_url, race_date: prospect.race_date || prospect.event_date };
    item.generation_job_snapshot = { id: job.id || '', prospect_id: job.prospect_id || '', template: job.template || '', updated_at: job.updated_at || '' };
    candidates.push({ prospect: enrichedProspect, job, item });
  }
  const items = candidates.map((candidate) => candidate.item);
  const reviewItems = items.filter((item) => item.final_dry_run_recommendation === 'INCLUDE' || item.final_dry_run_recommendation.startsWith('NEEDS_STEVE_DECISION'));
  return {
    items,
    scanEvidence: {
      prospectRowsScanned: prospectScan.rows.length,
      uniqueProspectIds: new Set(prospectScan.rows.map((row) => row.id)).size,
      generationJobsScanned: collapsed.generationJobsScanned,
      duplicateGenerationJobsCollapsed: collapsed.duplicateGenerationJobsCollapsed,
      finalOneRowPerProspectCandidateCount: candidates.length,
      pageCount: prospectScan.pageCount,
      prospectPageCount: prospectScan.pageCount,
      generationJobPageCount: jobScan.pageCount,
      totalRowsScanned: prospectScan.rows.length,
      sourceQuery: 'race_mockup_prospects full table joined read-only to latest relevant Community generation job per prospect',
      deterministicSort: prospectScan.deterministicSort,
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
    ? { items: (input.items || []).map((item) => buildOwnerReviewDossierItem(item)), scanEvidence: { totalRowsScanned: (input.items || []).length, pageCount: 0, sourceQuery: `fixture ${args.input}`, deterministicSort: 'fixture order' } }
    : await loadReadOnlySupabaseCandidates({ limit: args.limit || 10 });
  const selected = result.selectedItems || result.items;
  const markdown = buildDossierMarkdown(selected, { source: input ? `fixture ${args.input}` : 'read-only production Supabase candidate scan' });
  if (args.output) await fs.writeFile(args.output, markdown);
  if (args['exclusion-output']) await fs.writeFile(args['exclusion-output'], buildExclusionWaterfallMarkdown({ items: result.items, scanEvidence: result.scanEvidence }));
  console.log(markdown);
  console.error(JSON.stringify({ scanEvidence: result.scanEvidence }, null, 2));
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { console.error(error?.message || error); process.exit(1); });
}
