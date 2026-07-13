#!/usr/bin/env node
import {
  buildDuplicateFilters,
  buildMockupOutreachPayload,
  clean,
  validateMockupOutreachInput,
} from './lib/mockup-outreach-log.mjs';

const USAGE = `Usage: node scripts/record-mockup-outreach.mjs --race-name <name> --mockup-url <url> --mockup-template <template> --to <email[,email]> [options]

Options:
  --official-url <url>
  --registration-url <url>
  --registration-platform <name>
  --registration-race-id <id>
  --city <city>
  --state <state>
  --subject <subject>
  --from <email>
  --reply-to <email>
  --cc <email[,email]>
  --bcc <email[,email]>
  --resend-email-id <id>
  --sent-at <iso timestamp>
  --mockup-verified-at <iso timestamp>
  --notes <notes>
  --owner <owner>
  --dry-run

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY unless --dry-run is used.`;

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
      ...(method === 'POST' ? { prefer: 'return=representation' } : {}),
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

const findDuplicates = async (payload) => {
  const filters = buildDuplicateFilters(payload);
  const select = 'id,race_name,mockup_url,mockup_template,outreach_status,sent_at,to_emails,cc_emails,resend_email_id';
  const seen = new Map();

  for (const filter of filters) {
    const rows = await supabaseRequest({
      path: `race_mockup_outreach?select=${encodeURIComponent(select)}&${filter}&limit=10`,
    });
    for (const row of rows || []) seen.set(row.id, row);
  }

  return [...seen.values()];
};

const main = async () => {
  const args = parseArgs();
  if (args.help) {
    console.log(USAGE);
    return;
  }

  const input = {
    raceName: args['race-name'],
    raceCity: args.city,
    raceState: args.state,
    officialUrl: args['official-url'],
    registrationUrl: args['registration-url'],
    registrationPlatform: args['registration-platform'],
    registrationRaceId: args['registration-race-id'],
    mockupUrl: args['mockup-url'],
    mockupTemplate: args['mockup-template'],
    mockupVerifiedAt: args['mockup-verified-at'],
    subject: args.subject,
    resendEmailId: args['resend-email-id'],
    fromEmail: args.from,
    replyToEmail: args['reply-to'],
    toEmails: args.to,
    ccEmails: args.cc,
    bccEmails: args.bcc,
    sentAt: args['sent-at'],
    notes: args.notes,
    owner: args.owner,
  };

  const errors = validateMockupOutreachInput(input);
  if (errors.length) {
    throw new Error(`${errors.join(' ')}\n\n${USAGE}`);
  }

  const payload = buildMockupOutreachPayload(input);
  const dryRun = args['dry-run'] === true;

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dry_run: true, payload, duplicate_filters: buildDuplicateFilters(payload) }, null, 2));
    return;
  }

  const duplicates = await findDuplicates(payload);
  if (duplicates.length) {
    console.log(JSON.stringify({ ok: false, blocked: true, reason: 'prior_mockup_outreach_found', duplicates }, null, 2));
    process.exitCode = 2;
    return;
  }

  const rows = await supabaseRequest({
    path: 'race_mockup_outreach',
    method: 'POST',
    body: payload,
  });

  const row = rows?.[0];
  console.log(JSON.stringify({
    ok: true,
    id: row?.id,
    race_name: row?.race_name,
    mockup_url: row?.mockup_url,
    mockup_template: row?.mockup_template,
    sent_at: row?.sent_at,
    resend_email_id: clean(row?.resend_email_id, 200) || null,
  }, null, 2));
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
