import { createHash } from 'node:crypto';

import { clean, parseEmailList } from './mockup-outreach-log.mjs';

export const normalizeSuppressionEmail = (email) => clean(email, 320).toLowerCase();

export const hashSuppressionRecipient = (email, { env = process.env } = {}) => {
  const normalized = normalizeSuppressionEmail(email);
  if (!normalized) return '';
  const salt = env.STARTLINE_RECIPIENT_HASH_SALT || '';
  return createHash('sha256').update(`${salt}${normalized}`, 'utf8').digest('hex');
};

export const maskSuppressionEmail = (email) => {
  const normalized = normalizeSuppressionEmail(email);
  const [local, domain] = normalized.split('@');
  if (!local || !domain) return '';
  const visible = local.length <= 2 ? local[0] : local.slice(0, 2);
  return `${visible}***[at]${domain}`;
};

export const collectSuppressionRecipients = (payload = {}) => {
  const recipients = [
    ...parseEmailList(payload.to_emails || payload.toEmails),
    ...parseEmailList(payload.cc_emails || payload.ccEmails),
  ];

  const seen = new Set();
  return recipients.filter((email) => {
    if (!email || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
};

export const buildSuppressionLookup = (payload = {}, { env = process.env } = {}) => {
  const recipients = collectSuppressionRecipients(payload);
  const lookup = recipients
    .map((email) => ({
      email,
      masked_email: maskSuppressionEmail(email),
      recipient_email_hash: hashSuppressionRecipient(email, { env }),
    }))
    .filter((item) => item.recipient_email_hash);

  const hashes = lookup.map((item) => item.recipient_email_hash);
  const query = hashes.length
    ? `outreach_suppressions?select=${encodeURIComponent('id,recipient_email_hash,recipient_email_masked,reason,source_provider,source_outreach_id,created_at,updated_at,notes')}&recipient_email_hash=in.(${hashes.map(encodeURIComponent).join(',')})&limit=${hashes.length}`
    : null;

  return { recipients: lookup, hashes, query };
};

export const findSuppressedRecipients = async ({ payload, supabaseRequest, env = process.env } = {}) => {
  if (typeof supabaseRequest !== 'function') throw new Error('supabaseRequest is required.');
  const lookup = buildSuppressionLookup(payload, { env });
  if (!lookup.query) return { blocked: false, recipients_checked: [], suppressions: [] };

  const rows = await supabaseRequest({ path: lookup.query });
  const byHash = new Map(lookup.recipients.map((item) => [item.recipient_email_hash, item]));
  const suppressions = (rows || []).map((row) => {
    const recipient = byHash.get(row.recipient_email_hash) || {};
    return {
      id: row.id,
      recipient_email_hash: row.recipient_email_hash,
      recipient_email_masked: row.recipient_email_masked || recipient.masked_email || null,
      reason: row.reason,
      source_provider: row.source_provider || null,
      source_outreach_id: row.source_outreach_id || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
      notes: row.notes || null,
    };
  });

  return {
    blocked: suppressions.length > 0,
    recipients_checked: lookup.recipients.map((item) => ({
      recipient_email_hash: item.recipient_email_hash,
      recipient_email_masked: item.masked_email,
    })),
    suppressions,
  };
};

export const buildSuppressionBlockedResult = ({ generationJobId = null, suppression = {}, duplicateFilters = [] } = {}) => ({
  ok: false,
  blocked: true,
  reason: 'recipient_suppressed',
  generation_job_id: generationJobId,
  suppressions: suppression.suppressions || [],
  recipients_checked: suppression.recipients_checked || [],
  duplicate_filters: duplicateFilters,
});
