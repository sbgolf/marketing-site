const clean = (value, max = 1000) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const lc = (value) => clean(value, 500).toLowerCase();
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const asArray = (value) => Array.isArray(value) ? value : (value == null ? [] : [value]);

export const getMetadata = (row = {}) => asObject(row.metadata);
export const getSourceBundle = (row = {}) => asObject(row.source_bundle);

const firstKnown = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && clean(value) !== '') return value;
  }
  return 'unknown';
};

const sourceOf = (row, paths = []) => {
  for (const [label, value] of paths) {
    if (value !== undefined && value !== null && clean(value) !== '') return label;
  }
  return 'unknown';
};

export const normalizeUrlKey = (url = '') => {
  const value = clean(url, 1000);
  if (!value) return '';
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return value.replace(/\/$/, '').toLowerCase();
  }
};

export const normalizeDomain = (domainOrUrl = '') => {
  const value = lc(domainOrUrl);
  if (!value) return '';
  try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return value.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]; }
};

export const raceRegistrationKey = ({ registration_platform = '', registration_race_id = '', source_platform = '', source_race_id = '' } = {}) => {
  const platform = lc(registration_platform || source_platform);
  const raceId = clean(registration_race_id || source_race_id, 200).toLowerCase();
  return platform && raceId ? `${platform}|${raceId}` : '';
};

export const raceDomainKey = ({ race_slug = '', official_domain = '', official_url = '' } = {}) => {
  const slug = lc(race_slug);
  const domain = normalizeDomain(official_domain || official_url);
  return slug && domain ? `${slug}|${domain}` : '';
};

export const normalizeProspectRow = (row = {}) => {
  const meta = getMetadata(row);
  const canonical = {
    ...row,
    id: clean(row.id, 120),
    prospect_type: firstKnown(row.prospect_type, meta.prospect_type),
    campaign_lane: firstKnown(row.campaign_lane, meta.campaign_lane),
    source_platform: firstKnown(row.source_platform, row.registration_platform, meta.source_platform),
    source_race_id: firstKnown(row.source_race_id, row.registration_race_id, meta.source_race_id, meta.registration_race_id),
    registration_platform: firstKnown(row.registration_platform, row.source_platform, meta.registration_platform),
    registration_race_id: firstKnown(row.registration_race_id, row.source_race_id, meta.registration_race_id, meta.source_race_id),
    registration_url: firstKnown(row.registration_url, meta.registration_url),
    event_date: firstKnown(row.event_date, meta.event_date, meta.race_date),
    race_name: firstKnown(row.race_name, meta.race_name),
    race_city: firstKnown(row.race_city, meta.race_city),
    race_state: firstKnown(row.race_state, meta.race_state),
    race_slug: firstKnown(row.race_slug, meta.race_slug),
    official_url: firstKnown(row.official_url, meta.official_url),
    official_domain: firstKnown(row.official_domain, meta.official_domain),
    official_site_assessment: firstKnown(row.official_site_assessment, meta.official_site_assessment, meta.official_site_status),
    contact_sources: asArray(row.contact_sources ?? meta.contact_sources),
    metadata: meta,
  };
  canonical.field_provenance = {
    prospect_type: sourceOf(row, [['prospect.prospect_type', row.prospect_type], ['prospect.metadata.prospect_type', meta.prospect_type]]),
    campaign_lane: sourceOf(row, [['prospect.campaign_lane', row.campaign_lane], ['prospect.metadata.campaign_lane', meta.campaign_lane]]),
    source_platform: sourceOf(row, [['prospect.source_platform', row.source_platform], ['prospect.registration_platform', row.registration_platform], ['prospect.metadata.source_platform', meta.source_platform]]),
    source_race_id: sourceOf(row, [['prospect.source_race_id', row.source_race_id], ['prospect.registration_race_id', row.registration_race_id], ['prospect.metadata.source_race_id', meta.source_race_id], ['prospect.metadata.registration_race_id', meta.registration_race_id]]),
    registration_url: sourceOf(row, [['prospect.registration_url', row.registration_url], ['prospect.metadata.registration_url', meta.registration_url]]),
    event_date: sourceOf(row, [['prospect.event_date', row.event_date], ['prospect.metadata.event_date', meta.event_date], ['prospect.metadata.race_date', meta.race_date]]),
    contact_sources: sourceOf(row, [['prospect.contact_sources', row.contact_sources], ['prospect.metadata.contact_sources', meta.contact_sources]]),
    official_site_assessment: sourceOf(row, [['prospect.official_site_assessment', row.official_site_assessment], ['prospect.metadata.official_site_assessment', meta.official_site_assessment], ['prospect.metadata.official_site_status', meta.official_site_status]]),
  };
  return canonical;
};

