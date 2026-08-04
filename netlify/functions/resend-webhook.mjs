import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TOLERANCE_SECONDS = 300;
const MAX_BODY_BYTES = Number(process.env.STARTLINE_RESEND_WEBHOOK_MAX_BODY_BYTES || 100_000);

const SUPPORTED_EVENTS = new Map([
  ['email.delivered', 'delivered'],
  ['delivered', 'delivered'],
  ['email.opened', 'opened'],
  ['opened', 'opened'],
  ['email.clicked', 'clicked'],
  ['clicked', 'clicked'],
  ['email.bounced', 'bounced'],
  ['bounced', 'bounced'],
  ['email.complained', 'complained'],
  ['complained', 'complained'],
  ['email.unsubscribed', 'unsubscribed'],
  ['unsubscribed', 'unsubscribed'],
  ['email.suppressed', 'suppressed'],
  ['suppressed', 'suppressed'],
]);

const SUPPRESSION_REASONS = {
  bounced: 'bounce',
  complained: 'complaint',
  unsubscribed: 'unsubscribe',
  suppressed: 'manual_suppression',
};

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'password',
  'secret',
  'signature',
  'svix-signature',
  'token',
  'api_key',
  'apikey',
]);

const SENSITIVE_QUERY_PARAMS = new Set([
  'token',
  't',
  'access_token',
  'private_token',
  'preview_token',
  'mockup_token',
  'auth',
  'signature',
  'sig',
  'key',
]);

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /https?:\/\/[^\s"'<>]+/gi;

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

const lowerHeaderMap = (headers = {}) => Object.fromEntries(
  Object.entries(headers || {}).map(([key, value]) => [String(key).toLowerCase(), String(value)]),
);

const header = (headers, name) => headers[String(name).toLowerCase()] || '';

export const getRawBody = (event) => {
  if (!event?.body) return '';
  return event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
};

const decodeSvixSecret = (secret) => {
  const cleaned = clean(secret, 2000);
  if (!cleaned) return null;
  const candidate = cleaned.startsWith('whsec_') ? cleaned.slice('whsec_'.length) : cleaned;
  try {
    const decoded = Buffer.from(candidate, 'base64');
    if (decoded.length > 0) return decoded;
  } catch {
    // Fall through to utf8 fallback for local tests/manual secrets.
  }
  return Buffer.from(cleaned, 'utf8');
};

const safeEqualBase64 = (expected, actual) => {
  const expectedBuffer = Buffer.from(expected, 'base64');
  const actualBuffer = Buffer.from(actual, 'base64');
  if (!expectedBuffer.length || expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
};

const parseSvixSignatures = (signatureHeader) => Array.from(
  clean(signatureHeader, 5000).matchAll(/(?:^|\s|,)v1[=,]([^\s,]+)/g),
  (match) => ({ version: 'v1', signature: clean(match[1], 500) }),
).filter((part) => part.signature);

export const verifyResendSignature = ({
  rawBody,
  headers = {},
  secret,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
  nowSeconds = Math.floor(Date.now() / 1000),
}) => {
  const normalizedHeaders = lowerHeaderMap(headers);
  const id = clean(header(normalizedHeaders, 'svix-id'), 200);
  const timestampRaw = clean(header(normalizedHeaders, 'svix-timestamp'), 50);
  const timestamp = Number.parseInt(timestampRaw, 10);
  const signatures = parseSvixSignatures(header(normalizedHeaders, 'svix-signature'));
  const key = decodeSvixSecret(secret);

  if (!key || !id || !Number.isFinite(timestamp) || !signatures.length) {
    return { ok: false, reason: 'missing_signature_fields' };
  }
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return { ok: false, reason: 'stale_signature' };
  }

  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${rawBody}`, 'utf8')
    .digest('base64');

  const valid = signatures.some(({ signature }) => safeEqualBase64(expected, signature));
  return valid ? { ok: true, id, timestamp } : { ok: false, reason: 'invalid_signature' };
};

const parseJson = (rawBody) => {
  try {
    return { ok: true, value: JSON.parse(rawBody) };
  } catch {
    return { ok: false };
  }
};

const getDeep = (source, paths) => {
  for (const path of paths) {
    let value = source;
    for (const key of path) value = value?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
};

const firstString = (...values) => {
  for (const value of values.flat()) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const nested = firstString(...value);
      if (nested) return nested;
    }
  }
  return '';
};

const normalizeEmail = (email) => clean(email, 320).toLowerCase();

const hashRecipient = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return '';
  const salt = process.env.STARTLINE_RECIPIENT_HASH_SALT || '';
  return createHash('sha256').update(`${salt}${normalized}`, 'utf8').digest('hex');
};

export const maskEmail = (email) => {
  const normalized = normalizeEmail(email);
  const [local, domain] = normalized.split('@');
  if (!local || !domain) return '';
  const visible = local.length <= 2 ? local[0] : local.slice(0, 2);
  return `${visible}***[at]${domain}`;
};

export const sanitizeUrl = (value) => {
  const cleaned = clean(value, 4000);
  if (!cleaned) return '';
  try {
    const url = new URL(cleaned);
    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) url.searchParams.set(key, '[redacted]');
    }
    return url.toString();
  } catch {
    return cleaned;
  }
};

const sanitizeString = (value) => value
  .replace(EMAIL_RE, (match) => maskEmail(match) || '[masked-email]')
  .replace(URL_RE, (match) => sanitizeUrl(match));

export const sanitizePayload = (value, depth = 0) => {
  if (depth > 8) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeString(value).slice(0, 4000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizePayload(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => {
          const normalizedKey = String(key).toLowerCase();
          return !SENSITIVE_KEYS.has(normalizedKey)
            && !/secret|signature|token|password|authorization|cookie|api[_-]?key/i.test(normalizedKey);
        })
        .slice(0, 100)
        .map(([key, item]) => [key, sanitizePayload(item, depth + 1)]),
    );
  }
  return String(value);
};

const eventTimestamp = (payload) => {
  const raw = getDeep(payload, [
    ['created_at'],
    ['createdAt'],
    ['timestamp'],
    ['data', 'created_at'],
    ['data', 'createdAt'],
    ['data', 'timestamp'],
  ]);
  if (typeof raw === 'number') return new Date(raw > 10_000_000_000 ? raw : raw * 1000).toISOString();
  const cleaned = clean(raw, 100);
  const parsed = cleaned ? new Date(cleaned) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
};

const normalizeEventType = (type) => SUPPORTED_EVENTS.get(clean(type, 80).toLowerCase()) || '';

const extractRecipientEmail = (payload) => firstString(
  getDeep(payload, [['data', 'to']]),
  getDeep(payload, [['data', 'email', 'to']]),
  getDeep(payload, [['data', 'recipient']]),
  getDeep(payload, [['data', 'recipient_email']]),
  getDeep(payload, [['to']]),
  getDeep(payload, [['recipient']]),
  getDeep(payload, [['recipient_email']]),
);

const extractClickedUrl = (payload, normalizedType) => {
  if (normalizedType !== 'clicked') return null;
  const value = getDeep(payload, [
    ['data', 'click', 'link'],
    ['data', 'click', 'url'],
    ['data', 'link'],
    ['data', 'url'],
    ['click', 'link'],
    ['click', 'url'],
    ['url'],
  ]);
  const clickedUrl = clean(value, 2000);
  if (!clickedUrl) return null;
  try {
    const url = new URL(clickedUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? sanitizeUrl(url.toString()) : null;
  } catch {
    return null;
  }
};

const deriveProviderEventId = ({ payload, svixId, eventType, providerMessageId, recipientEmail, clickedUrl }) => clean(
  firstString(payload.id, payload.event_id, getDeep(payload, [['data', 'id']]), svixId)
  || createHash('sha256')
    .update(['resend', providerMessageId, eventType, eventTimestamp(payload), normalizeEmail(recipientEmail), clickedUrl || ''].join('|'))
    .digest('hex'),
  200,
);

export const normalizeResendEvent = ({ payload, svixId }) => {
  const rawType = firstString(payload.type, payload.event, payload.event_type, getDeep(payload, [['data', 'type']]));
  const eventType = normalizeEventType(rawType);
  if (!eventType) return { ok: false, ignored: true, reason: 'unsupported_event_type', rawType: clean(rawType, 100) };

  const providerMessageId = clean(firstString(
    getDeep(payload, [['data', 'email_id']]),
    getDeep(payload, [['data', 'emailId']]),
    getDeep(payload, [['data', 'message_id']]),
    getDeep(payload, [['data', 'messageId']]),
    getDeep(payload, [['email_id']]),
    getDeep(payload, [['message_id']]),
  ), 200);
  if (!providerMessageId) return { ok: false, reason: 'missing_provider_message_id' };

  const recipientEmail = extractRecipientEmail(payload);
  const clickedUrl = extractClickedUrl(payload, eventType);
  const providerEventId = deriveProviderEventId({
    payload,
    svixId,
    eventType,
    providerMessageId,
    recipientEmail,
    clickedUrl,
  });

  return {
    ok: true,
    event: {
      provider: 'resend',
      provider_event_id: providerEventId,
      provider_message_id: providerMessageId,
      resend_email_id: providerMessageId,
      event_type: eventType,
      event_timestamp: eventTimestamp(payload),
      recipient_email_hash: hashRecipient(recipientEmail) || null,
      recipient_email_masked: maskEmail(recipientEmail) || null,
      clicked_url: clickedUrl,
      campaign_id: clean(firstString(getDeep(payload, [['data', 'tags', 'campaign_id']]), getDeep(payload, [['data', 'campaign_id']]), payload.campaign_id), 200) || null,
      raw_event: sanitizePayload(payload),
    },
  };
};

const supabaseFetch = async ({ supabaseUrl, serviceKey, path, method = 'GET', body, headers = {} }) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Supabase ${method} ${path} failed: ${response.status}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const findOutreach = async ({ supabaseUrl, serviceKey, resendEmailId }) => {
  const query = new URLSearchParams({
    resend_email_id: `eq.${resendEmailId}`,
    select: 'id,prospect_id,generation_job_id,campaign_id',
    limit: '1',
  });
  const rows = await supabaseFetch({
    supabaseUrl,
    serviceKey,
    path: `race_mockup_outreach?${query.toString()}`,
  });
  return Array.isArray(rows) ? rows[0] || null : null;
};

const insertEngagementEvent = async ({ supabaseUrl, serviceKey, event }) => {
  try {
    const rows = await supabaseFetch({
      supabaseUrl,
      serviceKey,
      path: 'outreach_engagement_events?on_conflict=provider,provider_event_id',
      method: 'POST',
      body: event,
      headers: { prefer: 'resolution=ignore-duplicates,return=representation' },
    });
    return { duplicate: Array.isArray(rows) && rows.length === 0, record: Array.isArray(rows) ? rows[0] || null : null };
  } catch (error) {
    if (error.status === 409) return { duplicate: true, record: null };
    throw error;
  }
};

const upsertSuppression = async ({ supabaseUrl, serviceKey, event, eventRecord }) => {
  const reason = SUPPRESSION_REASONS[event.event_type];
  if (!reason || !event.recipient_email_hash) return { skipped: true };

  const body = {
    recipient_email_hash: event.recipient_email_hash,
    recipient_email_masked: event.recipient_email_masked,
    reason,
    source_provider: 'resend',
    source_event_id: eventRecord?.id || null,
    source_outreach_id: event.outreach_id || null,
    notes: `Created from Resend ${event.event_type} webhook event.`,
  };

  await supabaseFetch({
    supabaseUrl,
    serviceKey,
    path: 'outreach_suppressions?on_conflict=recipient_email_hash',
    method: 'POST',
    body,
    headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
  });
  return { skipped: false };
};

const resolveConfig = () => {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const missing = [];
  if (!webhookSecret) missing.push('RESEND_WEBHOOK_SECRET');
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  return { supabaseUrl, serviceKey, webhookSecret, missing };
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { 'cache-control': 'no-store' }, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' });

  const config = resolveConfig();
  if (config.missing.length) {
    return json(500, { ok: false, error: 'Resend webhook service is not configured.', missing: config.missing });
  }

  const rawBody = getRawBody(event);
  if (!rawBody || Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return json(400, { ok: false, error: 'Invalid webhook body.' });
  }

  const headers = lowerHeaderMap(event.headers || {});
  const signature = verifyResendSignature({ rawBody, headers, secret: config.webhookSecret });
  if (!signature.ok) return json(401, { ok: false, error: 'Invalid webhook signature.' });

  const parsed = parseJson(rawBody);
  if (!parsed.ok) return json(400, { ok: false, error: 'Malformed webhook JSON.' });

  const normalized = normalizeResendEvent({ payload: parsed.value, svixId: signature.id });
  if (normalized.ignored) return json(200, { ok: true, ignored: true, reason: normalized.reason });
  if (!normalized.ok) return json(400, { ok: false, error: normalized.reason || 'Malformed Resend webhook event.' });

  try {
    const outreach = await findOutreach({
      supabaseUrl: config.supabaseUrl,
      serviceKey: config.serviceKey,
      resendEmailId: normalized.event.resend_email_id,
    });

    const row = {
      ...normalized.event,
      outreach_id: outreach?.id || null,
      prospect_id: outreach?.prospect_id || null,
      generation_job_id: outreach?.generation_job_id || null,
      campaign_id: normalized.event.campaign_id || outreach?.campaign_id || null,
    };

    const inserted = await insertEngagementEvent({
      supabaseUrl: config.supabaseUrl,
      serviceKey: config.serviceKey,
      event: row,
    });

    if (!inserted.duplicate) {
      await upsertSuppression({
        supabaseUrl: config.supabaseUrl,
        serviceKey: config.serviceKey,
        event: row,
        eventRecord: inserted.record,
      });
    }

    return json(200, {
      ok: true,
      duplicate: inserted.duplicate,
      event_type: row.event_type,
      outreach_matched: Boolean(row.outreach_id),
      suppression_prepared: Boolean(SUPPRESSION_REASONS[row.event_type] && row.recipient_email_hash && !inserted.duplicate),
    });
  } catch (error) {
    console.error('Resend webhook processing failed', {
      status: error.status || 500,
      message: error.message,
    });
    return json(500, { ok: false, error: 'Resend webhook processing failed.' });
  }
}
