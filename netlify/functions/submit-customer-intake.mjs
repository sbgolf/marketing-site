import { createHash } from 'node:crypto';

import {
  CLIENT_SIGNATURE_TEXT,
  escapeHtml,
  renderBrandedEmail,
  renderEmailButton,
  renderInfoCard,
  renderSignatureHtml,
} from './lib/branded-email.mjs';

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

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const normalizeDomain = (value) => {
  const cleaned = clean(value, 500);
  if (!cleaned) return null;
  try {
    const candidate = cleaned.includes('://') ? cleaned : `https://${cleaned}`;
    const url = new URL(candidate);
    return url.hostname.replace(/^www\./, '').toLowerCase() || null;
  } catch {
    return null;
  }
};

const fieldLine = (label, value) => `${label}: ${value || 'Not provided'}`;
const htmlField = (label, value) => `<p><strong>${escapeHtml(label)}:</strong><br>${escapeHtml(value || 'Not provided')}</p>`;
const normalizeMatchValue = (value) => clean(value, 240).toLowerCase();


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
      event_timezone: optionalClean(payload.event_timezone, 120),
      current_domain: optionalClean(payload.current_domain, 500),
      derived_current_domain_host: normalizeDomain(payload.current_domain),
      template_preference: optionalClean(payload.template_preference, 120),
      distances_pricing: optionalClean(payload.distances_pricing, 2500),
      registration_platform: optionalClean(payload.registration_platform, 160),
      registration_status: optionalClean(payload.registration_status, 120),
      pricing_confidence: optionalClean(payload.pricing_confidence, 160),
      course_logistics: optionalClean(payload.course_logistics, 2500),
      bq_certification: optionalClean(payload.bq_certification, 1000),
      race_schedule: optionalClean(payload.race_schedule, 2500),
      sponsors: optionalClean(payload.sponsors, 2000),
      faqs: optionalClean(payload.faqs, 2500),
      volunteer_info: optionalClean(payload.volunteer_info, 1200),
      email_capture: optionalClean(payload.email_capture, 1200),
      identity_hero_image: optionalClean(payload.identity_hero_image, 500),
      assets_link: optionalClean(payload.assets_link, 800),
      domain_dns_status: optionalClean(payload.domain_dns_status, 160),
      domain_email_status: optionalClean(payload.domain_email_status, 160),
      analytics_search_status: optionalClean(payload.analytics_search_status, 160),
      final_approver: optionalClean(payload.final_approver, 240),
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
  if (row.metadata.current_domain && !isHttpUrl(row.metadata.current_domain)) errors.current_domain = 'Use a valid current race website/domain URL.';
  if (row.metadata.assets_link && !isHttpUrl(row.metadata.assets_link)) errors.assets_link = 'Use a valid shared Drive, Dropbox, or folder URL.';
  return errors;
};

const buildHandoffChecklist = ({ row, intakeId }) => {
  const missing = [];
  if (!row.race_name) missing.push('race name');
  if (!row.contact_name || !row.contact_email) missing.push('primary contact');
  if (!row.event_date) missing.push('event date');
  if (!row.event_location) missing.push('event location');
  if (!row.registration_url) missing.push('registration URL');
  if (!row.metadata.assets_link) missing.push('shared asset folder');
  if (!row.metadata.event_timezone) missing.push('event timezone');
  if (!row.metadata.current_domain) missing.push('current race website/domain');
  if (!row.metadata.distances_pricing) missing.push('distances/pricing');
  if (!row.metadata.course_logistics) missing.push('course/logistics');

  return {
    intake_id: intakeId || null,
    race_name: row.race_name,
    contact_email: row.contact_email,
    event_date_present: Boolean(row.event_date),
    event_location_present: Boolean(row.event_location),
    event_timezone_present: Boolean(row.metadata.event_timezone),
    current_domain_present: Boolean(row.metadata.current_domain),
    registration_url_present: Boolean(row.registration_url),
    assets_link_present: Boolean(row.metadata.assets_link),
    missing_critical_inputs: missing,
    suggested_next_steps: [
      'Review intake details and shared assets.',
      missing.length ? 'Request missing critical inputs before build production.' : 'Queue build production and create the project brief.',
      'Confirm staging timeline with Steve/support.',
    ],
  };
};

