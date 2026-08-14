export const POLICY_VERSION = 'phase2a1b-source-cohort-validation-v1.0.0';
export const POLICY_SPEC_TITLE = 'StartLineSites CMO Phase 2A-1B Source Cohort Validation Gate';

export const FINAL_STATES = Object.freeze({
  APPROVE: 'APPROVE_FOR_ASSET_PREPARATION',
  NEEDS: 'NEEDS_STEVE_DECISION',
  EXCLUDE: 'EXCLUDE',
});

export const REQUIRED_CANDIDATE_NUMBERS = Object.freeze([5, 10, 13, 15, 17, 19, 22, 24, 30]);

export const WEBSITE_NEED = Object.freeze(['HIGH', 'MEDIUM', 'LOW']);
export const COMMERCIAL_CAPACITY = Object.freeze(['HIGH', 'MEDIUM', 'LOW']);
export const EVENT_DETAIL_RELIABILITY = Object.freeze(['CURRENT_AND_CONSISTENT', 'STALE_OR_CONFLICTING', 'UNVERIFIED']);
export const CONTACT_STATUSES = Object.freeze([
  'VERIFIED_RACE_DIRECT',
  'VERIFIED_ORGANIZER_ROUTING',
  'PLAUSIBLE_REQUIRES_STEVE_CONFIRMATION',
  'INVALID_OR_WRONG_ORGANIZATION',
  'NO_CONTACT',
]);
export const HISTORY_CLASSIFICATIONS = Object.freeze(['REAL_EXTERNAL', 'INTERNAL_TEST_ONLY', 'FALSE_POSITIVE', 'AMBIGUOUS']);

export const SEQUENTIAL_WATERFALL_STAGES = Object.freeze([
  ['individual_race_not_operator', (c) => c.individualRaceNotOperator === true],
  ['race_level_runsignup_page', (c) => c.raceLevelRunSignupPage === true],
  ['future_date', (c) => c.futureDate === true],
  ['at_least_90_days_lead_time', (c) => Number(c.leadTimeDays) >= 90],
  ['no_prior_real_startlinesites_contact_history', (c) => !hasRealOrAmbiguousHistory(c)],
  ['identity_and_organizer_verified', (c) => c.identityAndOrganizerVerified === true],
  ['website_need_high_or_medium', (c) => ['HIGH', 'MEDIUM'].includes(c.websiteNeedSeverity)],
  ['commercial_capacity_medium_or_high', (c) => ['HIGH', 'MEDIUM'].includes(c.commercialCapacity)],
  ['current_event_details_reliable', (c) => c.eventDetailReliability === 'CURRENT_AND_CONSISTENT'],
  ['one_verified_direct_or_routing_email', (c) => ['VERIFIED_RACE_DIRECT', 'VERIFIED_ORGANIZER_ROUTING'].includes(c.contactStatus)],
  ['no_suppression_duplicate_ambiguity', (c) => c.suppressionClear === true && c.duplicateResult !== 'BLOCKED_OR_AMBIGUOUS'],
]);

const asArray = (value) => Array.isArray(value) ? value : [];

export const stableStringify = (value) => JSON.stringify(sortForStableJson(value), null, 2);

const sortForStableJson = (value) => {
  if (Array.isArray(value)) return value.map(sortForStableJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortForStableJson(value[key])]));
  }
  return value;
};

const enumErrors = (candidate, field, allowed) => allowed.includes(candidate[field]) ? [] : [`${field} must be one of ${allowed.join(', ')}`];

