import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  FINAL_STATES,
  applyOwnerDecision,
  assertNoSideEffectPostflight,
  buildPopulationReports,
  buildPostflight,
  buildPreflight,
  buildTransitionLog,
  classifyCandidate,
  createDeviation,
  deriveCommercialCapacity,
  deriveWebsiteNeed,
  loadPolicy,
  sha256Text,
  stableStringify,
  validateDeviationRecord,
  validateOwnerDecision,
  validatePolicy,
  validateSourceEvidence,
  validateTransitionLog,
} from '../scripts/lib/startline-lane-a-repeatability-policy.mjs';
import { runLaneA } from '../scripts/startline-lane-a-source-runner.mjs';

const policyPath = new URL('../config/startline-lane-a-sourcing-policy-v1.json', import.meta.url).pathname;
const fixturePath = new URL('./fixtures/startline-lane-a-repeatability-fixture.json', import.meta.url).pathname;
const goldenPath = new URL('./fixtures/startline-lane-a-repeatability-golden.json', import.meta.url).pathname;
const readFixture = async () => JSON.parse(await fs.readFile(fixturePath, 'utf8'));
const load = async () => ({ ...(await loadPolicy(policyPath)), fixture: await readFixture() });

test('policy JSON validates against schema-level contract and carries fixed enums', async () => {
  const { policy } = await load();
  assert.deepEqual(validatePolicy(policy), []);
  assert(policy.enums.contactState.includes('CONTACT_FORM_ONLY'));
  assert(policy.enums.websiteNeed.includes('UNKNOWN'));
  assert(!policy.enums.websiteNeed.includes('MEDIUM_HIGH'));
  assert.equal(policy.recurringCronCertificationRules.authorized, false);
});

test('policy checksum fields distinguish source file and canonical object hashes', async () => {
  const out = await fs.mkdtemp('/tmp/lane-a-sha-');
  const raw = await fs.readFile(policyPath, 'utf8');
  const policy = JSON.parse(raw);
  const result = await runLaneA({ policyPath, runId: 'sha-test', mode: 'fixture', inputPath: fixturePath, outputDir: out, goldenManifestPath: goldenPath });
  assert.equal(result.manifest.sourcePolicyFileSha256, sha256Text(raw));
  assert.equal(result.manifest.canonicalPolicyObjectSha256, sha256Text(stableStringify(policy)));
  const external = JSON.parse(await fs.readFile(path.join(out, 'external-evidence-checksums.json'), 'utf8'));
  assert.equal(external.policyFileVerification.matches, true);
  assert.equal(external.artifactHashes['startline-lane-a-sourcing-policy-v1.json'], sha256Text(raw));
});

test('unknown enum fails source-evidence validation', async () => {
  const { policy, fixture } = await load();
  const bad = structuredClone(fixture.candidates[0]);
  bad.contactState = 'PLAUSIBLE_REQUIRES_STEVE_CONFIRMATION';
  assert.match(validateSourceEvidence(bad, policy).join('\n'), /unknown enum/);
});

test('CONTACT_FORM_ONLY is supported and fails closed as non-sendable', async () => {
  const { policy, fixture } = await load();
  const candidate = fixture.candidates.find((c) => c.candidateId === 19);
  assert.equal(validateSourceEvidence(candidate, policy).length, 0);
  const decision = classifyCandidate({ candidate, policy });
  assert.equal(decision.recommendation, FINAL_STATES.EXCLUDE);
  assert(decision.hardExclusions.includes('CONTACT_FORM_ONLY'));
});

test('UNKNOWN need or capacity fails closed', async () => {
  const { policy, fixture } = await load();
  const candidate = structuredClone(fixture.candidates.find((c) => c.candidateId === 17));
  candidate.websiteNeedComponents = [];
  let decision = classifyCandidate({ candidate, policy });
  assert.equal(decision.recommendation, FINAL_STATES.EXCLUDE);
  assert(decision.hardExclusions.includes('UNKNOWN_WEBSITE_NEED'));
  candidate.websiteNeedComponents = fixture.candidates.find((c) => c.candidateId === 17).websiteNeedComponents;
  candidate.commercialCapacityComponents = [];
  decision = classifyCandidate({ candidate, policy });
  assert.equal(decision.recommendation, FINAL_STATES.EXCLUDE);
  assert(decision.hardExclusions.includes('UNKNOWN_COMMERCIAL_CAPACITY'));
});

