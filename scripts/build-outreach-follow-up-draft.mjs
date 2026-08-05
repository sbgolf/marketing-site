#!/usr/bin/env node
import fs from 'node:fs/promises';

import {
  buildOutreachFollowUpDraft,
  buildOutreachFollowUpDraftFromRow,
  formatOutreachFollowUpDraftForOwner,
  validateOutreachFollowUpDraft,
} from './lib/outreach-follow-up-drafts.mjs';

const USAGE = `Usage: node scripts/build-outreach-follow-up-draft.mjs [options]

Builds a Steve-review-only StartLine customer follow-up draft. This command never sends email, submits contact forms, writes Supabase, or mutates outreach state.

Inputs:
  --input <path>                JSON row or direct input object. Use - for stdin.
  --scenario <name>             clicked, opened, delivered, final_close, or suppressed
  --race-name <name>
  --contact-name <name>
  --mockup-url <url>
  --race-context <sentence>
  --recommended-package <tier>
  --package-reason <sentence>

Output:
  --json                        Print JSON instead of owner-review text
  --output <path>               Write output to a file in addition to stdout
  --help                        Show this message`;

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

const directInputFromArgs = (args = {}) => ({
  scenario: args.scenario,
  raceName: args['race-name'],
  contactName: args['contact-name'],
  mockupUrl: args['mockup-url'],
  raceContext: args['race-context'],
  recommendedPackage: args['recommended-package'],
  packageReason: args['package-reason'],
});

const hasDirectInput = (args = {}) => [
  'scenario',
  'race-name',
  'contact-name',
  'mockup-url',
  'race-context',
  'recommended-package',
  'package-reason',
].some((key) => args[key]);

const outputDraft = (draft, { json = false } = {}) => {
  if (json) return JSON.stringify({
    ...draft,
    dry_run: true,
    side_effects: 'none: no email, no contact-form submit, no Supabase write, no outreach approval mutation',
  }, null, 2);
  return `${formatOutreachFollowUpDraftForOwner(draft)}\n\nDry run side effects: none: no email, no contact-form submit, no Supabase write, no outreach approval mutation`;
};

const main = async () => {
  const args = parseArgs();
  if (args.help) {
    console.log(USAGE);
    return;
  }

  const input = await readJsonInput(args.input);
  const overrides = directInputFromArgs(args);
  const draft = input
    ? buildOutreachFollowUpDraftFromRow(input, overrides)
    : buildOutreachFollowUpDraft(hasDirectInput(args) ? overrides : { scenario: 'delivered' });

  const validation = validateOutreachFollowUpDraft(draft);
  if (!validation.ok) throw new Error(`Follow-up draft failed customer-facing guardrails: ${validation.issues.join('; ')}`);

  const rendered = outputDraft({ ...draft, validation }, { json: args.json === true });
  if (args.output) await fs.writeFile(args.output, `${rendered}\n`);
  console.log(rendered);
};

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