const dependencyStatusFromAnswer = (value) => {
  const normalized = normalizeMatchValue(value);
  if (!normalized) return 'unknown';
  if (normalized.includes('don’t know') || normalized.includes("don't know")) return 'customer_unsure';
  if (normalized.includes('not use email') || normalized.includes('set this up fresh')) return 'not_needed';
  if (normalized.includes('control it') || normalized.includes('grant access')) return 'confirmed';
  return 'requested';
};

const buildLaunchReadinessDependencySnapshot = ({ row, checklist }) => ({
  registration: {
    status: row.registration_url ? 'confirmed' : 'requested',
    registration_url_present: Boolean(row.registration_url),
    platform: row.metadata.registration_platform || null,
    current_status: row.metadata.registration_status || null,
    pricing_confidence: row.metadata.pricing_confidence || null,
  },
  domain_dns: {
    status: row.metadata.domain_dns_status ? dependencyStatusFromAnswer(row.metadata.domain_dns_status) : (row.metadata.current_domain ? 'requested' : 'unknown'),
    current_domain_present: Boolean(row.metadata.current_domain),
    current_domain: row.metadata.current_domain || null,
    owner_answer: row.metadata.domain_dns_status || null,
  },
  domain_email: {
    status: dependencyStatusFromAnswer(row.metadata.domain_email_status),
    owner_answer: row.metadata.domain_email_status || null,
  },
  analytics_search: {
    status: dependencyStatusFromAnswer(row.metadata.analytics_search_status),
    owner_answer: row.metadata.analytics_search_status || null,
  },
  assets_permissions: {
    status: row.metadata.assets_link ? 'confirmed' : 'requested',
    assets_link_present: Boolean(row.metadata.assets_link),
  },
  final_approval: {
    status: row.metadata.final_approver ? 'confirmed' : row.contact_name && row.contact_email ? 'requested' : 'unknown',
    approver_candidate: row.metadata.final_approver || row.contact_name || null,
  },
  missing_critical_inputs: checklist.missing_critical_inputs,
});

const scoreCustomerMatch = (candidate, row) => {
  const email = normalizeMatchValue(row.contact_email);
  const raceName = normalizeMatchValue(row.race_name);
  const candidateRace = normalizeMatchValue(candidate.race_name);
  const primaryEmail = normalizeMatchValue(candidate.primary_contact_email);
  const billingEmail = normalizeMatchValue(candidate.billing_contact_email);
  if (!email || !raceName || candidateRace !== raceName || (primaryEmail !== email && billingEmail !== email)) return -1;

  const hasPostDepositSignal = candidate.deposit_status === 'paid'
    || ['ready', 'started'].includes(candidate.kickoff_status)
    || ['ready_to_send', 'sent', 'received'].includes(candidate.intake_status)
    || ['kickoff_ready', 'build_queued', 'customer_active'].includes(candidate.customer_status);
  if (!hasPostDepositSignal) return -1;

  let score = 0;
  if (primaryEmail === email) score += 4;
  if (billingEmail === email) score += 3;
  if (candidate.deposit_status === 'paid') score += 4;
  if (['kickoff_ready', 'build_queued', 'customer_active'].includes(candidate.customer_status)) score += 3;
  if (['sent', 'ready_to_send', 'received'].includes(candidate.intake_status)) score += 2;
  if (['started', 'ready'].includes(candidate.kickoff_status)) score += 1;
  return score;
};

