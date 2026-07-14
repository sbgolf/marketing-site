import { randomBytes } from 'node:crypto';

const REJECTED_TEXT_RE = /\bno-index\b|\bBailey\b/i;
const ACCESS_TOKEN_RE = /^[a-f0-9]{32,}$/i;
const COMMUNITY_TEMPLATE = 'community';

export const clean = (value, max = 500) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const asArray = (value) => Array.isArray(value) ? value : [];
const compact = (items) => items.filter((item) => item !== null && item !== undefined && item !== '');
const unique = (items) => [...new Set(compact(items))];

export const generateAccessToken = () => randomBytes(16).toString('hex');

export const slugify = (value) => clean(value, 120)
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 70) || 'community-race-mockup';

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

const normalizeDate = (value) => {
  const text = clean(value, 80);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const titleCaseWords = (value) => clean(value, 120)
  .replace(/\b([a-z])/g, (match) => match.toUpperCase());

const normalizeDistance = (value, index = 0) => {
  const raw = clean(value, 80);
  if (!raw) return null;
  const normalized = raw
    .replace(/\b(\d+)\s*k\b/i, '$1K')
    .replace(/\b(\d+)\s*mile(s)?\b/i, (_, number, plural = '') => `${number} Mile${plural}`);
  const id = slugify(normalized).replace(/-run$|-walk$|-run-walk$/g, '') || `distance-${index + 1}`;
  return {
    id,
    name: titleCaseWords(normalized),
    distance: normalized,
    ...(index === 0 ? { featured: true } : {}),
    provenance: {
      source: 'prospect discovery output',
      confidence: 'medium',
    },
  };
};

const normalizeCandidate = (candidate = {}) => {
  const payload = candidate.payload || candidate;
  const input = candidate.input || {};
  const extractedFacts = payload.extracted_facts || input.extractedFacts || input.extracted_facts || {};
  const distances = unique([
    ...asArray(payload.distances),
    ...asArray(input.distances),
    ...asArray(extractedFacts.distances),
    ...asArray(extractedFacts.event_names),
  ]).map((item) => clean(item)).filter(Boolean);
  return {
    raceName: clean(payload.raceName || payload.race_name || input.raceName || input.race_name, 240),
    raceSlug: clean(payload.raceSlug || payload.race_slug || input.raceSlug || input.race_slug, 120),
    city: clean(payload.city || payload.race_city || input.raceCity || input.race_city, 120),
    state: clean(payload.state || payload.race_state || input.raceState || input.race_state, 40),
    eventDate: normalizeDate(payload.eventDate || payload.event_date || input.eventDate || input.event_date),
    sourceUrl: normalizeUrl(payload.sourceUrl || payload.source_url || input.sourceUrl || input.source_url),
    sourcePlatform: clean(payload.sourcePlatform || payload.source_platform || input.sourcePlatform || input.source_platform || 'runsignup', 80).toLowerCase(),
    sourceRaceId: clean(payload.sourceRaceId || payload.source_race_id || input.sourceRaceId || input.source_race_id, 80),
    registrationUrl: normalizeUrl(payload.registrationUrl || payload.registration_url || input.registrationUrl || input.registration_url || payload.sourceUrl || payload.source_url || input.sourceUrl || input.source_url),
    registrationPlatform: clean(payload.registrationPlatform || payload.registration_platform || input.registrationPlatform || input.registration_platform || 'runsignup', 80).toLowerCase(),
    registrationRaceId: clean(payload.registrationRaceId || payload.registration_race_id || input.registrationRaceId || input.registration_race_id || payload.sourceRaceId || payload.source_race_id || input.sourceRaceId || input.source_race_id, 80),
    officialUrl: normalizeUrl(payload.officialUrl || payload.official_url || input.officialUrl || input.official_url),
    distances,
    description: clean(payload.description || input.description, 800),
    totalScore: Number(payload.totalScore ?? payload.total_score ?? candidate.total_score ?? 0),
    qualificationStatus: clean(payload.qualificationStatus || payload.qualification_status || candidate.qualification_status, 80),
    qualificationReason: clean(payload.qualificationReason || payload.qualification_reason || candidate.qualification_reason, 1000),
    disqualifiers: asArray(payload.disqualifiers || candidate.disqualifiers).map((item) => clean(item, 240)).filter(Boolean),
    sourceCoverage: payload.sourceCoverage || payload.source_coverage || input.sourceCoverage || input.source_coverage || {},
    sourceUrls: unique(asArray(payload.sourceUrls || payload.source_urls || input.sourceUrls || input.source_urls).map(normalizeUrl)),
    contactSources: asArray(payload.contactSources || payload.contact_sources || input.contactSources || input.contact_sources),
    extractedFacts,
  };
};

export const extractConfigCandidates = (data = {}) => {
  if (Array.isArray(data)) return data.map(normalizeCandidate);
  if (Array.isArray(data.candidates)) return data.candidates.map(normalizeCandidate);
  if (Array.isArray(data.results)) return data.results.map(normalizeCandidate);
  return [];
};

const requiredMissing = (candidate) => {
  const missing = [];
  if (!candidate.raceName) missing.push('race name');
  if (!candidate.eventDate) missing.push('event date');
  if (!candidate.city && !candidate.state) missing.push('location');
  if (!candidate.registrationUrl) missing.push('registration URL');
  if (!candidate.distances.length) missing.push('distance list');
  if (!candidate.sourceUrl) missing.push('source URL');
  return missing;
};

export const assertGenerationAllowed = (candidate, options = {}) => {
  const errors = [];
  if (!options.ownerApproved) errors.push('Owner approval is required before generating a private mockup config. Pass ownerApproved only after Steve approves a specific candidate.');
  if (candidate.qualificationStatus !== 'qualified_for_mockup' && !options.allowNeedsReview) {
    errors.push(`Candidate status is ${candidate.qualificationStatus || 'unknown'}, not qualified_for_mockup.`);
  }
  if (candidate.disqualifiers.length) errors.push(`Candidate has disqualifiers: ${candidate.disqualifiers.join('; ')}`);
  const missing = requiredMissing(candidate);
  if (missing.length) errors.push(`Candidate is missing required source facts: ${missing.join(', ')}.`);
  if (errors.length) {
    const error = new Error(errors.join(' '));
    error.details = errors;
    throw error;
  }
};

const buildChecklistItems = (candidate, distanceIds) => {
  const items = [];
  const add = (item) => {
    if (!items.some((existing) => existing.id === item.id)) items.push(item);
  };
  add({
    id: 'date',
    label: 'Race date',
    value: candidate.eventDate,
    source_url: candidate.sourceUrl,
  });
  add({
    id: 'distance',
    label: candidate.distances.length > 1 ? 'Distances' : 'Distance',
    value: candidate.distances.join(', '),
    source_url: candidate.sourceUrl,
    applies_to_distance_ids: distanceIds,
  });
  add({
    id: 'location',
    label: 'Location',
    value: [candidate.city, candidate.state].filter(Boolean).join(', '),
    source_url: candidate.sourceUrl,
  });
  return items;
};

export const buildCommunityMockupConfig = (candidateInput = {}, options = {}) => {
  const candidate = normalizeCandidate(candidateInput);
  assertGenerationAllowed(candidate, options);

  const token = clean(options.token || generateAccessToken(), 80).toLowerCase();
  if (!ACCESS_TOKEN_RE.test(token)) throw new Error('Private mockup access token must be 32+ hex characters.');

  const slug = slugify(options.slug || candidate.raceSlug || candidate.raceName);
  const location = [candidate.city, candidate.state].filter(Boolean).join(', ');
  const distances = candidate.distances
    .map(normalizeDistance)
    .filter(Boolean)
    .filter((distance, index, all) => all.findIndex((item) => item.id === distance.id) === index);
  const distanceIds = distances.map((distance) => distance.id);
  const sourceUrls = unique([candidate.sourceUrl, candidate.registrationUrl, candidate.officialUrl, ...candidate.sourceUrls]);
  const description = candidate.description || `${candidate.raceName} is a community race in ${location}.`;

  const config = {
    identity: {
      template: COMMUNITY_TEMPLATE,
      name: candidate.raceName,
      slug,
      tagline: clean(description, 120),
      hero_image: {
        alt: `${candidate.raceName} race-day community scene`,
        placeholder: 'inline-svg',
      },
      colors: {
        primary: '#294735',
        secondary: '#D89B2A',
        accent: '#9F4A26',
        ink: '#2A1F18',
      },
    },
    event: {
      date: candidate.eventDate,
      location,
      timezone: 'America/Chicago',
    },
    distances,
    registration: {
      url: candidate.registrationUrl,
      platform: candidate.registrationPlatform || 'runsignup',
      cta_label: candidate.registrationPlatform === 'runsignup' ? 'Register on RunSignup' : 'Register now',
    },
    runner_decision_checklist: {
      headline: 'Key race details before you register',
      intro: 'This private mockup only uses details already visible in the approved source data.',
      items: buildChecklistItems(candidate, distanceIds),
    },
    seo: {
      meta_title: `${candidate.raceName} — ${candidate.eventDate}`,
      meta_description: clean(`${candidate.raceName} is a Community-template private mockup candidate for ${location}, generated from source-backed RunSignup prospect data.`, 165),
    },
    analytics: {
      register_click_event_name: 'register_click',
    },
    private_mockup: {
      access_token: token,
      route: `/private/mockups/${token}/`,
      noindex: true,
      template: COMMUNITY_TEMPLATE,
      source_url: candidate.sourceUrl,
      source_platform: candidate.sourcePlatform,
      source_race_id: candidate.sourceRaceId || undefined,
      registration_race_id: candidate.registrationRaceId || undefined,
      generated_from: 'marketing-site mockup prospect config generator',
      owner_approved_for_generation: true,
      prospect_score: candidate.totalScore,
      qualification_reason: candidate.qualificationReason || undefined,
      source_urls: sourceUrls,
      provenance: {
        items: [
          { field: 'identity.name', source: 'prospect discovery output', confidence: 'high' },
          { field: 'event.date', source: 'prospect discovery output', confidence: 'high' },
          { field: 'event.location', source: 'prospect discovery output', confidence: 'high' },
          { field: 'distances', source: 'prospect discovery output', confidence: 'medium' },
          { field: 'registration.url', source: 'prospect discovery output', confidence: 'high' },
        ],
        source_confirmed_sections: ['identity', 'event', 'distances', 'registration', 'runner_decision_checklist'],
      },
      uncertainty: {
        items: [
          'Schedule, packet pickup, awards, sponsors, GPX, maps, and elevation are omitted unless separately verified from source pages.',
          'Source facts must be rechecked before a customer-sendable mockup is approved.',
        ],
      },
    },
  };

  const serialized = JSON.stringify(config);
  if (REJECTED_TEXT_RE.test(serialized)) throw new Error('Generated config contains rejected wording.');
  return config;
};

export const selectConfigCandidate = (data, options = {}) => {
  const candidates = extractConfigCandidates(data);
  if (!candidates.length) throw new Error('No candidates found in input.');
  if (options.sourceRaceId) {
    const match = candidates.find((candidate) => candidate.sourceRaceId === String(options.sourceRaceId) || candidate.registrationRaceId === String(options.sourceRaceId));
    if (!match) throw new Error(`No candidate found for source race id ${options.sourceRaceId}.`);
    return match;
  }
  if (options.candidateIndex !== undefined) {
    const index = Number(options.candidateIndex) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= candidates.length) throw new Error(`Candidate index must be between 1 and ${candidates.length}.`);
    return candidates[index];
  }
  return candidates.find((candidate) => candidate.qualificationStatus === 'qualified_for_mockup' && !candidate.disqualifiers.length) || candidates[0];
};
