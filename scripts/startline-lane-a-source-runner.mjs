#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  FINAL_STATES,
  assertNoSideEffectPostflight,
  buildPopulationReports,
  buildPostflight,
  buildPreflight,
  classifyCandidate,
  gitCommitSha,
  gitDirtyState,
  loadPolicy,
  readJson,
  renderMarkdownTable,
  sha256Object,
  sha256Text,
  stableStringify,
  sanitizeForbiddenEnv,
  validateDeviationRecord,
} from './lib/startline-lane-a-repeatability-policy.mjs';

const DEFAULT_POLICY = 'config/startline-lane-a-sourcing-policy-v1.json';
const USAGE = `Usage: node scripts/startline-lane-a-source-runner.mjs --policy config/startline-lane-a-sourcing-policy-v1.json --run-id <id> --mode <fixture|live-read-only> --input fixture.json --output-dir /private/path [--golden-manifest golden.json]\n\nOwner-invoked Lane A repeatability runner. Fixture mode reads local sanitized evidence only. Live read-only mode is structurally read-only and fails closed unless approved read-only access is available; it never sends email, submits forms, writes prospects, creates mockups, mutates cron jobs, or starts Phase 2A-1C/2A-2.`;

const parseArgs = (argv = process.argv.slice(2)) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) args[key] = true;
      else { args[key] = value; i += 1; }
    }
  }
  return args;
};

const ensureDir = async (dir) => fs.mkdir(dir, { recursive: true });
const writeJson = async (file, value) => fs.writeFile(file, `${stableStringify(value)}\n`);
const writeText = async (file, value) => fs.writeFile(file, value.endsWith('\n') ? value : `${value}\n`);

const artifactHashes = async (outputDir, { exclude = [] } = {}) => {
  const hashes = {};
  for (const name of (await fs.readdir(outputDir)).sort()) {
    const file = path.join(outputDir, name);
    const stat = await fs.stat(file);
    if (exclude.includes(name)) continue;
    if (stat.isFile()) hashes[name] = sha256Text(await fs.readFile(file, 'utf8'));
  }
  return hashes;
};

const renderSop = ({ policy, sourcePolicyFileSha256, canonicalPolicyObjectSha256, specSha256 }) => [
  '# STARTLINESITES_CMO_LANE_A_REPEATABILITY_SOP',
  '',
  `Policy: \`${policy.policyId}\` v\`${policy.version}\``,
  `Source policy file SHA-256: \`${sourcePolicyFileSha256}\``,
  `Canonical policy object SHA-256: \`${canonicalPolicyObjectSha256}\``,
  `Authoritative specification SHA-256: \`${specSha256 || 'recorded in evidence package'}\``,
  '',
  'This SOP locks the Lane A sourcing process to a versioned policy, fixed schemas, fixed rubrics, explicit deviations, and a no-send/no-write boundary.',
  '',
  '## Authorized modes',
  '',
  '- `fixture`: local sanitized regression replay only; no network and no side effects.',
  '- `live-read-only`: approved public/read-only collection and history checks only; no production mutations and no sends.',
  '',
  '## Fixed stage order',
  '',
  policy.enums.candidateState.map((state, index) => `${index + 1}. \`${state}\``).join('\n'),
  '',
  'Phase 2A-1B may stop only at `VALIDATED` or `OWNER_SOURCE_APPROVED`. This PR does not authorize assets, mockups, sends, production writes, cron activation, Phase 2A-1C, or Phase 2A-2.',
  '',
].join('\n');

const renderStateMachine = (policy) => [
  '# STARTLINESITES_CMO_LANE_A_STATE_MACHINE',
  '',
  'Every candidate transition is append-only and must include candidate ID, from/to state, run ID, policy version, timestamp, actor, evidence hash, and owner approval where required.',
  '',
  renderMarkdownTable(['from', 'to'], policy.stateTransitions.map(([from, to]) => ({ from, to }))),
  '',
  'No record may jump stages. `ASSET_PREPARATION_READY`, `ASSET_READY_FOR_OWNER_REVIEW`, `OWNER_SEND_APPROVED`, and `SENT` are outside this workstream and remain unauthorized.',
  '',
].join('\n');