export const normalizeGenerationJobRow = (row = {}) => {
  const meta = getMetadata(row);
  const bundle = getSourceBundle(row);
  return {
    ...row,
    id: clean(row.id, 120),
    prospect_id: clean(row.prospect_id || meta.prospect_id, 120),
    template: firstKnown(row.template, row.mockup_template, meta.template, meta.mockup_template),
    mockup_url: firstKnown(row.mockup_url, meta.mockup_url, bundle.mockup_url),
    campaign_lane: firstKnown(row.campaign_lane, meta.campaign_lane, bundle.campaign_lane),
    prospect_type: firstKnown(row.prospect_type, meta.prospect_type, bundle.prospect_type),
    qa_status: firstKnown(row.qa_status, meta.qa_status),
    site_auditor_status: firstKnown(row.site_auditor_status, meta.site_auditor_status, 'not_requested'),
    private_preview_current: firstKnown(row.private_preview_current, meta.private_preview_current, meta.private_preview_current_and_accessible),
    private_preview_accessible: firstKnown(row.private_preview_accessible, meta.private_preview_accessible, meta.private_preview_current_and_accessible),
    owner_approval_status: firstKnown(row.owner_approval_status, meta.owner_approval_status),
    outreach_id: clean(row.outreach_id || meta.outreach_id, 120),
    source_bundle: bundle,
    metadata: meta,
  };
};

export const normalizeOutreachRow = (row = {}) => ({
  ...row,
  metadata: getMetadata(row),
  registration_url_key: normalizeUrlKey(row.registration_url || getMetadata(row).registration_url),
  registration_key: raceRegistrationKey({
    registration_platform: row.registration_platform || getMetadata(row).registration_platform,
    registration_race_id: row.registration_race_id || getMetadata(row).registration_race_id,
    source_platform: getMetadata(row).source_platform,
    source_race_id: getMetadata(row).source_race_id,
  }),
  race_domain_key: raceDomainKey(row),
  mockup_url_key: normalizeUrlKey(row.mockup_url || getMetadata(row).mockup_url),
  generation_job_id: clean(getMetadata(row).generation_job_id, 120),
  prospect_id: clean(getMetadata(row).prospect_id, 120),
});

export const normalizeSuppressionRow = (row = {}) => ({ ...row, recipient_email_hash: clean(row.recipient_email_hash, 200) });
export const normalizeAuditRequestRow = (row = {}) => ({ ...row, metadata: getMetadata(row), registration_url_key: normalizeUrlKey(row.registration_url || row.current_url || getMetadata(row).registration_url) });
export const normalizeCustomerRecordRow = (row = {}) => ({ ...row, metadata: getMetadata(row), registration_url_key: normalizeUrlKey(row.registration_url || row.current_url || getMetadata(row).registration_url) });
export const normalizeStripeWebhookEventRow = (row = {}) => ({ ...row, metadata: getMetadata(row), payload: asObject(row.payload) });

const addToIndex = (map, key, value) => {
  if (!key) return;
  const current = map.get(key) || [];
  current.push(value);
  map.set(key, current);
};

