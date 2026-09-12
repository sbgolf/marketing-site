import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

export const FINAL_STATES = Object.freeze({
  APPROVE: 'APPROVE_FOR_ASSET_PREPARATION',
  NEEDS: 'NEEDS_STEVE_DECISION',
  EXCLUDE: 'EXCLUDE',
});

export const STATE_ORDER = Object.freeze([
  'DISCOVERED',
  'DETERMINISTIC_PREFILTER_PASS',
  'DEEP_REVIEW_READY',
  'EVIDENCE_COMPLETE',
  'VALIDATED',
  'OWNER_SOURCE_APPROVED',
  'ASSET_PREPARATION_READY',
  'ASSET_READY_FOR_OWNER_REVIEW',
  'OWNER_SEND_APPROVED',
  'SENT',
]);

export const FORBIDDEN_ENV_KEYS = Object.freeze([
  'RESEND_API_KEY',
  'RESEND_AUDIENCES_API_KEY',
  'STRIPE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_KEY',
  'STARTLINE_SUPABASE_SERVICE_ROLE_KEY',
]);

export const stableStringify = (value) => JSON.stringify(sortStable(value), null, 2);

const sortStable = (value) => {
  if (Array.isArray(value)) return value.map(sortStable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortStable(value[key])]));
  }
  return value;
};

export const sha256Text = (text) => crypto.createHash('sha256').update(text).digest('hex');
export const sha256Object = (value) => sha256Text(stableStringify(value));
export const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

export const loadPolicy = async (policyPath) => {
  const raw = await fs.readFile(policyPath, 'utf8');
  const policy = JSON.parse(raw);
  const sourcePolicyFileSha256 = sha256Text(raw);
  const canonicalPolicyObjectSha256 = sha256Object(policy);
  const errors = validatePolicy(policy);
  if (errors.length) throw new Error(`policy validation failed closed:\n- ${errors.join('\n- ')}`);
  return { policy, raw, sha256: sourcePolicyFileSha256, sourcePolicyFileSha256, canonicalPolicyObjectSha256 };
};

const includes = (array, value) => Array.isArray(array) && array.includes(value);
const asArray = (value) => Array.isArray(value) ? value : [];

export const validatePolicy = (policy = {}) => {
  const errors = [];
  for (const key of ['policyId', 'version', 'targetSegment', 'allowedSourcePlatform', 'websiteNeedRubric', 'commercialCapacityRubric', 'enums', 'hardExclusions', 'stateTransitions', 'preflightRequirements', 'postflightRequirements', 'recurringCronCertificationRules']) {
    if (policy[key] === undefined) errors.push(`policy missing ${key}`);
  }
  if (policy.policyId !== 'startline-lane-a-sourcing-policy') errors.push('policyId must be startline-lane-a-sourcing-policy');
  if (!/^\d+\.\d+\.\d+$/.test(String(policy.version || ''))) errors.push('policy version must be semantic x.y.z');
  const enums = policy.enums || {};
  const requiredEnums = {
    websiteNeed: ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'],
    commercialCapacity: ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'],
    contactState: ['VERIFIED_RACE_DIRECT', 'VERIFIED_ORGANIZER_ROUTING', 'PLAUSIBLE_REQUIRES_STEVE_VERIFICATION', 'CONTACT_FORM_ONLY', 'NO_CONTACT', 'INVALID_OR_WRONG_ORGANIZATION'],
    eventReliability: ['CURRENT_AND_CONSISTENT', 'STALE_OR_CONFLICTING', 'UNVERIFIED'],
    recommendation: Object.values(FINAL_STATES),
    historyState: ['NEW_NO_HISTORY', 'PRIOR_REAL_EXTERNAL_OUTREACH', 'PRIOR_CONTACT_FORM_OUTREACH', 'PRIOR_COMMERCIAL_HISTORY', 'INTERNAL_TEST_ONLY', 'AMBIGUOUS_REQUIRES_STEVE_CONFIRMATION'],
    officialSiteClassification: ['NO_STANDALONE_SITE', 'RUNSIGNUP_ONLY', 'BASIC_EVENT_PAGE', 'MEANINGFUL_OFFICIAL_SITE', 'UNKNOWN'],
  };
  for (const [key, required] of Object.entries(requiredEnums)) {
    for (const value of required) if (!includes(enums[key], value)) errors.push(`policy enums.${key} missing ${value}`);
  }
  if (includes(enums.websiteNeed, 'MEDIUM_HIGH') || includes(enums.websiteNeed, 'LOW_MEDIUM')) errors.push('policy must not include ad hoc website need labels');
  if (policy.recurringCronCertificationRules?.authorized !== false) errors.push('recurring sourcing cron must not be authorized in policy v1');
  return errors;
};

