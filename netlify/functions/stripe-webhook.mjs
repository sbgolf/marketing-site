import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_BODY_BYTES = Number(process.env.STARTLINE_STRIPE_WEBHOOK_MAX_BODY_BYTES || 100_000);
const DEFAULT_TOLERANCE_SECONDS = 300;

const DEPOSIT_PACKAGES = {
  starter: {
    setup_tier: 'starter',
    monthly_tier: 'foundation',
    setup_amount_cents: 150_000,
    deposit_amount_cents: 75_000,
    final_invoice_amount_cents: 75_000,
    monthly_amount_cents: 9_900,
  },
  standard: {
    setup_tier: 'standard',
    monthly_tier: 'growth',
    setup_amount_cents: 250_000,
    deposit_amount_cents: 125_000,
    final_invoice_amount_cents: 125_000,
    monthly_amount_cents: 24_900,
  },
  premium: {
    setup_tier: 'premium',
    monthly_tier: 'performance',
    setup_amount_cents: 450_000,
    deposit_amount_cents: 225_000,
    final_invoice_amount_cents: 225_000,
    monthly_amount_cents: 49_900,
    proposal_required: true,
  },
};

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

const normalizeTier = (value) => clean(value, 40).toLowerCase();

export const getRawBody = (event) => {
  if (!event.body) return '';
  return event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
};

const parseStripeSignature = (signatureHeader) => {
  const parts = String(signatureHeader || '').split(',').map((part) => part.trim()).filter(Boolean);
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = parts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3))
    .filter(Boolean);

  return {
    timestamp: timestamp ? Number.parseInt(timestamp, 10) : null,
    signatures,
  };
};

const safeEqualHex = (expected, actual) => {
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(actual, 'hex');
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
};

export const verifyStripeSignature = ({ rawBody, signatureHeader, secret, toleranceSeconds = DEFAULT_TOLERANCE_SECONDS, nowSeconds = Math.floor(Date.now() / 1000) }) => {
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (!secret || !timestamp || !signatures.length) return false;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  return signatures.some((signature) => safeEqualHex(expected, signature));
};

const normalizeMetadata = (metadata) => (metadata && typeof metadata === 'object' ? metadata : {});

const inferTierFromAmount = (amountTotal) => {
  const matches = Object.values(DEPOSIT_PACKAGES).filter((pkg) => pkg.deposit_amount_cents === amountTotal);
  return matches.length === 1 ? matches[0].setup_tier : null;
};