export const buildProductionIndexes = ({ prospects = [], generationJobs = [], outreach = [], suppressions = [], auditRequests = [], customerRecords = [], stripeWebhookEvents = [] } = {}) => {
  const indexes = {
    prospectsById: new Map(),
    latestCommunityJobByProspect: new Map(),
    outreachByGenerationJobId: new Map(),
    outreachByProspectId: new Map(),
    outreachByMockupUrl: new Map(),
    outreachByRegistrationKey: new Map(),
    outreachByRegistrationUrl: new Map(),
    outreachByRaceDomain: new Map(),
    suppressionsByHash: new Map(),
    auditRequestsByRegistrationUrl: new Map(),
    customerRecordsByRegistrationUrl: new Map(),
    stripeEventsByCheckout: new Map(),
    stripeEventsByPaymentIntent: new Map(),
    stripeEventsByCustomer: new Map(),
  };
  for (const prospect of prospects) indexes.prospectsById.set(prospect.id, prospect);
  for (const job of generationJobs.filter((j) => lc(j.template) === 'community')) {
    if (!job.prospect_id) continue;
    const current = indexes.latestCommunityJobByProspect.get(job.prospect_id);
    const key = Date.parse(job.updated_at || job.created_at || '') || 0;
    const currentKey = current ? (Date.parse(current.updated_at || current.created_at || '') || 0) : -1;
    if (!current || key >= currentKey) indexes.latestCommunityJobByProspect.set(job.prospect_id, job);
  }
  for (const row of outreach) {
    addToIndex(indexes.outreachByGenerationJobId, row.generation_job_id, row);
    addToIndex(indexes.outreachByProspectId, row.prospect_id, row);
    addToIndex(indexes.outreachByMockupUrl, row.mockup_url_key, row);
    addToIndex(indexes.outreachByRegistrationKey, row.registration_key, row);
    addToIndex(indexes.outreachByRegistrationUrl, row.registration_url_key, row);
    addToIndex(indexes.outreachByRaceDomain, row.race_domain_key, row);
  }
  for (const row of suppressions) addToIndex(indexes.suppressionsByHash, row.recipient_email_hash, row);
  for (const row of auditRequests) addToIndex(indexes.auditRequestsByRegistrationUrl, row.registration_url_key, row);
  for (const row of customerRecords) addToIndex(indexes.customerRecordsByRegistrationUrl, row.registration_url_key, row);
  for (const row of stripeWebhookEvents) {
    addToIndex(indexes.stripeEventsByCheckout, clean(row.checkout_session_id || row.payload?.data?.object?.id, 200), row);
    addToIndex(indexes.stripeEventsByPaymentIntent, clean(row.payment_intent_id || row.payload?.data?.object?.payment_intent, 200), row);
    addToIndex(indexes.stripeEventsByCustomer, clean(row.stripe_customer_id || row.payload?.data?.object?.customer, 200), row);
  }
  return indexes;
};

export const deriveStableKeys = ({ prospect = {}, generationJob = {} } = {}) => ({
  prospect_id: prospect.id || generationJob.prospect_id || '',
  generation_job_id: generationJob.id || '',
  mockup_url_key: normalizeUrlKey(generationJob.mockup_url || prospect.mockup_url),
  registration_url_key: normalizeUrlKey(prospect.registration_url || generationJob.source_bundle?.registration_url),
  registration_key: raceRegistrationKey(prospect),
  race_domain_key: raceDomainKey(prospect),
});

export const uniqueRows = (rows = []) => [...new Map(rows.filter(Boolean).map((row) => [row.id || JSON.stringify(row), row])).values()];

const boolish = (value) => value === true || ['true', '1', 'yes'].includes(lc(value));
const hasLiveStripeSignal = (row = {}) => row.livemode === true || row.payload?.livemode === true || row.payload?.data?.object?.livemode === true;
const hasTestMarker = (row = {}) => {
  const meta = getMetadata(row);
  const text = lc([row.id, row.outreach_status, row.response_status, row.submission_channel, row.transport, row.resend_email_id, row.stripe_event_id, meta.test_live_classification, meta.created_by, meta.reconciliation_source, meta.note, meta.notes].join(' '), 2000);
  return boolish(row.internal_only) || boolish(row.smoke_test) || boolish(row.exclude_from_campaign_metrics) || boolish(meta.internal_only) || boolish(meta.smoke_test) || boolish(meta.exclude_from_campaign_metrics) || boolish(meta.phase3a_controlled_test) || text.includes('smoke') || text.includes('internal') || text.includes('test');
};

export const classifyOutreachHistoryRow = (row = {}) => {
  const meta = getMetadata(row);
  const channel = lc(row.submission_channel || meta.submission_channel || row.transport || meta.transport);
  if (hasTestMarker(row)) return { classification: 'INTERNAL_SMOKE_OR_TEST', blocks: false, reason: 'internal/smoke/test outreach marker' };
  if (boolish(meta.historical_backfill_of_real_contact) || lc(meta.reconciliation_source).includes('historical_backfill')) return { classification: 'HISTORICAL_BACKFILL_OF_REAL_CONTACT', blocks: true, reason: 'historical backfill represents real contact' };
  if (channel.includes('contact_form') || channel.includes('runsignup')) return { classification: 'REAL_EXTERNAL_CONTACT_FORM_SUBMISSION', blocks: true, reason: 'real contact-form submission blocks cold pilot send' };
  if (clean(row.sent_at || row.last_contacted_at || row.resend_email_id || meta.resend_email_id) && !hasTestMarker(row)) return { classification: 'REAL_EXTERNAL_OUTREACH', blocks: true, reason: 'real external email/provider history blocks cold pilot send' };
  return { classification: 'AMBIGUOUS_REQUIRES_OWNER_CONFIRMATION', blocks: false, ownerConfirmation: true, reason: 'matched outreach history lacks durable real/test classification' };
};