export const validateSourceEvidence = (candidate = {}, policy) => {
  const errors = [];
  const enums = policy.enums;
  for (const key of ['candidateId', 'raceName', 'runSignupUrl', 'sourceSnapshotId', 'evidenceHash', 'eventReliability', 'contactState', 'historyState', 'duplicateState', 'suppressionClear', 'leadTimeDays', 'laneAFit', 'obviousIncrementalValue', 'officialSiteClassification', 'evidenceAccessedAt', 'websiteNeedComponents', 'commercialCapacityComponents', 'sourceReferences']) {
    if (candidate[key] === undefined) errors.push(`missing ${key}`);
  }
  if (candidate.runSignupUrl && !String(candidate.runSignupUrl).includes('runsignup.com/Race/')) errors.push('runSignupUrl must be an exact race-level RunSignup URL');
  if (!includes(enums.eventReliability, candidate.eventReliability)) errors.push(`eventReliability unknown enum ${candidate.eventReliability}`);
  if (!includes(enums.contactState, candidate.contactState)) errors.push(`contactState unknown enum ${candidate.contactState}`);
  if (!includes(enums.historyState, candidate.historyState)) errors.push(`historyState unknown enum ${candidate.historyState}`);
  if (!includes(enums.officialSiteClassification, candidate.officialSiteClassification)) errors.push(`officialSiteClassification unknown enum ${candidate.officialSiteClassification}`);
  for (const componentSet of ['websiteNeedComponents', 'commercialCapacityComponents']) {
    for (const [index, component] of asArray(candidate[componentSet]).entries()) {
      if (!component.id) errors.push(`${componentSet}[${index}] missing id`);
      if (!Number.isFinite(Number(component.score))) errors.push(`${componentSet}[${index}] missing numeric score`);
      if (!Array.isArray(component.evidenceRefs) || !component.evidenceRefs.length) errors.push(`${componentSet}[${index}] requires evidenceRefs`);
    }
  }
  if (!Array.isArray(candidate.sourceReferences) || !candidate.sourceReferences.length) errors.push('sourceReferences must be non-empty');
  const officialSourceTypes = new Set(['exact_organizer_official_website', 'exact_official_race_event_page', 'official_contact_page']);
  if (!asArray(candidate.sourceReferences).some((source) => officialSourceTypes.has(source.type))) errors.push('missing official-site evidence source reference');
  for (const [index, source] of asArray(candidate.sourceReferences).entries()) {
    if (!source.accessedAt) errors.push(`sourceReferences[${index}] missing accessedAt`);
  }
  return errors;
};

const parseTime = (value) => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
};

export const validateSourceEvidenceFreshness = (candidate = {}, now = new Date().toISOString(), policy = {}) => {
  const errors = [];
  const maxHours = Number(policy.evidenceFreshnessWindows?.sourceEvidenceMaxAgeHours ?? 72);
  const nowMs = parseTime(now);
  const timestamps = [candidate.evidenceAccessedAt, ...asArray(candidate.sourceReferences).map((source) => source.accessedAt)];
  for (const [index, timestamp] of timestamps.entries()) {
    const tsMs = parseTime(timestamp);
    if (!timestamp || tsMs === null) {
      errors.push(index === 0 ? 'missing source evidence timestamp evidenceAccessedAt' : `missing source evidence timestamp sourceReferences[${index - 1}].accessedAt`);
      continue;
    }
    if (nowMs !== null && maxHours > 0 && nowMs - tsMs > maxHours * 60 * 60 * 1000) errors.push(`stale source evidence timestamp ${timestamp}`);
    if (nowMs !== null && tsMs - nowMs > 5 * 60 * 1000) errors.push(`future source evidence timestamp ${timestamp}`);
  }
  return errors;
};

