import { buildDuplicateFilters } from './mockup-outreach-log.mjs';
import {
  buildOutreachInputFromGenerationJob,
  validateGenerationJobSendReadiness,
} from './mockup-generation-outreach-handoff.mjs';
import {
  DEFAULT_MOCKUP_OUTREACH_FROM,
  DEFAULT_MOCKUP_OUTREACH_REPLY_TO,
  assertBrandedMockupOutreachHtml,
  buildResendMockupOutreachPayload,
  renderPrivateMockupOutreachEmail,
  validateMockupOutreachSend,
} from './mockup-outreach-send-gate.mjs';
import { buildMockupOutreachPayload } from './mockup-outreach-log.mjs';

const encode = (value) => encodeURIComponent(String(value || '').trim());
const firstRow = (rows) => Array.isArray(rows) && rows.length ? rows[0] : null;
const normalizeObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

export const buildGenerationJobQuery = (generationJobId) => {
  if (!String(generationJobId || '').trim()) throw new Error('generationJobId is required.');
  return `race_mockup_generation_jobs?select=*&id=eq.${encode(generationJobId)}&limit=1`;
};

export const buildProspectQuery = (prospectId) => {
  if (!String(prospectId || '').trim()) return null;
  return `race_mockup_prospects?select=*&id=eq.${encode(prospectId)}&limit=1`;
};

