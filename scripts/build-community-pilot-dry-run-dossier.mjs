#!/usr/bin/env node
import fs from 'node:fs/promises';
import { createSupabaseRestRequester } from './lib/mockup-generation-send-gate.mjs';
import { buildDossierMarkdown, buildOwnerReviewDossierItem } from './lib/community-pilot-governance.mjs';

const USAGE = `Usage: node scripts/build-community-pilot-dry-run-dossier.mjs [--input fixture.json] [--output file.md] [--limit 10]\n\nPreview-only Phase 2A-1 dossier generator. It reads data and writes only the requested local output file. It never sends email, submits contact forms, persists send approvals, applies migrations, or mutates Supabase.`;

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

export const createReadOnlyRequester = (requester = createSupabaseRestRequester()) => async ({ path, method = 'GET', ...rest } = {}) => {
  if (String(method || 'GET').toUpperCase() !== 'GET') throw new Error(`read-only dossier requester rejected ${method} mutation attempt`);
  return requester({ path, method: 'GET', ...rest });
};

const loadReadOnlySupabaseCandidates = async ({ limit = 10, requester } = {}) => {
  const request = createReadOnlyRequester(requester);
  const desiredIncludes = Math.max(1, Number(limit || 10));
  const maxRead = Math.max(desiredIncludes, Math.min(75, desiredIncludes * 8 || 75));
  const generationJobs = await request({ path: `race_mockup_generation_jobs?select=id,prospect_id,job_status,qa_status,site_auditor_status,owner_approval_status,mockup_url,template,source_bundle,metadata,updated_at&template=eq.community&qa_status=eq.passed&outreach_id=is.null&order=updated_at.desc&limit=${maxRead}` }).catch(() => []);
  const items = [];
  for (const job of generationJobs || []) {
    if (!job.prospect_id) continue;
    const prospects = await request({ path: `race_mockup_prospects?select=*&id=eq.${encodeURIComponent(job.prospect_id)}&limit=1` }).catch(() => []);
    const prospect = prospects?.[0];
    if (!prospect) continue;
    const priorByGenerationJob = await request({ path: `race_mockup_outreach?select=id&metadata->>generation_job_id=eq.${encodeURIComponent(job.id)}&limit=5` }).catch(() => []);
    const priorByProspect = await request({ path: `race_mockup_outreach?select=id&prospect_id=eq.${encodeURIComponent(job.prospect_id)}&limit=5` }).catch(() => []);
    const priorIds = new Map([...(priorByGenerationJob || []), ...(priorByProspect || [])].map((row) => [row.id, row]));
    const item = buildOwnerReviewDossierItem({ prospect, generationJob: job, priorOutreach: [...priorIds.values()] });
    items.push(item);
    if (items.filter((candidate) => candidate.final_dry_run_recommendation === 'INCLUDE').length >= desiredIncludes) break;
  }
  return items;
};

const main = async () => {
  const args = parseArgs();
  if (args.help) { console.log(USAGE); return; }
  const input = await readInput(args.input);
  const items = input ? (input.items || []).map((item) => buildOwnerReviewDossierItem(item)) : await loadReadOnlySupabaseCandidates({ limit: args.limit || 10 });
  const markdown = buildDossierMarkdown(items.slice(0, Number(args.limit || 10)), { source: input ? `fixture ${args.input}` : 'read-only production Supabase candidate scan' });
  if (args.output) await fs.writeFile(args.output, markdown);
  console.log(markdown);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { console.error(error?.message || error); process.exit(1); });
}