test('website score derives classification from components and thresholds', async () => {
  const { policy, fixture } = await load();
  const medium = deriveWebsiteNeed(fixture.candidates.find((c) => c.candidateId === 17), policy);
  assert.equal(medium.classification, 'MEDIUM');
  assert.equal(medium.total, 10);
});

test('capacity score derives classification from components and thresholds', async () => {
  const { policy, fixture } = await load();
  const capacity = deriveCommercialCapacity(fixture.candidates.find((c) => c.candidateId === 17), policy);
  assert.equal(capacity.classification, 'MEDIUM');
  assert.equal(capacity.total, 8);
});

test('absence of unique domain alone cannot produce HIGH', async () => {
  const { policy, fixture } = await load();
  const candidate = structuredClone(fixture.candidates.find((c) => c.candidateId === 17));
  candidate.websiteNeedComponents = candidate.websiteNeedComponents.map((component) => ({ ...component, score: component.id === 'standalone_site_gap' ? 3 : 0 }));
  const need = deriveWebsiteNeed(candidate, policy);
  assert.notEqual(need.classification, 'HIGH');
});

test('hard exclusion cannot be overridden by owner decision', async () => {
  const { policy, fixture } = await load();
  const candidateDecision = classifyCandidate({ candidate: fixture.candidates.find((c) => c.candidateId === 13), policy });
  const decision = { candidateId: 13, ownerIdentity: 'Steve Bailey', decision: 'approve source', reasonCode: 'manual', timestamp: '2026-08-14T12:00:00-05:00', policyVersion: policy.version, evidenceHash: 'sha256:test', expirationOrRevalidationTimestamp: '2026-08-15T12:00:00-05:00' };
  const applied = applyOwnerDecision({ decision, candidateDecision, policy });
  assert.match(applied.errors.join('\n'), /cannot override hard safety exclusions/);
});

test('more than one unresolved owner issue cannot become narrow NEEDS', async () => {
  const { policy, fixture } = await load();
  const candidate = structuredClone(fixture.candidates.find((c) => c.candidateId === 5));
  candidate.leadTimeDays = 95;
  const decision = classifyCandidate({ candidate, policy });
  assert.equal(decision.recommendation, FINAL_STATES.EXCLUDE);
  assert(decision.hardExclusions.includes('MULTIPLE_UNRESOLVED_OWNER_ISSUES'));
});

test('history 401 creates deviation and blocks live read-only mode', async () => {
  const { policy, sourcePolicyFileSha256, canonicalPolicyObjectSha256 } = await loadPolicy(policyPath);
  const preflight = buildPreflight({ mode: 'live-read-only', policy, sourcePolicyFileSha256, canonicalPolicyObjectSha256, outputDir: '/tmp/lane-a-test', runId: 'history-401' });
  assert.equal(preflight.status, 'PROCESS DEVIATION — BLOCKED');
  assert(preflight.deviations.some((record) => record.reason === 'READ_ONLY_HISTORY_UNAVAILABLE'));
});

test('stale fallback cannot produce APPROVE', async () => {
  const { policy, fixture } = await load();
  const candidate = structuredClone(fixture.candidates.find((c) => c.candidateId === 17));
  candidate.deviations = [createDeviation({ runId: 'stale', policy, stage: 'history', expectedCondition: 'same-run live history', actualCondition: 'stale fallback artifact', reason: 'STALE_FALLBACK', affectedRecords: [17] })];
  const decision = classifyCandidate({ candidate, policy });
  assert.equal(decision.recommendation, FINAL_STATES.EXCLUDE);
  assert(decision.hardExclusions.includes('PROCESS_DEVIATION_BLOCKED'));
});

test('run manifest required fields validate', async () => {
  const out = await fs.mkdtemp('/tmp/lane-a-manifest-');
  const result = await runLaneA({ policyPath, runId: 'manifest-test', mode: 'fixture', inputPath: fixturePath, outputDir: out, goldenManifestPath: goldenPath });
  for (const key of ['runId', 'policyId', 'policyVersion', 'sourcePolicyFileSha256', 'canonicalPolicyObjectSha256', 'codeCommitSha', 'gitDirtyState', 'sopSha256', 'evaluationTimestamp', 'mode', 'sourceEvidenceMode', 'preflight', 'populationCounts', 'outputArtifactHashes', 'deviations', 'finalDecisions', 'postflight']) {
    assert.notEqual(result.manifest[key], undefined, `${key} should exist`);
  }
});

