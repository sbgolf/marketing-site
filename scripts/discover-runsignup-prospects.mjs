#!/usr/bin/env node
import fs from 'node:fs/promises';

import {
  fetchRunSignupRaces,
  scoreRunSignupDiscoveryResponse,
} from './lib/runsignup-prospect-discovery.mjs';

const USAGE = `Usage: node scripts/discover-runsignup-prospects.mjs --state <state> [options]

Discovers RunSignup races through the public races API, normalizes them into the
StartLine mockup prospect shape, and prints scored dry-run candidates. This CLI
never writes to Supabase; pipe reviewed output into upsert:mockup-prospect later.

Options:
  --state <state>              State abbreviation to search (recommended/required for focused discovery)
  --city <city>                Optional city filter
  --name <name>                Optional race-name search
  --start-date <yyyy-mm-dd>    Search races on/after this date
  --end-date <yyyy-mm-dd>      Search races on/before this date
  --page <n>                   API page, default 1
  --results-per-page <n>       API page size, default 25, max 1000 by RunSignup docs
  --limit <n>                  Candidates to print after scoring/sorting, default 5
  --min-score <n>              Filter output by total_score, default 0
  --now <iso timestamp>        Deterministic scoring clock for tests/reproducible reviews
  --output <path>              Also write prospect input JSON suitable for upsert:mockup-prospect
  --help                       Show this message`;

const parseArgs = (argv = process.argv.slice(2)) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const main = async () => {
  const args = parseArgs();
  if (args.help) {
    console.log(USAGE);
    return;
  }
  if (!args.state && !args.city && !args.name) {
    throw new Error(`Provide at least --state, --city, or --name so discovery stays focused.\n\n${USAGE}`);
  }

  const query = {
    state: args.state,
    city: args.city,
    name: args.name,
    startDate: args['start-date'],
    endDate: args['end-date'],
    page: toInt(args.page, 1),
    resultsPerPage: toInt(args['results-per-page'], 25),
  };
  const limit = toInt(args.limit, 5);
  const minScore = Number.isFinite(Number(args['min-score'])) ? Number(args['min-score']) : 0;

  const response = await fetchRunSignupRaces(query);
  const candidates = scoreRunSignupDiscoveryResponse(response, {
    now: args.now,
    query,
    discoveredFrom: 'RunSignup public races API discovery CLI',
  }).filter((candidate) => candidate.payload.total_score >= minScore).slice(0, limit);

  if (args.output) {
    await fs.writeFile(args.output, `${JSON.stringify(candidates.map((candidate) => candidate.input), null, 2)}\n`);
  }

  console.log(JSON.stringify({
    ok: true,
    dry_run: true,
    source: 'runsignup_public_races_api',
    query,
    discovered_count: Array.isArray(response.races) ? response.races.length : 0,
    returned_count: candidates.length,
    output_path: args.output || null,
    candidates: candidates.map(({ payload, lookup_filters }) => ({
      race_name: payload.race_name,
      race_city: payload.race_city,
      race_state: payload.race_state,
      event_date: payload.event_date,
      source_url: payload.source_url,
      source_race_id: payload.source_race_id,
      official_url: payload.official_url,
      distances: payload.extracted_facts.distances || [],
      total_score: payload.total_score,
      qualification_status: payload.qualification_status,
      qualification_reason: payload.qualification_reason,
      disqualifiers: payload.disqualifiers,
      lookup_filters,
    })),
  }, null, 2));
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