export const validateCandidate = (candidate = {}) => {
  const errors = [];
  if (!Number.isInteger(candidate.candidateNumber)) errors.push('candidateNumber must be an integer');
  if (!candidate.raceName) errors.push('raceName is required');
  if (!candidate.runSignupUrl) errors.push('runSignupUrl is required');
  if (!Number.isFinite(Number(candidate.leadTimeDays))) errors.push('leadTimeDays must be numeric');
  errors.push(...enumErrors(candidate, 'websiteNeedSeverity', WEBSITE_NEED));
  errors.push(...enumErrors(candidate, 'commercialCapacity', COMMERCIAL_CAPACITY));
  errors.push(...enumErrors(candidate, 'eventDetailReliability', EVENT_DETAIL_RELIABILITY));
  errors.push(...enumErrors(candidate, 'contactStatus', CONTACT_STATUSES));
  for (const [index, match] of asArray(candidate.historyMatches).entries()) {
    if (!HISTORY_CLASSIFICATIONS.includes(match.classification)) errors.push(`historyMatches[${index}].classification must be one of ${HISTORY_CLASSIFICATIONS.join(', ')}`);
    if (!match.source || !match.recordId || !match.stableKey) errors.push(`historyMatches[${index}] requires source, recordId, and stableKey`);
  }
  return errors;
};

export const validateInput = (input = {}) => {
  const errors = [];
  if (input.policyVersion && input.policyVersion !== POLICY_VERSION) errors.push(`input policyVersion ${input.policyVersion} does not match runner ${POLICY_VERSION}`);
  if (!Array.isArray(input.candidates)) errors.push('candidates array is required');
  const candidates = asArray(input.candidates);
  const nine = REQUIRED_CANDIDATE_NUMBERS.join(',');
  const actualNine = candidates.map((c) => c.candidateNumber).filter((n) => REQUIRED_CANDIDATE_NUMBERS.includes(n)).sort((a, b) => a - b).join(',');
  if (actualNine !== nine) errors.push(`input must include the bounded nine candidate numbers exactly once: ${nine}`);
  const duplicates = candidates.map((c) => c.candidateNumber).filter((n, i, arr) => arr.indexOf(n) !== i);
  if (duplicates.length) errors.push(`duplicate candidateNumber values: ${[...new Set(duplicates)].join(', ')}`);
  for (const candidate of candidates) {
    for (const error of validateCandidate(candidate)) errors.push(`Candidate ${candidate.candidateNumber ?? 'unknown'}: ${error}`);
  }
  return errors;
};

export const leadTimeDecision = (leadTimeDays) => {
  const days = Number(leadTimeDays);
  if (days >= 120) return { timingState: 'PASSES_120_PLUS', hardBlocker: null, ownerDecision: null };
  if (days >= 90) return { timingState: 'LIMITED_RUNWAY_90_TO_119', hardBlocker: null, ownerDecision: 'LIMITED_RUNWAY' };
  return { timingState: 'EXCLUDE_UNDER_90', hardBlocker: 'UNDER_90_DAY_RUNWAY', ownerDecision: null };
};

export const hasRealOrAmbiguousHistory = (candidate = {}) => asArray(candidate.historyMatches).some((match) => ['REAL_EXTERNAL', 'AMBIGUOUS'].includes(match.classification));