test('deviation record validates', async () => {
  const { policy } = await load();
  const deviation = createDeviation({ runId: 'dev-test', policy, stage: 'source', expectedCondition: 'official page accessible', actualCondition: '403', reason: 'SOURCE_ACCESS_FAILURE', affectedRecords: [5] });
  assert.deepEqual(validateDeviationRecord(deviation), []);
});

test('state transition skipping fails', async () => {
  const { policy } = await load();
  const transitions = buildTransitionLog({ candidateId: 17, runId: 'state-test', policy, evidenceHash: 'sha256:test' });
  assert.deepEqual(validateTransitionLog(transitions), []);
  const bad = structuredClone(transitions);
  bad[1].to = 'VALIDATED';
  assert.match(validateTransitionLog(bad).join('\n'), /skips or reorders/);
});

test('owner ledger validator does not manufacture owner decisions', async () => {
  const { policy, fixture } = await load();
  const decision = classifyCandidate({ candidate: fixture.candidates.find((c) => c.candidateId === 10), policy });
  assert.equal(decision.ownerDecisionApplied, undefined);
  assert.match(validateOwnerDecision({ candidateId: 10, decision: 'allow limited runway' }, policy).join('\n'), /owner decision missing/);
});

test('raw, deep-review, and validation populations remain distinct', async () => {
  const { policy, fixture } = await load();
  const decisions = fixture.candidates.map((candidate) => classifyCandidate({ candidate, policy }));
  const population = buildPopulationReports(fixture.candidates, decisions);
  assert.equal(population.rawUniverse, 9);
  assert.equal(population.deepReviewPopulation, 9);
  assert.equal(population.validationPopulation, 9);
  assert.equal(population.ownerReviewCohort, 3);
});

test('sequential waterfall is monotonic', async () => {
  const { policy, fixture } = await load();
  const population = buildPopulationReports(fixture.candidates, fixture.candidates.map((candidate) => classifyCandidate({ candidate, policy })));
  assert(population.sequentialFilters.every((row, index, rows) => index === 0 || row.remaining <= rows[index - 1].remaining));
});

test('outcome branch reconciles', async () => {
  const { policy, fixture } = await load();
  const population = buildPopulationReports(fixture.candidates, fixture.candidates.map((candidate) => classifyCandidate({ candidate, policy })));
  assert.equal(population.reconciles, true);
  assert.equal(population.finalDecisions[FINAL_STATES.APPROVE] + population.finalDecisions[FINAL_STATES.NEEDS] + population.finalDecisions[FINAL_STATES.EXCLUDE], 9);
});

test('fixture replay matches corrected 1/2/6 candidate-level mapping', async () => {
  const out = await fs.mkdtemp('/tmp/lane-a-replay-');
  const result = await runLaneA({ policyPath, runId: 'fixture-replay', mode: 'fixture', inputPath: fixturePath, outputDir: out, goldenManifestPath: goldenPath });
  assert.deepEqual(result.manifest.finalDecisions, { [FINAL_STATES.APPROVE]: 1, [FINAL_STATES.EXCLUDE]: 6, [FINAL_STATES.NEEDS]: 2 });
  const mapping = Object.fromEntries(result.manifest.finalCandidateDecisions.map((d) => [d.candidateId, d.recommendation]));
  assert.equal(mapping[17], FINAL_STATES.APPROVE);
  assert.equal(mapping[10], FINAL_STATES.NEEDS);
  assert.equal(mapping[5], FINAL_STATES.NEEDS);
  for (const id of [13, 15, 19, 22, 24, 30]) assert.equal(mapping[id], FINAL_STATES.EXCLUDE);
});

