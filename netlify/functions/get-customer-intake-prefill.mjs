import { createHash } from 'node:crypto';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,200}$/;

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

const optional = (value, max = 500) => clean(value, max) || null;

export const hashIntakeToken = (token) => createHash('sha256').update(token, 'utf8').digest('hex');

const supabaseFetch = async ({ supabaseUrl, serviceKey, path }) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: 'GET',
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      accept: 'application/json',
      'user-agent': 'StartLineSites/1.0 (customer-intake-prefill)',
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase GET ${path} failed: ${response.status} ${detail}`);
  }

  return response.json();
};

const setIfPresent = (prefill, fields, name, value, max = 500) => {
  const cleaned = optional(value, max);
  if (!cleaned) return;
  prefill[name] = cleaned;
  fields.push(name);
};

export const buildSafePrefill = ({ customerRecord, auditRequest }) => {
  const prefill = {};
  const fields = [];

  setIfPresent(prefill, fields, 'organization_name', customerRecord.organization_name, 180);
  setIfPresent(prefill, fields, 'race_name', customerRecord.race_name || auditRequest?.race_name, 180);
  setIfPresent(prefill, fields, 'contact_name', customerRecord.primary_contact_name || auditRequest?.contact_name, 180);
  setIfPresent(prefill, fields, 'contact_email', customerRecord.primary_contact_email || auditRequest?.contact_email, 254);
  setIfPresent(prefill, fields, 'contact_phone', auditRequest?.contact_phone, 80);
  setIfPresent(prefill, fields, 'event_date', auditRequest?.race_date, 80);
  setIfPresent(prefill, fields, 'event_location', auditRequest?.location, 240);
  setIfPresent(prefill, fields, 'current_domain', customerRecord.current_url || auditRequest?.current_url, 500);
  setIfPresent(prefill, fields, 'registration_url', customerRecord.registration_url || auditRequest?.registration_url, 500);
  setIfPresent(prefill, fields, 'registration_platform', auditRequest?.registration_platform, 160);
  setIfPresent(prefill, fields, 'template_preference', customerRecord.setup_tier, 120);

  return { prefill, fields };
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed.' });

  const token = clean(event.queryStringParameters?.token || '', 240);
  if (!TOKEN_PATTERN.test(token)) return json(400, { ok: false, error: 'A valid intake token is required.' });

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return json(500, { ok: false, error: 'Prefill service is not configured.' });

  const tokenHash = hashIntakeToken(token);
  const customerSelect = [
    'id',
    'audit_request_id',
    'race_name',
    'organization_name',
    'current_url',
    'registration_url',
    'primary_contact_name',
    'primary_contact_email',
    'setup_tier',
  ].join(',');

  let customerRows;
  try {
    customerRows = await supabaseFetch({
      supabaseUrl,
      serviceKey,
      path: `customer_records?select=${encodeURIComponent(customerSelect)}&intake_token_hash=eq.${encodeURIComponent(tokenHash)}&limit=1`,
    });
  } catch (error) {
    console.error('Customer intake prefill lookup failed', error);
    return json(502, { ok: false, error: 'Prefill lookup failed.' });
  }

  const customerRecord = Array.isArray(customerRows) ? customerRows[0] : null;
  if (!customerRecord) return json(404, { ok: false, error: 'Intake prefill was not found.' });

  let auditRequest = null;
  if (customerRecord.audit_request_id) {
    const auditSelect = [
      'id',
      'race_name',
      'current_url',
      'contact_name',
      'contact_email',
      'contact_phone',
      'race_date',
      'registration_url',
      'registration_platform',
      'location',
    ].join(',');

    try {
      const auditRows = await supabaseFetch({
        supabaseUrl,
        serviceKey,
        path: `audit_requests?select=${encodeURIComponent(auditSelect)}&id=eq.${encodeURIComponent(customerRecord.audit_request_id)}&limit=1`,
      });
      auditRequest = Array.isArray(auditRows) ? auditRows[0] : null;
    } catch (error) {
      console.error('Customer intake audit prefill merge failed', error);
    }
  }

  const { prefill, fields } = buildSafePrefill({ customerRecord, auditRequest });
  return json(200, {
    ok: true,
    prefill,
    source: {
      customer_record_id: customerRecord.id,
      audit_request_id: customerRecord.audit_request_id || null,
      fields,
    },
  });
}