export const classifyCheckoutSession = (session) => {
  const metadata = normalizeMetadata(session?.metadata);
  const tier = normalizeTier(metadata.setup_tier || metadata.package_tier || metadata.selected_package_tier) || inferTierFromAmount(session?.amount_total);
  const pkg = DEPOSIT_PACKAGES[tier] || null;

  if (session?.mode !== 'payment') return { ok: false, status: 'ignored', reason: 'not_payment_mode' };
  if (session?.payment_status !== 'paid') return { ok: false, status: 'ignored', reason: 'payment_not_paid' };
  if (!pkg) return { ok: false, status: 'failed', reason: 'unknown_deposit_tier' };
  if ((session.currency || '').toLowerCase() !== 'usd') return { ok: false, status: 'failed', reason: 'unsupported_currency' };
  if (session.amount_total !== pkg.deposit_amount_cents) return { ok: false, status: 'failed', reason: 'deposit_amount_mismatch' };

  const paymentType = clean(metadata.startline_payment_type || metadata.payment_type || '', 80).toLowerCase();
  const looksLikeDeposit = paymentType === 'deposit' || !paymentType;
  if (!looksLikeDeposit) return { ok: false, status: 'ignored', reason: 'not_deposit_payment' };

  const proposalApproved = metadata.proposal_approved === 'true' || metadata.deposit_source === 'approved_proposal';
  if (pkg.proposal_required && !proposalApproved) {
    return { ok: false, status: 'ignored', reason: 'premium_requires_proposal' };
  }

  return { ok: true, tier, pkg, metadata };
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
    const error = new Error(`Supabase ${method} ${path} failed: ${response.status} ${detail}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const insertWebhookEvent = async ({ supabaseUrl, serviceKey, stripeEvent, session }) => {
  const row = {
    stripe_event_id: stripeEvent.id,
    event_type: stripeEvent.type,
    stripe_created: stripeEvent.created ? new Date(stripeEvent.created * 1000).toISOString() : null,
    livemode: Boolean(stripeEvent.livemode),
    processing_status: 'processing',
    checkout_session_id: session?.id || null,
    payment_intent_id: typeof session?.payment_intent === 'string' ? session.payment_intent : null,
    stripe_customer_id: typeof session?.customer === 'string' ? session.customer : null,
    payload: stripeEvent,
  };

  try {
    const inserted = await supabaseFetch({
      supabaseUrl,
      serviceKey,
      path: 'stripe_webhook_events',
      method: 'POST',
      body: row,
      headers: { prefer: 'return=representation' },
    });
    return { duplicate: false, record: inserted?.[0] || null };
  } catch (error) {
    if (error.status === 409) return { duplicate: true, record: null };
    throw error;
  }
};

const updateWebhookEvent = async ({ supabaseUrl, serviceKey, stripeEventId, patch }) => {
  await supabaseFetch({
    supabaseUrl,
    serviceKey,
    path: `stripe_webhook_events?stripe_event_id=eq.${encodeURIComponent(stripeEventId)}`,
    method: 'PATCH',
    body: patch,
    headers: { prefer: 'return=minimal' },
  });
};

const findAuditRequest = async ({ supabaseUrl, serviceKey, session, tier }) => {
  const metadata = normalizeMetadata(session.metadata);
  const explicitId = clean(metadata.audit_request_id || session.client_reference_id || '', 80);

  if (explicitId) {
    const rows = await supabaseFetch({
      supabaseUrl,
      serviceKey,
      path: `audit_requests?id=eq.${encodeURIComponent(explicitId)}&limit=1`,
    });
    if (rows?.[0]) return { auditRequest: rows[0], mappingMethod: metadata.audit_request_id ? 'metadata.audit_request_id' : 'client_reference_id' };
  }

  const email = clean(session.customer_details?.email || session.customer_email || '', 254).toLowerCase();
  if (!email) return { auditRequest: null, mappingMethod: 'none' };

  const rows = await supabaseFetch({
    supabaseUrl,
    serviceKey,
    path: `audit_requests?contact_email=eq.${encodeURIComponent(email)}&deposit_status=neq.paid&order=created_at.desc&limit=10`,
  });

  const matchingTier = rows?.find((row) => row.metadata?.selected_package?.tier === tier);
  if (matchingTier) return { auditRequest: matchingTier, mappingMethod: 'email_package_fallback' };
  if (rows?.[0]) return { auditRequest: rows[0], mappingMethod: 'email_fallback' };

  return { auditRequest: null, mappingMethod: 'not_found' };
};

const buildStripeDepositMetadata = ({ stripeEvent, session, tier, mappingMethod }) => ({
  event_id: stripeEvent.id,
  checkout_session_id: session.id,
  payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
  customer_id: typeof session.customer === 'string' ? session.customer : null,
  amount_total: session.amount_total,
  currency: session.currency,
  paid_at: stripeEvent.created ? new Date(stripeEvent.created * 1000).toISOString() : new Date().toISOString(),
  setup_tier: tier,
  mapping_method: mappingMethod,
});

const processPaidDeposit = async ({ supabaseUrl, serviceKey, stripeEvent, session, classification }) => {
  const { tier, pkg } = classification;
  const { auditRequest, mappingMethod } = await findAuditRequest({ supabaseUrl, serviceKey, session, tier });
  const stripeDeposit = buildStripeDepositMetadata({ stripeEvent, session, tier, mappingMethod });
  const billingEmail = clean(session.customer_details?.email || session.customer_email || '', 254).toLowerCase() || null;
  const billingName = clean(session.customer_details?.name || '', 200) || null;
  const paidAt = stripeDeposit.paid_at;

  if (auditRequest) {
    await supabaseFetch({
      supabaseUrl,
      serviceKey,
      path: `audit_requests?id=eq.${encodeURIComponent(auditRequest.id)}`,
      method: 'PATCH',
      body: {
        status: 'deposit_paid',
        outreach_status: 'kickoff_ready',
        deposit_status: 'paid',
        deposit_paid_at: paidAt,
        stripe_customer_id: stripeDeposit.customer_id,
        stripe_checkout_session_id: stripeDeposit.checkout_session_id,
        stripe_payment_intent_id: stripeDeposit.payment_intent_id,
        proposed_setup_tier: pkg.setup_tier,
        proposed_monthly_tier: pkg.monthly_tier,
        metadata: {
          ...(auditRequest.metadata || {}),
          stripe_deposit: stripeDeposit,
        },
      },
      headers: { prefer: 'return=minimal' },
    });
  }

  const metadata = {
    stripe_deposit: stripeDeposit,
    audit_request_match: auditRequest
      ? { status: 'matched', method: mappingMethod, audit_request_id: auditRequest.id }
      : { status: 'not_found', method: mappingMethod, email: billingEmail },
    raw_stripe_metadata: normalizeMetadata(session.metadata),
  };

  const customerRows = await supabaseFetch({
    supabaseUrl,
    serviceKey,
    path: 'customer_records?on_conflict=stripe_checkout_session_id',
    method: 'POST',
    body: {
      audit_request_id: auditRequest?.id || null,
      race_name: auditRequest?.race_name || clean(session.metadata?.race_name || '', 160) || 'Unknown race',
      current_url: auditRequest?.current_url || null,
      primary_contact_name: auditRequest?.contact_name || billingName,
      primary_contact_email: auditRequest?.contact_email || billingEmail,
      billing_contact_name: billingName,
      billing_contact_email: billingEmail,
      setup_tier: pkg.setup_tier,
      monthly_tier: pkg.monthly_tier,
      setup_amount_cents: pkg.setup_amount_cents,
      deposit_amount_cents: pkg.deposit_amount_cents,
      final_invoice_amount_cents: pkg.final_invoice_amount_cents,
      monthly_amount_cents: pkg.monthly_amount_cents,
      currency: 'usd',
      customer_status: 'kickoff_ready',
      deposit_status: 'paid',
      final_invoice_status: 'not_sent',
      subscription_status: 'not_started',
      kickoff_status: 'ready',
      intake_status: 'ready_to_send',
      stripe_customer_id: stripeDeposit.customer_id,
      stripe_checkout_session_id: stripeDeposit.checkout_session_id,
      stripe_deposit_payment_intent_id: stripeDeposit.payment_intent_id,
      deposit_paid_at: paidAt,
      kickoff_started_at: new Date().toISOString(),
      metadata,
    },
    headers: { prefer: 'resolution=merge-duplicates,return=representation' },
  });

  return {
    status: 'processed',
    audit_request_id: auditRequest?.id || null,
    customer_record_id: customerRows?.[0]?.id || null,
    customer_record: customerRows?.[0] || null,
    mapping_method: mappingMethod,
  };
};

const sendDepositNotification = async ({ result, session, tier }) => {
  const apiKey = process.env.RESEND_API_KEY || process.env.STARTLINE_RESEND_API_KEY;
  if (!apiKey || result.status !== 'processed') return;

  const to = process.env.STARTLINE_LEAD_NOTIFY_EMAIL
    || process.env.STARTLINE_ADMIN_EMAIL
    || 'support@startlinesites.com';
  const from = process.env.STARTLINE_NOTIFY_FROM || 'StartLine Sites <support@startlinesites.com>';
  const email = session.customer_details?.email || session.customer_email || 'unknown';
  const amount = `$${(session.amount_total / 100).toLocaleString('en-US')}`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'user-agent': 'StartLineSites/1.0 (stripe-webhook)',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `StartLine deposit paid: ${tier}`,
        text: [
          'A StartLine Sites setup deposit was paid.',
          '',
          `Tier: ${tier}`,
          `Amount: ${amount}`,
          `Customer email: ${email}`,
          `Checkout session: ${session.id}`,
          `Audit request: ${result.audit_request_id || 'Not matched'}`,
          `Customer record: ${result.customer_record_id || 'Not created'}`,
          '',
          'Next step: send/confirm intake and asset checklist before build timeline starts.',
        ].join('\n'),
      }),
    });

    if (!response.ok) {
      console.error('Deposit notification failed', response.status, await response.text());
    }
  } catch (error) {
    console.error('Deposit notification failed', error);
  }
};

const sendCustomerKickoffEmail = async ({ supabaseUrl, serviceKey, result, session, tier }) => {
  const apiKey = process.env.RESEND_API_KEY || process.env.STARTLINE_RESEND_API_KEY;
  const intakeUrl = clean(process.env.STARTLINE_INTAKE_FORM_URL || '', 1000);
  const assetChecklistUrl = clean(process.env.STARTLINE_ASSET_CHECKLIST_URL || '', 1000);
  const customer = result.customer_record;
  const toEmail = customer?.primary_contact_email || session.customer_details?.email || session.customer_email;

  if (!apiKey || result.status !== 'processed' || !customer?.id || !toEmail || !intakeUrl || !assetChecklistUrl) return { sent: false };

  const from = process.env.STARTLINE_NOTIFY_FROM || 'StartLine Sites <support@startlinesites.com>';
  const replyTo = clean(process.env.STARTLINE_KICKOFF_REPLY_TO || process.env.STARTLINE_ADMIN_EMAIL || '', 254) || undefined;
  const raceName = customer.race_name || session.metadata?.race_name || 'your race';
  const customerName = customer.primary_contact_name || session.customer_details?.name || 'there';
  const amount = `$${(session.amount_total / 100).toLocaleString('en-US')}`;
  const subject = `Next steps for ${raceName}`;
  const text = [
    `Hi ${customerName},`,
    '',
    `Thanks — we received the ${amount} ${tier} setup deposit for ${raceName}.`,
    '',
    'Next step: complete the intake form and gather the assets we need to build the site.',
    '',
    `Intake form: ${intakeUrl}`,
    `Asset checklist: ${assetChecklistUrl}`,
    '',
    'The build timeline starts once we have complete intake details and usable assets. If anything is unclear or missing, we’ll follow up with a short list instead of making you redo the whole form.',
    '',
    'Reply here if you have questions.',
    '',
    '— StartLine Sites',
  ].join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'user-agent': 'StartLineSites/1.0 (kickoff-email)',
    },
    body: JSON.stringify({
      from,
      to: [toEmail],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject,
      text,
    }),
  });

  if (!response.ok) {
    console.error('Kickoff email failed', response.status, await response.text());
    return { sent: false };
  }

  await supabaseFetch({
    supabaseUrl,
    serviceKey,
    path: `customer_records?id=eq.${encodeURIComponent(customer.id)}`,
    method: 'PATCH',
    body: {
      kickoff_status: 'started',
      intake_status: 'sent',
      intake_sent_at: new Date().toISOString(),
      metadata: {
        ...(customer.metadata || {}),
        kickoff_email: {
          sent_at: new Date().toISOString(),
          to: toEmail,
          intake_url_configured: true,
          asset_checklist_url_configured: true,
        },
      },
    },
    headers: { prefer: 'return=minimal' },
  });

  return { sent: true };
};

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const toleranceSeconds = Number(process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS || DEFAULT_TOLERANCE_SECONDS);

  if (!supabaseUrl || !serviceKey || !webhookSecret) {
    return json(500, { ok: false, error: 'Webhook service is not configured.' });
  }

  const rawBody = getRawBody(event);
  if (!rawBody || Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return json(400, { ok: false, error: 'Invalid payload.' });
  }

  const signatureHeader = event.headers?.['stripe-signature'] || event.headers?.['Stripe-Signature'];
  if (!verifyStripeSignature({ rawBody, signatureHeader, secret: webhookSecret, toleranceSeconds })) {
    return json(400, { ok: false, error: 'Invalid signature.' });
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch {
    return json(400, { ok: false, error: 'Invalid payload.' });
  }

  if (!stripeEvent?.id || !stripeEvent?.type || !stripeEvent?.data?.object) {
    return json(400, { ok: false, error: 'Invalid Stripe event.' });
  }

  const session = stripeEvent.type === 'checkout.session.completed' ? stripeEvent.data.object : null;

  let webhookRecord;
  try {
    webhookRecord = await insertWebhookEvent({ supabaseUrl, serviceKey, stripeEvent, session });
  } catch (error) {
    console.error('Stripe webhook event insert failed', error);
    return json(500, { ok: false, error: 'Webhook processing failed.' });
  }

  if (webhookRecord.duplicate) {
    return json(200, { ok: true, status: 'duplicate' });
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    await updateWebhookEvent({
      supabaseUrl,
      serviceKey,
      stripeEventId: stripeEvent.id,
      patch: { processing_status: 'ignored', ignored_reason: 'unsupported_event_type', processed_at: new Date().toISOString() },
    });
    return json(200, { ok: true, status: 'ignored', reason: 'unsupported_event_type' });
  }

  const classification = classifyCheckoutSession(session);
  if (!classification.ok) {
    const processingStatus = classification.status === 'failed' ? 'failed' : 'ignored';
    await updateWebhookEvent({
      supabaseUrl,
      serviceKey,
      stripeEventId: stripeEvent.id,
      patch: {
        processing_status: processingStatus,
        ignored_reason: processingStatus === 'ignored' ? classification.reason : null,
        error_message: processingStatus === 'failed' ? classification.reason : null,
        processed_at: new Date().toISOString(),
      },
    });
    return json(200, { ok: true, status: processingStatus, reason: classification.reason });
  }

  try {
    const result = await processPaidDeposit({ supabaseUrl, serviceKey, stripeEvent, session, classification });
    await updateWebhookEvent({
      supabaseUrl,
      serviceKey,
      stripeEventId: stripeEvent.id,
      patch: { processing_status: 'processed', processed_at: new Date().toISOString() },
    });
    await sendDepositNotification({ result, session, tier: classification.tier });
    await sendCustomerKickoffEmail({ supabaseUrl, serviceKey, result, session, tier: classification.tier });
    const { customer_record: _customerRecord, ...publicResult } = result;
    return json(200, { ok: true, ...publicResult });
  } catch (error) {
    console.error('Stripe deposit processing failed', error);
    await updateWebhookEvent({
      supabaseUrl,
      serviceKey,
      stripeEventId: stripeEvent.id,
      patch: { processing_status: 'failed', error_message: clean(error.message, 1200), processed_at: new Date().toISOString() },
    });
    return json(500, { ok: false, error: 'Webhook processing failed.' });
  }
}
