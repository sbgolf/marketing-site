import {
  hashRecipient,
  maskEmail,
  verifySignedUnsubscribeToken,
} from './lib/unsubscribe-link.mjs';

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
};

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  },
  body: JSON.stringify(body),
});

const page = ({ statusCode = 200, title, heading, body }) => ({
  statusCode,
  headers: HTML_HEADERS,
  body: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    body{margin:0;background:#050A14;color:#F6F8FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.55;}
    main{max-width:680px;margin:0 auto;padding:56px 20px;}
    section{background:#0E1729;border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:30px;box-shadow:0 26px 70px rgba(0,0,0,.42);}
    h1{margin:0 0 16px;font-size:34px;line-height:1.1;}
    p{color:#DDE7F3;font-size:17px;}
    a{color:#FF8A7A;}
  </style>
</head>
<body>
  <main><section><h1>${heading}</h1>${body}</section></main>
</body>
</html>`,
});

const clean = (value, max = 1000) => {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, max);
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
    const error = new Error(`Supabase ${method} ${path} failed: ${response.status}`);
    error.status = response.status;
    error.detail = await response.text();
    throw error;
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const insertUnsubscribeEvent = async ({ supabaseUrl, serviceKey, emailHash, emailMasked, outreachId, campaignId }) => {
  const providerEventId = `startline-unsubscribe-${emailHash}`;
  const rows = await supabaseFetch({
    supabaseUrl,
    serviceKey,
    path: 'outreach_engagement_events?on_conflict=provider,provider_event_id',
    method: 'POST',
    body: {
      provider: 'resend',
      provider_event_id: providerEventId,
      provider_message_id: null,
      resend_email_id: null,
      outreach_id: outreachId || null,
      event_type: 'unsubscribed',
      event_timestamp: new Date().toISOString(),
      recipient_email_hash: emailHash,
      recipient_email_masked: emailMasked,
      campaign_id: campaignId || null,
      raw_event: {
        source: 'startline_unsubscribe_function',
        recipient_email_masked: emailMasked,
        campaign_id: campaignId || null,
      },
    },
    headers: { prefer: 'resolution=merge-duplicates,return=representation' },
  });
  return Array.isArray(rows) ? rows[0] || null : null;
};

const upsertSuppression = async ({ supabaseUrl, serviceKey, emailHash, emailMasked, outreachId, eventRecord }) => supabaseFetch({
  supabaseUrl,
  serviceKey,
  path: 'outreach_suppressions?on_conflict=recipient_email_hash',
  method: 'POST',
  body: {
    recipient_email_hash: emailHash,
    recipient_email_masked: emailMasked,
    reason: 'unsubscribe',
    source_provider: 'manual',
    source_event_id: eventRecord?.id || null,
    source_outreach_id: outreachId || null,
    notes: 'Created from StartLine unsubscribe link.',
  },
  headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
});

export const handler = async (event = {}) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return json(405, { ok: false, error: 'method_not_allowed' });
  }

  const params = event.queryStringParameters || {};
  const verification = verifySignedUnsubscribeToken({
    payload: params.p,
    signature: params.s,
    env: process.env,
  });

  if (!verification.ok) {
    return page({
      statusCode: 400,
      title: 'Unsubscribe link expired or invalid',
      heading: 'We could not confirm this unsubscribe link',
      body: '<p>Please email <a href="mailto:support@startlinesites.com?subject=Unsubscribe%20from%20StartLine%20Sites">support@startlinesites.com</a> and we will remove the address manually.</p>',
    });
  }

  const supabaseUrl = clean(process.env.SUPABASE_URL, 1000);
  const serviceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY, 4000);
  if (!supabaseUrl || !serviceKey) {
    console.error('Unsubscribe failed: Supabase service env missing.');
    return page({
      statusCode: 503,
      title: 'Unsubscribe temporarily unavailable',
      heading: 'Unsubscribe is temporarily unavailable',
      body: '<p>Please email <a href="mailto:support@startlinesites.com?subject=Unsubscribe%20from%20StartLine%20Sites">support@startlinesites.com</a> and we will remove the address manually.</p>',
    });
  }

  const emailHash = hashRecipient(verification.email, { env: process.env });
  const emailMasked = maskEmail(verification.email);

  try {
    const eventRecord = await insertUnsubscribeEvent({
      supabaseUrl,
      serviceKey,
      emailHash,
      emailMasked,
      outreachId: verification.outreachId,
      campaignId: verification.campaignId,
    });
    await upsertSuppression({
      supabaseUrl,
      serviceKey,
      emailHash,
      emailMasked,
      outreachId: verification.outreachId,
      eventRecord,
    });
  } catch (error) {
    console.error('Unsubscribe persistence failed', error.message);
    return page({
      statusCode: 500,
      title: 'Unsubscribe could not be saved',
      heading: 'We could not save that unsubscribe yet',
      body: '<p>Please email <a href="mailto:support@startlinesites.com?subject=Unsubscribe%20from%20StartLine%20Sites">support@startlinesites.com</a> and we will remove the address manually.</p>',
    });
  }

  return page({
    title: 'You are unsubscribed',
    heading: 'You are unsubscribed',
    body: `<p>${emailMasked || 'That address'} has been added to the StartLine Sites suppression list. We will not send future outreach to this address.</p><p>If this was a mistake, email <a href="mailto:support@startlinesites.com">support@startlinesites.com</a>.</p>`,
  });
};