export const fixedRubricFindings = (candidate = {}) => {
  const blockers = [];
  const ownerDecisions = [];
  const notes = [];
  const timing = leadTimeDecision(candidate.leadTimeDays);
  if (timing.hardBlocker) blockers.push(timing.hardBlocker);
  if (timing.ownerDecision) ownerDecisions.push(timing.ownerDecision);
  if (candidate.individualRaceNotOperator !== true) blockers.push('NOT_INDIVIDUAL_RACE_OR_OPERATOR_FIT');
  if (candidate.raceLevelRunSignupPage !== true) blockers.push('NOT_RACE_LEVEL_RUNSIGNUP_PAGE');
  if (candidate.futureDate !== true) blockers.push('NOT_FUTURE_DATE');
  if (candidate.identityAndOrganizerVerified !== true) blockers.push('IDENTITY_OR_ORGANIZER_UNVERIFIED');
  if (candidate.websiteNeedSeverity === 'LOW') blockers.push('LOW_WEBSITE_NEED');
  if (candidate.websiteNeedSeverity === 'MEDIUM' && candidate.strongMediumNeed !== true) ownerDecisions.push('BORDERLINE_MEDIUM_WEBSITE_NEED');
  if (!['HIGH', 'MEDIUM'].includes(candidate.commercialCapacity)) blockers.push('WEAK_COMMERCIAL_CAPACITY');
  if (candidate.eventDetailReliability !== 'CURRENT_AND_CONSISTENT') blockers.push(`EVENT_DETAILS_${candidate.eventDetailReliability || 'UNVERIFIED'}`);
  if (candidate.contactStatus === 'PLAUSIBLE_REQUIRES_STEVE_CONFIRMATION') ownerDecisions.push('PLAUSIBLE_CONTACT_REQUIRES_STEVE_CONFIRMATION');
  if (['INVALID_OR_WRONG_ORGANIZATION', 'NO_CONTACT'].includes(candidate.contactStatus)) blockers.push(candidate.contactStatus);
  if (candidate.suppressionClear !== true) blockers.push('SUPPRESSION_NOT_CLEAR');
  if (candidate.duplicateResult === 'BLOCKED_OR_AMBIGUOUS') blockers.push('DUPLICATE_BLOCKED_OR_AMBIGUOUS');
  for (const match of asArray(candidate.historyMatches)) {
    if (match.classification === 'REAL_EXTERNAL') blockers.push(`REAL_EXTERNAL_HISTORY:${match.source}:${match.recordId}`);
    if (match.classification === 'AMBIGUOUS') ownerDecisions.push(`AMBIGUOUS_HISTORY:${match.source}:${match.recordId}`);
  }
  if (candidate.laneAFit !== true) blockers.push('NOT_LANE_A_FIT');
  if (candidate.obviousIncrementalValue !== true) blockers.push('NO_OBVIOUS_INCREMENTAL_COMMUNITY_VALUE');
  if (!candidate.officialSourceUrls || !asArray(candidate.officialSourceUrls).length) blockers.push('NO_OFFICIAL_SOURCE_URLS_RECORDED');
  if (candidate.websiteNeedSeverity === 'HIGH') notes.push('website need rubric permits consideration when all safety gates pass');
  return { blockers: [...new Set(blockers)].sort(), ownerDecisions: [...new Set(ownerDecisions)].sort(), notes, timingState: timing.timingState };
};

export const classifyCandidate = (candidate = {}) => {
  const schemaErrors = validateCandidate(candidate);
  const findings = fixedRubricFindings(candidate);
  if (schemaErrors.length) {
    return { finalState: FINAL_STATES.EXCLUDE, reason: 'SCHEMA_INVALID_FAIL_CLOSED', schemaErrors, ...findings, blockers: [...findings.blockers, ...schemaErrors].sort() };
  }
  if (findings.blockers.length) return { finalState: FINAL_STATES.EXCLUDE, reason: 'HARD_BLOCKER_FAIL_CLOSED', schemaErrors, ...findings };
  if (findings.ownerDecisions.length) return { finalState: FINAL_STATES.NEEDS, reason: 'NARROW_OWNER_DECISION_REQUIRED', schemaErrors, ...findings };
  return { finalState: FINAL_STATES.APPROVE, reason: 'ALL_APPROVAL_GATES_PASS', schemaErrors, ...findings };
};

export const classifySupply = ({ totalReviewed = 30, approveCount = 0, needsCount = 0 } = {}) => {
  const reviewCount = Number(totalReviewed) || 0;
  const viable = Number(approveCount) + Number(needsCount);
  if (reviewCount < 30) return 'INCONCLUSIVE';
  if (viable >= 6) return 'STRONG';
  if (viable >= 3) return 'MODERATE';
  if (viable >= 1) return 'WEAK';
  return 'INCONCLUSIVE';
};

export const independentFilterCounts = (allReviewed = []) => {
  const filters = [
    ['total_deeply_reviewed', () => true],
    ...SEQUENTIAL_WATERFALL_STAGES,
    ['approve_for_asset_preparation', (c) => classifyCandidate(c).finalState === FINAL_STATES.APPROVE],
    ['needs_steve_decision', (c) => classifyCandidate(c).finalState === FINAL_STATES.NEEDS],
    ['exclude', (c) => classifyCandidate(c).finalState === FINAL_STATES.EXCLUDE],
  ];
  return filters.map(([stage, predicate]) => ({ stage, passCount: allReviewed.filter(predicate).length, denominator: allReviewed.length }));
};