test('no send/write capability is available in sanitized runner environment', async () => {
  const { policy, sourcePolicyFileSha256, canonicalPolicyObjectSha256 } = await loadPolicy(policyPath);
  const saved = {};
  for (const key of ['RESEND_API_KEY', 'RESEND_AUDIENCES_API_KEY', 'STRIPE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'STARTLINE_SUPABASE_SERVICE_ROLE_KEY']) { saved[key] = process.env[key]; delete process.env[key]; }
  try {
    const preflight = buildPreflight({ mode: 'fixture', policy, sourcePolicyFileSha256, canonicalPolicyObjectSha256, outputDir: '/tmp/lane-a-safe', runId: 'env-test' });
    assert.equal(preflight.noSendOrWriteCredentialsLoaded, true);
  } finally {
    for (const [key, value] of Object.entries(saved)) { if (value !== undefined) process.env[key] = value; else delete process.env[key]; }
  }
});

test('no-side-effect postflight fails if a forbidden capability is detected', async () => {
  const saved = {};
  for (const key of ['RESEND_API_KEY', 'RESEND_AUDIENCES_API_KEY', 'STRIPE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'STARTLINE_SUPABASE_SERVICE_ROLE_KEY']) { saved[key] = process.env[key]; delete process.env[key]; }
  try {
    const postflight = buildPostflight({ decisions: [], population: { reconciles: true } });
    assertNoSideEffectPostflight(postflight);
    assert.throws(() => assertNoSideEffectPostflight({ ...postflight, noEmailsSent: false }), /no-side-effect postflight failed/);
  } finally {
    for (const [key, value] of Object.entries(saved)) { if (value !== undefined) process.env[key] = value; else delete process.env[key]; }
  }
});


test('manifest records actual git HEAD and dirty worktree state from runtime', async () => {
  const out = await fs.mkdtemp('/tmp/lane-a-head-');
  const expectedHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const result = await runLaneA({ policyPath, runId: 'head-test', mode: 'fixture', inputPath: fixturePath, outputDir: out, goldenManifestPath: goldenPath });
  assert.equal(result.manifest.codeCommitSha, expectedHead);
  assert.match(result.manifest.codeCommitSource, /git rev-parse HEAD/);
  assert.equal(typeof result.manifest.gitDirtyState.isDirty, 'boolean');
});

test('run manifest excludes self hash and external checksum matches final bytes', async () => {
  const out = await fs.mkdtemp('/tmp/lane-a-external-hash-');
  const result = await runLaneA({ policyPath, runId: 'external-hash-test', mode: 'fixture', inputPath: fixturePath, outputDir: out, goldenManifestPath: goldenPath });
  assert.equal(result.manifest.outputArtifactHashes['run-manifest.json'], undefined);
  const external = JSON.parse(await fs.readFile(path.join(out, 'external-evidence-checksums.json'), 'utf8'));
  assert.equal(external.runManifestSha256, sha256Text(await fs.readFile(path.join(out, 'run-manifest.json'), 'utf8')));
});

test('fixture mode manifest semantics are explicit and not live-evidence claims', async () => {
  const out = await fs.mkdtemp('/tmp/lane-a-fixture-semantics-');
  const result = await runLaneA({ policyPath, runId: 'fixture-semantics-test', mode: 'fixture', inputPath: fixturePath, outputDir: out, goldenManifestPath: goldenPath });
  assert.equal(result.manifest.sourceEvidenceMode, 'FROZEN_SANITIZED_FIXTURE');
  assert.equal(result.manifest.productionHistorySnapshotTimestamp, null);
  assert.equal(result.manifest.preflight.readOnlyCredentialStatus, 'NOT_APPLICABLE_IN_FIXTURE_MODE');
  assert.equal(result.manifest.preflight.readOnlyCredentialHealthy, null);
  assert(result.manifest.sourceUrlsAndAccessTimestamps.every((source) => source.accessSemantics === 'FIXTURE_REFERENCE_NOT_LIVE_ACCESS_EVIDENCE'));
});

test('golden fixture file stays exactly aligned to runner comparable output', async () => {
  const out = await fs.mkdtemp('/tmp/lane-a-golden-');
  const result = await runLaneA({ policyPath, runId: 'fixture-replay', mode: 'fixture', inputPath: fixturePath, outputDir: out, goldenManifestPath: goldenPath });
  const golden = JSON.parse(await fs.readFile(goldenPath, 'utf8'));
  const comparable = { finalDecisions: result.manifest.finalDecisions, candidateMapping: Object.fromEntries(result.manifest.finalCandidateDecisions.map((d) => [String(d.candidateId), { recommendation: d.recommendation, reason: d.reason, ownerDecisionReasons: d.ownerDecisionReasons, hardExclusions: d.hardExclusions }])), noSideEffect: result.manifest.postflight };
  assert.equal(stableStringify(golden), stableStringify(comparable));
});
