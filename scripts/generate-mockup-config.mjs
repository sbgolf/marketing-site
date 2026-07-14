#!/usr/bin/env node
import fs from 'node:fs/promises';

import {
  buildCommunityMockupConfig,
  selectConfigCandidate,
} from './lib/mockup-prospect-config-generator.mjs';

const USAGE = `Usage:
  npm run generate:mockup-config -- --input discovery-output.json --candidate-index 2 --owner-approved --output /tmp/race-config.json

Builds a race-templates-compatible Community private mockup config from a scored prospect.
This is generation only: it does not write to Supabase, open a race-template PR, deploy, QA, or send outreach.

Required gate:
  --owner-approved      Steve approved this specific candidate for mockup generation.

Selectors:
  --candidate-index N   One-based candidate number from the discovery/digest output.
  --source-race-id ID   Select by RunSignup/source race id.

Options:
  --token HEX           32+ hex private route token; omit for a random 128-bit token.
  --slug SLUG           Override output config slug.
  --output PATH         Write JSON to a file. Defaults to stdout.
  --allow-needs-review  Allow non-qualified status after explicit owner approval.
`;

const parseArgs = (argv) => {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') parsed.input = argv[++i];
    else if (arg === '--output') parsed.output = argv[++i];
    else if (arg === '--candidate-index') parsed.candidateIndex = argv[++i];
    else if (arg === '--source-race-id') parsed.sourceRaceId = argv[++i];
    else if (arg === '--token') parsed.token = argv[++i];
    else if (arg === '--slug') parsed.slug = argv[++i];
    else if (arg === '--owner-approved') parsed.ownerApproved = true;
    else if (arg === '--allow-needs-review') parsed.allowNeedsReview = true;
    else if (arg === '--help' || arg === '-h') parsed.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return parsed;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }
  if (!args.input) throw new Error(`${USAGE}\nMissing required --input.`);

  const input = JSON.parse(await fs.readFile(args.input, 'utf8'));
  const candidate = selectConfigCandidate(input, args);
  const config = buildCommunityMockupConfig(candidate, args);
  const text = `${JSON.stringify(config, null, 2)}\n`;

  if (args.output) {
    await fs.writeFile(args.output, text);
    console.log(`Mockup config written: ${args.output}`);
    console.log(`Race: ${config.identity.name}`);
    console.log(`Route: ${config.private_mockup.route}`);
    console.log('Next: copy this config into race-templates, run validation/build/QA, then request Steve send approval separately.');
    return;
  }
  process.stdout.write(text);
};

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