export const sequentialWaterfall = (allReviewed = []) => {
  let remaining = allReviewed.slice();
  const rows = [{ stage: 'deeply_reviewed_candidates', before: allReviewed.length, excluded: 0, remaining: allReviewed.length }];
  for (const [stage, predicate] of SEQUENTIAL_WATERFALL_STAGES) {
    const before = remaining.length;
    const passed = remaining.filter(predicate);
    rows.push({ stage, before, excluded: before - passed.length, remaining: passed.length });
    remaining = passed;
  }
  for (const state of [FINAL_STATES.APPROVE, FINAL_STATES.NEEDS, FINAL_STATES.EXCLUDE]) {
    const count = allReviewed.filter((candidate) => classifyCandidate(candidate).finalState === state).length;
    rows.push({ stage: state, before: allReviewed.length, excluded: allReviewed.length - count, remaining: count });
  }
  return rows;
};

export const buildDecisionLedger = (candidates = []) => candidates
  .map((candidate) => ({
    candidateNumber: candidate.candidateNumber,
    raceName: candidate.raceName,
    runSignupUrl: candidate.runSignupUrl,
    final: classifyCandidate(candidate),
    sourceUrls: asArray(candidate.officialSourceUrls).slice().sort(),
    evidenceHashes: asArray(candidate.evidenceHashes).slice().sort(),
  }))
  .sort((a, b) => a.candidateNumber - b.candidateNumber);

export const buildRunManifest = ({ input = {}, inputHash = '', outputFiles = [], startedAt = '', finishedAt = '', command = '' } = {}) => {
  const candidates = asArray(input.candidates);
  const ledger = buildDecisionLedger(candidates.filter((c) => REQUIRED_CANDIDATE_NUMBERS.includes(c.candidateNumber)));
  const counts = {
    [FINAL_STATES.APPROVE]: ledger.filter((row) => row.final.finalState === FINAL_STATES.APPROVE).length,
    [FINAL_STATES.NEEDS]: ledger.filter((row) => row.final.finalState === FINAL_STATES.NEEDS).length,
    [FINAL_STATES.EXCLUDE]: ledger.filter((row) => row.final.finalState === FINAL_STATES.EXCLUDE).length,
  };
  return {
    policyVersion: POLICY_VERSION,
    policySpecTitle: POLICY_SPEC_TITLE,
    startedAt,
    finishedAt,
    command,
    deterministicInputs: {
      inputHash,
      expectedBoundedCandidateNumbers: REQUIRED_CANDIDATE_NUMBERS,
      allReviewedCount: candidates.length,
      boundedCandidateCount: ledger.length,
    },
    finalDecisions: counts,
    sampledLaneASupply: classifySupply({ totalReviewed: candidates.length, approveCount: counts[FINAL_STATES.APPROVE], needsCount: counts[FINAL_STATES.NEEDS] }),
    sourceCohortValidation: counts[FINAL_STATES.APPROVE] > 0 ? 'GO' : 'NO-GO',
    noSideEffectCertification: {
      productionWrites: false,
      prospectWrites: false,
      emailsToProspects: false,
      contactFormSubmissions: false,
      mockupsCreated: false,
      cronJobsCreatedOrActivated: false,
      recurringSourcingCronCreated: false,
      networkMode: input.networkMode || 'external evidence supplied by operator; runner performs local deterministic replay',
    },
    outputFiles: outputFiles.slice().sort(),
  };
};

export const renderMarkdownTable = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map((row) => `| ${headers.map((header) => String(row[header] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`),
].join('\n');

export const redactEmail = (email = '') => {
  const text = String(email || '');
  const [local, domain] = text.split('@');
  if (!local || !domain) return text ? '[masked-email]' : '';
  return `${local.slice(0, 2)}***@${domain.replace(/^(.{2}).*?(@?[^@]*)$/, '$1***')}`;
};