const renderDeviationPolicy = (policy) => [
  '# STARTLINESITES_CMO_LANE_A_DEVIATION_POLICY',
  '',
  'Any inability to follow the approved process produces `PROCESS DEVIATION — BLOCKED`.',
  '',
  'Required fields: run ID, policy ID/version, stage, expected condition, actual condition, reason, affected records, evidence freshness, owner approval required, remediation, final run status, and resolved timestamp if later corrected.',
  '',
  'No silent fallbacks. No improvised sources, thresholds, labels, or workflow order. No candidate can receive an APPROVE recommendation while an unresolved deviation affects it.',
  '',
  `Policy hard exclusions: ${policy.hardExclusions.map((item) => `\`${item}\``).join(', ')}`,
  '',
].join('\n');

const renderOwnerLedgerTemplate = (policy) => `${stableStringify({
  description: 'Private append-only owner decision ledger template. Do not commit populated owner decisions to the public repository.',
  policyId: policy.policyId,
  policyVersion: policy.version,
  entries: [{
    candidateId: '<candidate-id>',
    ownerIdentity: 'Steve Bailey',
    decision: policy.enums.ownerDecision,
    reasonCode: '<reason-code>',
    timestamp: '<ISO-8601>',
    policyVersion: policy.version,
    evidenceHash: '<sha256>',
    expirationOrRevalidationTimestamp: '<ISO-8601>',
    priorDecisionReference: null,
  }],
})}\n`;

const renderReplayReport = ({ runId, manifest, decisions, population, expectedOutcomeHash }) => [
  '# STARTLINESITES_CMO_LANE_A_GOLDEN_FIXTURE_REPLAY_REPORT',
  '',
  `Run ID: \`${runId}\``,
  `Frozen evaluation timestamp: \`${manifest.evaluationTimestamp}\``,
  `Evidence snapshot ID/hash: \`${manifest.evidenceSnapshotId}\` / \`${manifest.evidenceSnapshotHash}\``,
  `Expected outcome hash: \`${expectedOutcomeHash || manifest.expectedOutcomeHash}\``,
  '',
  '## Final frozen mapping',
  '',
  renderMarkdownTable(['candidateId', 'recommendation', 'reason', 'ownerDecisionReasons', 'hardExclusions'], decisions.map((decision) => ({ candidateId: decision.candidateId, recommendation: decision.recommendation, reason: decision.reason, ownerDecisionReasons: decision.ownerDecisionReasons.join('; ') || 'none', hardExclusions: decision.hardExclusions.join('; ') || 'none' }))),
  '',
  '## Count reconciliation',
  '',
  `- APPROVE_FOR_ASSET_PREPARATION: ${population.finalDecisions[FINAL_STATES.APPROVE]}`,
  `- NEEDS_STEVE_DECISION: ${population.finalDecisions[FINAL_STATES.NEEDS]}`,
  `- EXCLUDE: ${population.finalDecisions[FINAL_STATES.EXCLUDE]}`,
  `- Outcome branch reconciles: ${population.reconciles}`,
  '',
].join('\n');

