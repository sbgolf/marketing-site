#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  FINAL_STATES,
  POLICY_VERSION,
  REQUIRED_CANDIDATE_NUMBERS,
  buildDecisionLedger,
  buildRunManifest,
  independentFilterCounts,
  renderMarkdownTable,
  sequentialWaterfall,
  stableStringify,
  validateInput,
} from './lib/phase2a1b-source-cohort-validation-policy.mjs';

const USAGE = `Usage: node scripts/phase2a1b-source-cohort-validation-runner.mjs --input candidates.json --output-dir artifacts/phase2a1b [--owner-ledger ledger.json] [--golden-manifest fixture.json]\n\nDeterministic one-time Phase 2A-1B source-cohort validation runner. It reads local evidence, writes only local evidence-package artifacts, and certifies no prospect writes, mockups, outreach, form submissions, cron creation, or production mutation.`;

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

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const hashText = (text) => crypto.createHash('sha256').update(text).digest('hex');
const writeJson = async (file, value) => fs.writeFile(file, `${stableStringify(value)}\n`);
const ensureDir = async (dir) => fs.mkdir(dir, { recursive: true });

const candidateSummaryRows = (ledger) => ledger.map((row) => ({
  Candidate: row.candidateNumber,
  Race: row.raceName,
  Final: row.final.finalState,
  Reason: row.final.reason,
  Blockers: row.final.blockers.join('; ') || 'none',
  'Owner decisions': row.final.ownerDecisions.join('; ') || 'none',
}));

const renderValidationReport = ({ manifest, ledger, inputHash }) => {
  const counts = manifest.finalDecisions;
  return [
    '# StartLineSites CMO Phase 2A-1B Source Cohort Validation Report',
    '',
    `Policy version: \`${POLICY_VERSION}\``,
    `Input SHA-256: \`${inputHash}\``,
    `Generated: ${manifest.finishedAt}`,
    '',
    '## Final decisions',
    '',
    `- SAMPLED LANE A SUPPLY — ${manifest.sampledLaneASupply}`,
    `- SOURCE COHORT VALIDATION — ${manifest.sourceCohortValidation}`,
    `- APPROVE_FOR_ASSET_PREPARATION — ${counts[FINAL_STATES.APPROVE]}`,
    `- NEEDS_STEVE_DECISION — ${counts[FINAL_STATES.NEEDS]}`,
    `- EXCLUDE — ${counts[FINAL_STATES.EXCLUDE]}`,
    '- PHASE 2A-1C — NOT AUTHORIZED',
    '- PHASE 2A-2 — NOT AUTHORIZED',
    '',
    '## Bounded cohort decision table',
    '',
    renderMarkdownTable(['Candidate', 'Race', 'Final', 'Reason', 'Blockers', 'Owner decisions'], candidateSummaryRows(ledger)),
    '',
    '## No-side-effect certification',
    '',
    '- No production writes were performed by this runner.',
    '- No prospects were written to production.',
    '- No mockups were created.',
    '- No race directors were contacted.',
    '- No contact forms were submitted.',
    '- No cron jobs were created or activated.',
    '- A recurring sourcing cron was not created.',
    '',
  ].join('\n');
};

const renderOwnerCohort = (ledger) => {
  const rows = ledger
    .filter((row) => [FINAL_STATES.APPROVE, FINAL_STATES.NEEDS].includes(row.final.finalState))
    .map((row) => ({
      Candidate: row.candidateNumber,
      Race: row.raceName,
      Final: row.final.finalState,
      'Decision point': row.final.ownerDecisions.join('; ') || 'none',
      Sources: row.sourceUrls.join('; '),
    }));
  return [
    '# StartLineSites CMO Phase 2A-1B Final Owner Source Cohort',
    '',
    'Contains only APPROVE_FOR_ASSET_PREPARATION and NEEDS_STEVE_DECISION records. No email copy or mockups are included.',
    '',
    rows.length ? renderMarkdownTable(['Candidate', 'Race', 'Final', 'Decision point', 'Sources'], rows) : '_No candidates remain for owner review after deterministic validation._',
    '',
  ].join('\n');
};