export const createSupabaseRestRequester = ({ fetchImpl = fetch, env = process.env } = {}) => async ({ path, method = 'GET', body }) => {
  const supabaseUrl = env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

  const response = await fetchImpl(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
      ...(method === 'POST' || method === 'PATCH' ? { prefer: 'return=representation' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase ${method} ${path} failed: ${response.status} ${detail}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

export const sendWithResend = async ({ apiKey = process.env.RESEND_API_KEY || process.env.STARTLINE_RESEND_API_KEY, fetchImpl = fetch, ...message } = {}) => {
  const payload = buildResendMockupOutreachPayload({ apiKey, ...message });
  const response = await fetchImpl(payload.endpoint, {
    method: 'POST',
    headers: payload.headers,
    body: JSON.stringify(payload.body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend send failed: ${response.status} ${detail}`);
  }

  return response.json();
};

export const findDuplicateMockupOutreach = async ({ payload, supabaseRequest }) => {
  const select = 'id,race_name,mockup_url,mockup_template,outreach_status,sent_at,to_emails,cc_emails,resend_email_id';
  const seen = new Map();

  for (const filter of buildDuplicateFilters(payload)) {
    const rows = await supabaseRequest({
      path: `race_mockup_outreach?select=${encodeURIComponent(select)}&${filter}&limit=10`,
    });
    for (const row of rows || []) seen.set(row.id, row);
  }

  return [...seen.values()];
};

const loadGenerationJobAndProspect = async ({ generationJobId, supabaseRequest }) => {
  const generationJob = firstRow(await supabaseRequest({ path: buildGenerationJobQuery(generationJobId) }));
  if (!generationJob) throw new Error(`No race_mockup_generation_jobs row found for ${generationJobId}.`);

  const prospectQuery = buildProspectQuery(generationJob.prospect_id);
  const prospect = prospectQuery ? firstRow(await supabaseRequest({ path: prospectQuery })) || {} : {};

  return { generationJob, prospect };
};

export const buildGenerationJobSendPreparation = ({ generationJob = {}, prospect = {}, ownerApprovedSend = false, overrides = {} } = {}) => {
  const readinessErrors = validateGenerationJobSendReadiness(generationJob, { ownerApprovedSend });
  const input = buildOutreachInputFromGenerationJob({ generationJob, prospect, overrides });
  const sendErrors = validateMockupOutreachSend(input);
  const email = renderPrivateMockupOutreachEmail({
    raceName: input.raceName,
    contactName: overrides.contactName,
    mockupUrl: input.mockupUrl,
    subject: input.subject,
    detail: input.detail,
  });
  const htmlErrors = assertBrandedMockupOutreachHtml({ html: email.html, mockupUrl: input.mockupUrl });
  const payload = buildMockupOutreachPayload({ ...input, subject: email.subject, outreachStatus: 'sent' });
  const errors = [...readinessErrors, ...sendErrors, ...htmlErrors];

  return {
    ok: errors.length === 0,
    errors,
    input,
    email,
    payload,
    duplicate_filters: buildDuplicateFilters(payload),
  };
};

export const sendMockupOutreachFromGenerationJob = async ({
  generationJobId,
  ownerApprovedSend = false,
  dryRun = false,
  overrides = {},
  supabaseRequest = createSupabaseRestRequester(),
  sendWithResend: send = sendWithResend,
} = {}) => {
  const { generationJob, prospect } = await loadGenerationJobAndProspect({ generationJobId, supabaseRequest });
  const prepared = buildGenerationJobSendPreparation({ generationJob, prospect, ownerApprovedSend, overrides });

  if (!prepared.ok) {
    return {
      ok: false,
      errors: prepared.errors,
      generation_job_id: generationJob.id || generationJobId,
      payload: prepared.payload,
      duplicate_filters: prepared.duplicate_filters,
    };
  }

  if (dryRun) {
    return {
      ok: true,
      dry_run: true,
      side_effects: 'none: no email, no Supabase insert, no generation-job mutation',
      generation_job_id: generationJob.id || generationJobId,
      prospect_id: generationJob.prospect_id || prospect.id || null,
      email: {
        subject: prepared.email.subject,
        text: prepared.email.text,
        html_checks: 'passed',
      },
      payload: prepared.payload,
      duplicate_filters: prepared.duplicate_filters,
    };
  }

  const duplicates = await findDuplicateMockupOutreach({ payload: prepared.payload, supabaseRequest });
  if (duplicates.length) {
    return {
      ok: false,
      blocked: true,
      reason: 'prior_mockup_outreach_found',
      generation_job_id: generationJob.id || generationJobId,
      duplicates,
    };
  }

  const fromEmail = overrides.fromEmail || DEFAULT_MOCKUP_OUTREACH_FROM;
  const replyToEmail = overrides.replyToEmail || DEFAULT_MOCKUP_OUTREACH_REPLY_TO;
  const resendResult = await send({
    to: prepared.input.toEmails.join(','),
    cc: Array.isArray(prepared.input.ccEmails) ? prepared.input.ccEmails.join(',') : prepared.input.ccEmails,
    bcc: Array.isArray(prepared.input.bccEmails) ? prepared.input.bccEmails.join(',') : prepared.input.bccEmails,
    subject: prepared.email.subject,
    text: prepared.email.text,
    html: prepared.email.html,
    from: fromEmail,
    replyTo: replyToEmail,
  });

  const outreachRows = await supabaseRequest({
    path: 'race_mockup_outreach',
    method: 'POST',
    body: {
      ...prepared.payload,
      resend_email_id: resendResult.id || null,
      from_email: fromEmail,
      reply_to_email: replyToEmail,
      metadata: {
        ...normalizeObject(prepared.payload.metadata),
        send_gate: 'scripts/send-mockup-outreach-from-job.mjs',
      },
    },
  });
  const outreachRow = firstRow(outreachRows) || {};

  if (outreachRow.id && generationJob.id) {
    await supabaseRequest({
      path: `race_mockup_generation_jobs?id=eq.${encode(generationJob.id)}`,
      method: 'PATCH',
      body: { outreach_id: outreachRow.id },
    });
  }

  return {
    ok: true,
    id: outreachRow.id || null,
    generation_job_id: generationJob.id || generationJobId,
    race_name: outreachRow.race_name || prepared.payload.race_name,
    mockup_url: outreachRow.mockup_url || prepared.payload.mockup_url,
    mockup_template: outreachRow.mockup_template || prepared.payload.mockup_template,
    resend_email_id: outreachRow.resend_email_id || resendResult.id || null,
    sent_at: outreachRow.sent_at || prepared.payload.sent_at,
  };
};