const renderCertificationReport = ({ manifest, preflight, postflight, deviations }) => [
  '# STARTLINESITES_CMO_LANE_A_REPEATABILITY_CERTIFICATION_REPORT',
  '',
  `Run ID: \`${manifest.runId}\``,
  `Policy: \`${manifest.policyId}\` v\`${manifest.policyVersion}\``,
  `Source policy file SHA-256: \`${manifest.sourcePolicyFileSha256}\``,
  `Canonical policy object SHA-256: \`${manifest.canonicalPolicyObjectSha256}\``,
  '',
  '## GO / NO-GO',
  '',
  `- REPEATABILITY POLICY — ${manifest.sourcePolicyFileSha256 && manifest.canonicalPolicyObjectSha256 ? 'GO' : 'NO-GO'}`,
  `- SCHEMA VALIDATION — ${manifest.outputSchemaValid ? 'GO' : 'NO-GO'}`,
  `- GOLDEN FIXTURE REPLAY — ${manifest.goldenReplayStatus || 'NOT_RUN'}`,
  `- READ-ONLY ENFORCEMENT — ${preflight.noSendOrWriteCredentialsLoaded && postflight.noDatabaseMutation ? 'GO' : 'NO-GO'}`,
  `- DEVIATION CONTROL — ${deviations.every((record) => validateDeviationRecord(record).length === 0) ? 'GO' : 'NO-GO'}`,
  '- RECURRING SOURCING CRON — NOT AUTHORIZED',
  '- PHASE 2A-1C — NOT AUTHORIZED',
  '- PHASE 2A-2 — NOT AUTHORIZED',
  '',
  '## No-side-effect certification',
  '',
  Object.entries(postflight).map(([key, value]) => `- ${key}: ${value}`).join('\n'),
  '',
].join('\n');

