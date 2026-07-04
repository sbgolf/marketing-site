import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  CLIENT_SIGNATURE_TEXT,
  escapeHtml,
  renderBrandedEmail,
  renderEmailButton,
  renderInfoCard,
  renderSignatureHtml,
} from './lib/branded-email.mjs';

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

const stripeFetch = async ({ secretKey, path, params }) => {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'StartLineSites/1.0 (stripe-webhook)',
    },
    body: new URLSearchParams(params),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Stripe ${path} failed: ${response.status}`);
    error.status = response.status;
    error.detail = data;
    throw error;
  }
  return data;
};

const addOneMonthDate = (now = new Date()) => {
  const date = new Date(now);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
};

const legacyMonthlySubscriptionsEnabled = () => process.env.STARTLINE_ENABLE_LEGACY_MONTHLY_SUBSCRIPTIONS === 'true';

const hasApprovedRecurringService = (customer) => {
  const metadata = normalizeMetadata(customer?.metadata);
  return customer?.approved_exception === true
    || metadata.recurring_service_approved === true
    || metadata.recurring_service_approved === 'true'
    || metadata.monthly_subscription_approved === true
    || metadata.monthly_subscription_approved === 'true';
};

const isFinalInvoicePaid = (invoice) => {
  const metadata = normalizeMetadata(invoice?.metadata);
  return invoice?.status === 'paid' && clean(metadata.startline_payment_type || '', 80).toLowerCase() === 'final_invoice';
};

const findCustomerForFinalInvoice = async ({ supabaseUrl, serviceKey, invoice }) => {
  const metadata = normalizeMetadata(invoice.metadata);
  const customerRecordId = clean(metadata.customer_record_id || '', 120);
  const invoiceId = clean(invoice.id || '', 200);
  const stripeCustomerId = clean(typeof invoice.customer === 'string' ? invoice.customer : '', 200);

  const filters = [];
  if (customerRecordId) filters.push(`id=eq.${encodeURIComponent(customerRecordId)}`);
  if (invoiceId) filters.push(`stripe_final_invoice_id=eq.${encodeURIComponent(invoiceId)}`);
  if (stripeCustomerId) filters.push(`stripe_customer_id=eq.${encodeURIComponent(stripeCustomerId)}`);

  for (const filter of filters) {
    const rows = await supabaseFetch({
      supabaseUrl,
      serviceKey,
      path: `customer_records?${filter}&limit=1`,
    });
    if (rows?.[0]) return rows[0];
  }
  return null;
};

const validateCustomerForFinalInvoicePaid = (customer, invoice) => {
  if (!customer) return 'customer_record_not_found';
  if (customer.deposit_status !== 'paid') return 'deposit_not_paid';
  if (customer.stripe_final_invoice_id && customer.stripe_final_invoice_id !== invoice.id) return 'final_invoice_mismatch';
  return null;
};

const validateCustomerForLegacySubscription = (customer) => {
  if (!clean(customer.stripe_customer_id, 200)) return 'missing_stripe_customer_id';
  if (!Number.isInteger(customer.monthly_amount_cents) || customer.monthly_amount_cents <= 0) return 'missing_monthly_amount_cents';
  if (!clean(customer.currency, 10)) return 'missing_currency';
  if (!clean(customer.monthly_tier, 80)) return 'missing_monthly_tier';
  if (customer.stripe_subscription_id && ['active', 'trialing', 'past_due', 'pending'].includes(customer.subscription_status)) return 'subscription_already_started';
  return null;
};

const patchCustomerRecord = async ({ supabaseUrl, serviceKey, customerId, body }) => supabaseFetch({
  supabaseUrl,
  serviceKey,
  path: `customer_records?id=eq.${encodeURIComponent(customerId)}`,
  method: 'PATCH',
  body,
  headers: { prefer: 'return=minimal' },
});

const processFinalInvoicePaid = async ({ supabaseUrl, serviceKey, stripeSecretKey, stripeEvent, invoice }) => {
  if (!isFinalInvoicePaid(invoice)) return { status: 'ignored', reason: 'not_final_invoice' };

  const customer = await findCustomerForFinalInvoice({ supabaseUrl, serviceKey, invoice });
  const finalInvoiceValidationError = validateCustomerForFinalInvoicePaid(customer, invoice);
  if (finalInvoiceValidationError) throw new Error(finalInvoiceValidationError);

  const paidAt = stripeEvent.created ? new Date(stripeEvent.created * 1000).toISOString() : new Date().toISOString();
  await patchCustomerRecord({
    supabaseUrl,
    serviceKey,
    customerId: customer.id,
    body: {
      customer_status: 'active',
      final_invoice_status: 'paid',
      final_invoice_paid_at: paidAt,
      stripe_final_invoice_id: invoice.id,
      metadata: {
        ...(customer.metadata || {}),
        final_invoice_paid: {
          event_id: stripeEvent.id,
          invoice_id: invoice.id,
          paid_at: paidAt,
        },
      },
    },
  });

  if (!legacyMonthlySubscriptionsEnabled() || !hasApprovedRecurringService(customer)) {
    await patchCustomerRecord({
      supabaseUrl,
      serviceKey,
      customerId: customer.id,
      body: {
        customer_status: 'active',
        subscription_status: 'dormant',
        metadata: {
          ...(customer.metadata || {}),
          final_invoice_paid: {
            event_id: stripeEvent.id,
            invoice_id: invoice.id,
            paid_at: paidAt,
          },
          monthly_subscription: {
            status: 'dormant',
            reason: legacyMonthlySubscriptionsEnabled()
              ? 'recurring_service_not_approved'
              : 'legacy_monthly_subscription_automation_disabled',
            source_event_id: stripeEvent.id,
          },
        },
      },
    });

    return {
      status: 'processed',
      customer_record_id: customer.id,
      subscription_status: 'dormant',
      monthly_subscription_status: 'dormant',
      monthly_subscription_reason: legacyMonthlySubscriptionsEnabled()
        ? 'recurring_service_not_approved'
        : 'legacy_monthly_subscription_automation_disabled',
    };
  }

  if (!stripeSecretKey) throw new Error('STRIPE_SECRET_KEY is required to start legacy monthly subscriptions.');

  const subscriptionValidationError = validateCustomerForLegacySubscription(customer);
  if (subscriptionValidationError === 'subscription_already_started') {
    return {
      status: 'processed',
      customer_record_id: customer.id,
      stripe_subscription_id: customer.stripe_subscription_id,
      subscription_status: customer.subscription_status,
      idempotent: true,
    };
  }
  if (subscriptionValidationError) throw new Error(subscriptionValidationError);

  try {
    const subscription = await stripeFetch({
      secretKey: stripeSecretKey,
      path: 'subscriptions',
      params: {
        customer: customer.stripe_customer_id,
        collection_method: 'send_invoice',
        days_until_due: '7',
        'items[0][price_data][currency]': clean(customer.currency, 10).toLowerCase(),
        'items[0][price_data][unit_amount]': String(customer.monthly_amount_cents),
        'items[0][price_data][recurring][interval]': 'month',
        'items[0][price_data][product_data][name]': `StartLine Sites ${customer.monthly_tier} monthly plan`,
        'items[0][price_data][product_data][metadata][monthly_tier]': customer.monthly_tier,
        'items[0][price_data][product_data][metadata][race_name]': customer.race_name || '',
        'metadata[startline_payment_type]': 'monthly_subscription',
        'metadata[customer_record_id]': customer.id,
        'metadata[monthly_tier]': customer.monthly_tier,
        'metadata[race_name]': customer.race_name || '',
        'metadata[final_invoice_id]': invoice.id,
      },
    });

    const subscriptionStatus = ['active', 'trialing'].includes(subscription.status) ? 'active' : (subscription.status || 'pending');
    const startedAt = new Date().toISOString();
    await patchCustomerRecord({
      supabaseUrl,
      serviceKey,
      customerId: customer.id,
      body: {
        customer_status: 'active',
        subscription_status: subscriptionStatus,
        stripe_subscription_id: subscription.id,
        subscription_started_at: startedAt,
        first_monthly_report_due_at: addOneMonthDate(new Date(startedAt)),
        metadata: {
          ...(customer.metadata || {}),
          final_invoice_paid: {
            event_id: stripeEvent.id,
            invoice_id: invoice.id,
            paid_at: paidAt,
          },
          monthly_subscription: {
            subscription_id: subscription.id,
            status: subscription.status || null,
            started_at: startedAt,
            source_event_id: stripeEvent.id,
          },
        },
      },
    });

    return {
      status: 'processed',
      customer_record_id: customer.id,
      stripe_subscription_id: subscription.id,
      subscription_status: subscriptionStatus,
    };
  } catch (error) {
    await patchCustomerRecord({
      supabaseUrl,
      serviceKey,
      customerId: customer.id,
      body: {
        customer_status: 'launch_billing',
        subscription_status: 'failed',
        metadata: {
          ...(customer.metadata || {}),
          final_invoice_paid: {
            event_id: stripeEvent.id,
            invoice_id: invoice.id,
            paid_at: paidAt,
          },
          monthly_subscription_error: {
            failed_at: new Date().toISOString(),
            message: clean(error.message, 1200),
            source_event_id: stripeEvent.id,
          },
        },
      },
    });
    throw error;
  }
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

export const renderCustomerKickoffEmail = ({ customer, session, tier, intakeUrl, assetChecklistUrl }) => {
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
    CLIENT_SIGNATURE_TEXT,
  ].join('\n');

  const html = renderBrandedEmail({
    preheader: `Deposit received for ${raceName}. Complete the intake and gather launch assets.`,
    heading: `Next steps for ${raceName}`,
    body: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(customerName)},</p>
      <p style="margin:0 0 18px;">Thanks — we received the <strong>${escapeHtml(amount)} ${escapeHtml(tier)}</strong> setup deposit for <strong>${escapeHtml(raceName)}</strong>.</p>
      ${renderInfoCard({
        title: 'Your next step',
        children: '<p style="margin:0;color:#1A2438;">Complete the intake form and gather the assets we need to build the site.</p>',
        tone: 'gold',
      })}
      ${renderEmailButton({ href: intakeUrl, label: 'Complete the intake form' })}
      ${renderEmailButton({ href: assetChecklistUrl, label: 'Review the asset checklist', variant: 'secondary' })}
      <p style="margin:18px 0 0;">The build timeline starts once we have complete intake details and usable assets. If anything is unclear or missing, we’ll follow up with a short list instead of making you redo the whole form.</p>
      <p style="margin:16px 0 0;">Reply here if you have questions.</p>
      ${renderSignatureHtml()}
    `,
  });

  return { subject, text, html };
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
  const { subject, text, html } = renderCustomerKickoffEmail({ customer, session, tier, intakeUrl, assetChecklistUrl });

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
      html,
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
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
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

  if (stripeEvent.type === 'invoice.paid') {
    try {
      const result = await processFinalInvoicePaid({
        supabaseUrl,
        serviceKey,
        stripeSecretKey,
        stripeEvent,
        invoice: stripeEvent.data.object,
      });
      await updateWebhookEvent({
        supabaseUrl,
        serviceKey,
        stripeEventId: stripeEvent.id,
        patch: {
          processing_status: result.status === 'processed' ? 'processed' : 'ignored',
          ignored_reason: result.status === 'ignored' ? result.reason : null,
          processed_at: new Date().toISOString(),
        },
      });
      return json(200, { ok: true, ...result });
    } catch (error) {
      console.error('Stripe final invoice processing failed', error);
      await updateWebhookEvent({
        supabaseUrl,
        serviceKey,
        stripeEventId: stripeEvent.id,
        patch: { processing_status: 'failed', error_message: clean(error.message, 1200), processed_at: new Date().toISOString() },
      });
      return json(500, { ok: false, error: 'Webhook processing failed.' });
    }
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
