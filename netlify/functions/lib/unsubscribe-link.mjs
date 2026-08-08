import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const DEFAULT_STARTLINE_UNSUBSCRIBE_EMAIL = 'support@startlinesites.com';
export const DEFAULT_STARTLINE_SITE_URL = 'https://startlinesites.com';

export const clean = (value, max = 1000) => {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, max);
};

export const normalizeEmail = (email) => clean(email, 320).toLowerCase();

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

export const maskEmail = (email) => {
  const normalized = normalizeEmail(email);
  const [local, domain] = normalized.split('@');
  if (!local || !domain) return '';
  const visible = local.length <= 2 ? local[0] : local.slice(0, 2);
  return `${visible}***[at]${domain}`;
};

export const hashRecipient = (email, { env = process.env } = {}) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return '';
  const salt = env.STARTLINE_RECIPIENT_HASH_SALT || '';
  return createHash('sha256').update(`${salt}${normalized}`, 'utf8').digest('hex');
};

const base64UrlEncode = (value) => Buffer
  .from(value, 'utf8')
  .toString('base64url');

const base64UrlDecode = (value) => Buffer
  .from(String(value || ''), 'base64url')
  .toString('utf8');

const signatureForPayload = (payload, secret) => createHmac('sha256', secret)
  .update(payload, 'utf8')
  .digest('base64url');

const safeEqual = (expected, actual) => {
  const expectedBuffer = Buffer.from(String(expected || ''), 'base64url');
  const actualBuffer = Buffer.from(String(actual || ''), 'base64url');
  return expectedBuffer.length > 0
    && expectedBuffer.length === actualBuffer.length
    && timingSafeEqual(expectedBuffer, actualBuffer);
};

export const getStartLineSiteUrl = ({ env = process.env } = {}) => clean(
  env.STARTLINE_SITE_URL || env.URL || DEFAULT_STARTLINE_SITE_URL,
  1000,
).replace(/\/+$/g, '');

export const getFallbackUnsubscribeUrl = ({ env = process.env } = {}) => clean(
  env.STARTLINE_UNSUBSCRIBE_URL
    || `mailto:${DEFAULT_STARTLINE_UNSUBSCRIBE_EMAIL}?subject=Unsubscribe%20from%20StartLine%20Sites`,
  1000,
);

export const buildUnsubscribePayload = ({ recipientEmail, outreachId, campaignId, createdAt = new Date().toISOString() } = {}) => {
  const email = normalizeEmail(recipientEmail);
  if (!isEmail(email)) return null;
  return {
    email,
    ...(clean(outreachId, 120) ? { outreachId: clean(outreachId, 120) } : {}),
    ...(clean(campaignId, 200) ? { campaignId: clean(campaignId, 200) } : {}),
    createdAt,
  };
};

export const createSignedUnsubscribeToken = ({ recipientEmail, outreachId, campaignId, env = process.env, createdAt } = {}) => {
  const secret = clean(env.UNSUBSCRIBE_SECRET, 2000);
  const payload = buildUnsubscribePayload({ recipientEmail, outreachId, campaignId, createdAt });
  if (!secret || !payload) return null;
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signatureForPayload(encodedPayload, secret);
  return { payload: encodedPayload, signature };
};

export const createSignedUnsubscribeUrl = ({ recipientEmail, outreachId, campaignId, env = process.env, createdAt } = {}) => {
  const signed = createSignedUnsubscribeToken({ recipientEmail, outreachId, campaignId, env, createdAt });
  if (!signed) return getFallbackUnsubscribeUrl({ env });
  const url = new URL('/.netlify/functions/unsubscribe', getStartLineSiteUrl({ env }));
  url.searchParams.set('p', signed.payload);
  url.searchParams.set('s', signed.signature);
  return url.toString();
};

export const verifySignedUnsubscribeToken = ({ payload, signature, env = process.env } = {}) => {
  const secret = clean(env.UNSUBSCRIBE_SECRET, 2000);
  const encodedPayload = clean(payload, 5000);
  const providedSignature = clean(signature, 5000);
  if (!secret || !encodedPayload || !providedSignature) return { ok: false, reason: 'missing_token' };

  const expectedSignature = signatureForPayload(encodedPayload, secret);
  if (!safeEqual(expectedSignature, providedSignature)) return { ok: false, reason: 'invalid_signature' };

  try {
    const decoded = JSON.parse(base64UrlDecode(encodedPayload));
    const email = normalizeEmail(decoded.email);
    if (!isEmail(email)) return { ok: false, reason: 'invalid_email' };
    return {
      ok: true,
      email,
      outreachId: clean(decoded.outreachId, 120) || null,
      campaignId: clean(decoded.campaignId, 200) || null,
      createdAt: clean(decoded.createdAt, 80) || null,
    };
  } catch {
    return { ok: false, reason: 'invalid_payload' };
  }
};