export const runLaneA = async ({ policyPath = DEFAULT_POLICY, runId, mode = 'fixture', inputPath, outputDir, goldenManifestPath, specSha256 = '' }) => {
  if (!runId) throw new Error('required --run-id');
  if (!['fixture', 'live-read-only'].includes(mode)) throw new Error('mode must be fixture or live-read-only');
  if (!outputDir) throw new Error('required --output-dir');
  if (!inputPath) throw new Error('required --input local evidence file for this locked PR; fresh sourcing is not authorized');
  const { policy, raw: policyRaw, sourcePolicyFileSha256, canonicalPolicyObjectSha256 } = await loadPolicy(policyPath);
  sanitizeForbiddenEnv();
  const startedAt = new Date().toISOString();
  await ensureDir(outputDir);
  const input = await readJson(inputPath);
  const evidenceSnapshotHash = sha256Object(input);
  const preflight = buildPreflight({ mode, policy, sourcePolicyFileSha256, canonicalPolicyObjectSha256, outputDir, runId });
  if (mode === 'live-read-only' && preflight.deviations.length) {
    await writeJson(path.join(outputDir, 'deviation-register.json'), preflight.deviations);
    throw new Error('PROCESS DEVIATION — BLOCKED');
  }
  if (mode === 'fixture' && !preflight.outputPrivate) throw new Error('PROCESS DEVIATION — BLOCKED');
  const now = input.frozenEvaluationTimestamp || startedAt;
  const candidates = input.candidates || [];
  const decisions = candidates.map((candidate) => classifyCandidate({ candidate, policy, runId, now }));
  const population = buildPopulationReports(candidates, decisions);
  const postflight = buildPostflight({ decisions, population });
  if (mode !== 'fixture') assertNoSideEffectPostflight(postflight);
  const deviations = [...preflight.deviations, ...candidates.flatMap((candidate) => candidate.deviations || [])];
  const expectedOutcome = { finalDecisions: population.finalDecisions, candidateMapping: Object.fromEntries(decisions.map((decision) => [String(decision.candidateId), { recommendation: decision.recommendation, reason: decision.reason, ownerDecisionReasons: decision.ownerDecisionReasons, hardExclusions: decision.hardExclusions }])) };
  const expectedOutcomeHash = sha256Object(expectedOutcome);
  const manifestBase = {
    runId,
    policyId: policy.policyId,
    policyVersion: policy.version,
    sourcePolicyFileSha256,
    canonicalPolicyObjectSha256,
    policyChecksumSemantics: {
      sourcePolicyFileSha256: 'SHA-256 of config/startline-lane-a-sourcing-policy-v1.json bytes as checked out at runtime',
      canonicalPolicyObjectSha256: 'SHA-256 of stable JSON stringification of the parsed policy object',
    },
    codeCommitSha: gitCommitSha(),
    codeCommitSource: 'git rev-parse HEAD at runner execution time; caller-supplied commit values are ignored',
    gitDirtyState: gitDirtyState(),
    sopSha256: sha256Text(renderSop({ policy, sourcePolicyFileSha256, canonicalPolicyObjectSha256, specSha256 })),
    modelProviderWhereAiJudgmentUsed: input.modelProviderWhereAiJudgmentUsed || 'none-fixture-deterministic',
    evaluationTimestamp: now,
    evaluationTimeZone: 'America/Chicago',
    mode,
    sourceEvidenceMode: mode === 'fixture' ? 'FROZEN_SANITIZED_FIXTURE' : 'LIVE_READ_ONLY',
    sourceUrlsAndAccessTimestamps: candidates.flatMap((candidate) => (candidate.sourceReferences || []).map((source) => ({ ...source, accessSemantics: mode === 'fixture' ? 'FIXTURE_REFERENCE_NOT_LIVE_ACCESS_EVIDENCE' : 'LIVE_READ_ONLY_ACCESS_EVIDENCE' }))),
    productionHistorySnapshotTimestamp: mode === 'fixture' ? null : (input.productionHistorySnapshotTimestamp || null),
    queryCounts: input.queryCounts || { productionHistorySelects: 0, publicSourceFetches: 0 },
    rowCounts: input.rowCounts || { sourceEvidenceRows: candidates.length },
    evidenceSnapshotId: input.sourceSnapshotId || 'sanitized-frozen-nine-candidate-repeatability-fixture',
    evidenceSnapshotHash,
    expectedOutcomeHash,
    preflight,
    populationCounts: population,
    outputArtifactHashes: {},
    deviations,
    finalDecisions: population.finalDecisions,
    finalCandidateDecisions: decisions.map(({ candidateId, recommendation, reason, hardExclusions, ownerDecisionReasons }) => ({ candidateId, recommendation, reason, hardExclusions, ownerDecisionReasons })),
    postflight,
    outputSchemaValid: decisions.every((decision) => decision.transitionLog.length > 0),
    goldenReplayStatus: goldenManifestPath ? 'PENDING' : 'NOT_REQUESTED',
  };

  await writeText(path.join(outputDir, 'STARTLINESITES_CMO_LANE_A_REPEATABILITY_SOP.md'), renderSop({ policy, sourcePolicyFileSha256, canonicalPolicyObjectSha256, specSha256 }));
  await writeText(path.join(outputDir, 'startline-lane-a-sourcing-policy-v1.json'), policyRaw);
  await writeText(path.join(outputDir, 'STARTLINESITES_CMO_LANE_A_STATE_MACHINE.md'), renderStateMachine(policy));
  await writeText(path.join(outputDir, 'STARTLINESITES_CMO_LANE_A_DEVIATION_POLICY.md'), renderDeviationPolicy(policy));
  await writeText(path.join(outputDir, 'STARTLINESITES_CMO_LANE_A_OWNER_DECISION_LEDGER_TEMPLATE.md'), renderOwnerLedgerTemplate(policy));
  await writeJson(path.join(outputDir, 'source-evidence-validation.json'), { valid: decisions.every((decision) => !decision.schemaErrors.length), schemaErrors: decisions.flatMap((decision) => decision.schemaErrors.map((error) => ({ candidateId: decision.candidateId, error }))) });
  await writeJson(path.join(outputDir, 'rubric-scores.json'), decisions.map((decision) => ({ candidateId: decision.candidateId, websiteNeed: decision.websiteNeedScore, commercialCapacity: decision.commercialCapacityScore })));
  await writeJson(path.join(outputDir, 'sequential-waterfall.json'), { sequentialFilters: population.sequentialFilters, outcomeBranch: population.outcomeBranch, reconciles: population.reconciles });
  await writeJson(path.join(outputDir, 'owner-review-dossier.json'), decisions.filter((decision) => [FINAL_STATES.APPROVE, FINAL_STATES.NEEDS].includes(decision.recommendation)).map((decision) => ({ runId, policyId: policy.policyId, policyVersion: policy.version, candidateId: decision.candidateId, recommendation: decision.recommendation, evidenceCard: { websiteNeed: decision.websiteNeedScore, commercialCapacity: decision.commercialCapacityScore, ownerDecisionReasons: decision.ownerDecisionReasons }, authorizedNextStep: 'OWNER_REVIEW_REQUIRED' })));
  await writeJson(path.join(outputDir, 'deviation-register.json'), deviations);
  await writeJson(path.join(outputDir, 'candidate-decisions.json'), decisions);
  await writeJson(path.join(outputDir, 'postflight-no-side-effect-report.json'), postflight);
  await writeText(path.join(outputDir, 'STARTLINESITES_CMO_LANE_A_GOLDEN_FIXTURE_REPLAY_REPORT.md'), renderReplayReport({ runId, manifest: manifestBase, decisions, population, expectedOutcomeHash }));

  let goldenReplayStatus = manifestBase.goldenReplayStatus;
  if (goldenManifestPath) {
    const golden = await readJson(goldenManifestPath);
    const comparable = { finalDecisions: population.finalDecisions, candidateMapping: expectedOutcome.candidateMapping, noSideEffect: postflight };
    if (stableStringify(golden) !== stableStringify(comparable)) {
      throw new Error(`golden manifest replay mismatch\nexpected=${stableStringify(golden)}\nactual=${stableStringify(comparable)}`);
    }
    goldenReplayStatus = 'GO';
  }
  const hashesBeforeManifest = await artifactHashes(outputDir, { exclude: ['run-manifest.json', 'external-evidence-checksums.json'] });
  const manifest = { ...manifestBase, goldenReplayStatus, outputArtifactHashes: hashesBeforeManifest, finishedAt: new Date().toISOString() };
  await writeJson(path.join(outputDir, 'run-manifest.json'), manifest);
  await writeText(path.join(outputDir, 'STARTLINESITES_CMO_LANE_A_REPEATABILITY_CERTIFICATION_REPORT.md'), renderCertificationReport({ manifest, preflight, postflight, deviations }));
  manifest.outputArtifactHashes = await artifactHashes(outputDir, { exclude: ['run-manifest.json', 'external-evidence-checksums.json'] });
  await writeJson(path.join(outputDir, 'run-manifest.json'), manifest);
  const finalizedHashes = await artifactHashes(outputDir, { exclude: ['external-evidence-checksums.json'] });
  const policyFileVerification = {
    path: policyPath,
    sourcePolicyFileSha256,
    recomputedSourcePolicyFileSha256: sha256Text(policyRaw),
    matches: sourcePolicyFileSha256 === sha256Text(policyRaw),
  };
  await writeJson(path.join(outputDir, 'external-evidence-checksums.json'), {
    generatedAfterRunManifestFinalized: true,
    runManifestSha256: finalizedHashes['run-manifest.json'],
    artifactHashes: finalizedHashes,
    policyFileVerification,
  });
  return { outputDir, policy, sourcePolicyFileSha256, canonicalPolicyObjectSha256, manifest, decisions, population, postflight, deviations };
};

const main = async () => {
  const args = parseArgs();
  if (args.help) { console.log(USAGE); return; }
  const result = await runLaneA({
    policyPath: args.policy || DEFAULT_POLICY,
    runId: args['run-id'],
    mode: args.mode || 'fixture',
    inputPath: args.input,
    outputDir: args['output-dir'],
    goldenManifestPath: args['golden-manifest'],
    specSha256: args['spec-sha256'] || '',
  });
  console.log(stableStringify({ outputDir: result.outputDir, manifest: result.manifest }));
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
