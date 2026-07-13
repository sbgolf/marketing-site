#!/usr/bin/env node
import { buildDuplicateFilters, buildMockupOutreachPayload } from './lib/mockup-outreach-log.mjs';
import {
  DEFAULT_MOCKUP_OUTREACH_FROM,
  DEFAULT_MOCKUP_OUTREACH_REPLY_TO,
  assertBrandedMockupOutreachHtml,
  buildResendMockupOutreachPayload,
  renderPrivateMockupOutreachEmail,
  validateMockupOutreachSend,
} from './lib/mockup-outreach-send-gate.mjs';

const USAGE = `Usage: node scripts/send-mockup-outreach.mjs --race-name <name> --mockup-url <url> --mockup-template <template> --to <email[,email]> --subject <subject> [options]

Options mirror record:mockup-outreach and add:
  --contact-name <name>
  --detail <customer-facing paragraph>
  --dry-run

The gate checks for prior mockup outreach, renders the branded StartLine email, sends through Resend, then records race_mockup_outreach.`;

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

const findDuplicates = async (payload) => {
  const select = 'id,race_name,mockup_url,mockup_template,outreach_status,sent_at,to_emails,cc_emails,resend_email_id';
  const seen = new Map();
  for (const filter of buildDuplicateFilters(payload)) {
    const rows = await supabaseRequest({
      path: `race_mockup_outreach?select=${encodeURIComponent(select)}&${filter}&limit=10`,
    });
    for (const row of rows || []) seen.set(row.id, row);
  }
  return [...seen.values()];
};

const sendWithResend = async ({ to, cc, bcc, subject, text, html, from, replyTo }) => {
  const apiKey = process.env.RESEND_API_KEY || process.env.STARTLINE_RESEND_API_KEY;
  const payload = buildResendMockupOutreachPayload({ apiKey, from, replyTo, to, cc, bcc, subject, text, html });
  const response = await fetch(payload.endpoint, {
    method: 'POST',
    headers: payload.headers,
    body: JSON.stringify(payload.body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend send failed: ${response.status} ${detail}`);
  }

  return response.json();
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
    fromEmail: args.from || DEFAULT_MOCKUP_OUTREACH_FROM,
    replyToEmail: args['reply-to'] || DEFAULT_MOCKUP_OUTREACH_REPLY_TO,
    toEmails: args.to,
    ccEmails: args.cc,
    bccEmails: args.bcc,
    notes: args.notes,
    owner: args.owner,
    detail: args.detail,
  };

  const errors = validateMockupOutreachSend(input);
  if (errors.length) throw new Error(`${errors.join(' ')}\n\n${USAGE}`);

  const email = renderPrivateMockupOutreachEmail({
    raceName: input.raceName,
    contactName: args['contact-name'],
    mockupUrl: input.mockupUrl,
    subject: input.subject,
    detail: input.detail,
  });
  const htmlErrors = assertBrandedMockupOutreachHtml({ html: email.html, mockupUrl: input.mockupUrl });
  if (htmlErrors.length) throw new Error(`Branded email validation failed: ${htmlErrors.join(' ')}`);

  const payload = buildMockupOutreachPayload({ ...input, subject: email.subject });
  const dryRun = args['dry-run'] === true;

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dry_run: true, email: { subject: email.subject, text: email.text, html_checks: 'passed' }, payload, duplicate_filters: buildDuplicateFilters(payload) }, null, 2));
    return;
  }

  const duplicates = await findDuplicates(payload);
  if (duplicates.length) {
    console.log(JSON.stringify({ ok: false, blocked: true, reason: 'prior_mockup_outreach_found', duplicates }, null, 2));
    process.exitCode = 2;
    return;
  }

  const resendResult = await sendWithResend({
    to: input.toEmails,
    cc: input.ccEmails,
    bcc: input.bccEmails,
    subject: email.subject,
    text: email.text,
    html: email.html,
    from: input.fromEmail,
    replyTo: input.replyToEmail,
  });

  const rows = await supabaseRequest({
    path: 'race_mockup_outreach',
    method: 'POST',
    body: {
      ...payload,
      resend_email_id: resendResult.id || null,
      metadata: {
        ...(payload.metadata || {}),
        send_gate: 'scripts/send-mockup-outreach.mjs',
      },
    },
  });

  const row = rows?.[0];
  console.log(JSON.stringify({
    ok: true,
    id: row?.id,
    race_name: row?.race_name,
    mockup_url: row?.mockup_url,
    mockup_template: row?.mockup_template,
    resend_email_id: row?.resend_email_id,
    sent_at: row?.sent_at,
  }, null, 2));
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
