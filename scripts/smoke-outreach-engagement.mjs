#!/usr/bin/env node
import {
  buildSmokeEventsQuery,
  buildSmokeFixture,
  buildSmokeOutreachQuery,
  buildSuppressionQuery,
  hashRecipient,
  maskEmail,
  parseSmokeArgs,
  redactEmails,
  renderSmokeReport,
  summarizeSmokeEvidence,
  validateSmokeOptions,
} from './lib/outreach-engagement-smoke-test.mjs';
import { createSupabaseRestRequester } from './lib/mockup-generation-send-gate.mjs';

const help = `Usage:
  npm run smoke:outreach-engagement -- --plan --internal-recipient support@startlinesites.com --confirm-internal-smoke
  npm run smoke:outreach-engagement -- --send-internal-smoke --internal-recipient support@startlinesites.com --confirm-internal-smoke
  npm run smoke:outreach-engagement -- --verify --smoke-id <id> --internal-recipient support@startlinesites.com --confirm-internal-smoke

Safe defaults:
  - No customer/race-director outreach unless --send-internal-smoke is passed.
  - Recipient must be an allowlisted StartLine internal domain by default.
  - Output masks recipient addresses.
  - Smoke rows are marked metadata.smoke_test=true and exclude_from_campaign_metrics=true.
`;

const jsonOut = (value) => JSON.stringify(value, null, 2);

const sendResend = async ({ apiKey = process.env.RESEND_API_KEY || process.env.STARTLINE_RESEND_API_KEY, message, fetchImpl = fetch }) => {
  if (!apiKey) throw new Error('RESEND_API_KEY or STARTLINE_RESEND_API_KEY is required.');
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'user-agent': 'StartLineSites/1.0 (outreach-engagement-smoke-test)',
    },
    body: JSON.stringify(message),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Resend smoke send failed: ${response.status} ${redactEmails(text)}`);
  return text ? JSON.parse(text) : {};
};

const first = (rows) => Array.isArray(rows) && rows.length ? rows[0] : null;

const main = async () => {
  const options = parseSmokeArgs(process.argv.slice(2));
  if (options.help) {
    console.log(help.trim());
    return;
  }

  const validation = validateSmokeOptions(options, process.env);
  if (!validation.ok) {
    console.error(redactEmails(['Outreach engagement smoke test refused:', ...validation.errors.map((e) => `- ${e}`)].join('\n')));
    process.exitCode = 1;
    return;
  }

  const fixture = buildSmokeFixture(options, process.env);
  if (!fixture.ok) {
    console.error(redactEmails(['Outreach engagement smoke fixture refused:', ...fixture.errors.map((e) => `- ${e}`)].join('\n')));
    process.exitCode = 1;
    return;
  }

  if (options.mode === 'plan') {
    const plan = {
      ok: true,
      mode: 'plan',
      side_effects: 'none',
      smoke_id: fixture.smoke_id,
      masked_recipient: fixture.masked_recipient,
      recipient_hash: fixture.recipient_hash,
      subject: fixture.email.subject,
      mockup_url: fixture.payload.mockup_url,
      row_markers: fixture.payload.metadata,
      verification_steps: [
        'Run with --send-internal-smoke only for an internal StartLine recipient.',
        'Wait for Resend delivery/open/click webhook events.',
        'Run with --verify --smoke-id <id> to query outreach row, raw events, aggregate fields, and suppression rows.',
        'Use the owner digest after events land to confirm reporting.',
      ],
      warnings: fixture.warnings,
    };
    console.log(options.json ? jsonOut(plan) : redactEmails(`Outreach engagement smoke plan ready\n- Smoke id: ${plan.smoke_id}\n- Recipient: ${plan.masked_recipient}\n- Subject: ${plan.subject}\n- Side effects: none\n- Mockup URL: ${plan.mockup_url}`));
    return;
  }

  const supabaseRequest = createSupabaseRestRequester();

  if (options.mode === 'send') {
    const resend = await sendResend({ message: fixture.resend_message });
    const rows = await supabaseRequest({
      path: 'race_mockup_outreach',
      method: 'POST',
      body: {
        ...fixture.payload,
        resend_email_id: resend.id || null,
        metadata: {
          ...fixture.payload.metadata,
          resend_smoke_sent_at: new Date().toISOString(),
          smoke_script: 'scripts/smoke-outreach-engagement.mjs',
        },
      },
    });
    const row = first(rows) || {};
    const result = {
      ok: true,
      mode: 'send',
      smoke_id: fixture.smoke_id,
      outreach_id: row.id || null,
      resend_email_id: row.resend_email_id || resend.id || null,
      masked_recipient: fixture.masked_recipient,
      next: `After webhook events arrive, run npm run smoke:outreach-engagement -- --verify --smoke-id ${fixture.smoke_id} --internal-recipient <same-internal-recipient> --confirm-internal-smoke`,
    };
    console.log(options.json ? jsonOut(result) : redactEmails(`Internal smoke email accepted\n- Outreach row: ${result.outreach_id}\n- Resend message: ${result.resend_email_id}\n- Recipient: ${result.masked_recipient}\n- Smoke id: ${result.smoke_id}`));
    return;
  }

  const outreachRows = await supabaseRequest({ path: buildSmokeOutreachQuery(options) });
  const outreach = first(outreachRows);
  if (!outreach) throw new Error('No smoke outreach row found for the provided --outreach-id/--smoke-id.');
  const events = await supabaseRequest({ path: buildSmokeEventsQuery(outreach.id) });
  const recipient = validation.recipient || (Array.isArray(outreach.to_emails) ? outreach.to_emails[0] : '');
  const suppressions = await supabaseRequest({ path: buildSuppressionQuery(hashRecipient(recipient)) });

  if (options.mode === 'mark-complete') {
    const metadata = outreach.metadata && typeof outreach.metadata === 'object' && !Array.isArray(outreach.metadata) ? outreach.metadata : {};
    await supabaseRequest({
      path: `race_mockup_outreach?id=eq.${encodeURIComponent(outreach.id)}`,
      method: 'PATCH',
      body: {
        metadata: {
          ...metadata,
          smoke_completed_at: new Date().toISOString(),
          smoke_event_count: Array.isArray(events) ? events.length : 0,
          smoke_marked_complete_by: 'scripts/smoke-outreach-engagement.mjs',
        },
      },
    });
  }

  const summary = summarizeSmokeEvidence({ outreach, events: events || [], suppressions: suppressions || [], maskedRecipient: maskEmail(recipient) });
  console.log(options.json ? jsonOut(summary) : renderSmokeReport(summary));
};

main().catch((error) => {
  console.error(redactEmails(error?.stack || error?.message || String(error)));
  process.exitCode = 1;
});
