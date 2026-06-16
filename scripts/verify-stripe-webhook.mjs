#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REQUIRED_ENV = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

export const DEFAULT_WEBHOOK_URL = 'https://startlinesites.com/.netlify/functions/stripe-webhook';
export const REQUIRED_EVENT_TYPE = 'checkout.session.completed';
export const DEFAULT_RECENT_EVENT_HOURS = 72;
export const ACCEPTED_PROCESSING_STATUSES = ['processed', 'duplicate'];

export const redactValue = (value) => {
  if (!value) return 'missing';
  const stringValue = String(value);
  if (stringValue.startsWith('sk_') && stringValue.length >= 12) {
    return `${stringValue.slice(0, 7)}…${stringValue.slice(-4)}`;
  }
  if (stringValue.startsWith('whsec_') && stringValue.length >= 12) {
    return `${stringValue.slice(0, 6)}…${stringValue.slice(-4)}`;
  }
  if (stringValue.startsWith('http')) {
    return stringValue.replace(/(service_role|apikey|access_token)=([^&]+)/gi, '$1=redacted');
  }
  return 'set';
};

export const validateRequiredEnv = (env) => {
  const missing = REQUIRED_ENV.filter((key) => !String(env[key] || '').trim());
  const lines = REQUIRED_ENV.map((key) => {
    const status = env[key] ? 'set' : 'missing';
    return `- [${env[key] ? 'x' : ' '}] ${key}: ${status} (${redactValue(env[key])})`;
  });
  return { ok: missing.length === 0, missing, lines };
};

const normalizeUrl = (url) => String(url || '').trim().replace(/\/$/, '');

export const analyzeStripeEndpoints = (endpoints, expectedUrl = DEFAULT_WEBHOOK_URL) => {
  const expected = normalizeUrl(expectedUrl);
  const matchedEndpoint = (endpoints || []).find((endpoint) => normalizeUrl(endpoint.url) === expected) || null;
  const enabledEvents = matchedEndpoint?.enabled_events || [];
  const hasCheckoutCompleted = enabledEvents.includes(REQUIRED_EVENT_TYPE) || enabledEvents.includes('*');
  return {
    ok: Boolean(matchedEndpoint && hasCheckoutCompleted),
    hasExpectedUrl: Boolean(matchedEndpoint),
    hasCheckoutCompleted,
    matchedEndpoint,
    expectedUrl: expected,
    endpointCount: endpoints?.length || 0,
  };
};

export const decideVerificationStatus = ({ envOk, endpointOk, eventFound, targetEventId }) => {
  const mustFindEvent = Boolean(targetEventId);
  const ok = Boolean(envOk && endpointOk && (eventFound || !mustFindEvent));
  return { ok, exitCode: ok ? 0 : 1, recentEventWarning: !eventFound && !mustFindEvent };
};

export const isVerifiedWebhookEventRow = (row) => row?.event_type === REQUIRED_EVENT_TYPE
  && ACCEPTED_PROCESSING_STATUSES.includes(row?.processing_status);

export const analyzeWebhookRows = (rows) => {
  const allRows = Array.isArray(rows) ? rows : [];
  const verifiedRows = allRows.filter(isVerifiedWebhookEventRow);
  return {
    eventFound: verifiedRows.length > 0,
    verifiedRows,
    rowCount: allRows.length,
  };
};

export const parseArgs = (argv) => {
  const args = { eventId: '', loadEnvLocal: true };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--event-id') args.eventId = argv[++index] || '';
    else if (value.startsWith('--event-id=')) args.eventId = value.slice('--event-id='.length);
    else if (value === '--no-env-local') args.loadEnvLocal = false;
    else if (value === '--help' || value === '-h') args.help = true;
  }
  return args;
};

const parseEnvLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return null;
  const [rawKey, ...rawValueParts] = trimmed.split('=');
  const key = rawKey.trim();
  let value = rawValueParts.join('=').trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return key ? [key, value] : null;
};

export const loadEnvLocal = async (path = '.env.local', env = process.env) => {
  if (!existsSync(path)) return false;
  const content = await readFile(path, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (parsed && !env[parsed[0]]) env[parsed[0]] = parsed[1];
  }
  return true;
};

