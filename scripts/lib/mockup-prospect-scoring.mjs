const COMMUNITY_KEYWORDS = [
  'community',
  'hometown',
  'family',
  'families',
  'fun run',
  'kids',
  'school',
  'ymca',
  'church',
  'neighborhood',
  'festival',
  'park',
  'greenway',
  'local',
  'walk',
];

const CAUSE_KEYWORDS = [
  'benefit',
  'benefits',
  'charity',
  'foundation',
  'fundraiser',
  'nonprofit',
  'donation',
  'memorial',
  'scholarship',
  'awareness',
  'cause',
  'support',
];

const PERFORMANCE_KEYWORDS = [
  'boston qualifier',
  'bq',
  'pr',
  'personal record',
  'elite',
  'championship',
  'records',
  'certified marathon',
];

const DESTINATION_KEYWORDS = [
  'destination',
  'resort',
  'vacation',
  'travel',
  'scenic marathon',
  'national park',
  'world-class',
];

const TRAIL_KEYWORDS = ['trail', 'ultra', 'ultramarathon', '50k', '100k', 'mountain', 'technical'];

const RUNSIGNUP_HOST_RE = /(^|\.)runsignup\.com$/i;

export const cleanText = (value, max = 5000) => {
  if (Array.isArray(value)) return value.map((item) => cleanText(item, max)).join(' ');
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/\s+/g, ' ').slice(0, max);
};