export const summarizeOutreachHistory = (rows = []) => {
  const classifications = rows.map((row) => ({ row, ...classifyOutreachHistoryRow(row) }));
  return {
    classifications,
    blockingRows: classifications.filter((item) => item.blocks).map((item) => item.row),
    ambiguousRows: classifications.filter((item) => item.ownerConfirmation).map((item) => item.row),
    breakdown: classifications.reduce((acc, item) => { acc[item.classification] = (acc[item.classification] || 0) + 1; return acc; }, {}),
  };
};

const classifyCommercialRow = (row = {}) => {
  const meta = getMetadata(row);
  if (hasLiveStripeSignal(row)) return { classification: 'LIVE_AUDIT_CUSTOMER_PAYMENT_OUTCOME', blocks: true, reason: 'live-mode Stripe/customer/payment evidence' };
  if (hasTestMarker(row)) return { classification: 'CONTROLLED_TEST_OUTCOME', blocks: false, reason: 'controlled internal/test commercial evidence' };
  const statusText = lc([row.status, row.outreach_status, row.customer_status, row.deposit_status, row.subscription_status, meta.status, meta.created_by].join(' '));
  if (statusText.includes('manual') || statusText.includes('conversation')) return { classification: 'AMBIGUOUS_MANUAL_HISTORY_CONFIRMATION', ownerConfirmation: true, reason: 'manual/test history needs owner confirmation' };
  if (clean(row.id)) return { classification: 'AMBIGUOUS_MANUAL_HISTORY_CONFIRMATION', ownerConfirmation: true, reason: 'commercial row is linkable but not clearly live or controlled test' };
  return { classification: 'NO_HISTORICAL_BLOCKER', blocks: false, reason: 'no row' };
};

export const classifyCommercialHistory = ({ auditRequests = [], customerRecords = [], stripeEvents = [] } = {}) => {
  const classified = [...auditRequests, ...customerRecords, ...stripeEvents].map((row) => ({ row, ...classifyCommercialRow(row) }));
  const blocking = classified.filter((item) => item.blocks);
  const ambiguous = classified.filter((item) => item.ownerConfirmation);
  const controlled = classified.filter((item) => item.classification === 'CONTROLLED_TEST_OUTCOME');
  return {
    state: blocking.length ? 'BLOCKS' : ambiguous.length ? 'OWNER_CONFIRMATION_REQUIRED' : 'CLEAR',
    reasons: [...blocking, ...ambiguous].map((item) => item.reason),
    classified,
    breakdown: classified.reduce((acc, item) => { acc[item.classification] = (acc[item.classification] || 0) + 1; return acc; }, {}),
    blockingAuditRequests: blocking.map((item) => item.row).filter((row) => auditRequests.includes(row)),
    blockingCustomerRecords: blocking.map((item) => item.row).filter((row) => customerRecords.includes(row)),
    blockingStripeEvents: blocking.map((item) => item.row).filter((row) => stripeEvents.includes(row)),
    controlledTestRows: controlled.map((item) => item.row),
  };
};

export const findPriorOutreachForCandidate = ({ prospect = {}, generationJob = {}, indexes } = {}) => {
  const keys = deriveStableKeys({ prospect, generationJob });
  return uniqueRows([
    ...(indexes.outreachByGenerationJobId.get(keys.generation_job_id) || []),
    ...(indexes.outreachByProspectId.get(keys.prospect_id) || []),
    ...(indexes.outreachByMockupUrl.get(keys.mockup_url_key) || []),
    ...(indexes.outreachByRegistrationKey.get(keys.registration_key) || []),
    ...(indexes.outreachByRegistrationUrl.get(keys.registration_url_key) || []),
    ...(indexes.outreachByRaceDomain.get(keys.race_domain_key) || []),
  ]);
};

