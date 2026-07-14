import { buildProspectLookupFilters, buildRaceMockupProspectPayload, clean } from './mockup-prospect-upsert.mjs';

const RUNSIGNUP_RACES_ENDPOINT = 'https://api.runsignup.com/rest/races';

const stripHtml = (value = '') => clean(String(value).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'), 5000);

const normalizeDate = (value) => {
  const text = clean(value, 80);
  if (!text) return null;
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toISOString().slice(0, 10);
};

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

const compact = (items) => items.filter((item) => item !== null && item !== undefined && item !== '');
const unique = (items) => [...new Set(compact(items))];

export const buildRunSignupRacesUrl = (params = {}) => {
  const url = new URL(RUNSIGNUP_RACES_ENDPOINT);
  const query = {
    format: 'json',
    events: 'T',
    page: params.page || 1,
    results_per_page: params.resultsPerPage || params.results_per_page || 25,
    ...(params.name ? { name: params.name } : {}),
    ...(params.city ? { city: params.city } : {}),
    ...(params.state ? { state: params.state } : {}),
    ...(params.country ? { country: params.country } : { country: 'US' }),
    ...(params.startDate || params.start_date ? { start_date: params.startDate || params.start_date } : {}),
    ...(params.endDate || params.end_date ? { end_date: params.endDate || params.end_date } : {}),
    ...(params.eventType || params.event_type ? { event_type: params.eventType || params.event_type } : {}),
  };
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  return url;
};

const contactSourcesForRace = (race) => {
  const sources = [];
  if (race.url) sources.push({ type: 'form', label: 'RunSignup race contact path', url: `${String(race.url).replace(/\/$/, '')}/Contact` });
  return sources;
};

export const normalizeRunSignupRaceToProspectInput = (raceWrapper = {}, options = {}) => {
  const race = raceWrapper.race || raceWrapper;
  const address = race.address || {};
  const events = Array.isArray(race.events) ? race.events : [];
  const distances = unique(events.map((event) => clean(event.distance || event.name, 120)));
  const eventNames = unique(events.map((event) => clean(event.name, 160)));
  const registrationUrl = normalizeUrl(race.url);
  const officialUrl = normalizeUrl(race.external_race_url);
  const eventDate = normalizeDate(race.next_date || race.last_date || events[0]?.start_time);
  const description = stripHtml(race.description);
  const sourceUrls = unique([registrationUrl, officialUrl, normalizeUrl(race.logo_url)]);
  const contactSources = contactSourcesForRace(race);
  const city = clean(address.city, 120);
  const state = clean(address.state, 40);

  return {
    raceName: clean(race.name, 240),
    sourcePlatform: 'runsignup',
    sourceUrl: registrationUrl,
    sourceRaceId: race.race_id ? String(race.race_id) : null,
    registrationPlatform: 'runsignup',
    registrationUrl,
    registrationRaceId: race.race_id ? String(race.race_id) : null,
    officialUrl,
    raceCity: city,
    raceState: state,
    region: city && state ? `${city}, ${state}` : state || city || null,
    eventDate,
    distances,
    description,
    contactSources,
    sourceUrls,
    discoveredFrom: options.discoveredFrom || 'RunSignup public races API',
    sourceCoverage: {
      date: Boolean(eventDate),
      location: Boolean(city || state),
      distances: distances.length > 0,
      registration: Boolean(registrationUrl),
      contact: contactSources.length > 0,
      official_url: Boolean(officialUrl),
      description: Boolean(description),
    },
    extractedFacts: {
      runsignup_race_id: race.race_id || null,
      next_date: race.next_date || null,
      timezone: race.timezone || null,
      address,
      event_names: eventNames,
      distances,
      is_registration_open: race.is_registration_open || null,
      external_race_url: race.external_race_url || null,
      logo_url: race.logo_url || null,
    },
    metadata: {
      discovery_source: 'runsignup_public_races_api',
      discovery_query: options.query || {},
    },
  };
};

export const scoreRunSignupDiscoveryResponse = (data = {}, options = {}) => {
  const races = Array.isArray(data.races) ? data.races : [];
  return races.map((raceWrapper) => {
    const input = normalizeRunSignupRaceToProspectInput(raceWrapper, options);
    const payload = buildRaceMockupProspectPayload(input, {
      now: options.now,
      upsertSource: 'scripts/discover-runsignup-prospects.mjs',
    });
    return {
      input,
      payload,
      lookup_filters: buildProspectLookupFilters(payload),
    };
  }).sort((a, b) => b.payload.total_score - a.payload.total_score || a.payload.race_name.localeCompare(b.payload.race_name));
};

export const fetchRunSignupRaces = async (params = {}, fetchImpl = fetch) => {
  const url = buildRunSignupRacesUrl(params);
  const response = await fetchImpl(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'StartLineSitesBot/0.1 (+https://startlinesites.com)',
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`RunSignup races request failed: ${response.status} ${detail.slice(0, 500)}`);
  }
  return response.json();
};