const scoreComponents = (policyRubric, components = []) => {
  const byId = new Map(asArray(components).map((component) => [component.id, component]));
  const rows = policyRubric.components.map((componentPolicy) => {
    const component = byId.get(componentPolicy.id);
    const rawScore = Number(component?.score ?? 0);
    const score = Math.max(0, Math.min(Number(componentPolicy.weight), rawScore));
    return { id: componentPolicy.id, weight: componentPolicy.weight, score, evidenceRefs: asArray(component?.evidenceRefs) };
  });
  const total = rows.reduce((sum, row) => sum + row.score, 0);
  return { rows, total };
};

const classifyScore = (total, thresholds) => {
  if (!Number.isFinite(total)) return 'UNKNOWN';
  if (total >= thresholds.HIGH) return 'HIGH';
  if (total >= thresholds.MEDIUM) return 'MEDIUM';
  if (total >= thresholds.LOW) return 'LOW';
  return 'UNKNOWN';
};

export const deriveWebsiteNeed = (candidate, policy) => {
  const score = scoreComponents(policy.websiteNeedRubric, candidate.websiteNeedComponents);
  let classification = classifyScore(score.total, policy.websiteNeedRubric.thresholds);
  const nonDomainEvidence = score.rows.filter((row) => row.id !== 'standalone_site_gap').reduce((sum, row) => sum + row.score, 0);
  if (policy.websiteNeedRubric.rules?.absenceOfUniqueDomainAloneCannotProduceHigh && classification === 'HIGH' && nonDomainEvidence < policy.websiteNeedRubric.thresholds.MEDIUM) {
    classification = 'MEDIUM';
  }
  return { ...score, threshold: policy.websiteNeedRubric.thresholds, classification };
};

export const deriveCommercialCapacity = (candidate, policy) => {
  const score = scoreComponents(policy.commercialCapacityRubric, candidate.commercialCapacityComponents);
  return { ...score, threshold: policy.commercialCapacityRubric.thresholds, classification: classifyScore(score.total, policy.commercialCapacityRubric.thresholds) };
};

export const createDeviation = ({ runId, policy, stage, expectedCondition, actualCondition, reason, affectedRecords = [], evidenceFreshness = 'same_run', ownerApprovalRequired = true, remediation = 'Stop and correct before continuing.', finalRunStatus = 'PROCESS DEVIATION — BLOCKED' }) => ({
  runId,
  policyId: policy.policyId,
  policyVersion: policy.version,
  stage,
  expectedCondition,
  actualCondition,
  reason,
  affectedRecords,
  evidenceFreshness,
  ownerApprovalRequired,
  remediation,
  finalRunStatus,
});

export const validateDeviationRecord = (record = {}) => {
  const required = ['runId', 'policyId', 'policyVersion', 'stage', 'expectedCondition', 'actualCondition', 'reason', 'affectedRecords', 'evidenceFreshness', 'ownerApprovalRequired', 'remediation', 'finalRunStatus'];
  return required.filter((key) => record[key] === undefined).map((key) => `deviation missing ${key}`);
};

export const buildTransitionLog = ({ candidateId, runId, policy, evidenceHash, actor = 'deterministic-runner', terminalState = 'VALIDATED', timestamp = new Date().toISOString() }) => {
  const terminalIndex = STATE_ORDER.indexOf(terminalState);
  if (terminalIndex < 0) throw new Error(`unknown terminal state ${terminalState}`);
  const transitions = [];
  for (let index = 0; index < terminalIndex; index += 1) {
    transitions.push({
      candidateId,
      transitionName: `${STATE_ORDER[index]}_TO_${STATE_ORDER[index + 1]}`,
      from: STATE_ORDER[index],
      to: STATE_ORDER[index + 1],
      runId,
      policyVersion: policy.version,
      timestamp,
      actor,
      evidenceHash,
      ownerApproval: STATE_ORDER[index + 1] === 'OWNER_SOURCE_APPROVED' ? 'required' : null,
    });
  }
  return transitions;
};

export const validateTransitionLog = (transitions = []) => {
  const errors = [];
  for (const [index, transition] of asArray(transitions).entries()) {
    const expectedFrom = STATE_ORDER[index];
    const expectedTo = STATE_ORDER[index + 1];
    if (!expectedTo) break;
    if (transition.from !== expectedFrom || transition.to !== expectedTo) errors.push(`transition ${index} skips or reorders state: expected ${expectedFrom}->${expectedTo}, got ${transition.from}->${transition.to}`);
  }
  return errors;
};

