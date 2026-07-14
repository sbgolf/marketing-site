#!/usr/bin/env node
import fs from 'node:fs/promises';

import { buildPreparedMockupOutreach } from './lib/mockup-generation-outreach-handoff.mjs';

const USAGE = `Usage: node scripts/prepare-mockup-outreach-from-job.mjs --generation-job job.json --prospect prospect.json --to director@example.test --owner-approved-send --dry-run [options]

Prepares a branded race-director outreach payload from an approved race_mockup_generation_jobs row.
This is a handoff/check command: it does not send email, submit contact forms, write Supabase, or mark outreach complete.

Required gates:
  --owner-approved-send   Steve approved this specific race-director send.
  --dry-run               Required in this first pilot version.

Inputs:
  --generation-job PATH   JSON object shaped like a race_mockup_generation_jobs row.
  --prospect PATH         Optional JSON object shaped like a race_mockup_prospects row.

Overrides:
  --to <emails>           To recipients; otherwise uses prospect contact emails when present.
  --cc <emails>
  --bcc <emails>
  --contact-name <name>
  --subject <subject>
  --detail <paragraph>
  --owner <owner>
`;

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

const readJson = async (path, fallback = {}) => {
  if (!path) return fallback;
  return JSON.parse(await fs.readFile(path, 'utf8'));
};

const main = async () => {
  const args = parseArgs();
  if (args.help) {
    console.log(USAGE);
    return;
  }
  if (!args['generation-job']) throw new Error(`${USAGE}\nMissing required --generation-job.`);
  if (args['dry-run'] !== true) throw new Error(`${USAGE}\nThis first pilot version requires --dry-run and will not send or write.`);

  const generationJob = await readJson(args['generation-job']);
  const prospect = await readJson(args.prospect);
  const result = buildPreparedMockupOutreach({
    generationJob,
    prospect,
    ownerApprovedSend: args['owner-approved-send'] === true,
    overrides: {
      toEmails: args.to,
      ccEmails: args.cc,
      bccEmails: args.bcc,
      contactName: args['contact-name'],
      subject: args.subject,
      detail: args.detail,
      owner: args.owner,
    },
  });

  console.log(JSON.stringify({
    ...result,
    dry_run: true,
    side_effects: 'none: no email, no contact-form submit, no Supabase write, no outreach approval mutation',
  }, null, 2));

  if (!result.ok) process.exitCode = 2;
};

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
