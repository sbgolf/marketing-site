#!/usr/bin/env node
import fs from 'node:fs/promises';

import {
  buildGenerationJobInputFromConfig,
  buildGenerationJobLookupFilters,
  buildGenerationJobPayload,
  validateGenerationJobInput,
} from './lib/mockup-generation-job.mjs';

const USAGE = `Usage: node scripts/record-mockup-generation-job.mjs --input <config.json> --prospect-id <uuid> --mockup-base-url https://mockups.startlinesites.com [options]

Records or updates a race_mockup_generation_jobs row after an owner-approved
mockup config has been generated. This does not create a race-template PR,
run QA, send outreach, or approve customer delivery.

Options:
  --config-path <path>          Path where the config will live in race-templates
  --mockup-url <url>            Production/private mockup URL; overrides --mockup-base-url + config route
  --branch-name <name>
  --pull-request-url <url>
  --deploy-preview-url <url>
  --job-status <status>         Default: config_generated
  --qa-status <status>          Default: not_started
  --site-auditor-status <status> Default: not_requested
  --owner-approval-status <status>
  --owner-approved-at <iso timestamp>
  --owner-decision-notes <notes>
  --dry-run

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY unless --dry-run is used.`;

const parseArgs = (argv = process.argv.slice(2)) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) args[key] = true;
      else {
        args[key] = next;
        index += 1;
      }
    }
  }
  return args;
};

const supabaseRequest = async ({ path, method = 'GET', body }) => {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
      ...(method === 'POST' || method === 'PATCH' ? { prefer: 'return=representation' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase ${method} ${path} failed: ${response.status} ${detail}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const findExistingJob = async (payload) => {
  const select = 'id,prospect_id,job_status,template,mockup_url,mockup_token,config_path,pull_request_url,deploy_preview_url,qa_status,site_auditor_status,owner_approval_status';
  const seen = new Map();
  for (const filter of buildGenerationJobLookupFilters(payload)) {
    const rows = await supabaseRequest({
      path: `race_mockup_generation_jobs?select=${encodeURIComponent(select)}&${filter}&limit=10`,
    });
    for (const row of rows || []) seen.set(row.id, row);
  }
  return [...seen.values()][0] || null;
};

const upsertGenerationJob = async (payload) => {
  const existing = await findExistingJob(payload);
  if (existing) {
    const rows = await supabaseRequest({
      path: `race_mockup_generation_jobs?id=eq.${encodeURIComponent(existing.id)}`,
      method: 'PATCH',
      body: payload,
    });
    return { action: 'updated', row: rows?.[0] || existing };
  }
  const rows = await supabaseRequest({
    path: 'race_mockup_generation_jobs',
    method: 'POST',
    body: payload,
  });
  return { action: 'created', row: rows?.[0] || null };
};

const patchProspect = async (payload, row) => {
  await supabaseRequest({
    path: `race_mockup_prospects?id=eq.${encodeURIComponent(payload.prospect_id)}`,
    method: 'PATCH',
    body: {
      qualification_status: 'mockup_generated',
      metadata: {
        mockup_generation_job_id: row?.id || null,
        mockup_url: payload.mockup_url,
        mockup_token: payload.mockup_token,
        config_path: payload.config_path,
        generation_job_recorded_at: new Date().toISOString(),
      },
    },
  });
};

const main = async () => {
  const args = parseArgs();
  if (args.help) {
    console.log(USAGE);
    return;
  }
  if (!args.input) throw new Error(`${USAGE}\nMissing required --input.`);

  const config = JSON.parse(await fs.readFile(args.input, 'utf8'));
  const input = buildGenerationJobInputFromConfig(config, {
    prospectId: args['prospect-id'],
    configPath: args['config-path'],
    mockupUrl: args['mockup-url'],
    mockupBaseUrl: args['mockup-base-url'] || process.env.STARTLINE_PRIVATE_MOCKUP_BASE_URL,
    branchName: args['branch-name'],
    pullRequestUrl: args['pull-request-url'],
    deployPreviewUrl: args['deploy-preview-url'],
    jobStatus: args['job-status'],
    qaStatus: args['qa-status'],
    siteAuditorStatus: args['site-auditor-status'],
    ownerApprovalStatus: args['owner-approval-status'],
    ownerApprovedAt: args['owner-approved-at'],
    ownerDecisionNotes: args['owner-decision-notes'],
  });
  const errors = validateGenerationJobInput(input);
  if (errors.length) throw new Error(`${errors.join(' ')}\n\n${USAGE}`);

  const payload = buildGenerationJobPayload(input);
  const dryRun = args['dry-run'] === true;
  if (dryRun) {
    console.log(JSON.stringify({
      ok: true,
      dry_run: true,
      payload,
      lookup_filters: buildGenerationJobLookupFilters(payload),
      note: 'No Supabase writes, no QA, no outreach send, and no customer approval performed.',
    }, null, 2));
    return;
  }

  const result = await upsertGenerationJob(payload);
  await patchProspect(payload, result.row);
  console.log(JSON.stringify({
    ok: true,
    action: result.action,
    id: result.row?.id,
    prospect_id: result.row?.prospect_id || payload.prospect_id,
    job_status: result.row?.job_status || payload.job_status,
    template: result.row?.template || payload.template,
    mockup_url: result.row?.mockup_url || payload.mockup_url,
    config_path: result.row?.config_path || payload.config_path,
    owner_approval_status: result.row?.owner_approval_status || payload.owner_approval_status,
    next: 'Create/update the race-templates PR, run QA/Site Auditor, then request separate Steve send approval before outreach.',
  }, null, 2));
};

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
