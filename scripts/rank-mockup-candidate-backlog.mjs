#!/usr/bin/env node
import fs from 'node:fs/promises';

import { prioritizeMockupBacklog } from './lib/mockup-backlog-prioritization.mjs';

const USAGE = `Usage: node scripts/rank-mockup-candidate-backlog.mjs --input <path> [options]

Ranks broad discovery candidates into a template-agnostic StartLine backlog.
This command is review-only: it does not write to Supabase, generate mockups,
submit contact forms, or send outreach.

Options:
  --input <path>              JSON array, or object with candidates/prospects/results/data array
  --existing-prospects <path> Optional JSON array of existing race_mockup_prospects rows
  --existing-jobs <path>      Optional JSON array of existing race_mockup_generation_jobs rows
  --existing-outreach <path>  Optional JSON array of existing outreach rows
  --now <iso timestamp>       Deterministic scoring clock
  --limit <n>                 Limit rows per bucket in printed report, default 25
  --help                      Show this message`;

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

const readJsonFile = async (path, fallback = []) => {
  if (!path) return fallback;
  const value = JSON.parse(await fs.readFile(path, 'utf8'));
  if (Array.isArray(value)) return value;
  for (const key of ['candidates', 'prospects', 'results', 'data']) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return fallback;
};

const compactItem = (item) => ({
  race_name: item.raceName,
  location: [item.raceCity, item.raceState].filter(Boolean).join(', ') || null,
  event_date: item.eventDate,
  startline_value_score: item.startlineValueScore,
  primary_template_fit: item.primaryTemplateFit,
  secondary_template_fits: item.secondaryTemplateFits,
  recommended_lane: item.recommendedLane,
  template_readiness_status: item.templateReadinessStatus,
  contact_quality: item.contactQuality,
  duplicate_state: item.duplicateState,
  source_url: item.sourceUrl,
  official_url: item.officialUrl,
  why: item.reasons.slice(0, 4),
});

const main = async () => {
  const args = parseArgs();
  if (args.help) {
    console.log(USAGE);
    return;
  }
  if (!args.input) throw new Error(`--input is required.\n\n${USAGE}`);

  const candidates = await readJsonFile(args.input);
  const prospects = await readJsonFile(args['existing-prospects']);
  const jobs = await readJsonFile(args['existing-jobs']);
  const outreach = await readJsonFile(args['existing-outreach']);
  const limit = Number.isFinite(Number(args.limit)) ? Number(args.limit) : 25;

  const ranked = prioritizeMockupBacklog(candidates, {
    prospects,
    jobs,
    outreach,
    now: args.now,
  });

  const buckets = {};
  for (const [bucket, rows] of Object.entries(ranked.byBucket)) {
    buckets[bucket] = rows.slice(0, limit).map(compactItem);
  }

  console.log(JSON.stringify({
    ok: true,
    dry_run: true,
    input_count: candidates.length,
    counts: ranked.counts,
    buckets,
    note: 'Review-only ranking. No Supabase writes, mockup generation, contact-form submissions, or outreach sends were performed.',
  }, null, 2));
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
