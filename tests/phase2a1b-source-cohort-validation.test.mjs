import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  FINAL_STATES,
  POLICY_VERSION,
  classifyCandidate,
  independentFilterCounts,
  sequentialWaterfall,
  validateInput,
} from '../scripts/lib/phase2a1b-source-cohort-validation-policy.mjs';
import { runValidation } from '../scripts/phase2a1b-source-cohort-validation-runner.mjs';

const fixturePath = new URL('./fixtures/phase2a1b-source-cohort-validation-input.json', import.meta.url);
const goldenPath = new URL('./fixtures/phase2a1b-source-cohort-validation-golden.json', import.meta.url);
const readFixture = async () => JSON.parse(await fs.readFile(fixturePath, 'utf8'));

test('Phase 2A-1B policy validates the bounded nine candidates exactly once', async () => {
  const fixture = await readFixture();
  assert.equal(fixture.policyVersion, POLICY_VERSION);
  assert.deepEqual(validateInput(fixture), []);
  const missing = structuredClone(fixture);
  missing.candidates = missing.candidates.filter((candidate) => candidate.candidateNumber !== 30);
  assert.match(validateInput(missing).join('\n'), /bounded nine candidate numbers/);
});

test('fixed rubrics fail closed for low need, ambiguous history, stale details, and owner decisions', async () => {
  const fixture = await readFixture();
  const byNumber = new Map(fixture.candidates.map((candidate) => [candidate.candidateNumber, candidate]));
  assert.equal(classifyCandidate(byNumber.get(5)).finalState, FINAL_STATES.EXCLUDE);
  assert(classifyCandidate(byNumber.get(5)).blockers.includes('LOW_WEBSITE_NEED'));
  assert.equal(classifyCandidate(byNumber.get(22)).finalState, FINAL_STATES.EXCLUDE);
  assert(classifyCandidate(byNumber.get(22)).blockers.includes('DUPLICATE_BLOCKED_OR_AMBIGUOUS'));
  assert.equal(classifyCandidate(byNumber.get(30)).finalState, FINAL_STATES.EXCLUDE);
  assert(classifyCandidate(byNumber.get(30)).blockers.includes('EVENT_DETAILS_STALE_OR_CONFLICTING'));
  assert.equal(classifyCandidate(byNumber.get(10)).finalState, FINAL_STATES.NEEDS);
  assert(classifyCandidate(byNumber.get(10)).ownerDecisions.includes('LIMITED_RUNWAY'));
  assert.equal(classifyCandidate(byNumber.get(24)).finalState, FINAL_STATES.APPROVE);
});

test('independent counts and sequential waterfall are deterministic and separate', async () => {
  const fixture = await readFixture();
  const independent = independentFilterCounts(fixture.candidates);
  const sequential = sequentialWaterfall(fixture.candidates);
  assert.equal(independent.find((row) => row.stage === 'total_deeply_reviewed').passCount, 17);
  assert.equal(independent.find((row) => row.stage === 'approve_for_asset_preparation').passCount, 2);
  assert.equal(sequential[0].stage, 'deeply_reviewed_candidates');
  assert.equal(sequential.at(-3).stage, FINAL_STATES.APPROVE);
  assert(sequential.every((row) => Number.isInteger(row.before) && Number.isInteger(row.excluded) && Number.isInteger(row.remaining)));
});

test('runner replays golden fixture and emits no-side-effect evidence package files', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'phase2a1b-runner-'));
  const result = await runValidation({ inputPath: fixturePath.pathname, outputDir: out, ownerLedgerPath: path.join(out, 'ledger', 'owner-decisions.json'), command: 'node test-runner' });
  const golden = JSON.parse(await fs.readFile(goldenPath, 'utf8'));
  const comparable = {
    finalDecisions: result.manifest.finalDecisions,
    sampledLaneASupply: result.manifest.sampledLaneASupply,
    sourceCohortValidation: result.manifest.sourceCohortValidation,
    noSideEffectCertification: result.manifest.noSideEffectCertification,
  };
  assert.deepEqual(comparable, golden);
  for (const file of [
    'STARTLINESITES_CMO_PHASE2A1B_SOURCE_COHORT_VALIDATION_REPORT.md',
    'STARTLINESITES_CMO_PHASE2A1B_FINAL_OWNER_SOURCE_COHORT.md',
    'STARTLINESITES_CMO_PHASE2A1B_CANDIDATE_RECLASSIFICATION_TABLE.md',
    'STARTLINESITES_CMO_PHASE2A1B_CORRECTED_YIELD_WATERFALL.md',
    'STARTLINESITES_CMO_PHASE2A1B_HISTORY_MATCH_RECONCILIATION.md',
    'STARTLINESITES_CMO_PHASE2A1B_SOURCE_URL_MANIFEST.md',
    'STARTLINESITES_CMO_PHASE2A1B_RUN_MANIFEST.json',
    'STARTLINESITES_CMO_PHASE2A1B_NO_SIDE_EFFECT_CERTIFICATION.json',
  ]) {
    assert(await fs.stat(path.join(out, file)));
  }
  const report = await fs.readFile(path.join(out, 'STARTLINESITES_CMO_PHASE2A1B_SOURCE_COHORT_VALIDATION_REPORT.md'), 'utf8');
  assert.match(report, /PHASE 2A-1C — NOT AUTHORIZED/);
  assert.match(report, /No production writes were performed/);
});
