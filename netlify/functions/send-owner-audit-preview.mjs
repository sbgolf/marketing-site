const ALLOWED_METHODS = ['POST', 'OPTIONS'];
const MAX_BODY_BYTES = 20_000;

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

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const getHeader = (headers = {}, name) => {
  const target = name.toLowerCase();
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === target);
  return entry?.[1] || '';
};

const parseJsonBody = (event) => {
  if (!event.body) return {};
  if (event.body.length > MAX_BODY_BYTES) {
    const error = new Error('Request body is too large.');
    error.statusCode = 413;
    throw error;
  }

  try {
    return JSON.parse(event.body);
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.statusCode = 400;
    throw error;
  }
};

const isAuthorized = (event) => {
  const expectedToken = process.env.STARTLINE_OWNER_AUDIT_PREVIEW_TOKEN;
  if (!expectedToken) return false;

  const authorization = clean(getHeader(event.headers, 'authorization'), 2_000);
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const headerSecret = clean(getHeader(event.headers, 'x-startline-owner-preview-token'), 2_000);
  return bearer === expectedToken || headerSecret === expectedToken;
};

const getConfig = () => {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY || process.env.STARTLINE_RESEND_API_KEY;
  const to = clean(
    process.env.STARTLINE_OWNER_PREVIEW_EMAIL
      || process.env.STARTLINE_ADMIN_EMAIL
      || process.env.STARTLINE_LEAD_NOTIFY_EMAIL,
    254,
  );

  const missing = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!resendApiKey) missing.push('RESEND_API_KEY or STARTLINE_RESEND_API_KEY');
  if (!to) missing.push('STARTLINE_OWNER_PREVIEW_EMAIL or STARTLINE_ADMIN_EMAIL');
  if (missing.length) {
    const error = new Error(`Missing required runtime config: ${missing.join(', ')}`);
    error.statusCode = 500;
    throw error;
  }

  return { supabaseUrl, serviceKey, resendApiKey, to };
};

const firstString = (...values) => values.find((value) => clean(value, 10_000));

const getCustomerReadyDraft = (record) => firstString(
  record?.audit_summary?.customer_ready_draft,
  record?.audit_summary?.customer_ready?.draft,
  record?.audit_summary?.draft_customer_email,
  record?.audit_summary?.owner_preview?.customer_ready_draft,
);

const getTopFindings = (record) => {
  const summary = record?.audit_summary || {};
  const candidates = [
    record?.top_opportunities,
    summary.top_opportunities,
    summary.top_3_findings,
    summary.top_three_findings,
    summary.top3_findings,
    summary.customer_ready?.top_3_findings,
    summary.owner_preview?.top_3_findings,
  ];

  const array = candidates.find((candidate) => Array.isArray(candidate));
  return (array || [])
    .map((item) => {
      if (typeof item === 'string') return clean(item, 1_000);
      const title = clean(item?.title || item?.finding || item?.headline, 240);
      const detail = clean(item?.detail || item?.description || item?.recommendation, 700);
      return [title, detail].filter(Boolean).join(' — ');
    })
    .filter(Boolean)
    .slice(0, 3);
};

export const validatePreviewReady = (record) => {
  const customerReadyDraft = clean(getCustomerReadyDraft(record), 10_000);
  const topFindings = getTopFindings(record);
  const missing = [];
  if (!customerReadyDraft) missing.push('customer-ready draft');
  if (topFindings.length < 3) missing.push('top 3 findings');
  return {
    ok: missing.length === 0,
    missing,
    customerReadyDraft,
    topFindings,
  };
};