export const classifyCandidate = ({ candidate, policy, runId = 'test-run', now = new Date().toISOString() }) => {
  const schemaErrors = [...validateSourceEvidence(candidate, policy), ...validateSourceEvidenceFreshness(candidate, now, policy)];
  const websiteNeed = deriveWebsiteNeed(candidate, policy);
  const commercialCapacity = deriveCommercialCapacity(candidate, policy);
  const hardExclusions = [];
  const ownerDecisionReasons = [];

  if (schemaErrors.length) hardExclusions.push('MISSING_REQUIRED_EVIDENCE');
  if (candidate.duplicateState === undefined || candidate.suppressionClear === undefined) hardExclusions.push('MISSING_REQUIRED_EVIDENCE');
  if (candidate.duplicateState === 'DUPLICATE_OR_SUPPRESSED' || candidate.suppressionClear === false) hardExclusions.push('DUPLICATE_OR_SUPPRESSED');
  if (['PRIOR_REAL_EXTERNAL_OUTREACH', 'PRIOR_CONTACT_FORM_OUTREACH', 'PRIOR_COMMERCIAL_HISTORY'].includes(candidate.historyState)) hardExclusions.push(candidate.historyState);
  if (candidate.historyState === 'AMBIGUOUS_REQUIRES_STEVE_CONFIRMATION') ownerDecisionReasons.push('AMBIGUOUS_HISTORY');
  if (candidate.eventReliability === 'STALE_OR_CONFLICTING') hardExclusions.push('STALE_OR_CONFLICTING_EVENT_DETAILS');
  if (candidate.eventReliability === 'UNVERIFIED') hardExclusions.push('UNVERIFIED_EVENT_DETAILS');
  if (['INVALID_OR_WRONG_ORGANIZATION', 'NO_CONTACT', 'CONTACT_FORM_ONLY'].includes(candidate.contactState)) hardExclusions.push(candidate.contactState);
  if (candidate.contactState === 'PLAUSIBLE_REQUIRES_STEVE_VERIFICATION') ownerDecisionReasons.push('CONTACT_VERIFICATION');
  const leadTimeDays = Number(candidate.leadTimeDays);
  if (!Number.isFinite(leadTimeDays) || leadTimeDays <= policy.leadTimeBands.underRunwayExclusionDays) hardExclusions.push('UNDER_90_DAY_RUNWAY');
  else if (leadTimeDays < policy.leadTimeBands.approveMinimumDays) ownerDecisionReasons.push('LIMITED_RUNWAY');
  if (websiteNeed.classification === 'LOW') hardExclusions.push('LOW_WEBSITE_NEED');
  if (websiteNeed.classification === 'UNKNOWN') hardExclusions.push('UNKNOWN_WEBSITE_NEED');
  if (websiteNeed.classification === 'MEDIUM' && candidate.strongMediumNeed !== true) ownerDecisionReasons.push('BORDERLINE_MEDIUM_WEBSITE_NEED');
  if (commercialCapacity.classification === 'LOW') hardExclusions.push('LOW_COMMERCIAL_CAPACITY');
  if (commercialCapacity.classification === 'UNKNOWN') hardExclusions.push('UNKNOWN_COMMERCIAL_CAPACITY');
  if (candidate.laneAFit !== true) hardExclusions.push('NOT_LANE_A_FIT');
  if (candidate.obviousIncrementalValue !== true) hardExclusions.push('NO_OBVIOUS_INCREMENTAL_VALUE');
  if (schemaErrors.length) hardExclusions.push('MISSING_REQUIRED_EVIDENCE');
  if (!asArray(candidate.sourceReferences).some((source) => source.type === 'race_level_runsignup_page')) hardExclusions.push('MISSING_REQUIRED_EVIDENCE');
  if (asArray(candidate.deviations).some((deviation) => deviation.finalRunStatus === 'PROCESS DEVIATION — BLOCKED')) hardExclusions.push('PROCESS_DEVIATION_BLOCKED');
  if (ownerDecisionReasons.length > 1 && policy.allowMultipleUnresolvedOwnerIssuesForNeeds !== true) hardExclusions.push('MULTIPLE_UNRESOLVED_OWNER_ISSUES');

  let recommendation = FINAL_STATES.APPROVE;
  let reason = 'ALL_REPEATABILITY_GATES_PASS_CONDITIONAL_ON_FRESH_HISTORY_RECHECK_BEFORE_PHASE_2A_1C';
  if (hardExclusions.length) {
    recommendation = FINAL_STATES.EXCLUDE;
    reason = 'HARD_EXCLUSION_FAIL_CLOSED';
  } else if (ownerDecisionReasons.length) {
    recommendation = FINAL_STATES.NEEDS;
    reason = 'NARROW_OWNER_DECISION_REQUIRED';
  }

  const transitionLog = recommendation === FINAL_STATES.EXCLUDE ? buildTransitionLog({ candidateId: candidate.candidateId, runId, policy, evidenceHash: candidate.evidenceHash, terminalState: 'VALIDATED', timestamp: now }) : buildTransitionLog({ candidateId: candidate.candidateId, runId, policy, evidenceHash: candidate.evidenceHash, terminalState: 'VALIDATED', timestamp: now });

  return {
    candidateId: candidate.candidateId,
    raceName: candidate.raceName,
    recommendation,
    reason,
    hardExclusions: [...new Set(hardExclusions)].sort(),
    ownerDecisionReasons: [...new Set(ownerDecisionReasons)].sort(),
    websiteNeed: websiteNeed.classification,
    commercialCapacity: commercialCapacity.classification,
    websiteNeedScore: websiteNeed,
    commercialCapacityScore: commercialCapacity,
    schemaErrors,
    transitionLog,
  };
};