const findMatchingCustomerRecord = async ({ supabaseUrl, serviceKey, row }) => {
  const email = normalizeMatchValue(row.contact_email);
  const query = new URLSearchParams({
    select: 'id,race_name,primary_contact_email,billing_contact_email,customer_status,deposit_status,intake_status,kickoff_status,created_at',
    or: `(primary_contact_email.ilike.${email},billing_contact_email.ilike.${email})`,
    race_name: `ilike.${row.race_name}`,
    order: 'created_at.desc',
    limit: '10',
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/customer_records?${query}`, {
    method: 'GET',
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      accept: 'application/json',
      'user-agent': 'StartLineSites/1.0 (customer-intake-handoff)',
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Customer record lookup failed: ${response.status} ${detail}`);
  }

  const candidates = await response.json();
  return (Array.isArray(candidates) ? candidates : [])
    .map((candidate) => ({ candidate, score: scoreCustomerMatch(candidate, row) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || String(b.candidate.created_at || '').localeCompare(String(a.candidate.created_at || '')))[0]?.candidate || null;
};

const updateBuildHandoff = async ({ supabaseUrl, serviceKey, row, record }) => {
  const customerRecord = await findMatchingCustomerRecord({ supabaseUrl, serviceKey, row });
  const checklist = buildHandoffChecklist({ row, intakeId: record?.id });
  const launchReadinessDependencies = buildLaunchReadinessDependencySnapshot({ row, checklist });
  const launchReadinessStatus = checklist.missing_critical_inputs.length ? 'needs_follow_up' : 'build_ready';
  if (!customerRecord) {
    console.warn('Customer intake build handoff skipped: no matching customer record found', { intakeId: record?.id, raceName: row.race_name, contactEmail: row.contact_email });
    return { customerRecord: null, checklist };
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/customer_records?id=eq.${encodeURIComponent(customerRecord.id)}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
      'user-agent': 'StartLineSites/1.0 (customer-intake-handoff)',
    },
    body: JSON.stringify({
      customer_intake_submission_id: record?.id || null,
      customer_status: 'build_queued',
      intake_status: 'received',
      launch_readiness_status: launchReadinessStatus,
      launch_readiness_submitted_at: new Date().toISOString(),
      launch_readiness_updated_at: new Date().toISOString(),
      launch_readiness_dependencies: launchReadinessDependencies,
      launch_blocker_summary: checklist.missing_critical_inputs.length
        ? `Missing critical inputs: ${checklist.missing_critical_inputs.join(', ')}`
        : null,
      domain_dns_status: launchReadinessDependencies.domain_dns.status,
      domain_email_status: launchReadinessDependencies.domain_email.status,
      analytics_status: launchReadinessDependencies.analytics_search.status,
      search_console_status: launchReadinessDependencies.analytics_search.status,
      registration_confirmation_status: row.registration_url ? 'confirmed' : 'requested',
      asset_permission_status: row.metadata.assets_link ? 'confirmed' : 'requested',
      final_approver_status: launchReadinessDependencies.final_approval.status,
      build_status: checklist.missing_critical_inputs.length ? 'blocked' : 'ready_for_build',
      build_handoff_at: new Date().toISOString(),
      build_handoff_checklist: checklist,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Customer record handoff update failed: ${response.status} ${detail}`);
    error.customerRecord = customerRecord;
    throw error;
  }

  return { customerRecord, checklist };
};

const sendSupportNotification = async ({ record, row, customerRecord, checklist }) => {
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
  const customerRecordId = customerRecord?.id || 'Not matched';
  const handoffChecklist = checklist || buildHandoffChecklist({ row, intakeId: record?.id });
  const missingCriticalInputs = handoffChecklist.missing_critical_inputs.length
    ? handoffChecklist.missing_critical_inputs.join(', ')
    : 'None';
  const lines = [
    'A new StartLine Sites customer intake was submitted.',
    '',
    'Build handoff checklist',
    fieldLine('Race', row.race_name),
    fieldLine('Contact', `${row.contact_name} <${row.contact_email}>`),
    fieldLine('Event date/location/timezone', [row.event_date, row.event_location, row.metadata.event_timezone].filter(Boolean).join(' — ')),
    fieldLine('Current domain', row.metadata.current_domain),
    fieldLine('Registration URL', row.registration_url),
    fieldLine('Asset link', row.metadata.assets_link),
    fieldLine('Missing critical inputs', missingCriticalInputs),
    fieldLine('Supabase intake ID', rowId),
    fieldLine('Customer record ID', customerRecordId),
    'Suggested next steps:',
    ...handoffChecklist.suggested_next_steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    'Full intake detail',
    fieldLine('Race name', row.race_name),
    fieldLine('Organization', row.organization_name),
    fieldLine('Contact', `${row.contact_name} <${row.contact_email}>`),
    fieldLine('Event date', row.event_date),
    fieldLine('Location', row.event_location),
    fieldLine('Event timezone', row.metadata.event_timezone),
    fieldLine('Current domain', row.metadata.current_domain),
    fieldLine('Derived domain host', row.metadata.derived_current_domain_host),
    fieldLine('Template preference', row.metadata.template_preference),
    fieldLine('Distances/pricing', row.metadata.distances_pricing),
    fieldLine('Registration platform', row.metadata.registration_platform),
    fieldLine('Registration URL', row.registration_url),
    fieldLine('Course/logistics', row.metadata.course_logistics),
    fieldLine('BQ/certification', row.metadata.bq_certification),
    fieldLine('Schedule', row.metadata.race_schedule),
    fieldLine('Sponsors', row.metadata.sponsors),
    fieldLine('FAQs', row.metadata.faqs),
    fieldLine('Volunteer info', row.metadata.volunteer_info),
    fieldLine('Email capture preference', row.metadata.email_capture),
    fieldLine('Preferred hero image', row.metadata.identity_hero_image),
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
      html: `<h2>New StartLine Sites customer intake</h2><h3>Build handoff checklist</h3>${[
        ['Race', row.race_name],
        ['Contact', `${row.contact_name} <${row.contact_email}>`],
        ['Event date/location/timezone', [row.event_date, row.event_location, row.metadata.event_timezone].filter(Boolean).join(' — ')],
        ['Current domain', row.metadata.current_domain],
        ['Registration URL', row.registration_url],
        ['Asset link', row.metadata.assets_link],
        ['Missing critical inputs', missingCriticalInputs],
        ['Supabase intake ID', rowId],
        ['Customer record ID', customerRecordId],
        ['Suggested next steps', handoffChecklist.suggested_next_steps.join('\n')],
      ].map(([label, value]) => htmlField(label, value)).join('')}<h3>Full intake detail</h3>${[
        ['Race name', row.race_name],
        ['Organization', row.organization_name],
        ['Contact', `${row.contact_name} <${row.contact_email}>`],
        ['Event date', row.event_date],
        ['Location', row.event_location],
        ['Event timezone', row.metadata.event_timezone],
        ['Current domain', row.metadata.current_domain],
        ['Derived domain host', row.metadata.derived_current_domain_host],
        ['Template preference', row.metadata.template_preference],
        ['Distances/pricing', row.metadata.distances_pricing],
        ['Registration platform', row.metadata.registration_platform],
        ['Registration URL', row.registration_url],
        ['Course/logistics', row.metadata.course_logistics],
        ['BQ/certification', row.metadata.bq_certification],
        ['Schedule', row.metadata.race_schedule],
        ['Sponsors', row.metadata.sponsors],
        ['FAQs', row.metadata.faqs],
        ['Volunteer info', row.metadata.volunteer_info],
        ['Email capture preference', row.metadata.email_capture],
        ['Preferred hero image', row.metadata.identity_hero_image],
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

export const renderCustomerIntakeConfirmationEmail = ({ row, checklistUrl }) => {
  const text = [
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
    CLIENT_SIGNATURE_TEXT,
  ].join('\n');

  const html = renderBrandedEmail({
    preheader: `We received the StartLine intake for ${row.race_name}.`,
    heading: `We received your intake for ${row.race_name}`,
    body: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(row.contact_name)},</p>
      <p style="margin:0 0 18px;">Thanks — we received the StartLine Sites 20–30 minute intake for <strong>${escapeHtml(row.race_name)}</strong>.</p>
      ${renderInfoCard({
        title: 'What happens next',
        children: `<ol style="margin:0;padding-left:20px;color:#DDE7F3;"><li>We review your intake and shared asset folder.</li><li>We follow up with any short list of missing details before production starts.</li><li>Once intake and usable assets are complete, we begin the build timeline.</li></ol>`,
      })}
      ${renderEmailButton({ href: checklistUrl, label: 'Review the asset checklist' })}
      <p style="margin:10px 0 0;">Reply to this email if anything in the intake should change.</p>
      ${renderSignatureHtml()}
    `,
  });

  return { text, html };
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
  const { text, html } = renderCustomerIntakeConfirmationEmail({ row, checklistUrl });

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
      text,
      html,
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
  let handoff = { customerRecord: null, checklist: buildHandoffChecklist({ row, intakeId: record?.id }) };

  try {
    handoff = await updateBuildHandoff({ supabaseUrl, serviceKey, row, record });
  } catch (error) {
    console.error('Customer intake build handoff update failed', error);
    handoff = {
      customerRecord: error.customerRecord || null,
      checklist: buildHandoffChecklist({ row, intakeId: record?.id }),
    };
  }

  try {
    await sendSupportNotification({ record, row, ...handoff });
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
