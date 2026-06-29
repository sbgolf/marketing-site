#!/usr/bin/env node

const DEFAULT_ENDPOINT = 'https://startlinesites.com/.netlify/functions/submit-audit-request';
const RUN_ID = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.join('=') || 'true'];
}));

const endpoint = args.get('endpoint') || process.env.STARTLINE_AUDIT_SMOKE_ENDPOINT || DEFAULT_ENDPOINT;
const contactEmail = args.get('contact-email') || process.env.STARTLINE_SMOKE_CONTACT_EMAIL || process.env.STARTLINE_ADMIN_EMAIL;
const shouldVerifySupabase = args.get('verify-supabase') === 'true' || process.env.STARTLINE_SMOKE_VERIFY_SUPABASE === 'true';
const shouldDeleteRecord = args.get('delete-record') === 'true' || process.env.STARTLINE_SMOKE_DELETE_RECORD === 'true';

if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
  console.error('Missing safe recipient: set STARTLINE_SMOKE_CONTACT_EMAIL to an owner-controlled inbox before running the normal smoke.');
  process.exit(2);
}

const redact = (value) => {
  if (!value) return value;
  return String(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[redacted-token]')
    .replace(/(apikey["']?\s*[:=]\s*["']?)[A-Za-z0-9._-]+/gi, '$1[redacted-key]');
};

const safeJson = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const normalPayload = {
  race_name: `StartLine Smoke Test ${RUN_ID}`,
  current_url: 'https://example.com/startline-smoke-test-race',
  contact_name: 'StartLine Smoke Test',
  contact_email: contactEmail,
  notes: `SAFE SMOKE TEST ${RUN_ID}: owner-controlled inbox only; delete/ignore before real outreach.`,
  company_website: '',
  package_tier: '',
  landing_page: `${new URL(endpoint).origin}/#audit?smoke=${RUN_ID}`,
  referrer: 'https://startlinesites.com/internal-smoke-gate',
};

const honeypotPayload = {
  ...normalPayload,
  race_name: `StartLine Honeypot Smoke ${RUN_ID}`,
  notes: `SAFE HONEYPOT SMOKE ${RUN_ID}: should not persist or notify.`,
  company_website: 'https://spam.example/honeypot-filled',
};

const postJson = async (payload) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': `StartLineAuditSmoke/1.0 ${RUN_ID}`,
    },
    body: JSON.stringify(payload),
  });
  return { status: response.status, body: await safeJson(response) };
};

const supabaseRequest = async (path, options = {}) => {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase verification.');
  }

  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = response.status === 204 ? null : await safeJson(response);
  if (!response.ok) {
    throw new Error(`Supabase ${options.method || 'GET'} ${path} failed: ${response.status} ${redact(JSON.stringify(body))}`);
  }
  return { status: response.status, body };
};

const verifySupabaseRow = async (id) => {
  const select = 'id,race_name,contact_email,status,outreach_status,deposit_status,metadata,created_at';
  const result = await supabaseRequest(`/rest/v1/audit_requests?id=eq.${encodeURIComponent(id)}&select=${encodeURIComponent(select)}`);
  const [row] = Array.isArray(result.body) ? result.body : [];
  if (!row) throw new Error(`Supabase row ${id} was not found.`);

  const workflow = row.metadata?.audit_workflow || {};
  const expected = {
    status: row.status === 'queued_for_site_review',
    outreach_status: row.outreach_status === 'steve_approval_required',
    deposit_status: row.deposit_status === 'not_sent',
    current_url_scrape_status: workflow.current_url_scrape_status === 'queued',
    steve_approval_status: workflow.steve_approval_status === 'required_before_customer_delivery',
    customer_delivery_status: workflow.customer_delivery_status === 'blocked_until_steve_approval',
    automation_scope: workflow.automation_scope === 'internal_draft_only_no_customer_send',
  };

  const failed = Object.entries(expected).filter(([, ok]) => !ok).map(([key]) => key);
  if (failed.length) throw new Error(`Supabase row ${id} failed workflow checks: ${failed.join(', ')}`);

  return {
    id: row.id,
    race_name: row.race_name,
    contact_email: '[redacted-email]',
    status: row.status,
    outreach_status: row.outreach_status,
    deposit_status: row.deposit_status,
    created_at: row.created_at,
    audit_workflow: workflow,
  };
};

const deleteSupabaseRow = async (id) => {
  await supabaseRequest(`/rest/v1/audit_requests?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { prefer: 'return=minimal' },
  });
};

const main = async () => {
  const output = {
    run_id: RUN_ID,
    endpoint,
    payload_notes: {
      normal: 'Fictional example.com race URL, owner-controlled contact inbox, empty honeypot.',
      honeypot: 'Same safe payload with company_website filled; expected 200 safe no-op with no id/message.',
    },
    normal: null,
    honeypot: null,
    supabase_verification: shouldVerifySupabase ? null : 'not requested; set STARTLINE_SMOKE_VERIFY_SUPABASE=true with Supabase service credentials',
    cleanup: shouldDeleteRecord ? null : 'not requested; smoke row intentionally left for owner notification/inbox verification unless STARTLINE_SMOKE_DELETE_RECORD=true',
  };

  const normal = await postJson(normalPayload);
  output.normal = {
    status: normal.status,
    ok: normal.body?.ok,
    id: normal.body?.id || null,
    message: normal.body?.message || null,
    checkout_url_present: Boolean(normal.body?.checkout_url),
    checkout_url_source: normal.body?.checkout_url_source || null,
  };

  if (normal.status !== 201 || normal.body?.ok !== true || !normal.body?.id) {
    throw new Error(`Normal smoke failed expected 201 with id: ${redact(JSON.stringify(output.normal))}`);
  }

  const honeypot = await postJson(honeypotPayload);
  output.honeypot = {
    status: honeypot.status,
    ok: honeypot.body?.ok,
    id_present: Boolean(honeypot.body?.id),
    message_present: Boolean(honeypot.body?.message),
  };

  if (honeypot.status !== 200 || honeypot.body?.ok !== true || honeypot.body?.id || honeypot.body?.message) {
    throw new Error(`Honeypot smoke failed expected 200 safe no-op: ${redact(JSON.stringify(output.honeypot))}`);
  }

  if (shouldVerifySupabase) {
    output.supabase_verification = await verifySupabaseRow(normal.body.id);
  }

  if (shouldDeleteRecord) {
    await deleteSupabaseRow(normal.body.id);
    output.cleanup = `deleted audit_requests row ${normal.body.id}`;
  }

  console.log(redact(JSON.stringify(output, null, 2)));
};

main().catch((error) => {
  console.error(redact(error.stack || error.message));
  process.exit(1);
});
