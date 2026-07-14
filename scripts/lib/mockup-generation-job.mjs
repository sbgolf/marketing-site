const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HTTP_URL_RE = /^https?:\/\//i;
const COMMUNITY_TEMPLATE = 'community';

export const clean = (value, max = 500) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const normalizeObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const normalizeRoute = (value) => {
  const route = clean(value, 1000);
  if (!route) return '';
  if (/^https?:\/\//i.test(route)) {
    try {
      return new URL(route).pathname || '';
    } catch {
      return '';
    }
  }
  return route.startsWith('/') ? route : `/${route}`;
};

export const buildMockupUrl = ({ mockupUrl, mockupBaseUrl, route } = {}) => {
  const explicitUrl = clean(mockupUrl, 1000);
  if (explicitUrl) return explicitUrl;

  const base = clean(mockupBaseUrl, 1000).replace(/\/$/, '');
  const path = normalizeRoute(route);
  if (!base || !path) return '';
  try {
    const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
};

export const mockupTokenFromConfig = (config = {}) => {
  const privateMockup = normalizeObject(config.private_mockup);
  const explicit = clean(privateMockup.access_token || privateMockup.token, 220);
  if (explicit) return explicit;

  const route = normalizeRoute(privateMockup.route);
  const segments = route.split('/').filter(Boolean);
  const mockupsIndex = segments.findIndex((segment, index) => segment === 'mockups' && segments[index - 1] === 'private');
  return mockupsIndex >= 0 ? clean(segments[mockupsIndex + 1], 220) : '';
};

export const buildGenerationJobInputFromConfig = (config = {}, options = {}) => {
  const privateMockup = normalizeObject(config.private_mockup);
  const identity = normalizeObject(config.identity);
  const registration = normalizeObject(config.registration);
  return {
    prospectId: options.prospectId,
    template: clean(options.template || privateMockup.template || identity.template || COMMUNITY_TEMPLATE, 120).toLowerCase(),
    mockupToken: options.mockupToken || mockupTokenFromConfig(config),
    mockupUrl: buildMockupUrl({
      mockupUrl: options.mockupUrl,
      mockupBaseUrl: options.mockupBaseUrl,
      route: privateMockup.route,
    }),
    configPath: options.configPath,
    branchName: options.branchName,
    pullRequestUrl: options.pullRequestUrl,
    deployPreviewUrl: options.deployPreviewUrl,
    jobStatus: options.jobStatus || 'config_generated',
    qaStatus: options.qaStatus || 'not_started',
    siteAuditorStatus: options.siteAuditorStatus || 'not_requested',
    sourceBundle: {
      race_name: identity.name || null,
      race_slug: identity.slug || null,
      source_url: privateMockup.source_url || null,
      source_platform: privateMockup.source_platform || null,
      source_race_id: privateMockup.source_race_id || null,
      registration_url: registration.url || null,
      registration_platform: registration.platform || null,
      registration_race_id: privateMockup.registration_race_id || null,
      source_urls: Array.isArray(privateMockup.source_urls) ? privateMockup.source_urls : [],
    },
    sourceCoverage: privateMockup.provenance || {},
    qaReport: options.qaReport || {},
    ownerApprovalStatus: options.ownerApprovalStatus || 'not_requested',
    ownerApprovedAt: options.ownerApprovedAt,
    ownerDecisionNotes: options.ownerDecisionNotes,
    failureReason: options.failureReason,
    metadata: {
      generated_from: privateMockup.generated_from || null,
      owner_approved_for_generation: privateMockup.owner_approved_for_generation === true,
      prospect_score: privateMockup.prospect_score ?? null,
      qualification_reason: privateMockup.qualification_reason || null,
      config_identity_name: identity.name || null,
    },
  };
};

export const validateGenerationJobInput = (input = {}) => {
  const errors = [];
  if (!UUID_RE.test(clean(input.prospectId))) errors.push('prospectId must be a Supabase UUID.');
  const template = clean(input.template, 120).toLowerCase();
  if (!template) errors.push('template is required.');
  else if (template !== COMMUNITY_TEMPLATE) errors.push('template must be community for the current pilot.');
  if (!clean(input.mockupToken)) errors.push('mockupToken is required.');
  const mockupUrl = clean(input.mockupUrl, 1000);
  if (!mockupUrl) errors.push('mockupUrl is required.');
  else if (!HTTP_URL_RE.test(mockupUrl)) errors.push('mockupUrl must be http(s).');
  for (const [key, value] of [
    ['pullRequestUrl', input.pullRequestUrl],
    ['deployPreviewUrl', input.deployPreviewUrl],
  ]) {
    const text = clean(value, 1000);
    if (text && !HTTP_URL_RE.test(text)) errors.push(`${key} must be http(s) when provided.`);
  }
  return errors;
};

export const buildGenerationJobPayload = (input = {}) => ({
  prospect_id: clean(input.prospectId),
  job_status: clean(input.jobStatus, 80) || 'config_generated',
  template: clean(input.template || COMMUNITY_TEMPLATE, 120).toLowerCase(),
  mockup_token: clean(input.mockupToken, 220) || null,
  mockup_url: clean(input.mockupUrl, 1000) || null,
  config_path: clean(input.configPath, 500) || null,
  branch_name: clean(input.branchName, 220) || null,
  pull_request_url: clean(input.pullRequestUrl, 1000) || null,
  deploy_preview_url: clean(input.deployPreviewUrl, 1000) || null,
  source_bundle: normalizeObject(input.sourceBundle),
  source_coverage: normalizeObject(input.sourceCoverage),
  qa_status: clean(input.qaStatus, 80) || 'not_started',
  qa_report: normalizeObject(input.qaReport),
  site_auditor_status: clean(input.siteAuditorStatus, 80) || 'not_requested',
  failure_reason: clean(input.failureReason, 2000) || null,
  owner_approval_status: clean(input.ownerApprovalStatus, 80) || 'not_requested',
  owner_approved_at: clean(input.ownerApprovedAt, 80) || null,
  owner_decision_notes: clean(input.ownerDecisionNotes, 2000) || null,
  metadata: normalizeObject(input.metadata),
});

export const buildGenerationJobLookupFilters = (payload = {}) => {
  const filters = [];
  if (payload.mockup_url) filters.push(`mockup_url=eq.${encodeURIComponent(payload.mockup_url)}`);
  if (payload.prospect_id && payload.mockup_token) {
    filters.push(`prospect_id=eq.${encodeURIComponent(payload.prospect_id)}&mockup_token=eq.${encodeURIComponent(payload.mockup_token)}`);
  }
  return filters;
};
