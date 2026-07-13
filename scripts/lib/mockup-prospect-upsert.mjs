import { scoreCommunityProspect } from './mockup-prospect-scoring.mjs';

export const clean = (value, max = 1000) => {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/\s+/g, ' ').slice(0, max);
};

export const slugifyRace = (value) => clean(value, 160)
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 120);

const normalizeUrl = (value) => {
  const text = clean(value, 2000);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
};

const hostnameFromUrl = (value) => {
  const url = normalizeUrl(value);
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
};

const isRunSignupUrl = (value) => {
  const host = hostnameFromUrl(value);
  return Boolean(host && /(^|\.)runsignup\.com$/i.test(host));
};

const normalizeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const normalizeJsonObject = (value, fallback = {}) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return fallback;
};

const normalizeJsonArray = (value) => normalizeArray(value).map((item) => {
  if (item && typeof item === 'object') return item;
  return { value: clean(item, 1000) };
});

const mergeSourceUrls = (input) => {
  const urls = [
    input.sourceUrl || input.source_url,
    input.registrationUrl || input.registration_url,
    input.officialUrl || input.official_url,
    ...normalizeArray(input.sourceUrls || input.source_urls),
  ].map(normalizeUrl).filter(Boolean);
  return [...new Set(urls)];
};

export const buildRaceMockupProspectPayload = (input = {}, options = {}) => {
  const raceName = clean(input.raceName || input.race_name, 240);
  const sourceUrl = normalizeUrl(input.sourceUrl || input.source_url || input.registrationUrl || input.registration_url);
  const registrationUrl = normalizeUrl(input.registrationUrl || input.registration_url || sourceUrl);
  const officialUrl = normalizeUrl(input.officialUrl || input.official_url);
  const raceSlug = clean(input.raceSlug || input.race_slug, 160) || slugifyRace(raceName);
  const sourcePlatform = clean(input.sourcePlatform || input.source_platform || (isRunSignupUrl(sourceUrl) ? 'runsignup' : 'other'), 80).toLowerCase();
  const registrationPlatform = clean(input.registrationPlatform || input.registration_platform || (isRunSignupUrl(registrationUrl) ? 'runsignup' : ''), 80).toLowerCase() || null;
  const contactSources = normalizeJsonArray(input.contactSources || input.contact_sources);
  const sourceUrls = mergeSourceUrls(input);
  const sourceCoverage = normalizeJsonObject(input.sourceCoverage || input.source_coverage);
  const extractedFacts = normalizeJsonObject(input.extractedFacts || input.extracted_facts);
  const distances = normalizeArray(input.distances || extractedFacts.distances);
  const score = scoreCommunityProspect({
    ...input,
    raceName,
    raceCity: input.raceCity || input.race_city || input.city,
    raceState: input.raceState || input.race_state || input.state,
    sourcePlatform,
    sourceUrl,
    registrationUrl,
    officialUrl,
    contactSources,
    sourceUrls,
    sourceCoverage,
    distances,
  }, options);

  return {
    race_name: raceName,
    race_slug: raceSlug,
    race_city: clean(input.raceCity || input.race_city || input.city, 120) || null,
    race_state: clean(input.raceState || input.race_state || input.state, 40) || null,
    region: clean(input.region, 160) || null,
    event_date: clean(input.eventDate || input.event_date, 40) || null,
    source_platform: sourcePlatform,
    source_url: sourceUrl,
    source_race_id: clean(input.sourceRaceId || input.source_race_id, 120) || null,
    official_url: officialUrl,
    official_domain: clean(input.officialDomain || input.official_domain, 240) || hostnameFromUrl(officialUrl),
    registration_url: registrationUrl,
    registration_platform: registrationPlatform,
    registration_race_id: clean(input.registrationRaceId || input.registration_race_id || input.sourceRaceId || input.source_race_id, 120) || null,
    discovered_from: clean(input.discoveredFrom || input.discovered_from, 500) || null,
    source_urls: sourceUrls,
    contact_sources: contactSources,
    extracted_facts: {
      ...extractedFacts,
      ...(distances.length ? { distances } : {}),
      ...(clean(input.description, 5000) ? { description: clean(input.description, 5000) } : {}),
    },
    source_coverage: sourceCoverage,
    community_fit_score: score.communityFitScore,
    business_opportunity_score: score.businessOpportunityScore,
    source_quality_score: score.sourceQualityScore,
    outreach_viability_score: score.outreachViabilityScore,
    total_score: score.totalScore,
    recommended_template: score.recommendedTemplate,
    qualification_status: score.qualificationStatus,
    qualification_reason: score.reasons.join(' '),
    disqualifiers: score.disqualifiers,
    owner_approval_status: score.ownerApprovalStatus,
    metadata: {
      ...(normalizeJsonObject(input.metadata || {})),
      scoring_reasons: score.reasons,
      upsert_source: options.upsertSource || 'scripts/upsert-mockup-prospect.mjs',
    },
  };
};

export const validateRaceMockupProspectInput = (input = {}) => {
  const payload = buildRaceMockupProspectPayload(input);
  const errors = [];
  if (!payload.race_name) errors.push('raceName is required.');
  if (!payload.race_slug) errors.push('raceSlug could not be generated.');
  if (!payload.source_url) errors.push('sourceUrl or registrationUrl must be a valid http(s) URL.');
  if (payload.event_date && Number.isNaN(new Date(payload.event_date).getTime())) errors.push('eventDate must be a valid date when provided.');
  return errors;
};

export const buildProspectLookupFilters = (payload = {}) => {
  const filters = [];
  if (payload.registration_platform && payload.registration_race_id) {
    filters.push(`registration_platform=eq.${encodeURIComponent(payload.registration_platform)}&registration_race_id=eq.${encodeURIComponent(payload.registration_race_id)}`);
  }
  if (payload.source_platform && payload.source_race_id) {
    filters.push(`source_platform=eq.${encodeURIComponent(payload.source_platform)}&source_race_id=eq.${encodeURIComponent(payload.source_race_id)}`);
  }
  if (payload.source_url) {
    filters.push(`source_url=eq.${encodeURIComponent(payload.source_url)}`);
  }
  return [...new Set(filters)];
};