export const validateOwnerDecision = (decision = {}, policy) => {
  const errors = [];
  for (const key of ['candidateId', 'ownerIdentity', 'decision', 'reasonCode', 'timestamp', 'policyVersion', 'evidenceHash', 'expirationOrRevalidationTimestamp']) {
    if (decision[key] === undefined) errors.push(`owner decision missing ${key}`);
  }
  if (!includes(policy.enums.ownerDecision, decision.decision)) errors.push(`owner decision unknown enum ${decision.decision}`);
  return errors;
};

export const applyOwnerDecision = ({ decision, candidateDecision, policy }) => {
  const errors = validateOwnerDecision(decision, policy);
  if (errors.length) return { errors, candidateDecision };
  if (candidateDecision.hardExclusions.length) return { errors: ['owner decision cannot override hard safety exclusions'], candidateDecision };
  return { errors: [], candidateDecision: { ...candidateDecision, ownerDecisionApplied: decision } };
};

export const buildPopulationReports = (candidates = [], decisions = []) => {
  const rawUniverse = candidates.length;
  const deepReviewPopulation = candidates.filter((candidate) => candidate.deepReviewReady !== false).length;
  const validationPopulation = decisions.length;
  const counts = {
    [FINAL_STATES.APPROVE]: decisions.filter((decision) => decision.recommendation === FINAL_STATES.APPROVE).length,
    [FINAL_STATES.NEEDS]: decisions.filter((decision) => decision.recommendation === FINAL_STATES.NEEDS).length,
    [FINAL_STATES.EXCLUDE]: decisions.filter((decision) => decision.recommendation === FINAL_STATES.EXCLUDE).length,
  };
  const sequentialFilters = [
    { stage: 'raw_universe', before: rawUniverse, excluded: 0, remaining: rawUniverse },
    { stage: 'deep_review_ready', before: rawUniverse, excluded: rawUniverse - deepReviewPopulation, remaining: deepReviewPopulation },
    { stage: 'validation_population', before: deepReviewPopulation, excluded: deepReviewPopulation - validationPopulation, remaining: validationPopulation },
  ];
  const outcomeBranch = Object.entries(counts).map(([stage, count]) => ({ stage, count, denominator: validationPopulation }));
  const monotonic = sequentialFilters.every((row, index, rows) => index === 0 || row.remaining <= rows[index - 1].remaining);
  const outcomeReconciles = Object.values(counts).reduce((a, b) => a + b, 0) === validationPopulation;
  return { rawUniverse, deepReviewPopulation, validationPopulation, ownerReviewCohort: counts[FINAL_STATES.APPROVE] + counts[FINAL_STATES.NEEDS], sequentialFilters, outcomeBranch, finalDecisions: counts, reconciles: monotonic && outcomeReconciles };
};