const renderReclassificationTable = (ledger) => [
  '# StartLineSites CMO Phase 2A-1B Candidate Reclassification Table',
  '',
  renderMarkdownTable(['Candidate', 'Race', 'Final', 'Reason', 'Blockers', 'Owner decisions'], candidateSummaryRows(ledger)),
  '',
].join('\n');

const renderWaterfall = ({ independentCounts, sequentialRows }) => [
  '# StartLineSites CMO Phase 2A-1B Corrected Yield Waterfall',
  '',
  '## A. Independent filter counts',
  '',
  renderMarkdownTable(['stage', 'passCount', 'denominator'], independentCounts),
  '',
  '## B. True sequential waterfall',
  '',
  renderMarkdownTable(['stage', 'before', 'excluded', 'remaining'], sequentialRows),
  '',
].join('\n');

const renderHistory = (ledger) => {
  const rows = ledger.flatMap((row) => {
    const candidateMatches = row.final ? [] : [];
    return (row.historyMatches || candidateMatches);
  });
  const historyRows = ledger.flatMap((row) => {
    const sourceLedger = row;
    return (sourceLedger.historyMatches || []).map((match) => ({ Candidate: row.candidateNumber, Race: row.raceName, Source: match.source, 'Record ID': match.recordId, 'Stable key': match.stableKey, Classification: match.classification, Implication: match.implication || row.final.finalState }));
  });
  return [
    '# StartLineSites CMO Phase 2A-1B History Match Reconciliation',
    '',
    'No hardcoded row-ID exception is permitted. Each listed match must carry source, record ID, stable key, classification, and final implication.',
    '',
    historyRows.length ? renderMarkdownTable(['Candidate', 'Race', 'Source', 'Record ID', 'Stable key', 'Classification', 'Implication'], historyRows) : '_No history matches were included in the deterministic input._',
    '',
    rows.length ? '' : '',
  ].join('\n');
};

const renderSourceManifest = ({ ledger, manifest }) => [
  '# StartLineSites CMO Phase 2A-1B URL / Source Manifest',
  '',
  `Policy version: ${POLICY_VERSION}`,
  `Generated: ${manifest.finishedAt}`,
  '',
  renderMarkdownTable(['Candidate', 'Race', 'Sources', 'Evidence hashes'], ledger.map((row) => ({
    Candidate: row.candidateNumber,
    Race: row.raceName,
    Sources: row.sourceUrls.join('; '),
    'Evidence hashes': row.evidenceHashes.join('; '),
  }))),
  '',
].join('\n');