const lowerText = (value) => cleanText(value, 20000).toLowerCase();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const keywordMatches = (haystack, needle) => {
  const cleanedNeedle = lowerText(needle);
  if (!cleanedNeedle) return false;
  if (/^[a-z0-9][a-z0-9\s-]*[a-z0-9]$/.test(cleanedNeedle)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegex(cleanedNeedle)}([^a-z0-9]|$)`, 'i').test(haystack);
  }
  return haystack.includes(cleanedNeedle);
};

const includesAny = (haystack, needles) => needles.some((needle) => keywordMatches(haystack, needle));

const countKeywordHits = (haystack, needles) => needles.filter((needle) => keywordMatches(haystack, needle)).length;

const hasRunSignupUrl = (value) => {
  try {
    const url = new URL(cleanText(value, 1000));
    return RUNSIGNUP_HOST_RE.test(url.hostname);
  } catch {
    return false;
  }
};

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const daysUntil = (value, now = new Date()) => {
  const date = toDate(value);
  if (!date) return null;
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((target - start) / 86_400_000);
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const scoreCommunityProspect = (prospect = {}, options = {}) => {
  const now = options.now ? new Date(options.now) : new Date();
  const fields = [
    prospect.raceName,
    prospect.race_name,
    prospect.description,
    prospect.summary,
    prospect.sourceText,
    prospect.source_text,
    prospect.organizationName,
    prospect.organization_name,
    prospect.city,
    prospect.raceCity,
    prospect.race_city,
    prospect.state,
    prospect.raceState,
    prospect.race_state,
    ...(Array.isArray(prospect.distances) ? prospect.distances : []),
  ];
  const text = lowerText(fields);
  const distances = Array.isArray(prospect.distances) ? prospect.distances.map((distance) => lowerText(distance)) : [];
  const eventDate = prospect.eventDate || prospect.event_date;
  const registrationUrl = prospect.registrationUrl || prospect.registration_url || prospect.sourceUrl || prospect.source_url;
  const officialUrl = prospect.officialUrl || prospect.official_url;
  const contactSources = Array.isArray(prospect.contactSources) ? prospect.contactSources : prospect.contact_sources || [];
  const sourceUrls = Array.isArray(prospect.sourceUrls) ? prospect.sourceUrls : prospect.source_urls || [];
  const sourceCoverage = prospect.sourceCoverage || prospect.source_coverage || {};
  const sourcePlatform = lowerText(prospect.sourcePlatform || prospect.source_platform || 'runsignup');

  const reasons = [];
  const disqualifiers = [];

  let communityFitScore = 0;
  const communityHits = countKeywordHits(text, COMMUNITY_KEYWORDS);
  if (communityHits >= 3) {
    communityFitScore += 10;
    reasons.push('Strong local/community language.');
  } else if (communityHits >= 1) {
    communityFitScore += 6;
    reasons.push('Some local/community language.');
  }

  const causeHits = countKeywordHits(text, CAUSE_KEYWORDS);
  if (causeHits >= 2) {
    communityFitScore += 10;
    reasons.push('Cause, nonprofit, or fundraising language is present.');
  } else if (causeHits === 1) {
    communityFitScore += 6;
    reasons.push('Some cause/fundraising signal is present.');
  }

  const hasMultiDistance = distances.length > 1 || /\b(5k|10k|half|marathon|kids|fun run|walk)\b.*\b(5k|10k|half|marathon|kids|fun run|walk)\b/i.test(cleanText(fields));
  if (hasMultiDistance) {
    communityFitScore += 8;
    reasons.push('Multi-distance or family participation format.');
  }

  if (includesAny(text, ['walk', 'kids', 'family', 'fun run', 'community', 'hometown', 'festival'])) {
    communityFitScore += 7;
    reasons.push('Participation-oriented copy fits Community template.');
  }

  let businessOpportunityScore = 0;
  const days = daysUntil(eventDate, now);
  if (officialUrl && hasRunSignupUrl(registrationUrl) && !hasRunSignupUrl(officialUrl)) {
    businessOpportunityScore += 5;
    reasons.push('Has an official site plus RunSignup registration path.');
  } else if (hasRunSignupUrl(registrationUrl) && (!officialUrl || hasRunSignupUrl(officialUrl))) {
    businessOpportunityScore += 10;
    reasons.push('Appears registration-platform-first, a strong StartLine opportunity.');
  }
  if (typeof days === 'number') {
    if (days >= 90 && days <= 300) {
      businessOpportunityScore += 5;
      reasons.push('Race date has useful outreach runway.');
    } else if (days < 45) {
      disqualifiers.push('Race date is too close for first-wave outreach.');
    }
  }
  if (prospect.isRecurring || prospect.is_recurring || includesAny(text, ['annual', 'classic', 'tradition', 'year'])) {
    businessOpportunityScore += 3;
    reasons.push('Recurring/established race signal.');
  }
  if (prospect.currentSiteWeakness || prospect.current_site_weakness || hasRunSignupUrl(registrationUrl)) {
    businessOpportunityScore += 7;
    reasons.push('Current web presence likely has room for a standalone race site.');
  }

  let sourceQualityScore = 0;
  const hasDate = Boolean(eventDate || sourceCoverage.date);
  const hasLocation = Boolean(prospect.city || prospect.raceCity || prospect.race_city || sourceCoverage.location);
  const hasDistance = distances.length > 0 || Boolean(sourceCoverage.distances);
  if (hasDate && hasLocation && hasDistance) {
    sourceQualityScore += 5;
    reasons.push('Core date/location/distance facts are available.');
  }
  if (registrationUrl || sourceCoverage.registration) {
    sourceQualityScore += 5;
    reasons.push('Registration URL is available.');
  }
  if (sourceCoverage.schedule || sourceCoverage.logistics || includesAny(text, ['packet pickup', 'schedule', 'race day', 'parking'])) {
    sourceQualityScore += 4;
    reasons.push('Schedule/logistics source detail is available.');
  }
  if (contactSources.length > 0 || sourceCoverage.contact || includesAny(text, ['contact race', 'contact the race', 'email'])) {
    sourceQualityScore += 4;
    reasons.push('Contact path is available.');
  }
  if (sourceCoverage.sponsors || sourceCoverage.cause || causeHits > 0) {
    sourceQualityScore += 2;
    reasons.push('Cause/sponsor/community proof can support the page.');
  }

  let outreachViabilityScore = 0;
  const directEmailContacts = contactSources.filter((source) => lowerText(source.type || source.kind || source.label).includes('email') || lowerText(source.value || source.email).includes('@'));
  const formContacts = contactSources.filter((source) => lowerText(source.type || source.kind || source.label).includes('form'));
  if (directEmailContacts.length > 0) {
    outreachViabilityScore += 8;
    reasons.push('Direct race contact email found.');
  }
  if (formContacts.length > 0 || includesAny(text, ['contact the race', 'contact form'])) {
    outreachViabilityScore += 5;
    reasons.push('Contact form path found.');
  }
  if (officialUrl || prospect.officialDomain || prospect.official_domain) {
    outreachViabilityScore += 3;
    reasons.push('Official race/org web identity found.');
  }
  if (!prospect.priorOutreach && !prospect.prior_outreach) {
    outreachViabilityScore += 4;
    reasons.push('No prior outreach flagged in input.');
  }

  if (sourcePlatform !== 'runsignup' && !hasRunSignupUrl(registrationUrl) && !sourceUrls.some(hasRunSignupUrl)) {
    disqualifiers.push('First pilot is RunSignup-first; no RunSignup source detected.');
  }
  if (includesAny(text, PERFORMANCE_KEYWORDS)) {
    disqualifiers.push('Performance/BQ-coded language suggests this may not be a Community-template fit.');
  }
  if (includesAny(text, DESTINATION_KEYWORDS)) {
    disqualifiers.push('Destination-positioned language suggests this may not be a Community-template fit.');
  }
  if (includesAny(text, TRAIL_KEYWORDS)) {
    disqualifiers.push('Trail/ultra language is outside the current Community-first pilot.');
  }

  communityFitScore = clamp(communityFitScore, 0, 35);
  businessOpportunityScore = clamp(businessOpportunityScore, 0, 25);
  sourceQualityScore = clamp(sourceQualityScore, 0, 20);
  outreachViabilityScore = clamp(outreachViabilityScore, 0, 20);
  const totalScore = communityFitScore + businessOpportunityScore + sourceQualityScore + outreachViabilityScore;

  let qualificationStatus = 'skipped';
  if (disqualifiers.length > 0) {
    qualificationStatus = totalScore >= 80 ? 'needs_review' : 'skipped';
  } else if (totalScore >= 80) {
    qualificationStatus = 'qualified_for_mockup';
  } else if (totalScore >= 65) {
    qualificationStatus = 'needs_review';
  } else if (totalScore >= 45) {
    qualificationStatus = 'scored';
  }

  return {
    communityFitScore,
    businessOpportunityScore,
    sourceQualityScore,
    outreachViabilityScore,
    totalScore,
    recommendedTemplate: 'community',
    qualificationStatus,
    ownerApprovalStatus: 'not_requested',
    reasons,
    disqualifiers,
  };
};
