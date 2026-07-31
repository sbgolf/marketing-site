import { classifyTemplateFits } from './mockup-template-fit.mjs';

const TERMINAL_STATUSES = new Set(['outreach_sent', 'held', 'skipped', 'inactive', 'archived']);

const normalizeKey = (value) => String(value || '').trim().toLowerCase();
const clean = (value) => (value === null || value === undefined ? '' : String(value).trim().replace(/\s+/g, ' '));

export const buildCandidateIdentityKeys = (candidate = {}) => {
  const keys = [];
  const sourceRaceId = candidate.sourceRaceId || candidate.source_race_id || candidate.registrationRaceId || candidate.registration_race_id;
  const sourcePlatform = candidate.sourcePlatform || candidate.source_platform || candidate.registrationPlatform || candidate.registration_platform;
  const sourceUrl = candidate.sourceUrl || candidate.source_url || candidate.registrationUrl || candidate.registration_url;
  const name = candidate.raceName || candidate.race_name;
  const date = candidate.eventDate || candidate.event_date;
  const state = candidate.raceState || candidate.race_state || candidate.state;

  if (sourcePlatform && sourceRaceId) keys.push(`${normalizeKey(sourcePlatform)}:${normalizeKey(sourceRaceId)}`);
  if (sourceUrl) keys.push(`url:${normalizeKey(sourceUrl).replace(/\/$/, '')}`);
  if (name && date && state) keys.push(`name-date-state:${normalizeKey(name)}:${normalizeKey(date)}:${normalizeKey(state)}`);
  return [...new Set(keys)];
};

export const buildExistingCandidateIndex = ({ prospects = [], jobs = [], outreach = [] } = {}) => {
  const entries = [];
  for (const prospect of prospects) {
    entries.push({ kind: 'prospect', record: prospect, keys: buildCandidateIdentityKeys(prospect) });
  }
  for (const job of jobs) {
    entries.push({ kind: 'job', record: job, keys: buildCandidateIdentityKeys(job) });
  }
  for (const item of outreach) {
    entries.push({ kind: 'outreach', record: item, keys: buildCandidateIdentityKeys(item) });
  }

  const byKey = new Map();
  for (const entry of entries) {
    for (const key of entry.keys) {
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(entry);
    }
  }
  return byKey;
};

const hasGeneratedOrOutreach = (matches = []) => matches.some(({ kind, record }) => {
  if (kind === 'outreach') return true;
  if (kind === 'job') return Boolean(record.outreach_id || ['outreach_sent', 'mockup_generated', 'ready_for_owner_review'].includes(record.job_status));
  return record.qualification_status === 'outreach_sent' || record.metadata?.customer_outreach_sent === true;
});

const hasHoldOrSkip = (candidate = {}, matches = []) => {
  const records = [candidate, ...matches.map((match) => match.record)];
  return records.some((record) => {
    const status = record.qualification_status || record.job_status || record.lifecycle_status;
    const metadata = record.metadata || {};
    return TERMINAL_STATUSES.has(status) || metadata.outreach_hold === true || metadata.future_follow_up_hold === true || metadata.no_outreach_sent === true;
  });
};

export const prioritizeMockupCandidate = (candidate = {}, context = {}) => {
  const index = context.existingIndex || buildExistingCandidateIndex(context);
  const keys = buildCandidateIdentityKeys(candidate);
  const matches = keys.flatMap((key) => index.get(key) || []);
  const templateFit = classifyTemplateFits(candidate, context);
  const duplicateState = matches.length ? (hasGeneratedOrOutreach(matches) ? 'already_generated_or_contacted' : 'existing_candidate') : 'new_candidate';
  const heldOrSkipped = hasHoldOrSkip(candidate, matches);

  let backlogBucket = 'hold_later';
  const reasons = [...templateFit.reasons];
  if (duplicateState === 'already_generated_or_contacted') {
    backlogBucket = 'exclude_existing';
    reasons.push('Existing mockup generation or outreach already exists.');
  } else if (heldOrSkipped) {
    backlogBucket = 'hold_later';
    reasons.push('Candidate is held, skipped, inactive, or marked no-outreach.');
  } else if (templateFit.templateReadinessStatus === 'ready_to_generate') {
    backlogBucket = 'generate_now';
  } else if (templateFit.contactQuality === 'form_only' || templateFit.contactQuality === 'none') {
    backlogBucket = 'research_contact_first';
    reasons.push('Verified direct/routing email is required before active generation priority.');
  } else if (templateFit.templateReadinessStatus === 'needs_source_review') {
    backlogBucket = 'research_source_first';
  }

  return {
    ...templateFit,
    backlogBucket,
    duplicateState,
    identityKeys: keys,
    matchedExistingCount: matches.length,
    raceName: candidate.raceName || candidate.race_name,
    eventDate: candidate.eventDate || candidate.event_date,
    raceCity: candidate.raceCity || candidate.race_city || candidate.city,
    raceState: candidate.raceState || candidate.race_state || candidate.state,
    sourceUrl: candidate.sourceUrl || candidate.source_url,
    officialUrl: candidate.officialUrl || candidate.official_url,
    reasons,
  };
};

export const prioritizeMockupBacklog = (candidates = [], context = {}) => {
  const existingIndex = context.existingIndex || buildExistingCandidateIndex(context);
  const prioritized = candidates.map((candidate) => prioritizeMockupCandidate(candidate, { ...context, existingIndex }));
  const byBucket = prioritized.reduce((acc, item) => {
    if (!acc[item.backlogBucket]) acc[item.backlogBucket] = [];
    acc[item.backlogBucket].push(item);
    return acc;
  }, {});
  for (const bucket of Object.values(byBucket)) {
    bucket.sort((a, b) => b.startlineValueScore - a.startlineValueScore || clean(a.eventDate).localeCompare(clean(b.eventDate)) || clean(a.raceName).localeCompare(clean(b.raceName)));
  }
  return {
    counts: Object.fromEntries(Object.entries(byBucket).map(([bucket, rows]) => [bucket, rows.length])),
    byBucket,
    ranked: [...prioritized].sort((a, b) => b.startlineValueScore - a.startlineValueScore || clean(a.raceName).localeCompare(clean(b.raceName))),
  };
};