const appendOwnerLedger = async ({ ownerLedgerPath, manifest, ledger }) => {
  if (!ownerLedgerPath) return null;
  let existing = [];
  try {
    existing = JSON.parse(await fs.readFile(ownerLedgerPath, 'utf8'));
    if (!Array.isArray(existing)) throw new Error('ledger root is not an array');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const entry = { recordedAt: manifest.finishedAt, policyVersion: POLICY_VERSION, finalDecisions: manifest.finalDecisions, sampledLaneASupply: manifest.sampledLaneASupply, sourceCohortValidation: manifest.sourceCohortValidation, boundedCandidateDecisions: ledger.map((row) => ({ candidateNumber: row.candidateNumber, raceName: row.raceName, finalState: row.final.finalState, reason: row.final.reason })) };
  existing.push(entry);
  await ensureDir(path.dirname(ownerLedgerPath));
  await writeJson(ownerLedgerPath, existing);
  return ownerLedgerPath;
};

export const runValidation = async ({ inputPath, outputDir, ownerLedgerPath, command = process.argv.join(' ') }) => {
  if (!inputPath || !outputDir) throw new Error('required --input and --output-dir');
  const startedAt = new Date().toISOString();
  const raw = await fs.readFile(inputPath, 'utf8');
  const inputHash = hashText(raw);
  const input = JSON.parse(raw);
  const inputErrors = validateInput(input);
  if (inputErrors.length) {
    const error = new Error(`input failed closed:\n- ${inputErrors.join('\n- ')}`);
    error.inputErrors = inputErrors;
    throw error;
  }
  await ensureDir(outputDir);
  const allCandidates = input.candidates.slice().sort((a, b) => a.candidateNumber - b.candidateNumber);
  const boundedCandidates = allCandidates.filter((c) => REQUIRED_CANDIDATE_NUMBERS.includes(c.candidateNumber));
  const ledger = buildDecisionLedger(boundedCandidates);
  for (const row of ledger) {
    const original = boundedCandidates.find((c) => c.candidateNumber === row.candidateNumber);
    row.historyMatches = original.historyMatches || [];
  }
  const independentCounts = independentFilterCounts(allCandidates);
  const sequentialRows = sequentialWaterfall(allCandidates);
  const manifestDraft = buildRunManifest({ input, inputHash, startedAt, finishedAt: new Date().toISOString(), command });
  const outputs = new Map([
    ['STARTLINESITES_CMO_PHASE2A1B_SOURCE_COHORT_VALIDATION_REPORT.md', renderValidationReport({ manifest: manifestDraft, ledger, inputHash })],
    ['STARTLINESITES_CMO_PHASE2A1B_FINAL_OWNER_SOURCE_COHORT.md', renderOwnerCohort(ledger)],
    ['STARTLINESITES_CMO_PHASE2A1B_CANDIDATE_RECLASSIFICATION_TABLE.md', renderReclassificationTable(ledger)],
    ['STARTLINESITES_CMO_PHASE2A1B_CORRECTED_YIELD_WATERFALL.md', renderWaterfall({ independentCounts, sequentialRows })],
    ['STARTLINESITES_CMO_PHASE2A1B_HISTORY_MATCH_RECONCILIATION.md', renderHistory(ledger)],
    ['STARTLINESITES_CMO_PHASE2A1B_SOURCE_URL_MANIFEST.md', renderSourceManifest({ ledger, manifest: manifestDraft })],
    ['STARTLINESITES_CMO_PHASE2A1B_OWNER_DECISION_LEDGER.json', stableStringify(ledger)],
    ['STARTLINESITES_CMO_PHASE2A1B_NO_SIDE_EFFECT_CERTIFICATION.json', stableStringify(manifestDraft.noSideEffectCertification)],
  ]);
  const outputFiles = [];
  for (const [name, content] of outputs.entries()) {
    const file = path.join(outputDir, name);
    await fs.writeFile(file, content.endsWith('\n') ? content : `${content}\n`);
    outputFiles.push(name);
  }
  const ledgerPath = await appendOwnerLedger({ ownerLedgerPath, manifest: manifestDraft, ledger });
  if (ledgerPath) outputFiles.push(path.relative(outputDir, ledgerPath));
  const manifest = buildRunManifest({ input, inputHash, outputFiles, startedAt, finishedAt: new Date().toISOString(), command });
  await writeJson(path.join(outputDir, 'STARTLINESITES_CMO_PHASE2A1B_RUN_MANIFEST.json'), manifest);
  return { manifest, outputDir, outputFiles: [...outputFiles, 'STARTLINESITES_CMO_PHASE2A1B_RUN_MANIFEST.json'], ledger, independentCounts, sequentialRows };
};

const main = async () => {
  const args = parseArgs();
  if (args.help) { console.log(USAGE); return; }
  const result = await runValidation({ inputPath: args.input, outputDir: args['output-dir'], ownerLedgerPath: args['owner-ledger'] });
  if (args['golden-manifest']) {
    const golden = await readJson(args['golden-manifest']);
    const comparable = {
      finalDecisions: result.manifest.finalDecisions,
      sampledLaneASupply: result.manifest.sampledLaneASupply,
      sourceCohortValidation: result.manifest.sourceCohortValidation,
      noSideEffectCertification: result.manifest.noSideEffectCertification,
    };
    if (stableStringify(comparable) !== stableStringify(golden)) {
      throw new Error(`golden manifest replay mismatch\nexpected=${stableStringify(golden)}\nactual=${stableStringify(comparable)}`);
    }
  }
  console.log(stableStringify({ outputDir: result.outputDir, manifest: result.manifest }));
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
