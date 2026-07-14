#!/usr/bin/env node
import {
  createSupabaseRestRequester,
  sendMockupOutreachFromGenerationJob,
} from './lib/mockup-generation-send-gate.mjs';

const USAGE = `Usage: node scripts/send-mockup-outreach-from-job.mjs --generation-job-id <uuid> --owner-approved-send [options]

Fetches an approved race_mockup_generation_jobs row from Supabase, fetches its prospect row, validates QA/Site Auditor/owner gates, checks duplicate outreach, sends through Resend, records race_mockup_outreach, and patches the generation job with outreach_id.

Required for any customer/race-director send:
  --owner-approved-send       Steve approved this specific race-director send.

Options:
  --dry-run                   Fetch and validate only; no email and no Supabase writes.
  --to <emails>               Override prospect contact emails.
  --cc <emails>
  --bcc <emails>
  --contact-name <name>
  --subject <subject>
  --detail <paragraph>
  --from <email>              Defaults to Steve <steve@startlinesites.com>.
  --reply-to <email>          Defaults to support@startlinesites.com.
  --owner <owner>

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Non-dry-run also requires RESEND_API_KEY or STARTLINE_RESEND_API_KEY.`;

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

const main = async () => {
  const args = parseArgs();
  if (args.help) {
    console.log(USAGE);
    return;
  }
  if (!args['generation-job-id']) throw new Error(`${USAGE}\nMissing required --generation-job-id.`);

  const result = await sendMockupOutreachFromGenerationJob({
    generationJobId: args['generation-job-id'],
    ownerApprovedSend: args['owner-approved-send'] === true,
    dryRun: args['dry-run'] === true,
    overrides: {
      toEmails: args.to,
      ccEmails: args.cc,
      bccEmails: args.bcc,
      contactName: args['contact-name'],
      subject: args.subject,
      detail: args.detail,
      fromEmail: args.from,
      replyToEmail: args['reply-to'],
      owner: args.owner,
    },
    supabaseRequest: createSupabaseRestRequester(),
  });

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = result.blocked ? 2 : 1;
};

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
