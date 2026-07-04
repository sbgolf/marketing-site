import { createHash } from 'node:crypto';

import {
  CLIENT_SIGNATURE_TEXT,
  escapeHtml,
  renderBrandedEmail,
  renderEmailButton,
  renderInfoCard,
  renderSignatureHtml,
} from './lib/branded-email.mjs';
import { createDepositCheckoutSession, getDepositPackage } from './create-checkout-session.mjs';

const ALLOWED_METHODS = ['POST', 'OPTIONS'];
const MAX_BODY_BYTES = 10_000;

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  },
  body: JSON.stringify(body),
});

const clean = (value, max = 500) => {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, max);
};

const optionalClean = (value, max = 500) => {
  const cleaned = clean(value, max);
  return cleaned || null;
};

const fieldLine = (label, value) => `${label}: ${value || 'Not provided'}`;
const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(clean(value, 20));
const emailShell = renderBrandedEmail;

const actionCard = (label, value) => `
  <div style="border:1px solid #eadfce;border-radius:16px;background:#ffffff;padding:14px 16px;margin:0 0 12px;">
    <div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#8a5d16;font-weight:800;margin-bottom:5px;">${escapeHtml(label)}</div>
    <div style="color:#0b0e13;word-break:break-word;">${escapeHtml(value || 'Not provided')}</div>
  </div>`;

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const publicPackageName = (selectedPackage) => selectedPackage?.name
  ? selectedPackage.name
    .replace('StartLine Sites ', '')
    .replace(' First-Year Package Deposit', '')
    .replace(' Deposit', '')
  : '';

const publicPackageWithDeposit = (selectedPackage) => {
  const name = publicPackageName(selectedPackage);
  if (!name) return null;
  return `${name}${selectedPackage.deposit_amount ? ` (${selectedPackage.deposit_amount} first-year package deposit)` : ''}`;
};

const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const hashIp = (event) => {
  const ip = event.headers?.['x-nf-client-connection-ip']
    || event.headers?.['client-ip']
    || event.headers?.['x-forwarded-for']?.split(',')[0]
    || '';
  const salt = process.env.STARTLINE_IP_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'startline-sites';
  return ip ? createHash('sha256').update(`${salt}:${ip}`).digest('hex') : null;
};

