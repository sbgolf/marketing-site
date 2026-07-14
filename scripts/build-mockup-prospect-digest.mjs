#!/usr/bin/env node
import fs from 'node:fs/promises';

import {
  buildMockupProspectApprovalDigest,
  validateDigestText,
} from './lib/mockup-prospect-approval-digest.mjs';

const USAGE = `Usage: node scripts/build-mockup-prospect-digest.mjs --input <discovery-output.json> [options]

Builds a Telegram-ready owner approval digest from scored mockup prospect
candidates. This is review-only: it never writes to Supabase, generates mockups,
or sends race-director outreach.

Options:
  --input <path>           JSON from discover:runsignup-prospects, or an array of candidates
  --output <path>          Write digest text to this path in addition to stdout
  --limit <n>              Max candidates to include, default 5
  --generated-at <iso>     Deterministic timestamp for tests/reviews
  --help                   Show this message`;

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

const readJsonInput = async (path) => {
  if (!path) throw new Error(`Provide --input so the digest is based on explicit reviewed discovery output.\n\n${USAGE}`);
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

const main = async () => {
  const args = parseArgs();
  if (args.help) {
    console.log(USAGE);
    return;
  }

  const input = await readJsonInput(args.input);
  const digest = buildMockupProspectApprovalDigest(input, {
    limit: args.limit ? Number(args.limit) : undefined,
    generatedAt: args['generated-at'],
  });
  const validation = validateDigestText(digest);
  if (!validation.ok) {
    throw new Error(`Digest contains rejected customer/outreach wording: ${validation.rejected_terms.join(', ')}`);
  }

  if (args.output) await fs.writeFile(args.output, `${digest}\n`);
  console.log(digest);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
