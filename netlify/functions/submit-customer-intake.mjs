import { createHash } from 'node:crypto';

const ALLOWED_METHODS = ['POST', 'OPTIONS'];
const MAX_BODY_BYTES = 25_000;

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  },
  body: JSON.stringify(body),
});

const clean = (value, max = 1000) => {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, max);
};

const optionalClean = (value, max = 1000) => clean(value, max) || null;

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const fieldLine = (label, value) => `${label}: ${value || 'Not provided'}`;
const htmlField = (label, value) => `<p><strong>${escapeHtml(label)}:</strong><br>${escapeHtml(value || 'Not provided')}</p>`;

const hashIp = (event) => {
  const ip = event.headers?.['x-nf-client-connection-ip']
    || event.headers?.['client-ip']
    || event.headers?.['x-forwarded-for']?.split(',')[0]
    || '';
  const salt = process.env.STARTLINE_IP_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'startline-sites';
  return ip ? createHash('sha256').update(`${salt}:${ip}`).digest('hex') : null;
};

const buildRow = (payload, event) => {
  const contactEmail = clean(payload.contact_email, 254).toLowerCase();
  const referrer = optionalClean(payload.referrer || event.headers?.referer || '', 1000);
  const landingPage = optionalClean(payload.landing_page || '', 1000);
  const userAgent = optionalClean(event.headers?.['user-agent'] || '', 1000);

  return {
    organization_name: clean(payload.organization_name, 180),
    race_name: clean(payload.race_name, 180),
    contact_name: clean(payload.contact_name, 180),
    contact_email: contactEmail,
    event_date: optionalClean(payload.event_date, 80),
    event_location: optionalClean(payload.event_location, 240),
    registration_url: clean(payload.registration_url, 500),
    status: 'new',
    source: 'marketing_site_intake',
    referrer,
    landing_page: landingPage,
    user_agent: userAgent,
    ip_hash: hashIp(event),
    metadata: {
      submitted_from: 'startlinesites.com/intake',
      form_version: 'customer_intake_v1',
      contact_phone: optionalClean(payload.contact_phone, 80),
      template_preference: optionalClean(payload.template_preference, 120),
      distances_pricing: optionalClean(payload.distances_pricing, 2500),
      registration_platform: optionalClean(payload.registration_platform, 160),
      course_logistics: optionalClean(payload.course_logistics, 2500),
      bq_certification: optionalClean(payload.bq_certification, 1000),
      race_schedule: optionalClean(payload.race_schedule, 2500),
      sponsors: optionalClean(payload.sponsors, 2000),
      faqs: optionalClean(payload.faqs, 2500),
      assets_link: optionalClean(payload.assets_link, 800),
      analytics_access_notes: optionalClean(payload.analytics_access_notes, 1200),
      optional_notes: optionalClean(payload.optional_notes, 2000),
    },
  };
};

const validateRow = (row) => {
  const errors = {};
  if (!row.race_name) errors.race_name = 'Race name is required.';
  if (!row.contact_name) errors.contact_name = 'Contact name is required.';
  if (!row.contact_email || !isEmail(row.contact_email)) errors.contact_email = 'A valid contact email is required.';
  if (!row.event_date) errors.event_date = 'Event date or target date is required.';
  if (!row.event_location) errors.event_location = 'Event location is required.';
  if (!row.registration_url || !isHttpUrl(row.registration_url)) errors.registration_url = 'A valid registration URL is required.';
  if (row.metadata.assets_link && !isHttpUrl(row.metadata.assets_link)) errors.assets_link = 'Use a valid shared Drive, Dropbox, or folder URL.';
  return errors;
};

