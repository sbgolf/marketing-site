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

const normalizeMetadata = (metadata) => (metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {});

const getHeader = (headers = {}, name) => {
  const lower = name.toLowerCase();
  const key = Object.keys(headers || {}).find((candidate) => candidate.toLowerCase() === lower);
  return key ? headers[key] : '';
};

const isAuthorized = (event, token) => {
  const auth = clean(getHeader(event.headers, 'authorization'), 1000);
  if (auth === `Bearer ${token}`) return true;
  return clean(getHeader(event.headers, 'x-startline-launch-billing-token'), 1000) === token;
};

const parsePayload = (event) => {
  if (!event.body) return null;
  try {
    return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body);
  } catch {
    return null;
  }
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
    throw error;
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const stripeFetch = async ({ secretKey, path, params }) => {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'StartLineSites/1.0 (launch-billing)',
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

const findCustomer = async ({ supabaseUrl, serviceKey, payload }) => {
  const customerRecordId = clean(payload.customer_record_id || payload.customerRecordId || '', 120);
  const checkoutSessionId = clean(payload.stripe_checkout_session_id || payload.checkout_session_id || '', 200);

  if (!customerRecordId && !checkoutSessionId) {
    const error = new Error('Request must include customer_record_id or stripe_checkout_session_id.');
    error.statusCode = 400;
    throw error;
  }

  const filter = customerRecordId
    ? `id=eq.${encodeURIComponent(customerRecordId)}`
    : `stripe_checkout_session_id=eq.${encodeURIComponent(checkoutSessionId)}`;
  const rows = await supabaseFetch({
    supabaseUrl,
    serviceKey,
    path: `customer_records?${filter}&limit=1`,
  });

  if (!rows?.[0]) {
    const error = new Error('Customer record not found.');
    error.statusCode = 404;
    throw error;
  }
  return rows[0];
};

const validateCustomerForLaunchBilling = (customer) => {
  if (customer.deposit_status !== 'paid') return { ok: false, statusCode: 409, error: 'Customer deposit is not paid.' };
  if (['paid'].includes(customer.final_invoice_status)) {
    return { ok: false, idempotent: true, status: 'already_paid', stripe_final_invoice_id: customer.stripe_final_invoice_id || null };
  }
  if (['sent', 'open'].includes(customer.final_invoice_status) && customer.stripe_final_invoice_id) {
    return { ok: false, idempotent: true, status: 'already_sent', stripe_final_invoice_id: customer.stripe_final_invoice_id };
  }
  if (!clean(customer.stripe_customer_id, 200)) return { ok: false, statusCode: 422, error: 'Customer is missing stripe_customer_id.' };
  if (!Number.isInteger(customer.final_invoice_amount_cents) || customer.final_invoice_amount_cents <= 0) {
    return { ok: false, statusCode: 422, error: 'Customer is missing final_invoice_amount_cents.' };
  }
  if (!clean(customer.currency, 10)) return { ok: false, statusCode: 422, error: 'Customer is missing currency.' };
  if (!clean(customer.race_name, 200)) return { ok: false, statusCode: 422, error: 'Customer is missing race_name.' };
  if (!clean(customer.setup_tier, 80)) return { ok: false, statusCode: 422, error: 'Customer is missing setup_tier.' };
  return { ok: true };
};

const updateCustomer = async ({ supabaseUrl, serviceKey, customer, invoice, sentAt }) => {
  const metadata = normalizeMetadata(customer.metadata);
  await supabaseFetch({
    supabaseUrl,
    serviceKey,
    path: `customer_records?id=eq.${encodeURIComponent(customer.id)}`,
    method: 'PATCH',
    body: {
      customer_status: 'launch_billing',
      final_invoice_status: 'sent',
      stripe_final_invoice_id: invoice.id,
      final_invoice_sent_at: sentAt,
      metadata: {
        ...metadata,
        launch_billing: {
          ...(metadata.launch_billing || {}),
          started_at: sentAt,
          stripe_final_invoice_id: invoice.id,
          hosted_invoice_url: invoice.hosted_invoice_url || null,
          amount_cents: customer.final_invoice_amount_cents,
          currency: customer.currency,
        },
      },
    },
    headers: { prefer: 'return=minimal' },
  });
};

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' });

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const billingToken = process.env.STARTLINE_LAUNCH_BILLING_TOKEN;

  if (!supabaseUrl || !serviceKey || !stripeSecretKey || !billingToken) {
    return json(500, { ok: false, error: 'Launch billing service is not configured.' });
  }
  if (!isAuthorized(event, billingToken)) return json(401, { ok: false, error: 'Unauthorized.' });

  const payload = parsePayload(event);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json(400, { ok: false, error: 'Invalid payload.' });
  }

  let customer;
  try {
    customer = await findCustomer({ supabaseUrl, serviceKey, payload });
  } catch (error) {
    if (error.statusCode) return json(error.statusCode, { ok: false, error: error.message });
    console.error('Launch billing customer lookup failed', error);
    return json(500, { ok: false, error: 'Launch billing failed.' });
  }

  const validation = validateCustomerForLaunchBilling(customer);
  if (!validation.ok) {
    if (validation.idempotent) {
      return json(200, {
        ok: true,
        status: validation.status,
        customer_record_id: customer.id,
        stripe_final_invoice_id: validation.stripe_final_invoice_id,
      });
    }
    return json(validation.statusCode, { ok: false, error: validation.error });
  }

  try {
    const draftInvoice = await stripeFetch({
      secretKey: stripeSecretKey,
      path: 'invoices',
      params: {
        customer: customer.stripe_customer_id,
        collection_method: 'send_invoice',
        days_until_due: '7',
        pending_invoice_items_behavior: 'exclude',
        description: `Final setup payment for ${customer.race_name}`,
        'metadata[startline_payment_type]': 'final_invoice',
        'metadata[customer_record_id]': customer.id,
        'metadata[setup_tier]': customer.setup_tier,
        'metadata[race_name]': customer.race_name,
      },
    });

    await stripeFetch({
      secretKey: stripeSecretKey,
      path: 'invoiceitems',
      params: {
        customer: customer.stripe_customer_id,
        invoice: draftInvoice.id,
        amount: String(customer.final_invoice_amount_cents),
        currency: clean(customer.currency, 10).toLowerCase(),
        description: `Final 50% setup payment for ${customer.race_name}`,
        'metadata[startline_payment_type]': 'final_invoice',
        'metadata[customer_record_id]': customer.id,
        'metadata[setup_tier]': customer.setup_tier,
        'metadata[race_name]': customer.race_name,
      },
    });

    const sentInvoice = await stripeFetch({
      secretKey: stripeSecretKey,
      path: `invoices/${encodeURIComponent(draftInvoice.id)}/send`,
      params: {},
    });

    const sentAt = new Date().toISOString();
    await updateCustomer({ supabaseUrl, serviceKey, customer, invoice: sentInvoice, sentAt });

    return json(200, {
      ok: true,
      status: 'sent',
      customer_record_id: customer.id,
      stripe_final_invoice_id: sentInvoice.id,
      hosted_invoice_url: sentInvoice.hosted_invoice_url || null,
    });
  } catch (error) {
    console.error('Launch billing failed', error);
    return json(500, { ok: false, error: 'Launch billing failed.' });
  }
}
