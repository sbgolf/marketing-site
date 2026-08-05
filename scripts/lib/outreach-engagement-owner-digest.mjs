const clean = (value, max = 500) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const asArray = (value) => Array.isArray(value) ? value : [];
const encode = (value) => encodeURIComponent(String(value ?? '').trim());

const ACTIVE_STATUSES = new Set(['sent', 'accepted', 'delivered', 'opened', 'clicked']);
const NEGATIVE_STATUSES = new Set(['bounced', 'complained', 'unsubscribed', 'suppressed']);

export const OUTREACH_DIGEST_SELECT = [
  'id',
  'race_name',
  'official_domain',
  'mockup_url',
  'mockup_template',
  'outreach_status',
  'sent_at',
  'resend_email_id',
  'to_emails',
  'cc_emails',
  'campaign_id',
  'delivered_at',
  'first_opened_at',
  'last_opened_at',
  'open_count',
  'first_clicked_at',
  'last_clicked_at',
  'click_count',
  'clicked_urls',
  'bounced_at',
  'complained_at',
  'unsubscribed_at',
  'suppressed_at',
  'engagement_status',
  'next_follow_up_at',
  'follow_up_reason',
  'last_engagement_at',
].join(',');

export const OUTREACH_EVENT_DIGEST_SELECT = [
  'id',
  'outreach_id',
  'event_type',
  'event_timestamp',
  'clicked_url',
].join(',');

export const buildOutreachDigestQuery = ({ campaignId, since, until, limit = 100 } = {}) => {
  const params = new URLSearchParams({
    select: OUTREACH_DIGEST_SELECT,
    order: 'sent_at.desc.nullslast',
    limit: String(Number.isFinite(Number(limit)) ? Number(limit) : 100),
  });
  if (campaignId) params.set('campaign_id', `eq.${clean(campaignId, 120)}`);
  if (since) params.set('sent_at', `gte.${clean(since, 80)}`);
  if (until) params.append('sent_at', `lte.${clean(until, 80)}`);
  return `race_mockup_outreach?${params.toString()}`;
};

export const buildOutreachEventDigestQuery = ({ outreachIds = [], limit = 1000 } = {}) => {
  const ids = asArray(outreachIds).map((id) => clean(id, 80)).filter(Boolean).slice(0, 200);
  if (!ids.length) return null;
  const params = new URLSearchParams({
    select: OUTREACH_EVENT_DIGEST_SELECT,
    outreach_id: `in.(${ids.map(encode).join(',')})`,
    order: 'event_timestamp.desc.nullslast',
    limit: String(Number.isFinite(Number(limit)) ? Number(limit) : 1000),
  });
  return `outreach_engagement_events?${params.toString()}`;
};

export const maskEmailForOwnerDigest = (email = '') => {
  const normalized = clean(email, 320).toLowerCase();
  const [local, domain] = normalized.split('@');
  if (!local || !domain) return '';
  const visible = local.length <= 2 ? local[0] : local.slice(0, 2);
  return `${visible}***[at]${domain}`;
};

const parseEmailList = (value) => {
  if (Array.isArray(value)) return value.map((item) => clean(item, 320)).filter(Boolean);
  return clean(value, 2000)
    .split(/[;,\s]+/)
    .map((item) => clean(item, 320))
    .filter(Boolean);
};

const unique = (items) => [...new Set(items.filter(Boolean))];

const recipientMasks = (row = {}) => unique([
  ...parseEmailList(row.to_emails),
  ...parseEmailList(row.cc_emails),
].map(maskEmailForOwnerDigest)).slice(0, 4);

const statusOf = (row = {}) => clean(row.engagement_status || row.outreach_status || 'no_activity', 80) || 'no_activity';

const hasPrivateMockupClick = (row = {}) => {
  const urls = asArray(row.clicked_urls).map((url) => clean(url, 500).toLowerCase());
  const mockup = clean(row.mockup_url, 500).toLowerCase();
  return Boolean(row.click_count) && (urls.some((url) => url.includes('/private/') || url.includes('mockup') || (mockup && url === mockup)) || mockup);
};

const percent = (numerator, denominator) => {
  if (!denominator) return '0%';
  return `${Math.round((Number(numerator || 0) / denominator) * 100)}%`;
};