export const findSuppressionsForCandidate = ({ recipientHashes = [], indexes } = {}) => uniqueRows(recipientHashes.flatMap((hash) => indexes.suppressionsByHash.get(hash) || []));

export const findOutcomeEvidenceForCandidate = ({ prospect = {}, generationJob = {}, indexes } = {}) => {
  const keys = deriveStableKeys({ prospect, generationJob });
  const auditRequests = uniqueRows(indexes.auditRequestsByRegistrationUrl.get(keys.registration_url_key) || []);
  const customerRecords = uniqueRows(indexes.customerRecordsByRegistrationUrl.get(keys.registration_url_key) || []);
  const stripeEvents = uniqueRows(customerRecords.flatMap((row) => [
    ...(indexes.stripeEventsByCheckout.get(clean(row.stripe_checkout_session_id, 200)) || []),
    ...(indexes.stripeEventsByPaymentIntent.get(clean(row.stripe_deposit_payment_intent_id, 200)) || []),
    ...(indexes.stripeEventsByCustomer.get(clean(row.stripe_customer_id, 200)) || []),
  ]));
  const commercialHistoryClassification = classifyCommercialHistory({ auditRequests, customerRecords, stripeEvents });
  return {
    priorReplies: [],
    manualContacts: [],
    auditRequests: commercialHistoryClassification.blockingAuditRequests,
    proposals: [],
    checkouts: commercialHistoryClassification.blockingStripeEvents.filter((event) => lc(event.event_type).includes('checkout')),
    customerRecords: commercialHistoryClassification.blockingCustomerRecords,
    stripeEvents: commercialHistoryClassification.blockingStripeEvents,
    commercialHistoryClassification,
    unavailableSources: commercialHistoryClassification.state === 'OWNER_CONFIRMATION_REQUIRED' ? ['ambiguous_commercial_history_requires_owner_confirmation'] : [],
    unverifiedLinkages: [],
    sourceSummary: {
      audit_requests: auditRequests.length,
      customer_records: customerRecords.length,
      stripe_webhook_events: stripeEvents.length,
      commercial_history_breakdown: commercialHistoryClassification.breakdown,
      controlled_test_rows: commercialHistoryClassification.controlledTestRows.length,
      proposal_evidence_source: 'unavailable',
    },
  };
};

export const buildProductionDataMapMarkdown = ({ tableScans = {}, generatedAt = new Date().toISOString() } = {}) => {
  const lines = [
    '# STARTLINESITES_CMO_PHASE2A1_PRODUCTION_DATA_ADAPTER_MAP',
    '',
    `Generated: ${generatedAt}`,
    '',
    'Private read-only production data map. Values are redacted; this records columns/keys only.',
    '',
  ];
  for (const [table, scan] of Object.entries(tableScans)) {
    const metadataKeys = new Set();
    for (const row of scan.rows || []) Object.keys(asObject(row.metadata)).forEach((key) => metadataKeys.add(key));
    lines.push(`## ${table}`);
    lines.push(`- Rows loaded: ${scan.rows?.length ?? 0}`);
    lines.push(`- Pages: ${scan.pageCount ?? 0}`);
    lines.push(`- Raw production columns observed: ${(scan.rawColumns || []).sort().join(', ') || 'none_observed'}`);
    lines.push(`- Canonical normalized fields produced: ${(scan.canonicalFields || []).sort().join(', ') || 'none_observed'}`);
    lines.push(`- Metadata keys observed: ${[...metadataKeys].sort().join(', ') || 'none_observed'}`);
    lines.push(`- Stable linkage keys used: ${scan.keysIndexed?.join(', ') || 'see adapter indexes'}`);
    lines.push('');
  }
  lines.push('## Sufficiency summary');
  lines.push('- duplicate outreach: race_mockup_outreach via metadata generation/prospect IDs, mockup URL, registration keys, race/domain keys.');
  lines.push('- suppression: outreach_suppressions.recipient_email_hash via production hash helper.');
  lines.push('- reply/manual-contact evidence: incomplete unless durable outreach response/manual state is present; owner confirmation required for otherwise-qualified candidates.');
  lines.push('- audit request evidence: audit_requests via registration/current URL where reliable.');
  lines.push('- proposal evidence: no proposal table queried; unavailable, owner history confirmation required.');
  lines.push('- checkout/payment/customer evidence: customer_records and stripe_webhook_events via registration URL and Stripe IDs when linkable.');
  return `${lines.join('\n')}\n`;
};