const stripeRequest = async ({ secretKey, path }) => {
  const response = await fetch(`https://api.stripe.com${path}`, {
    headers: {
      authorization: `Bearer ${secretKey}`,
      'user-agent': 'StartLineSites/1.0 (stripe-webhook-verifier)',
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!response.ok) throw new Error(`Stripe API ${response.status}: ${body?.error?.message || text}`);
  return body;
};

const supabaseRequest = async ({ supabaseUrl, serviceKey, path }) => {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${path}`, {
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      accept: 'application/json',
      'user-agent': 'StartLineSites/1.0 (stripe-webhook-verifier)',
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : [];
  } catch {
    body = { raw: text };
  }
  if (!response.ok) throw new Error(`Supabase REST ${response.status}: ${text}`);
  return body;
};

export const buildEventQueryPath = (eventId, { now = new Date(), recentHours = DEFAULT_RECENT_EVENT_HOURS } = {}) => {
  if (eventId) {
    return `stripe_webhook_events?select=stripe_event_id,event_type,processing_status,created_at&stripe_event_id=eq.${encodeURIComponent(eventId)}&limit=1`;
  }
  const since = new Date(now.getTime() - recentHours * 60 * 60 * 1000).toISOString();
  return `stripe_webhook_events?select=stripe_event_id,event_type,processing_status,created_at&event_type=eq.${encodeURIComponent(REQUIRED_EVENT_TYPE)}&processing_status=in.(${ACCEPTED_PROCESSING_STATUSES.join(',')})&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=5`;
};

const printHelp = () => {
  console.log(`Usage: npm run verify:stripe-webhook -- [--event-id evt_...]

Verifies required env, Stripe webhook endpoint configuration, and Supabase webhook intake rows.
Loads .env.local by default when present; pass --no-env-local to skip.`);
};

export async function runCli({ argv = process.argv.slice(2), env = process.env } = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return 0;
  }
  if (args.loadEnvLocal) await loadEnvLocal('.env.local', env);

  const expectedUrl = env.STARTLINE_STRIPE_WEBHOOK_URL || DEFAULT_WEBHOOK_URL;
  const envResult = validateRequiredEnv(env);
  const lines = ['Stripe webhook verification checklist', '', 'Environment:', ...envResult.lines];

  let endpointResult = { ok: false, hasExpectedUrl: false, hasCheckoutCompleted: false, matchedEndpoint: null, expectedUrl, endpointCount: 0 };
  let eventRows = [];
  let endpointError = null;
  let supabaseError = null;

  if (envResult.ok) {
    try {
      const endpoints = await stripeRequest({ secretKey: env.STRIPE_SECRET_KEY, path: '/v1/webhook_endpoints?limit=100' });
      endpointResult = analyzeStripeEndpoints(endpoints.data || [], expectedUrl);
    } catch (error) {
      endpointError = error;
    }

    try {
      eventRows = await supabaseRequest({
        supabaseUrl: env.SUPABASE_URL,
        serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
        path: buildEventQueryPath(args.eventId),
      });
    } catch (error) {
      supabaseError = error;
    }
  }

  lines.push('', 'Stripe endpoint:');
  lines.push(`- [${endpointResult.hasExpectedUrl ? 'x' : ' '}] Expected URL configured: ${expectedUrl}`);
  lines.push(`- [${endpointResult.hasCheckoutCompleted ? 'x' : ' '}] Enabled event includes ${REQUIRED_EVENT_TYPE}`);
  if (endpointResult.matchedEndpoint) lines.push(`  Endpoint ID: ${endpointResult.matchedEndpoint.id}`);
  if (endpointError) lines.push(`  Error: ${endpointError.message}`);

  const eventAnalysis = analyzeWebhookRows(eventRows);
  const eventFound = eventAnalysis.eventFound;
  lines.push('', 'Supabase webhook intake:');
  lines.push(`- [${eventFound ? 'x' : ' '}] ${args.eventId ? `Target processed ${REQUIRED_EVENT_TYPE} event found: ${args.eventId}` : `Recent processed ${REQUIRED_EVENT_TYPE} webhook rows found (last ${DEFAULT_RECENT_EVENT_HOURS}h)`}`);
  if (eventFound) {
    for (const row of eventAnalysis.verifiedRows.slice(0, 5)) {
      lines.push(`  ${row.stripe_event_id} — ${row.processing_status || 'unknown'} — ${row.created_at || 'unknown time'}`);
    }
  } else if (supabaseError) {
    lines.push(`  Error: ${supabaseError.message}`);
  } else if (Array.isArray(eventRows) && eventRows.length) {
    lines.push('  Rows were found, but none were processed checkout.session.completed events.');
    for (const row of eventRows.slice(0, 5)) {
      lines.push(`  ${row.stripe_event_id || 'unknown event'} — ${row.event_type || 'unknown type'} — ${row.processing_status || 'unknown status'} — ${row.created_at || 'unknown time'}`);
    }
  } else if (args.eventId) {
    lines.push('  Target event was not found in stripe_webhook_events as a processed checkout.session.completed event.');
  } else {
    lines.push(`  Warning: no processed checkout.session.completed rows found in the last ${DEFAULT_RECENT_EVENT_HOURS} hours. Trigger a test payment or inspect Stripe delivery logs.`);
  }

  const decision = decideVerificationStatus({
    envOk: envResult.ok,
    endpointOk: endpointResult.ok,
    eventFound: eventFound && !supabaseError,
    targetEventId: args.eventId,
  });
  lines.push('', `Result: ${decision.ok ? 'PASS' : 'FAIL'}`);
  console.log(lines.join('\n'));
  return decision.exitCode;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli().then((exitCode) => {
    process.exitCode = exitCode;
  }).catch((error) => {
    console.error(`Stripe webhook verification failed: ${error.message}`);
    process.exitCode = 1;
  });
}
