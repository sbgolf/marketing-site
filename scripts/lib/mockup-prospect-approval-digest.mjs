const clean = (value, max = 500) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const asArray = (value) => Array.isArray(value) ? value : [];

const summarizeReasons = (reason = '', maxReasons = 2) => clean(reason, 2000)
  .split(/\.\s+/)
  .map((item) => clean(item.replace(/\.$/, ''), 160))
  .filter(Boolean)
  .filter((item) => !/^No prior outreach flagged/i.test(item))
  .slice(0, maxReasons);

const summarizeRisks = (candidate = {}) => {
  const disqualifiers = asArray(candidate.disqualifiers).map((item) => clean(item, 160)).filter(Boolean);
  if (disqualifiers.length) return disqualifiers.slice(0, 2);
  if (candidate.qualification_status === 'needs_review') return ['Needs owner review before mockup generation.'];
  if (candidate.qualification_status === 'qualified_for_mockup') return ['No scoring disqualifiers flagged; verify source facts before generation.'];
  return ['Below current mockup threshold; keep for later or skip.'];
};

const formatDistanceList = (distances = []) => {
  const list = asArray(distances).map((item) => clean(item, 40)).filter(Boolean).slice(0, 4);
  return list.length ? list.join(', ') : 'not found';
};

const formatCandidate = (candidate = {}, index = 0) => {
  const name = clean(candidate.race_name || candidate.raceName || 'Unnamed race', 120);
  const location = [candidate.race_city || candidate.raceCity, candidate.race_state || candidate.raceState]
    .map((item) => clean(item, 80))
    .filter(Boolean)
    .join(', ') || 'location not found';
  const date = clean(candidate.event_date || candidate.eventDate || 'date not found', 40);
  const status = clean(candidate.qualification_status || candidate.qualificationStatus || 'unscored', 80);
  const score = Number.isFinite(Number(candidate.total_score ?? candidate.totalScore)) ? Number(candidate.total_score ?? candidate.totalScore) : null;
  const sourceUrl = clean(candidate.source_url || candidate.sourceUrl || '', 500);
  const officialUrl = clean(candidate.official_url || candidate.officialUrl || '', 500);
  const reasons = summarizeReasons(candidate.qualification_reason || candidate.qualificationReason);
  const risks = summarizeRisks(candidate);
  const lookupFilters = asArray(candidate.lookup_filters || candidate.lookupFilters).slice(0, 2);

  const lines = [
    `${index + 1}. ${name}`,
    `   Date/location: ${date} — ${location}`,
    `   Score/status: ${score === null ? 'n/a' : score}/100 — ${status}`,
    `   Distances: ${formatDistanceList(candidate.distances)}`,
  ];

  if (sourceUrl) lines.push(`   Source: ${sourceUrl}`);
  if (officialUrl) lines.push(`   Official site: ${officialUrl}`);
  if (reasons.length) lines.push(`   Why it fits: ${reasons.join('; ')}.`);
  if (risks.length) lines.push(`   Risks/checks: ${risks.join('; ')}`);
  if (lookupFilters.length) lines.push(`   Duplicate checks: ${lookupFilters.join(' | ')}`);
  lines.push('   Decision options: generate mockup / skip / needs edits / collect more info');
  return lines.join('\n');
};

export const extractDigestCandidates = (input = {}) => {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.candidates)) return input.candidates;
  if (Array.isArray(input.prospects)) return input.prospects;
  return [];
};

export const buildMockupProspectApprovalDigest = (input = {}, options = {}) => {
  const candidates = extractDigestCandidates(input)
    .slice(0, Number.isFinite(Number(options.limit)) ? Number(options.limit) : 5);
  const generatedAt = options.generatedAt || input.generated_at || input.generatedAt || new Date().toISOString();
  const source = clean(input.source || options.source || 'mockup prospect discovery', 120);
  const query = input.query || options.query || {};
  const querySummary = [query.city, query.state, query.startDate || query.start_date, query.endDate || query.end_date]
    .map((item) => clean(item, 80))
    .filter(Boolean)
    .join(' / ');

  const lines = [
    'StartLine mockup prospect approval digest',
    `Generated: ${generatedAt}`,
    `Source: ${source}${querySummary ? ` (${querySummary})` : ''}`,
    '',
    'Owner gate: review only. Do not generate a mockup or send outreach until Steve approves a specific candidate.',
    '',
  ];

  if (!candidates.length) {
    lines.push('No candidates found for this digest.');
  } else {
    lines.push(`Candidates for review: ${candidates.length}`);
    lines.push('');
    candidates.forEach((candidate, index) => {
      lines.push(formatCandidate(candidate, index));
      if (index < candidates.length - 1) lines.push('');
    });
  }

  lines.push('');
  lines.push('Reply format: "Generate mockup for #N", "Skip #N", "Needs edits #N: ...", or "Collect more info for #N".');

  return lines.join('\n');
};

export const validateDigestText = (digest = '') => {
  const text = String(digest);
  const rejected = [/no-index/i, /Bailey/i].filter((pattern) => pattern.test(text));
  return {
    ok: rejected.length === 0,
    rejected_terms: rejected.map((pattern) => pattern.source),
  };
};
