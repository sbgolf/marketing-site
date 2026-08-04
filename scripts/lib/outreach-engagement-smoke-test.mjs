import { createHash } from 'node:crypto';

import { buildMockupOutreachPayload, normalizeEmail, parseEmailList, slugifyRace } from './mockup-outreach-log.mjs';
import {
  DEFAULT_MOCKUP_OUTREACH_FROM,
  DEFAULT_MOCKUP_OUTREACH_REPLY_TO,
  assertBrandedMockupOutreachHtml,
  renderPrivateMockupOutreachEmail,
} from './mockup-outreach-send-gate.mjs';

const INTERNAL_DOMAIN_ALLOWLIST = ['startlinesites.com'];
const SMOKE_CAMPAIGN_ID = 'internal-outreach-engagement-smoke';
const DANGEROUS_RACE_WORDS = /\b(marathon|turkey trot|5k|10k|half marathon|trail run|race director|runsignup)\b/i;
const LIVE_CONTEXT_WORDS = /\b(real|live|customer|race director|prospect|campaign|external)\b/i;
const FULL_EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export const maskEmail = (value = '') => {
  const email = normalizeEmail(value);
  const [user = '', domain = ''] = email.split('@');
  if (!user || !domain) return '';
  const visible = user.length <= 2 ? `${user[0] || '*'}*` : `${user.slice(0, 2)}***`;
  return `${visible}@${domain}`;
};

export const hashRecipient = (value = '') => createHash('sha256').update(normalizeEmail(value)).digest('hex');

export const redactEmails = (value = '') => String(value).replace(FULL_EMAIL_RE, (match) => maskEmail(match));

export const buildSmokeId = (value = '') => {
  const provided = String(value || '').trim();
  if (provided) return provided.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
};