const sendLeadNotification = async ({ record, row }) => {
  const apiKey = process.env.RESEND_API_KEY || process.env.STARTLINE_RESEND_API_KEY;
  const to = process.env.STARTLINE_LEAD_NOTIFY_EMAIL
    || process.env.STARTLINE_ADMIN_EMAIL
    || 'support@startlinesites.com';

  if (!apiKey) {
    console.warn('Lead notification skipped: RESEND_API_KEY or STARTLINE_RESEND_API_KEY is not configured.');
    return;
  }

  const from = process.env.STARTLINE_NOTIFY_FROM || 'StartLine Sites <support@startlinesites.com>';
  const rowId = record?.id || 'Unknown';
  const subject = `New StartLine audit request: ${row.race_name}`;
  const selectedPackage = row.metadata?.selected_package;
  const packageName = publicPackageName(selectedPackage);
  const packageDeposit = selectedPackage?.deposit_amount;
  const packageUrl = selectedPackage?.proposal_required ? 'Reviewed proposal required before a first-year package deposit link is sent' : (selectedPackage?.url || selectedPackage?.static_url);
  const lines = [
    'A new StartLine Sites audit request was submitted.',
    '',
    'Owner-approved workflow foundation:',
    '1. Agent may scrape/review the submitted public URL for an internal draft only.',
    '2. Agent drafts audit findings for Steve review.',
    '3. Steve approval is required before any findings or recommendations go to the race director.',
    '',
    fieldLine('Race name', row.race_name),
    fieldLine('Current URL', row.current_url),
    fieldLine('Contact name', row.contact_name),
    fieldLine('Contact email', row.contact_email),
    fieldLine('Selected first-year package', packageName ? `${packageName} (${packageDeposit} first-year package deposit)` : null),
    fieldLine('Stripe first-year package deposit link', packageUrl),
    fieldLine('Notes', row.notes),
    fieldLine('Landing page', row.landing_page),
    fieldLine('Referrer', row.referrer),
    fieldLine('Pipeline status', row.status),
    fieldLine('Outreach status', row.outreach_status),
    fieldLine('Audit workflow', JSON.stringify(row.metadata?.audit_workflow || {})),
    fieldLine('Supabase row ID', rowId),
  ];

  const adminHtml = emailShell({
    preheader: `New audit request for ${row.race_name}. Steve approval is required before customer delivery.`,
    heading: `New private audit request: ${row.race_name}`,
    eyebrow: 'StartLine audit intake',
    body: `
      <p style="margin:0 0 18px;">A new private audit request is ready for the internal review workflow. Do not send agent-drafted findings to the customer until Steve approves the response.</p>
      ${actionCard('Race name', row.race_name)}
      ${actionCard('Submitted URL', row.current_url)}
      ${actionCard('Contact', `${row.contact_name} · ${row.contact_email}`)}
      ${actionCard('Selected first-year package', packageName ? `${packageName} (${packageDeposit} first-year package deposit)` : 'Recommend after review')}
      ${actionCard('Stripe first-year package deposit link', packageUrl)}
      ${actionCard('Notes', row.notes)}
      <div style="border:1px solid rgba(245,176,65,.45);border-radius:18px;background:#fff7e6;padding:16px 18px;margin:18px 0;">
        <strong style="display:block;color:#0b0e13;margin-bottom:8px;">Agent-audit workflow foundation</strong>
        <ol style="margin:0;padding-left:20px;color:#233043;">
          <li>Scrape/review the submitted public URL for internal findings only.</li>
          <li>Draft the audit response and recommended next step.</li>
          <li>Email Steve for approval before anything goes to the race director.</li>
        </ol>
      </div>
      ${actionCard('Pipeline status', row.status)}
      ${actionCard('Outreach status', row.outreach_status)}
      ${actionCard('Supabase row ID', rowId)}
      ${actionCard('Landing page', row.landing_page)}
      ${actionCard('Referrer', row.referrer)}
    `,
  });

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'user-agent': 'StartLineSites/1.0 (lead-notifications)',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: lines.join('\n'),
      html: adminHtml,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend notification failed: ${response.status} ${detail}`);
  }
};

export const renderCustomerAuditConfirmationEmail = ({ row }) => {
  const selectedPackage = row.metadata?.selected_package;
  const checkoutUrl = selectedPackage?.proposal_required ? null : selectedPackage?.url;
  const packageLine = selectedPackage?.name
    ? `Selected first-year package: ${publicPackageWithDeposit(selectedPackage)}`
    : 'Selected first-year package: We will recommend the best fit after reviewing your race.';
  const nextStep = checkoutUrl
    ? `If you are ready to start the one-time first-year race-cycle package, you can pay the first-year package deposit here: ${checkoutUrl}`
    : selectedPackage?.proposal_required
      ? 'Premium projects start with a reviewed proposal before any first-year package deposit link is sent.'
      : 'We will review your race site and follow up with the clearest package recommendation.';
  const text = [
    `Hi ${row.contact_name},`,
    '',
    `Thanks — we received the private StartLine Sites audit request for ${row.race_name}.`,
    '',
    packageLine,
    fieldLine('Current site / registration URL', row.current_url),
    '',
    'What happens next:',
    '1. We review the current race page like a runner deciding whether to register.',
    '2. Steve reviews the findings before your response is sent.',
    '3. We email your written audit within 2 business days with the recommended next step.',
    '',
    nextStep,
    '',
    'Reply to this email if anything about the request should change.',
    '',
    CLIENT_SIGNATURE_TEXT,
  ].join('\n');

  const html = emailShell({
    preheader: `We received your private StartLine audit request for ${row.race_name}.`,
    heading: 'Your private audit request is in',
    body: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(row.contact_name)},</p>
      <p style="margin:0 0 18px;">Thanks — we received the private StartLine Sites audit request for <strong>${escapeHtml(row.race_name)}</strong>.</p>
      ${actionCard('Current site / registration URL', row.current_url)}
      ${actionCard('Selected first-year package', selectedPackage?.name ? publicPackageWithDeposit(selectedPackage) : 'We will recommend the best fit after reviewing your race.')}
      ${renderInfoCard({
        title: 'What happens next',
        children: `<ol style="margin:0;padding-left:20px;color:#1A2438;"><li>We review the current race page like a runner deciding whether to register.</li><li>Steve reviews the findings before your response is sent.</li><li>We email your written audit within 2 business days with the recommended next step.</li></ol>`,
      })}
      <p style="margin:0 0 16px;">${escapeHtml(nextStep)}</p>
      ${checkoutUrl ? renderEmailButton({ href: checkoutUrl, label: 'Pay the first-year package deposit' }) : ''}
      <p style="margin:0;">Reply to this email if anything about the request should change.</p>
      ${renderSignatureHtml()}
    `,
  });

  return { text, html };
};