const sendSupportNotification = async ({ record, row }) => {
  const apiKey = process.env.RESEND_API_KEY || process.env.STARTLINE_RESEND_API_KEY;
  if (!apiKey) {
    console.warn('Customer intake support notification skipped: Resend is not configured.');
    return;
  }

  const to = process.env.STARTLINE_LEAD_NOTIFY_EMAIL
    || process.env.STARTLINE_ADMIN_EMAIL
    || 'support@startlinesites.com';
  const from = process.env.STARTLINE_NOTIFY_FROM || 'StartLine Sites <support@startlinesites.com>';
  const rowId = record?.id || 'Unknown';
  const lines = [
    'A new StartLine Sites customer intake was submitted.',
    '',
    fieldLine('Race name', row.race_name),
    fieldLine('Organization', row.organization_name),
    fieldLine('Contact', `${row.contact_name} <${row.contact_email}>`),
    fieldLine('Event date', row.event_date),
    fieldLine('Location', row.event_location),
    fieldLine('Template preference', row.metadata.template_preference),
    fieldLine('Distances/pricing', row.metadata.distances_pricing),
    fieldLine('Registration platform', row.metadata.registration_platform),
    fieldLine('Registration URL', row.registration_url),
    fieldLine('Course/logistics', row.metadata.course_logistics),
    fieldLine('BQ/certification', row.metadata.bq_certification),
    fieldLine('Schedule', row.metadata.race_schedule),
    fieldLine('Sponsors', row.metadata.sponsors),
    fieldLine('FAQs', row.metadata.faqs),
    fieldLine('Assets link', row.metadata.assets_link),
    fieldLine('Analytics/access notes', row.metadata.analytics_access_notes),
    fieldLine('Optional notes', row.metadata.optional_notes),
    fieldLine('Supabase row ID', rowId),
  ];

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'user-agent': 'StartLineSites/1.0 (customer-intake-notification)',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `New StartLine customer intake: ${row.race_name}`,
      text: lines.join('\n'),
      html: `<h2>New StartLine Sites customer intake</h2>${[
        ['Race name', row.race_name],
        ['Organization', row.organization_name],
        ['Contact', `${row.contact_name} <${row.contact_email}>`],
        ['Event date', row.event_date],
        ['Location', row.event_location],
        ['Template preference', row.metadata.template_preference],
        ['Distances/pricing', row.metadata.distances_pricing],
        ['Registration platform', row.metadata.registration_platform],
        ['Registration URL', row.registration_url],
        ['Course/logistics', row.metadata.course_logistics],
        ['BQ/certification', row.metadata.bq_certification],
        ['Schedule', row.metadata.race_schedule],
        ['Sponsors', row.metadata.sponsors],
        ['FAQs', row.metadata.faqs],
        ['Assets link', row.metadata.assets_link],
        ['Analytics/access notes', row.metadata.analytics_access_notes],
        ['Optional notes', row.metadata.optional_notes],
        ['Supabase row ID', rowId],
      ].map(([label, value]) => htmlField(label, value)).join('')}`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend customer intake support notification failed: ${response.status} ${detail}`);
  }
};

const sendCustomerConfirmation = async ({ row }) => {
  const apiKey = process.env.RESEND_API_KEY || process.env.STARTLINE_RESEND_API_KEY;
  if (!apiKey || !row.contact_email || !isEmail(row.contact_email)) {
    console.warn('Customer intake confirmation skipped: Resend is not configured or contact email is invalid.');
    return;
  }

  const from = process.env.STARTLINE_NOTIFY_FROM || 'StartLine Sites <support@startlinesites.com>';
  const replyTo = process.env.STARTLINE_KICKOFF_REPLY_TO
    || process.env.STARTLINE_ADMIN_EMAIL
    || process.env.STARTLINE_LEAD_NOTIFY_EMAIL
    || undefined;
  const checklistUrl = process.env.STARTLINE_ASSET_CHECKLIST_URL || 'https://startlinesites.com/asset-checklist';
  const lines = [
    `Hi ${row.contact_name},`,
    '',
    `Thanks — we received the StartLine Sites 20–30 minute intake for ${row.race_name}.`,
    '',
    'What happens next:',
    '1. We review your intake and shared asset folder.',
    '2. We follow up with any short list of missing details before production starts.',
    '3. Once intake and usable assets are complete, we begin the build timeline.',
    '',
    `Asset checklist: ${checklistUrl}`,
    '',
    'Reply to this email if anything in the intake should change.',
    '',
    '— StartLine Sites',
  ];

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'user-agent': 'StartLineSites/1.0 (customer-intake-confirmation)',
    },
    body: JSON.stringify({
      from,
      to: [row.contact_email],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject: `We received your StartLine intake for ${row.race_name}`,
      text: lines.join('\n'),
      html: `
        <p>Hi ${escapeHtml(row.contact_name)},</p>
        <p>Thanks — we received the StartLine Sites 20–30 minute intake for <strong>${escapeHtml(row.race_name)}</strong>.</p>
        <p><strong>What happens next:</strong></p>
        <ol>
          <li>We review your intake and shared asset folder.</li>
          <li>We follow up with any short list of missing details before production starts.</li>
          <li>Once intake and usable assets are complete, we begin the build timeline.</li>
        </ol>
        <p>Asset checklist: <a href="${escapeHtml(checklistUrl)}">${escapeHtml(checklistUrl)}</a></p>
        <p>Reply to this email if anything in the intake should change.</p>
        <p>— StartLine Sites</p>
      `,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend customer intake confirmation failed: ${response.status} ${detail}`);
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

  if (clean(payload.company_website, 200)) {
    return json(200, { ok: true });
  }

  const row = buildRow(payload, event);
  const errors = validateRow(row);
  if (Object.keys(errors).length) {
    return json(422, { ok: false, error: 'Please check the form fields.', fields: errors });
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/customer_intake_submissions`, {
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
    console.error('Customer intake Supabase insert failed', response.status, detail);
    return json(502, { ok: false, error: 'We could not submit your intake. Please try again.' });
  }

  const [record] = await response.json();

  try {
    await sendSupportNotification({ record, row });
  } catch (error) {
    console.error('Customer intake support notification failed', error);
  }

  try {
    await sendCustomerConfirmation({ row });
  } catch (error) {
    console.error('Customer intake confirmation failed', error);
  }

  return json(201, {
    ok: true,
    id: record?.id,
    message: 'Thanks — your StartLine Sites customer intake was received.',
  });
}