export const parseSmokeArgs = (argv = []) => {
  const options = {
    mode: 'plan',
    confirmInternalSmoke: false,
    sendInternalSmoke: false,
    verify: false,
    markComplete: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const read = () => argv[++i] || '';
    if (arg === '--internal-recipient') options.internalRecipient = read();
    else if (arg === '--smoke-id') options.smokeId = read();
    else if (arg === '--outreach-id') options.outreachId = read();
    else if (arg === '--mockup-url') options.mockupUrl = read();
    else if (arg === '--recipient-domain') options.recipientDomain = read();
    else if (arg === '--race-name') options.raceName = read();
    else if (arg === '--context-note') options.contextNote = read();
    else if (arg === '--confirm-internal-smoke') options.confirmInternalSmoke = true;
    else if (arg === '--send-internal-smoke') { options.sendInternalSmoke = true; options.mode = 'send'; }
    else if (arg === '--verify') { options.verify = true; options.mode = 'verify'; }
    else if (arg === '--mark-complete') { options.markComplete = true; options.mode = 'mark-complete'; }
    else if (arg === '--json') options.json = true;
    else if (arg === '--plan') options.mode = 'plan';
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
};

export const validateSmokeOptions = (options = {}, env = process.env) => {
  const errors = [];
  const warnings = [];
  const recipient = normalizeEmail(options.internalRecipient || env.STARTLINE_INTERNAL_SMOKE_RECIPIENT || '');
  const recipientDomain = recipient.split('@')[1] || '';
  const allowedDomains = [...INTERNAL_DOMAIN_ALLOWLIST, ...String(options.recipientDomain || env.STARTLINE_INTERNAL_SMOKE_DOMAIN || '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean)];
  const raceName = String(options.raceName || 'StartLine Internal Smoke Test 5K').trim();
  const contextNote = String(options.contextNote || '').trim();

  if (!recipient) errors.push('Set --internal-recipient or STARTLINE_INTERNAL_SMOKE_RECIPIENT.');
  if (recipient && !allowedDomains.includes(recipientDomain)) {
    errors.push(`Internal smoke recipient must be on an allowlisted StartLine domain; got ${maskEmail(recipient)}.`);
  }
  if (!options.confirmInternalSmoke) errors.push('Pass --confirm-internal-smoke to acknowledge this is internal-only and not customer outreach.');
  if (options.sendInternalSmoke && !(env.RESEND_API_KEY || env.STARTLINE_RESEND_API_KEY)) errors.push('RESEND_API_KEY or STARTLINE_RESEND_API_KEY is required for --send-internal-smoke.');
  if ((options.sendInternalSmoke || options.verify || options.markComplete) && (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) errors.push('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase verification/marking.');
  if (LIVE_CONTEXT_WORDS.test(contextNote)) errors.push('Context note looks like a live customer/prospect context; use fictional/internal smoke language only.');
  if (DANGEROUS_RACE_WORDS.test(raceName) && raceName !== 'StartLine Internal Smoke Test 5K') warnings.push('Race name includes race-like wording; ensure it remains fictional/internal.');
  if (options.verify && !options.outreachId && !options.smokeId) errors.push('Pass --outreach-id or --smoke-id for verification.');

  return { ok: errors.length === 0, errors, warnings, recipient, allowedDomains, raceName };
};

export const buildSmokeFixture = (options = {}, env = process.env) => {
  const validation = validateSmokeOptions(options, env);
  const smokeId = buildSmokeId(options.smokeId);
  const recipient = validation.recipient;
  const raceName = validation.raceName || 'StartLine Internal Smoke Test 5K';
  const raceSlug = `internal-smoke-${slugifyRace(smokeId, 'smoke')}`;
  const mockupUrl = String(options.mockupUrl || `https://mockups.startlinesites.com/private/mockups/internal-smoke-${smokeId}`).trim();
  const subject = `[Internal smoke] A free private website mockup for ${raceName}`;
  const detail = 'This is an internal StartLine Sites engagement-tracking smoke test using fictional race context. It is not customer outreach and does not require a reply.';
  const email = renderPrivateMockupOutreachEmail({ raceName, contactName: 'StartLine team', mockupUrl, subject, detail });
  const htmlErrors = assertBrandedMockupOutreachHtml({ html: email.html, mockupUrl });
  const sentAt = new Date().toISOString();
  const payload = buildMockupOutreachPayload({
    raceName,
    raceSlug,
    officialUrl: 'https://startlinesites.com/',
    registrationUrl: 'https://startlinesites.com/sample-audit/',
    registrationPlatform: 'internal_smoke',
    registrationRaceId: smokeId,
    mockupUrl,
    mockupTemplate: 'internal_smoke',
    mockupVerifiedAt: sentAt,
    toEmails: [recipient],
    bccEmails: ['support@startlinesites.com'],
    subject: email.subject,
    outreachStatus: 'sent',
    sentAt,
    fromEmail: DEFAULT_MOCKUP_OUTREACH_FROM,
    replyToEmail: DEFAULT_MOCKUP_OUTREACH_REPLY_TO,
    owner: 'StartLine internal smoke',
    notes: 'Internal outreach engagement smoke test row; exclude from customer campaign metrics.',
    metadata: {
      smoke_test: true,
      smoke_id: smokeId,
      campaign_id: SMOKE_CAMPAIGN_ID,
      exclude_from_campaign_metrics: true,
      customer_outreach: false,
      internal_only: true,
      cleanup: 'mark metadata.smoke_completed_at after verification; do not delete evidence rows by default',
    },
  });

  return {
    ok: validation.ok && htmlErrors.length === 0,
    errors: [...validation.errors, ...htmlErrors],
    warnings: validation.warnings,
    smoke_id: smokeId,
    masked_recipient: maskEmail(recipient),
    recipient_hash: hashRecipient(recipient),
    email,
    payload,
    resend_message: {
      from: DEFAULT_MOCKUP_OUTREACH_FROM,
      reply_to: [DEFAULT_MOCKUP_OUTREACH_REPLY_TO],
      to: [recipient],
      bcc: ['support@startlinesites.com'],
      subject: email.subject,
      text: email.text,
      html: email.html,
    },
  };
};

export const buildSmokeOutreachQuery = ({ outreachId, smokeId } = {}) => {
  const select = encodeURIComponent('id,race_name,race_slug,outreach_status,resend_email_id,to_emails,sent_at,delivered_at,opened_at,clicked_at,engagement_status,open_count,click_count,last_event_at,metadata');
  if (outreachId) return `race_mockup_outreach?select=${select}&id=eq.${encodeURIComponent(outreachId)}&limit=1`;
  const slug = `internal-smoke-${slugifyRace(buildSmokeId(smokeId), 'smoke')}`;
  return `race_mockup_outreach?select=${select}&race_slug=eq.${encodeURIComponent(slug)}&limit=1`;
};

export const buildSmokeEventsQuery = (outreachId) => {
  if (!outreachId) throw new Error('outreachId is required.');
  const select = encodeURIComponent('id,event_type,provider_event_id,recipient_hash,url,created_at,metadata');
  return `outreach_engagement_events?select=${select}&outreach_id=eq.${encodeURIComponent(outreachId)}&order=created_at.desc&limit=50`;
};

export const buildSuppressionQuery = (recipientHash) => {
  if (!recipientHash) throw new Error('recipientHash is required.');
  const select = encodeURIComponent('id,recipient_hash,reason,status,source,created_at,metadata');
  return `outreach_suppressions?select=${select}&recipient_hash=eq.${encodeURIComponent(recipientHash)}&status=eq.active&limit=5`;
};

export const summarizeSmokeEvidence = ({ outreach = {}, events = [], suppressions = [], maskedRecipient = '' } = {}) => {
  const eventCounts = events.reduce((acc, event) => {
    const type = String(event.event_type || 'unknown');
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  return {
    outreach_id: outreach.id || null,
    resend_email_id: outreach.resend_email_id || null,
    masked_recipient: maskedRecipient || maskEmail(parseEmailList(outreach.to_emails || [])[0]),
    outreach_status: outreach.outreach_status || null,
    engagement_status: outreach.engagement_status || null,
    open_count: Number(outreach.open_count || 0),
    click_count: Number(outreach.click_count || 0),
    raw_event_count: events.length,
    event_counts: eventCounts,
    suppression_rows: suppressions.length,
    passed: Boolean(outreach.id && outreach.resend_email_id && events.length > 0),
    caveats: events.length === 0 ? ['No webhook events found yet; check Resend tracking/webhook/DNS/Netlify env before using for outreach waves.'] : [],
  };
};

export const renderSmokeReport = (summary = {}) => {
  const lines = [
    'StartLine outreach engagement internal smoke report',
    `- Outreach row: ${summary.outreach_id || 'missing'}`,
    `- Resend message: ${summary.resend_email_id || 'missing'}`,
    `- Recipient: ${summary.masked_recipient || 'masked'}`,
    `- Raw events: ${summary.raw_event_count || 0}`,
    `- Engagement status: ${summary.engagement_status || 'none'}`,
    `- Opens/clicks: ${summary.open_count || 0}/${summary.click_count || 0}`,
    `- Suppression rows for recipient: ${summary.suppression_rows || 0}`,
    `- Result: ${summary.passed ? 'passed' : 'needs follow-up'}`,
  ];
  for (const caveat of summary.caveats || []) lines.push(`- Caveat: ${caveat}`);
  return redactEmails(lines.join('\n'));
};
