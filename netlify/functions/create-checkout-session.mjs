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

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const DEPOSIT_PACKAGES = {
  starter: {
    setup_tier: 'starter',
    name: 'StartLine Sites Starter First-Year Package Deposit',
    setup_price: '$1,500',
    deposit_amount: '$750',
    deposit_amount_cents: 75_000,
    public_package_framing: 'one-time first-year race-cycle package',
    monthly_tier: 'foundation',
    static_url: 'https://buy.stripe.com/8x2bIU1Bs0ww3H50UJ9fW00',
  },
  standard: {
    setup_tier: 'standard',
    name: 'StartLine Sites Standard First-Year Package Deposit',
    setup_price: '$2,500',
    deposit_amount: '$1,250',
    deposit_amount_cents: 125_000,
    public_package_framing: 'one-time first-year race-cycle package',
    monthly_tier: 'growth',
    static_url: 'https://buy.stripe.com/28EeV65RI3II3H5bzn9fW01',
  },
  premium: {
    setup_tier: 'premium',
    name: 'StartLine Sites Premium First-Year Package Deposit',
    setup_price: '$4,500',
    deposit_amount: '$2,250',
    deposit_amount_cents: 225_000,
    public_package_framing: 'one-time first-year race-cycle package',
    monthly_tier: 'performance',
    proposal_required: true,
  },
};

export const getDepositPackage = (tier) => DEPOSIT_PACKAGES[clean(tier, 40).toLowerCase()] || null;

const siteUrl = () => (process.env.STARTLINE_SITE_URL || 'https://startlinesites.com').replace(/\/$/, '');

export const buildCheckoutSessionParams = ({ auditRequestId, setupTier, contactEmail, raceName, currentUrl }) => {
  const pkg = getDepositPackage(setupTier);
  const auditId = clean(auditRequestId, 100);
  const email = clean(contactEmail, 254).toLowerCase();

  if (!pkg) throw new Error('invalid_setup_tier');
  if (pkg.proposal_required) throw new Error('proposal_required');
  if (!auditId) throw new Error('missing_audit_request_id');
  if (!email || !isEmail(email)) throw new Error('invalid_contact_email');

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('client_reference_id', auditId);
  params.set('customer_email', email);
  params.set('billing_address_collection', 'required');
  params.set('success_url', `${siteUrl()}/?deposit=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${siteUrl()}/?deposit=cancelled#pricing`);
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', 'usd');
  params.set('line_items[0][price_data][unit_amount]', String(pkg.deposit_amount_cents));
  params.set('line_items[0][price_data][product_data][name]', pkg.name);
  params.set('line_items[0][price_data][product_data][description]', `${pkg.deposit_amount} first-year package deposit toward the ${pkg.setup_price} ${pkg.setup_tier} one-time first-year race-cycle package. Final package balance due at launch.`);
  params.set('metadata[startline_payment_type]', 'deposit');
  params.set('metadata[public_package_framing]', pkg.public_package_framing);
  params.set('metadata[setup_tier]', pkg.setup_tier);
  params.set('metadata[audit_request_id]', auditId);
  params.set('metadata[race_name]', clean(raceName, 160));
  params.set('metadata[current_url]', clean(currentUrl, 500));
  params.set('payment_intent_data[metadata][startline_payment_type]', 'deposit');
  params.set('payment_intent_data[metadata][public_package_framing]', pkg.public_package_framing);
  params.set('payment_intent_data[metadata][setup_tier]', pkg.setup_tier);
  params.set('payment_intent_data[metadata][audit_request_id]', auditId);

  return params;
};

export const createDepositCheckoutSession = async ({ stripeSecretKey, ...input }) => {
  if (!stripeSecretKey) throw new Error('missing_stripe_secret_key');

  const params = buildCheckoutSessionParams(input);
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${stripeSecretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'StartLineSites/1.0 (checkout-session)',
    },
    body: params,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = data?.error?.message || text || 'Stripe Checkout Session creation failed.';
    throw new Error(`stripe_checkout_failed: ${message}`);
  }

  return {
    id: data.id,
    url: data.url,
  };
};

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' });

  if (!process.env.STRIPE_SECRET_KEY) {
    return json(500, { ok: false, error: 'Checkout service is not configured.' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'Invalid request.' });
  }

  try {
    const session = await createDepositCheckoutSession({
      stripeSecretKey: process.env.STRIPE_SECRET_KEY,
      auditRequestId: payload.audit_request_id,
      setupTier: payload.setup_tier,
      contactEmail: payload.contact_email,
      raceName: payload.race_name,
      currentUrl: payload.current_url,
    });

    return json(200, { ok: true, checkout_session_id: session.id, checkout_url: session.url });
  } catch (error) {
    const reason = clean(error.message, 300);
    const status = reason === 'proposal_required' ? 403 : 422;
    return json(status, { ok: false, error: reason });
  }
}
