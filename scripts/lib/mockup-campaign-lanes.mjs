const clean = (value, max = 5000) => {
  if (Array.isArray(value)) return value.map((item) => clean(item, max)).join(' ');
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/\s+/g, ' ').slice(0, max);
};

const lowerText = (value) => clean(value, 20000).toLowerCase();
const asArray = (value) => Array.isArray(value) ? value : [];
const normalizeObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const keywordMatches = (haystack, needle) => {
  const cleanedNeedle = lowerText(needle);
  if (!cleanedNeedle) return false;
  if (/^[a-z0-9][a-z0-9\s-]*[a-z0-9]$/.test(cleanedNeedle)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegex(cleanedNeedle)}([^a-z0-9]|$)`, 'i').test(haystack);
  }
  return haystack.includes(cleanedNeedle);
};

const countHits = (haystack, needles) => needles.filter((needle) => keywordMatches(haystack, needle)).length;
const hasAny = (haystack, needles) => needles.some((needle) => keywordMatches(haystack, needle));

const hostnameFromUrl = (value) => {
  const text = clean(value, 2000);
  if (!text) return '';
  try {
    return new URL(text).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
};

const isRegistrationPlatformUrl = (value) => {
  const host = hostnameFromUrl(value);
  return Boolean(host && /(^|\.)(runsignup\.com|raceroster\.com|runsignup\.io|runsignup\.run)$/i.test(host));
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

const RUNSIGNUP_ONLY_KEYWORDS = ['community', 'hometown', 'fun run', '5k', '10k', 'walk', 'family', 'annual'];
const SPONSOR_CAUSE_KEYWORDS = [
  'sponsor', 'sponsors', 'presented by', 'thank you to our sponsors', 'partner', 'partners',
  'charity', 'foundation', 'fundraiser', 'donate', 'donation', 'benefits', 'benefiting',
  'memorial', 'scholarship', 'nonprofit', 'ministry', 'school', 'church', 'crisis', 'awareness',
];
const OUTDATED_SITE_KEYWORDS = [
  'wordpress', 'wix', 'squarespace', 'weebly', 'copyright 2020', 'copyright 2021', 'copyright 2022',
  'under construction', 'coming soon', 'pdf', 'flyer', 'brochure', 'not mobile friendly', 'broken',
  'stale', 'outdated', 'slow', 'weak cta', 'registration buried',
];
const OPERATOR_KEYWORDS = [
  'race management', 'event management', 'event production', 'timing company', 'timing services',
  'produced by', 'managed by', 'organizer profile', 'event calendar', 'our events', 'events we manage',
  'sports management', 'race services', 'endurance events', 'portfolio', 'race series',
];

export const CAMPAIGN_LANES = {
  A: {
    label: 'RunSignup-only community race',
    prospectType: 'runsignup_only_community_race',
    emailTemplateKey: 'individual_mockup_v1',
    minScore: 50,
  },
  B: {
    label: 'Sponsor-heavy charity/community race',
    prospectType: 'sponsor_heavy_charity_race',
    emailTemplateKey: 'sponsor_visibility_v1',
    minScore: 60,
  },
  C: {
    label: 'Outdated standalone race website',
    prospectType: 'outdated_standalone_race_site',
    emailTemplateKey: 'outdated_site_modernization_v1',
    minScore: 55,
  },
  D: {
    label: 'Race management / timing company portfolio',
    prospectType: 'race_management_company',
    emailTemplateKey: 'operator_portfolio_v1',
    minScore: 35,
  },
};

export const EMAIL_TEMPLATE_REGISTRY = {
  individual_mockup_v1: {
    allowedLanes: ['A'],
    allowedProspectTypes: ['runsignup_only_community_race'],
    requiresOperatorEvidence: false,
  },
  sponsor_visibility_v1: {
    allowedLanes: ['B'],
    allowedProspectTypes: ['sponsor_heavy_charity_race'],
    requiresOperatorEvidence: false,
  },
  outdated_site_modernization_v1: {
    allowedLanes: ['C'],
    allowedProspectTypes: ['outdated_standalone_race_site'],
    requiresOperatorEvidence: false,
  },
  operator_portfolio_v1: {
    allowedLanes: ['D'],
    allowedProspectTypes: ['race_management_company'],
    requiresOperatorEvidence: true,
    minOperatorEventCount: 3,
    minSegmentEvidenceCount: 2,
    requiresCompanyRecipient: true,
  },
};

const collectText = (prospect = {}) => lowerText([
  prospect.raceName,
  prospect.race_name,
  prospect.organizationName,
  prospect.organization_name,
  prospect.companyName,
  prospect.company_name,
  prospect.description,
  prospect.summary,
  prospect.sourceText,
  prospect.source_text,
  prospect.currentSiteWeakness,
  prospect.current_site_weakness,
  prospect.discoveredFrom,
  prospect.discovered_from,
  ...(asArray(prospect.distances)),
  ...asArray(prospect.sourceUrls || prospect.source_urls),
]);

const classifyContactQuality = (prospect = {}) => {
  const contactSources = asArray(prospect.contactSources || prospect.contact_sources);
  const text = lowerText([collectText(prospect), ...contactSources.map((source) => typeof source === 'string' ? source : Object.values(normalizeObject(source)).join(' '))]);
  const hasEmail = contactSources.some((source) => {
    if (typeof source === 'string') return source.includes('@');
    const item = normalizeObject(source);
    return lowerText([item.type, item.kind, item.label, item.email, item.value, item.address]).includes('@')
      || hasAny(lowerText([item.type, item.kind, item.label]), ['email', 'routing']);
  }) || /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
  const hasForm = contactSources.some((source) => lowerText(typeof source === 'string' ? source : [source.type, source.kind, source.label, source.url]).includes('form')) || hasAny(text, ['contact form', 'contact the race']);
  if (hasEmail) return { score: 20, quality: 'direct_or_routing_email', evidence: ['Direct/routing email contact available.'] };
  if (hasForm) return { score: 6, quality: 'contact_form_only', evidence: ['Contact form available but no verified email.'] };
  return { score: 0, quality: 'missing_contact', evidence: ['No usable contact path found yet.'] };
};

const computeSharedScores = (prospect = {}, options = {}) => {
  const now = options.now ? new Date(options.now) : new Date();
  const text = collectText(prospect);
  const eventDate = prospect.eventDate || prospect.event_date;
  const days = daysUntil(eventDate, now);
  const registrationUrl = prospect.registrationUrl || prospect.registration_url || prospect.sourceUrl || prospect.source_url;
  const officialUrl = prospect.officialUrl || prospect.official_url;
  const sourceUrls = asArray(prospect.sourceUrls || prospect.source_urls);
  const sourceCoverage = normalizeObject(prospect.sourceCoverage || prospect.source_coverage);
  const extractedFacts = normalizeObject(prospect.extractedFacts || prospect.extracted_facts);
  const metadata = normalizeObject(prospect.metadata);
  const contact = classifyContactQuality(prospect);

  let budgetScore = 0;
  const budgetEvidence = [];
  const sponsorCount = Number(prospect.sponsorCount ?? prospect.sponsor_count ?? sourceCoverage.sponsor_count ?? extractedFacts.sponsor_count ?? 0);
  if (sponsorCount >= 5 || sourceCoverage.sponsors || countHits(text, ['sponsor', 'sponsors', 'presented by']) >= 1) {
    budgetScore += sponsorCount >= 5 ? 8 : 5;
    budgetEvidence.push(sponsorCount >= 5 ? '5+ sponsor signal found.' : 'Sponsor signal found.');
  }
  if (sourceCoverage.cause || hasAny(text, ['foundation', 'nonprofit', 'charity', 'school', 'church', 'ministry'])) {
    budgetScore += 5;
    budgetEvidence.push('Nonprofit/cause organization signal found.');
  }
  const registrationPrice = Number(prospect.registrationPrice ?? prospect.registration_price ?? extractedFacts.registration_price ?? 0);
  if (registrationPrice >= 50 || hasAny(text, ['$60', '$75', '$100', '$125', '$150'])) {
    budgetScore += 5;
    budgetEvidence.push('Higher registration price or premium distance signal found.');
  }
  const operatorEventCount = Number(
    prospect.operatorEventCount
    ?? prospect.operator_event_count
    ?? metadata.operator_event_count
    ?? sourceCoverage.operator_event_count
    ?? 0,
  );
  if (operatorEventCount >= 3 || hasAny(text, OPERATOR_KEYWORDS)) {
    budgetScore += 5;
    budgetEvidence.push(operatorEventCount >= 3 ? `${operatorEventCount} operator-managed events found.` : 'Race-management/operator language found.');
  }
  if (sourceCoverage.paid_ads || hasAny(text, ['early bird', 'price increase', 'register today', 'limited spots', 'ad library'])) {
    budgetScore += 2;
    budgetEvidence.push('Active promotion/urgency signal found.');
  }

  let websitePainScore = 0;
  const painEvidence = [];
  const registrationFirst = isRegistrationPlatformUrl(registrationUrl) && (!officialUrl || isRegistrationPlatformUrl(officialUrl));
  if (registrationFirst) {
    websitePainScore += 8;
    painEvidence.push('Registration-platform-first web presence.');
  }
  if (officialUrl && !isRegistrationPlatformUrl(officialUrl) && (sourceCoverage.outdated_site || hasAny(text, OUTDATED_SITE_KEYWORDS))) {
    websitePainScore += 10;
    painEvidence.push('Standalone official site appears outdated or conversion-weak.');
  }
  if (sourceCoverage.poor_mobile || sourceCoverage.weak_cta || hasAny(text, ['poor mobile', 'weak cta', 'buried register', 'registration buried'])) {
    websitePainScore += 5;
    painEvidence.push('Mobile or registration CTA friction found.');
  }
  if (sourceCoverage.broken_pages || sourceCoverage.stale_content || hasAny(text, ['broken link', 'stale', 'old copyright'])) {
    websitePainScore += 2;
    painEvidence.push('Stale or broken current-site signal found.');
  }

  let upsideScore = 0;
  const upsideEvidence = [];
  if (prospect.isRecurring || prospect.is_recurring || hasAny(text, ['annual', 'classic', 'tradition', 'year'])) {
    upsideScore += 6;
    upsideEvidence.push('Recurring/established race signal.');
  }
  const distances = asArray(prospect.distances || extractedFacts.distances);
  if (distances.length > 1 || hasAny(text, ['5k and 10k', 'half marathon and 5k', 'kids run', 'fun run'])) {
    upsideScore += 4;
    upsideEvidence.push('Multiple distances or family formats create more runner-decision content.');
  }
  if (sourceCoverage.donations || sourceCoverage.fundraising || hasAny(text, ['donate', 'donation', 'fundraiser', 'fundraising'])) {
    upsideScore += 4;
    upsideEvidence.push('Fundraising/donation component found.');
  }
  if (sourceCoverage.travel || hasAny(text, ['hotel', 'lodging', 'travel', 'destination', 'scenic', 'waterfront', 'mountain', 'historic'])) {
    upsideScore += 3;
    upsideEvidence.push('Travel/destination logistics can benefit from a stronger landing page.');
  }
  if (typeof days === 'number' && days >= 90 && days <= 300) {
    upsideScore += 3;
    upsideEvidence.push('Event date has useful outreach runway.');
  }

  return {
    text,
    contact,
    operatorEventCount,
    registrationFirst,
    hasOfficialStandaloneSite: Boolean(officialUrl && !isRegistrationPlatformUrl(officialUrl)),
    budgetScore: clamp(budgetScore, 0, 25),
    websitePainScore: clamp(websitePainScore, 0, 25),
    upsideScore: clamp(upsideScore, 0, 20),
    contactScore: clamp(contact.score, 0, 20),
    budgetEvidence,
    painEvidence,
    upsideEvidence,
    contactEvidence: contact.evidence,
    sourceUrls,
    registrationUrl,
    officialUrl,
    sourceCoverage,
  };
};

const laneFitScore = (lane, shared, prospect = {}) => {
  const text = shared.text;
  const evidence = [];
  let score = 0;

  if (lane === 'A') {
    if (shared.registrationFirst) {
      score += 5;
      evidence.push('Fits RunSignup-only/platform-first control lane.');
    }
    const hits = countHits(text, RUNSIGNUP_ONLY_KEYWORDS);
    if (hits >= 3) {
      score += 5;
      evidence.push('Community race language is strong.');
    } else if (hits >= 1) {
      score += 3;
      evidence.push('Some community race language found.');
    }
  }

  if (lane === 'B') {
    const hits = countHits(text, SPONSOR_CAUSE_KEYWORDS);
    const sponsorCount = Number(prospect.sponsorCount ?? prospect.sponsor_count ?? shared.sourceCoverage.sponsor_count ?? 0);
    if (sponsorCount >= 5) {
      score += 5;
      evidence.push('5+ sponsors found for sponsor-visibility angle.');
    } else if (hits >= 2) {
      score += 4;
      evidence.push('Sponsor/cause language supports sponsor-visibility angle.');
    }
    if (shared.sourceCoverage.donations || shared.sourceCoverage.fundraising || hasAny(text, ['donate', 'fundraiser', 'benefiting'])) {
      score += 3;
      evidence.push('Fundraising/donation angle is present.');
    }
    if (hasAny(text, ['foundation', 'nonprofit', 'school', 'church', 'memorial'])) {
      score += 2;
      evidence.push('Cause/community organization can support trust-focused copy.');
    }
  }

  if (lane === 'C') {
    if (shared.hasOfficialStandaloneSite) {
      score += 4;
      evidence.push('Already has a standalone site, so modernization pitch is credible.');
    }
    if (shared.sourceCoverage.outdated_site || hasAny(text, OUTDATED_SITE_KEYWORDS)) {
      score += 4;
      evidence.push('Outdated/stale/weak-site evidence found.');
    }
    if (shared.sourceCoverage.weak_cta || shared.sourceCoverage.poor_mobile || hasAny(text, ['weak cta', 'poor mobile', 'buried register'])) {
      score += 2;
      evidence.push('Conversion/mobile friction evidence found.');
    }
  }

  if (lane === 'D') {
    const operatorEvidence = collectOperatorEvidence(prospect, shared);
    score += Math.min(10, operatorEvidence.length * 3 + (shared.operatorEventCount >= 3 ? 4 : 0));
    evidence.push(...operatorEvidence);
  }

  return { score: clamp(score, 0, 10), evidence };
};

export const collectOperatorEvidence = (prospect = {}, sharedInput = null) => {
  const shared = sharedInput || computeSharedScores(prospect);
  const text = shared.text || collectText(prospect);
  const evidence = [];
  if (shared.operatorEventCount >= 3) evidence.push(`${shared.operatorEventCount} active/known events tied to this operator.`);
  if (hasAny(text, ['race management', 'event management', 'event production', 'sports management'])) evidence.push('Company describes itself as race/event management or production.');
  if (hasAny(text, ['timing company', 'timing services', 'timed by', 'timing by'])) evidence.push('Timing-company language found.');
  if (hasAny(text, ['event calendar', 'our events', 'events we manage'])) evidence.push('Multi-event calendar/portfolio language found.');
  if (hasAny(text, ['produced by', 'managed by', 'organizer profile'])) evidence.push('Produced/managed-by evidence found.');
  if (asArray(prospect.managedEvents || prospect.managed_events).length >= 3) evidence.push(`${asArray(prospect.managedEvents || prospect.managed_events).length} managed events supplied in input.`);
  return [...new Set(evidence)];
};

export const scoreCampaignLaneCandidate = (prospect = {}, lane = 'A', options = {}) => {
  const laneKey = clean(lane, 5).toUpperCase();
  if (!CAMPAIGN_LANES[laneKey]) throw new Error(`Unknown campaign lane: ${lane}`);
  const shared = computeSharedScores(prospect, options);
  const laneFit = laneFitScore(laneKey, shared, prospect);
  const totalScore = clamp(shared.budgetScore + shared.websitePainScore + shared.upsideScore + shared.contactScore + laneFit.score, 0, 100);
  const evidence = [
    ...laneFit.evidence,
    ...shared.budgetEvidence,
    ...shared.painEvidence,
    ...shared.upsideEvidence,
    ...shared.contactEvidence,
  ];
  const disqualifiers = [];
  const days = daysUntil(prospect.eventDate || prospect.event_date, options.now ? new Date(options.now) : new Date());
  if (typeof days === 'number' && days < 45) disqualifiers.push('Event date is too close for first-wave outreach.');
  if (shared.contact.quality === 'missing_contact') disqualifiers.push('No direct/routing email or contact form found yet.');
  if (shared.contact.quality === 'contact_form_only') disqualifiers.push('Contact form only; no race-director send without explicit Steve override.');
  if (laneKey === 'A' && !shared.registrationFirst) disqualifiers.push('Lane A requires registration-platform-first / no meaningful standalone site.');
  if (laneKey === 'B' && laneFit.score < 4) disqualifiers.push('Lane B requires sponsor, cause, donation, or nonprofit evidence.');
  if (laneKey === 'C' && (!shared.hasOfficialStandaloneSite || laneFit.score < 6)) disqualifiers.push('Lane C requires a standalone site plus outdated/conversion-friction evidence.');
  if (laneKey === 'D') {
    const operatorEvidence = collectOperatorEvidence(prospect, shared);
    if (shared.operatorEventCount < 3 && operatorEvidence.length < 2) disqualifiers.push('Lane D requires verified multi-event operator evidence.');
    if (shared.contact.quality !== 'direct_or_routing_email') disqualifiers.push('Lane D requires a company/org/routing email before portfolio outreach.');
  }

  const minScore = CAMPAIGN_LANES[laneKey].minScore;
  const sendEligible = totalScore >= minScore && disqualifiers.length === 0;
  const reviewStatus = sendEligible ? 'eligible_for_owner_review' : totalScore >= 60 ? 'needs_research' : 'not_qualified';
  return {
    campaignLane: laneKey,
    campaignLaneLabel: CAMPAIGN_LANES[laneKey].label,
    prospectType: CAMPAIGN_LANES[laneKey].prospectType,
    emailTemplateKey: CAMPAIGN_LANES[laneKey].emailTemplateKey,
    totalScore,
    budgetScore: shared.budgetScore,
    websitePainScore: shared.websitePainScore,
    upsideScore: shared.upsideScore,
    contactScore: shared.contactScore,
    laneFitScore: laneFit.score,
    contactQuality: shared.contact.quality,
    operatorEventCount: shared.operatorEventCount,
    segmentEvidence: [...new Set(evidence)].slice(0, 12),
    disqualifiers,
    sendEligibilityStatus: reviewStatus,
    sendEligible,
  };
};

export const classifyCampaignLane = (prospect = {}, options = {}) => {
  const requestedLane = clean(prospect.campaignLane || prospect.campaign_lane || options.campaignLane, 5).toUpperCase();
  if (requestedLane && CAMPAIGN_LANES[requestedLane]) return scoreCampaignLaneCandidate(prospect, requestedLane, options);
  const scores = Object.keys(CAMPAIGN_LANES).map((lane) => scoreCampaignLaneCandidate(prospect, lane, options));
  return scores.sort((a, b) => Number(b.sendEligible) - Number(a.sendEligible) || b.totalScore - a.totalScore || b.laneFitScore - a.laneFitScore)[0];
};

export const validateEmailTemplateForCampaignLane = ({
  emailTemplateKey,
  campaignLane,
  prospectType,
  segmentEvidence = [],
  operatorEventCount = 0,
  recipientType = '',
} = {}) => {
  const template = EMAIL_TEMPLATE_REGISTRY[emailTemplateKey];
  const errors = [];
  if (!template) return [`Unknown email template key: ${emailTemplateKey || 'blank'}.`];
  const lane = clean(campaignLane, 5).toUpperCase();
  if (!template.allowedLanes.includes(lane)) errors.push(`${emailTemplateKey} is only allowed for lane(s): ${template.allowedLanes.join(', ')}.`);
  if (!template.allowedProspectTypes.includes(clean(prospectType, 120))) errors.push(`${emailTemplateKey} is not allowed for prospect_type=${prospectType || 'blank'}.`);
  if (template.requiresOperatorEvidence) {
    if (Number(operatorEventCount) < template.minOperatorEventCount) errors.push(`${emailTemplateKey} requires operator_event_count >= ${template.minOperatorEventCount}.`);
    if (asArray(segmentEvidence).length < template.minSegmentEvidenceCount) errors.push(`${emailTemplateKey} requires at least ${template.minSegmentEvidenceCount} operator evidence items.`);
    if (template.requiresCompanyRecipient && !hasAny(lowerText(recipientType), ['company', 'org', 'organization', 'routing', 'operator'])) {
      errors.push(`${emailTemplateKey} requires a company/org/routing recipient type.`);
    }
  }
  return errors;
};