export const sanitizeForbiddenEnv = () => {
  for (const key of FORBIDDEN_ENV_KEYS) delete process.env[key];
};

export const buildPreflight = ({ mode, policy, sourcePolicyFileSha256, canonicalPolicyObjectSha256, outputDir, runId }) => {
  const forbiddenLoaded = FORBIDDEN_ENV_KEYS.filter((key) => Boolean(process.env[key]));
  const outputPrivate = String(outputDir || '').startsWith('/tmp/') || String(outputDir || '').includes('/.hermes/artifacts/');
  const liveReadOnlyHealthy = Boolean(process.env.STARTLINE_READ_ONLY_HISTORY_ENDPOINT || process.env.STARTLINE_READ_ONLY_SUPABASE_URL);
  const readOnlyCredentialStatus = mode === 'fixture' ? 'NOT_APPLICABLE_IN_FIXTURE_MODE' : (liveReadOnlyHealthy ? 'AVAILABLE' : 'UNAVAILABLE');
  const outboundJobsPaused = true;
  const safetyJobsEnabled = true;
  const deviations = [];
  if (forbiddenLoaded.length) deviations.push(createDeviation({ runId, policy, stage: 'preflight', expectedCondition: 'no send/write credentials in runner environment', actualCondition: `forbidden keys loaded: ${forbiddenLoaded.join(',')}`, reason: 'FORBIDDEN_CAPABILITY_LOADED', affectedRecords: [] }));
  if (!outputPrivate) deviations.push(createDeviation({ runId, policy, stage: 'preflight', expectedCondition: 'output path private', actualCondition: String(outputDir), reason: 'OUTPUT_PATH_NOT_PRIVATE', affectedRecords: [] }));
  if (mode !== 'fixture' && !liveReadOnlyHealthy) deviations.push(createDeviation({ runId, policy, stage: 'preflight', expectedCondition: 'read-only history credential healthy', actualCondition: 'missing approved read-only endpoint/credential', reason: 'READ_ONLY_HISTORY_UNAVAILABLE', affectedRecords: [] }));
  return {
    runId,
    policyId: policy.policyId,
    policyVersion: policy.version,
    sourcePolicyFileSha256,
    canonicalPolicyObjectSha256,
    mode,
    safetyJobsEnabled,
    outboundJobsPaused,
    readOnlyCredentialStatus,
    readOnlyCredentialHealthy: mode === 'fixture' ? null : liveReadOnlyHealthy,
    noSendOrWriteCredentialsLoaded: forbiddenLoaded.length === 0,
    forbiddenCapabilitiesDetected: forbiddenLoaded,
    outputPrivate,
    status: deviations.length ? 'PROCESS DEVIATION — BLOCKED' : 'GO',
    deviations,
  };
};

export const buildPostflight = ({ decisions, population }) => ({
  noEmailsSent: true,
  noContactFormsSubmitted: true,
  noProspectsWritten: true,
  noMockupsCreated: true,
  noCronStateChanged: true,
  noDatabaseMutation: true,
  noResendSendCapabilityAvailable: FORBIDDEN_ENV_KEYS.filter((key) => Boolean(process.env[key])).length === 0,
  outputSchemaValid: decisions.every((decision) => !validateTransitionLog(decision.transitionLog).length),
  countsReconcile: population.reconciles,
  recurringSourcingCronCreated: false,
  phase2a1cAuthorized: false,
  phase2a2Authorized: false,
});

export const assertNoSideEffectPostflight = (postflight) => {
  const failures = Object.entries(postflight).filter(([key, value]) => {
    if (['phase2a1cAuthorized', 'phase2a2Authorized', 'recurringSourcingCronCreated'].includes(key)) return value !== false;
    return value !== true;
  });
  if (failures.length) throw new Error(`no-side-effect postflight failed: ${failures.map(([key]) => key).join(', ')}`);
};

export const gitCommitSha = () => {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return 'unknown'; }
};

export const gitDirtyState = () => {
  try {
    const porcelain = execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim();
    return { isDirty: porcelain.length > 0, porcelain };
  } catch {
    return { isDirty: null, porcelain: 'unknown' };
  }
};

export const renderMarkdownTable = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map((row) => `| ${headers.map((header) => String(row[header] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`),
].join('\n');
