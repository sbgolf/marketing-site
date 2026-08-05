#!/usr/bin/env node
import fs from 'node:fs/promises';

import { createSupabaseRestRequester } from './lib/mockup-generation-send-gate.mjs';
import {
  buildOutreachEngagementOwnerDigest,
  loadOutreachEngagementDigestData,
  validateOwnerDigestText,
} from './lib/outreach-engagement-owner-digest.mjs';

const USAGE = `Usage: node scripts/build-outreach-engagement-digest.mjs [options]

Builds a Telegram-ready owner digest from race_mockup_outreach engagement
aggregates and raw outreach_engagement_events. Review-only: it never sends
customer/race-director follow-ups and never writes to Supabase.

Options:
  --campaign-id <id>       Filter digest to one campaign/wave id
  --since <iso>            Include outreach sent at/after this timestamp
  --since-days <n>         Include outreach sent in the last n days
  --until <iso>            Include outreach sent at/before this timestamp
  --limit <n>              Max outreach rows to read, default 100
  --generated-at <iso>     Deterministic timestamp for reviews/tests
  --input <path>           Build from JSON fixture instead of Supabase
                           Shape: { "outreach": [...], "events": [...] }
  --output <path>          Write digest text to this path in addition to stdout
  --help                   Show this message

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY unless --input is used.`;

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

const readJsonInput = async (path) => {
  if (!path) return null;
  const content = path === '-' ? await new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  }) : await fs.readFile(path, 'utf8');
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Could not parse JSON input: ${error.message}`);
  }
};

const isoDaysAgo = (days, now = new Date()) => {
  const numeric = Number(days);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - numeric);
  return date.toISOString();
};

const main = async () => {
  const args = parseArgs();
  if (args.help) {
    console.log(USAGE);
    return;
  }

  const input = await readJsonInput(args.input);
  const since = args.since || isoDaysAgo(args['since-days']);
  const data = input || await loadOutreachEngagementDigestData({
    supabaseRequest: createSupabaseRestRequester(),
    campaignId: args['campaign-id'],
    since,
    until: args.until,
    limit: args.limit ? Number(args.limit) : undefined,
  });

  const digest = buildOutreachEngagementOwnerDigest(data.outreach || [], data.events || [], {
    campaignId: args['campaign-id'] || input?.campaign_id || input?.campaignId,
    generatedAt: args['generated-at'] || input?.generated_at || input?.generatedAt,
  });
  const validation = validateOwnerDigestText(digest);
  if (!validation.ok) {
    throw new Error(`Digest contains unsafe/surveillance wording or unmasked email exposure: ${validation.rejected_terms.join(', ')}`);
  }

  if (args.output) await fs.writeFile(args.output, `${digest}\n`);
  console.log(digest);
};

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