const sendCustomerAuditConfirmation = async ({ row }) => {
  const apiKey = process.env.RESEND_API_KEY || process.env.STARTLINE_RESEND_API_KEY;
  const to = row.contact_email;

  if (!apiKey || !to || !isEmail(to)) {
    console.warn('Customer audit confirmation skipped: Resend is not configured or contact email is invalid.');
    return;
  }

  const from = process.env.STARTLINE_NOTIFY_FROM || 'StartLine Sites <support@startlinesites.com>';
  const replyTo = process.env.STARTLINE_KICKOFF_REPLY_TO
    || process.env.STARTLINE_ADMIN_EMAIL
    || process.env.STARTLINE_LEAD_NOTIFY_EMAIL
    || undefined;
  const { text, html } = renderCustomerAuditConfirmationEmail({ row });

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'user-agent': 'StartLineSites/1.0 (customer-audit-confirmation)',
    },
    body: JSON.stringify({
      from,
      to: [to],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject: `We received your StartLine audit request for ${row.race_name}`,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend customer confirmation failed: ${response.status} ${detail}`);
  }
};

const persistCheckoutSessionMetadata = async ({ supabaseUrl, serviceKey, auditRequestId, checkoutSession, metadata }) => {
  const sessionId = clean(checkoutSession?.id, 200);
  if (!sessionId || !auditRequestId) return;

  const response = await fetch(`${supabaseUrl}/rest/v1/audit_requests?id=eq.${encodeURIComponent(auditRequestId)}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify({
      stripe_checkout_session_id: sessionId,
      metadata,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase checkout metadata patch failed: ${response.status} ${detail}`);
  }
};

export async function handler(event) {
  if (!ALLOWED_METHODS.includes(event.httpMethod)) {
    return json(405, { ok: false, error: 'Method not allowed.' });
  }

  if (event.httpMethod === 'OPTIONS') {
    return json(204, {});
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return json(500, { ok: false, error: 'Submission service is not configured.' });
  }

  if (!event.body || event.body.length > MAX_BODY_BYTES) {
    return json(400, { ok: false, error: 'Invalid submission.' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { ok: false, error: 'Invalid submission format.' });
  }

  // Honeypot: real users never fill this hidden field.
  if (clean(payload.company_website, 200)) {
    return json(200, { ok: true });
  }

  const raceName = clean(payload.race_name, 160);
  const currentUrl = clean(payload.current_url, 500);
  const contactName = clean(payload.contact_name, 160);
  const contactEmail = clean(payload.contact_email, 254).toLowerCase();
  const notes = optionalClean(payload.notes, 1200);
  const preferredLaunchDate = optionalClean(payload.preferred_launch_date, 20);
  const packageTier = clean(payload.package_tier, 40).toLowerCase();
  const selectedPackage = getDepositPackage(packageTier);

  const errors = {};
  if (!raceName) errors.race_name = 'Race name is required.';
  if (!currentUrl || !isHttpUrl(currentUrl)) errors.current_url = 'A valid race website or registration URL is required.';
  if (!contactName) errors.contact_name = 'Your name is required.';
  if (!contactEmail || !isEmail(contactEmail)) errors.contact_email = 'A valid email is required.';
  if (preferredLaunchDate && !isIsoDate(preferredLaunchDate)) errors.preferred_launch_date = 'Preferred launch date must use the date picker format.';
  if (packageTier && !selectedPackage) errors.package_tier = 'Selected package is not valid.';

  if (Object.keys(errors).length) {
    return json(422, { ok: false, error: 'Please check the form fields.', fields: errors });
  }

  const referrer = clean(payload.referrer || event.headers?.referer || '', 1000) || null;
  const landingPage = clean(payload.landing_page || '', 1000) || null;
  const userAgent = clean(event.headers?.['user-agent'] || '', 1000) || null;

  const row = {
    race_name: raceName,
    current_url: currentUrl,
    contact_name: contactName,
    contact_email: contactEmail,
    notes,
    source: 'marketing_site',
    referrer: referrer,
    landing_page: landingPage,
    user_agent: userAgent,
    ip_hash: hashIp(event),
    status: 'queued_for_site_review',
    outreach_status: 'steve_approval_required',
    deposit_status: 'not_sent',
    metadata: {
      submitted_from: 'startlinesites.com',
      form_version: 'audit_request_v3',
      preferred_launch_date: preferredLaunchDate,
      audit_workflow: {
        current_url_scrape_status: 'queued',
        findings_draft_status: 'pending_url_review',
        steve_approval_status: 'required_before_customer_delivery',
        customer_delivery_status: 'blocked_until_steve_approval',
        automation_scope: 'internal_draft_only_no_customer_send',
      },
      selected_package: selectedPackage ? {
        tier: packageTier,
        name: selectedPackage.name,
        setup_price: selectedPackage.setup_price,
        deposit_amount: selectedPackage.deposit_amount,
        static_url: null,
        proposal_required: Boolean(selectedPackage.proposal_required),
      } : null,
    },
  };

  const response = await fetch(`${supabaseUrl}/rest/v1/audit_requests`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('Supabase insert failed', response.status, detail);
    return json(502, { ok: false, error: 'We could not submit your request. Please try again.' });
  }

  const [record] = await response.json();
  let checkoutSession = null;

  if (record?.id && selectedPackage && !selectedPackage.proposal_required && process.env.STRIPE_SECRET_KEY) {
    try {
      checkoutSession = await createDepositCheckoutSession({
        stripeSecretKey: process.env.STRIPE_SECRET_KEY,
        auditRequestId: record.id,
        setupTier: packageTier,
        contactEmail,
        raceName,
        currentUrl,
        preferredLaunchDate,
      });

      row.metadata.selected_package = {
        ...row.metadata.selected_package,
        checkout_session_id: checkoutSession.id,
        url: checkoutSession.url,
        url_source: 'dynamic_checkout_session',
      };

      try {
        await persistCheckoutSessionMetadata({
          supabaseUrl,
          serviceKey,
          auditRequestId: record.id,
          checkoutSession,
          metadata: row.metadata,
        });
      } catch (error) {
        console.error('Checkout Session metadata persistence failed', error);
      }
    } catch (error) {
      console.error('Stripe Checkout Session creation failed', error);
    }
  }

  try {
    await sendLeadNotification({ record, row });
  } catch (error) {
    console.error('Lead notification failed', error);
  }

  try {
    await sendCustomerAuditConfirmation({ row });
  } catch (error) {
    console.error('Customer audit confirmation failed', error);
  }

  return json(201, {
    ok: true,
    id: record?.id,
    message: 'Thanks — your private audit request was received.',
    checkout_url: checkoutSession?.url || null,
    checkout_url_source: checkoutSession?.url ? 'dynamic_checkout_session' : null,
  });
}
