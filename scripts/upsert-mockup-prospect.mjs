#!/usr/bin/env node
import fs from 'node:fs/promises';

import {
  buildProspectLookupFilters,
  buildRaceMockupProspectPayload,
  validateRaceMockupProspectInput,
} from './lib/mockup-prospect-upsert.mjs';

const USAGE = `Usage: node scripts/upsert-mockup-prospect.mjs [options]

Input options:
  --input <path>              JSON file containing one prospect object or an array of prospects
  --json '<json>'             Inline JSON prospect object or array

Single-prospect convenience fields:
  --race-name <name>
  --source-url <url>
  --source-race-id <id>
  --registration-url <url>
  --registration-race-id <id>
  --official-url <url>
  --city <city>
  --state <state>
  --region <region>
  --event-date <yyyy-mm-dd>
  --distance <value>          Repeatable or comma-separated
  --description <text>
  --contact-form <url>
  --contact-email <email>
  --discovered-from <text>

Other options:
  --dry-run                   Print scored payload and lookup filters without writing
  --now <iso timestamp>       Deterministic scoring clock for tests/reproducible reviews

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY unless --dry-run is used.`;

const parseArgs = (argv = process.argv.slice(2)) => {
  const args = { distance: [], 'contact-form': [], 'contact-email': [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else if (['distance', 'contact-form', 'contact-email'].includes(key)) {
      args[key].push(next);
      index += 1;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
};

const readJsonInput = async (args) => {
  if (args.input) return JSON.parse(await fs.readFile(args.input, 'utf8'));
  if (args.json) return JSON.parse(args.json);

  const contactSources = [
    ...args['contact-form'].map((url) => ({ type: 'form', url })),
    ...args['contact-email'].map((value) => ({ type: 'email', value })),
  ];

  return {
    raceName: args['race-name'],
    sourceUrl: args['source-url'] || args['registration-url'],
    sourceRaceId: args['source-race-id'],
    registrationUrl: args['registration-url'] || args['source-url'],
    registrationRaceId: args['registration-race-id'] || args['source-race-id'],
    officialUrl: args['official-url'],
    raceCity: args.city,
    raceState: args.state,
    region: args.region,
    eventDate: args['event-date'],
    distances: args.distance,
    description: args.description,
    contactSources,
    discoveredFrom: args['discovered-from'],
    sourceCoverage: {
      date: Boolean(args['event-date']),
      location: Boolean(args.city || args.state),
      distances: args.distance.length > 0,
      registration: Boolean(args['registration-url'] || args['source-url']),
      contact: contactSources.length > 0,
    },
  };
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

const findExistingProspect = async (payload) => {
  const select = 'id,race_name,source_platform,source_race_id,registration_platform,registration_race_id,qualification_status,total_score';
  for (const filter of buildProspectLookupFilters(payload)) {
    const rows = await supabaseRequest({
      path: `race_mockup_prospects?select=${encodeURIComponent(select)}&${filter}&limit=1`,
    });
    if (rows?.[0]) return rows[0];
  }
  return null;
};

const upsertProspect = async (payload) => {
  const existing = await findExistingProspect(payload);
  if (existing?.id) {
    const rows = await supabaseRequest({
      path: `race_mockup_prospects?id=eq.${encodeURIComponent(existing.id)}`,
      method: 'PATCH',
      body: payload,
    });
    return { action: 'updated', row: rows?.[0] || null, previous: existing };
  }

  const rows = await supabaseRequest({
    path: 'race_mockup_prospects',
    method: 'POST',
    body: payload,
  });
  return { action: 'inserted', row: rows?.[0] || null };
};

const main = async () => {
  const args = parseArgs();
  if (args.help) {
    console.log(USAGE);
    return;
  }

  const rawInput = await readJsonInput(args);
  const prospects = Array.isArray(rawInput) ? rawInput : [rawInput];
  const results = [];

  for (const prospect of prospects) {
    const errors = validateRaceMockupProspectInput(prospect);
    if (errors.length) throw new Error(`${errors.join(' ')}\n\n${USAGE}`);

    const payload = buildRaceMockupProspectPayload(prospect, {
      now: args.now,
      upsertSource: args.input ? args.input : 'scripts/upsert-mockup-prospect.mjs',
    });

    if (args['dry-run'] === true) {
      results.push({
        ok: true,
        dry_run: true,
        payload,
        lookup_filters: buildProspectLookupFilters(payload),
      });
      continue;
    }

    const result = await upsertProspect(payload);
    results.push({
      ok: true,
      action: result.action,
      id: result.row?.id || null,
      race_name: result.row?.race_name || payload.race_name,
      total_score: result.row?.total_score ?? payload.total_score,
      qualification_status: result.row?.qualification_status || payload.qualification_status,
      owner_approval_status: result.row?.owner_approval_status || payload.owner_approval_status,
    });
  }

  console.log(JSON.stringify({ ok: true, count: results.length, results }, null, 2));
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
