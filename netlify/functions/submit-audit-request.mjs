import { createHash } from 'node:crypto';

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

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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

  const errors = {};
  if (!raceName) errors.race_name = 'Race name is required.';
  if (!currentUrl || !isHttpUrl(currentUrl)) errors.current_url = 'A valid race website or registration URL is required.';
  if (!contactName) errors.contact_name = 'Your name is required.';
  if (!contactEmail || !isEmail(contactEmail)) errors.contact_email = 'A valid email is required.';

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
    status: 'new',
    outreach_status: 'not_started',
    deposit_status: 'not_sent',
    metadata: {
      submitted_from: 'startlinesites.com',
      form_version: 'audit_request_v1',
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
  return json(201, {
    ok: true,
    id: record?.id,
    message: 'Thanks — your private audit request was received.',
  });
}