const fetchAuditRecord = async ({ auditId, supabaseUrl, serviceKey }) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/audit_requests?id=eq.${encodeURIComponent(auditId)}&select=*`, {
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase audit fetch failed: ${response.status} ${detail}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    const error = new Error('Audit request was not found.');
    error.statusCode = 404;
    throw error;
  }
  return rows[0];
};

export const buildOwnerPreviewEmail = ({ record, customerReadyDraft, topFindings }) => {
  const raceName = clean(record?.race_name, 160) || 'Unknown race';
  const currentUrl = clean(record?.current_url, 500) || 'Not provided';
  const contactName = clean(record?.contact_name, 160) || 'Not provided';
  const contactEmail = clean(record?.contact_email, 254) || 'Not provided';
  const privateMockupUrl = clean(record?.private_mockup_url || record?.metadata?.audit_workflow?.private_mockup_url, 1_000);
  const top3Text = topFindings.map((finding, index) => `${index + 1}. ${finding}`).join('\n');
  const subject = `Owner audit preview ready: ${raceName}`;
  const text = [
    `Owner audit preview ready: ${raceName}`,
    '',
    'Guardrails:',
    '- Owner/admin preview only. This email was not sent to the race director.',
    '- Customer delivery remains blocked until Steve gives final approval.',
    '- Review the draft below before any customer-facing send.',
    '',
    `Audit row: ${record?.id || 'Unknown'}`,
    `Current URL: ${currentUrl}`,
    `Race contact on file: ${contactName} <${contactEmail}>`,
    privateMockupUrl ? `Private mockup URL: ${privateMockupUrl}` : null,
    '',
    'Top 3 customer-ready findings:',
    top3Text,
    '',
    'Customer-ready draft for owner review:',
    customerReadyDraft,
  ].filter((line) => line !== null).join('\n');

  const findingItems = topFindings
    .map((finding) => `<li style="margin:0 0 10px;">${escapeHtml(finding)}</li>`)
    .join('');
  const html = `
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">Owner/admin preview only. Customer delivery remains blocked pending final approval.</div>
    <div style="margin:0;padding:0;background:#f7f2e8;color:#0b0e13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
      <div style="max-width:680px;margin:0 auto;padding:28px 18px;">
        <div style="border:1px solid #eadfce;border-radius:24px;overflow:hidden;background:#fffaf4;box-shadow:0 18px 48px rgba(14,23,41,.08);">
          <div style="padding:26px 28px;background:linear-gradient(135deg,#0b0e13,#182236);color:#fffaf4;">
            <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#f5b041;font-weight:800;">StartLine owner audit gate</div>
            <h1 style="margin:10px 0 0;font-size:26px;line-height:1.15;font-weight:800;">${escapeHtml(raceName)} preview is ready</h1>
          </div>
          <div style="padding:26px 28px;font-size:16px;line-height:1.62;color:#233043;">
            <div style="border:1px solid rgba(245,176,65,.45);border-radius:18px;background:#fff7e6;padding:16px 18px;margin:0 0 18px;">
              <strong style="display:block;color:#0b0e13;margin-bottom:8px;">Final approval required</strong>
              Owner/admin preview only. No race director/customer email was sent by this function. Customer delivery remains blocked until Steve gives final approval.
            </div>
            <p style="margin:0 0 12px;"><strong>Audit row:</strong> ${escapeHtml(record?.id || 'Unknown')}</p>
            <p style="margin:0 0 12px;"><strong>Current URL:</strong> ${escapeHtml(currentUrl)}</p>
            <p style="margin:0 0 18px;"><strong>Race contact on file:</strong> ${escapeHtml(`${contactName} <${contactEmail}>`)}</p>
            ${privateMockupUrl ? `<p style="margin:0 0 18px;"><strong>Private mockup URL:</strong> ${escapeHtml(privateMockupUrl)}</p>` : ''}
            <h2 style="font-size:18px;line-height:1.3;margin:22px 0 10px;color:#0b0e13;">Top 3 customer-ready findings</h2>
            <ol style="margin:0 0 22px;padding-left:22px;">${findingItems}</ol>
            <h2 style="font-size:18px;line-height:1.3;margin:22px 0 10px;color:#0b0e13;">Customer-ready draft for owner review</h2>
            <div style="white-space:pre-wrap;border:1px solid #eadfce;border-radius:16px;background:#ffffff;padding:16px 18px;">${escapeHtml(customerReadyDraft)}</div>
          </div>
          <div style="padding:18px 28px;border-top:1px solid #eadfce;background:#f7f2e8;color:#6b7280;font-size:13px;line-height:1.5;">
            StartLine Sites · Owner preview gate · delivery blocked until final approval.
          </div>
        </div>
      </div>
    </div>`;

  return { subject, text, html };
};

const sendOwnerEmail = async ({ resendApiKey, to, record, customerReadyDraft, topFindings }) => {
  const from = process.env.STARTLINE_NOTIFY_FROM || 'StartLine Sites <support@startlinesites.com>';
  const { subject, text, html } = buildOwnerPreviewEmail({ record, customerReadyDraft, topFindings });
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${resendApiKey}`,
      'content-type': 'application/json',
      'user-agent': 'StartLineSites/1.0 (owner-audit-preview)',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Owner audit preview email failed: ${response.status} ${detail}`);
  }

  return response.json().catch(() => ({}));
};

const patchAuditRecord = async ({ auditId, supabaseUrl, serviceKey, record, to, resendResult }) => {
  const sentAt = new Date().toISOString();
  const metadata = {
    ...(record.metadata || {}),
    audit_workflow: {
      ...(record.metadata?.audit_workflow || {}),
      owner_preview_status: 'sent',
      owner_preview_sent_at: sentAt,
      owner_preview_sent_to: to,
      owner_preview_resend_id: resendResult?.id || null,
      final_approval_status: 'required_before_customer_delivery',
      customer_delivery_status: 'blocked_until_final_approval',
      customer_delivery_blocked_until: 'final_owner_approval',
    },
  };

  const response = await fetch(`${supabaseUrl}/rest/v1/audit_requests?id=eq.${encodeURIComponent(auditId)}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify({
      status: 'owner_preview_sent',
      outreach_status: 'final_approval_required',
      metadata,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase audit patch failed: ${response.status} ${detail}`);
  }

  return { sentAt, metadata };
};

export const handler = async (event) => {
  if (!ALLOWED_METHODS.includes(event.httpMethod)) {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  if (event.httpMethod === 'OPTIONS') {
    return json(204, { ok: true });
  }

  if (!isAuthorized(event)) {
    return json(401, { ok: false, error: 'Unauthorized' });
  }

  try {
    const body = parseJsonBody(event);
    const auditId = clean(body.audit_id || body.auditId || body.id, 120);
    if (!auditId) {
      return json(400, { ok: false, error: 'audit_id is required' });
    }

    const config = getConfig();
    const record = await fetchAuditRecord({ auditId, ...config });
    const readiness = validatePreviewReady(record);
    if (!readiness.ok) {
      return json(409, {
        ok: false,
        error: `Audit row is not ready for owner preview: missing ${readiness.missing.join(' and ')}.`,
        missing: readiness.missing,
        sent: false,
      });
    }

    const resendResult = await sendOwnerEmail({
      ...config,
      record,
      customerReadyDraft: readiness.customerReadyDraft,
      topFindings: readiness.topFindings,
    });
    const patch = await patchAuditRecord({
      auditId,
      ...config,
      record,
      resendResult,
    });

    return json(200, {
      ok: true,
      audit_id: auditId,
      sent_to: config.to,
      resend_id: resendResult?.id || null,
      status: 'owner_preview_sent',
      outreach_status: 'final_approval_required',
      customer_delivery_status: patch.metadata.audit_workflow.customer_delivery_status,
      sent_at: patch.sentAt,
    });
  } catch (error) {
    console.error('send-owner-audit-preview failed', error);
    return json(error.statusCode || 500, { ok: false, error: error.message || 'Internal server error' });
  }
};