const isDue = (value, now = new Date()) => {
  const date = Date.parse(value || '');
  const nowDate = now instanceof Date ? now : new Date(now);
  return Number.isFinite(date) && Number.isFinite(nowDate.getTime()) && date <= nowDate.getTime();
};

const formatDate = (value) => clean(value, 40) || 'not set';

const recommendationFor = (row = {}, { now = new Date() } = {}) => {
  const status = statusOf(row);
  if (NEGATIVE_STATUSES.has(status) || row.suppressed_at || row.complained_at || row.unsubscribed_at || row.bounced_at) {
    return 'No follow-up — suppression or negative deliverability signal.';
  }
  if (!row.next_follow_up_at) return 'No follow-up date yet; keep owner-reviewed.';
  const timing = isDue(row.next_follow_up_at, now) ? 'Due now' : `Not due until ${formatDate(row.next_follow_up_at)}`;
  if (status === 'clicked') return `${timing}: consider a personalized owner-reviewed reply about the mockup value; do not mention tracking.`;
  if (status === 'opened') return `${timing}: consider a soft owner-reviewed follow-up; do not mention opens.`;
  if (status === 'delivered') return `${timing}: consider a final gentle nudge if still no reply.`;
  return `${timing}: owner review required before any follow-up.`;
};

export const summarizeOutreachEngagementRows = (rows = [], events = [], options = {}) => {
  const now = options.now ? new Date(options.now) : new Date();
  const outreachRows = asArray(rows);
  const eventRows = asArray(events);
  const sentRows = outreachRows.filter((row) => row.sent_at || ACTIVE_STATUSES.has(clean(row.outreach_status, 80)) || statusOf(row) !== 'no_activity');
  const deliveredRows = outreachRows.filter((row) => row.delivered_at || ['delivered', 'opened', 'clicked'].includes(statusOf(row)));
  const openedRows = outreachRows.filter((row) => Number(row.open_count || 0) > 0 || ['opened', 'clicked'].includes(statusOf(row)));
  const clickedRows = outreachRows.filter((row) => Number(row.click_count || 0) > 0 || statusOf(row) === 'clicked');
  const privateMockupClickedRows = clickedRows.filter(hasPrivateMockupClick);
  const suppressedRows = outreachRows.filter((row) => NEGATIVE_STATUSES.has(statusOf(row)) || row.suppressed_at || row.complained_at || row.unsubscribed_at || row.bounced_at);
  const followUpRows = outreachRows
    .filter((row) => !suppressedRows.includes(row))
    .filter((row) => row.next_follow_up_at || ['delivered', 'opened', 'clicked'].includes(statusOf(row)))
    .sort((a, b) => Date.parse(a.next_follow_up_at || '9999-12-31') - Date.parse(b.next_follow_up_at || '9999-12-31'));

  const eventsByType = eventRows.reduce((acc, event) => {
    const key = clean(event.event_type || 'unknown', 80) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    total_rows: outreachRows.length,
    sent_count: sentRows.length,
    delivered_count: deliveredRows.length,
    delivered_rate: percent(deliveredRows.length, sentRows.length || outreachRows.length),
    open_count: openedRows.length,
    open_rate: percent(openedRows.length, deliveredRows.length || sentRows.length || outreachRows.length),
    click_count: clickedRows.length,
    click_rate: percent(clickedRows.length, deliveredRows.length || sentRows.length || outreachRows.length),
    private_mockup_click_count: privateMockupClickedRows.length,
    private_mockup_click_rate: percent(privateMockupClickedRows.length, deliveredRows.length || sentRows.length || outreachRows.length),
    suppression_count: suppressedRows.length,
    event_count: eventRows.length,
    events_by_type: eventsByType,
    follow_up_rows: followUpRows,
    suppressed_rows: suppressedRows,
    now: now.toISOString(),
  };
};

const formatRowLabel = (row = {}) => {
  const raceName = clean(row.race_name || 'Unnamed race', 120);
  const domain = clean(row.official_domain || row.race_domain, 120);
  const recipients = recipientMasks(row);
  const parts = [raceName];
  if (domain) parts.push(domain);
  if (recipients.length) parts.push(`recipient ${recipients.join(', ')}`);
  return parts.join(' — ');
};

export const buildOutreachEngagementOwnerDigest = (rows = [], events = [], options = {}) => {
  const summary = summarizeOutreachEngagementRows(rows, events, options);
  const generatedAt = options.generatedAt || summary.now;
  const campaign = clean(options.campaignId || 'all campaigns', 120);
  const source = clean(options.source || 'race_mockup_outreach engagement aggregates', 160);
  const lines = [
    'StartLine outreach engagement owner digest',
    `Generated: ${generatedAt}`,
    `Scope: ${campaign}`,
    `Source: ${source}`,
    '',
    'Owner gate: review only. This digest never sends customer/race-director follow-ups.',
    'Open tracking caveat: opens are directional because Apple/Gmail/security scanners can inflate or hide opens.',
    '',
  ];

  if (!summary.total_rows) {
    lines.push('No outreach rows matched this digest. No engagement or follow-up recommendations to report.');
    return lines.join('\n');
  }

  lines.push('Summary');
  lines.push(`- Sent/outreach rows: ${summary.sent_count}/${summary.total_rows}`);
  lines.push(`- Delivered: ${summary.delivered_count} (${summary.delivered_rate})`);
  lines.push(`- Opened: ${summary.open_count} (${summary.open_rate}, directional)`);
  lines.push(`- Clicked: ${summary.click_count} (${summary.click_rate})`);
  lines.push(`- Private mockup clicks: ${summary.private_mockup_click_count} (${summary.private_mockup_click_rate})`);
  lines.push(`- Suppression blockers: ${summary.suppression_count}`);
  if (summary.event_count) {
    const eventParts = Object.entries(summary.events_by_type).map(([type, count]) => `${type}: ${count}`);
    lines.push(`- Raw events included: ${summary.event_count}${eventParts.length ? ` (${eventParts.join(', ')})` : ''}`);
  }
  lines.push('');

  lines.push('Recommended owner-reviewed actions');
  if (!summary.follow_up_rows.length) {
    lines.push('- No eligible follow-up recommendations yet.');
  } else {
    summary.follow_up_rows.slice(0, Number.isFinite(Number(options.recommendationLimit)) ? Number(options.recommendationLimit) : 8).forEach((row, index) => {
      lines.push(`${index + 1}. ${formatRowLabel(row)}`);
      lines.push(`   Status: ${statusOf(row)}; next follow-up: ${formatDate(row.next_follow_up_at)}`);
      lines.push(`   Recommendation: ${recommendationFor(row, { now: summary.now })}`);
      if (row.follow_up_reason) lines.push(`   Internal reason: ${clean(row.follow_up_reason, 220)}`);
    });
  }
  lines.push('');

  lines.push('Suppression blockers');
  if (!summary.suppressed_rows.length) {
    lines.push('- None in this digest.');
  } else {
    summary.suppressed_rows.slice(0, 8).forEach((row) => {
      lines.push(`- ${formatRowLabel(row)} — ${statusOf(row)}. Do not follow up unless Steve records a verified replacement contact.`);
    });
  }
  lines.push('');
  lines.push('Reply options: approve a numbered follow-up draft, hold, suppress manually, or ask for more contact research.');

  return lines.join('\n');
};

export const validateOwnerDigestText = (digest = '') => {
  const text = String(digest);
  const rejected = [
    /I saw you (opened|clicked)/i,
    /we saw you (opened|clicked)/i,
    /you opened/i,
    /you clicked/i,
    /@[^\s]*\.[^\s]*/i,
  ].filter((pattern) => pattern.test(text));
  return {
    ok: rejected.length === 0,
    rejected_terms: rejected.map((pattern) => pattern.source),
  };
};

export const loadOutreachEngagementDigestData = async ({ supabaseRequest, campaignId, since, until, limit } = {}) => {
  if (typeof supabaseRequest !== 'function') throw new Error('supabaseRequest is required.');
  const outreach = await supabaseRequest({ path: buildOutreachDigestQuery({ campaignId, since, until, limit }) }) || [];
  const eventQuery = buildOutreachEventDigestQuery({ outreachIds: outreach.map((row) => row.id) });
  const events = eventQuery ? await supabaseRequest({ path: eventQuery }) || [] : [];
  return { outreach, events };
};
