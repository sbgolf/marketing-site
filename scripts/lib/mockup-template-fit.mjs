const cleanText = (value, max = 12000) => {
  if (Array.isArray(value)) return value.map((item) => cleanText(item, max)).join(' ');
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return cleanText(Object.values(value), max);
  return String(value).trim().replace(/\s+/g, ' ').slice(0, max);
};

const lowerText = (value) => cleanText(value).toLowerCase();
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const KEYWORDS = {
  community: [
    'community',
    'family',
    'families',
    'fun run',
    'kids',
    'school',
    'church',
    'rotary',
    'festival',
    'turkey trot',
    'jingle',
    'walk',
    'hometown',
  ],
  performance: [
    'boston qualifier',
    'bq',
    'certified',
    'usatf',
    'fast course',
    'pr course',
    'personal record',
    'elite',
    'pacers',
    'marathon',
    'half marathon',
    '10k',
  ],
  destination: [
    'destination',
    'scenic',
    'resort',
    'vacation',
    'travel',
    'beach',
    'island',
    'mountain',
    'downtown',
    'historic',
    'weekend',
  ],
  trail_adventure: [
    'trail',
    'ultra',
    'ultramarathon',
    '50k',
    '100k',
    'mountain',
    'gravel',
    'adventure',
    'technical',
    'ruck',
    'endurance',
  ],
  charity_cause: [
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
    'sponsor',
  ],
  operator_portfolio: [
    'timing company',
    'race management',
    'event management',
    'portfolio',
    'events calendar',
    'multiple events',
    'operator',
    'timer',
  ],
};

const emailTypes = new Set(['email', 'direct_email', 'public_race_contact', 'public_org_routing_contact']);

const keywordHitCount = (text, keywords) => keywords.reduce((count, keyword) => {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const isSimple = /^[a-z0-9][a-z0-9\s-]*[a-z0-9]$/.test(keyword);
  const regex = isSimple ? new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i') : null;
  return count + (regex ? regex.test(text) : text.includes(keyword) ? 1 : 0);
}, 0);

const hasRunSignupUrl = (value) => {
  try {
    return /(^|\.)runsignup\.com$/i.test(new URL(cleanText(value, 2000)).hostname);
  } catch {
    return false;
  }
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const eventDaysUntil = (value, now = new Date()) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((target - start) / 86400000);
};

export const summarizeContactViability = (candidate = {}) => {
  const contactSources = toArray(candidate.contactSources || candidate.contact_sources);
  const directEmails = contactSources.filter((source) => {
    const type = lowerText(source.type || source.kind || source.label);
    return emailTypes.has(type) || type.includes('email') || lowerText(source.email || source.value).includes('@');
  });
  const namedEmails = directEmails.filter((source) => /director|race director|coordinator|manager|president|operations/i.test(cleanText(source.role || source.label || source.context || source.name)));
  const routingEmails = directEmails.filter((source) => /info@|hello@|events@|support@|contact@|admin@/i.test(cleanText(source.email || source.value)));
  const forms = contactSources.filter((source) => lowerText(source.type || source.kind || source.label).includes('form') || lowerText(source.url).includes('/contact'));

  let quality = 'none';
  let score = 0;
  const reasons = [];
  if (namedEmails.length) {
    quality = 'named_email';
    score = 30;
    reasons.push('Named/direct race contact email is source-backed.');
  } else if (directEmails.length) {
    quality = routingEmails.length ? 'routing_email' : 'direct_email';
    score = routingEmails.length ? 24 : 27;
    reasons.push('Direct or routing email is source-backed.');
  } else if (forms.length) {
    quality = 'form_only';
    score = 10;
    reasons.push('Only a contact form is currently available.');
  }

  return {
    contactQuality: quality,
    contactScore: score,
    hasVerifiedEmail: ['named_email', 'direct_email', 'routing_email'].includes(quality),
    hasContactPath: quality !== 'none',
    reasons,
  };
};

export const classifyTemplateFits = (candidate = {}, options = {}) => {
  const metadata = candidate.metadata || {};
  const extractedFacts = candidate.extractedFacts || candidate.extracted_facts || {};
  const sourceCoverage = candidate.sourceCoverage || candidate.source_coverage || {};
  const text = lowerText([
    candidate.raceName,
    candidate.race_name,
    candidate.description,
    candidate.summary,
    candidate.sourceText,
    candidate.source_text,
    candidate.organizationName,
    candidate.organization_name,
    candidate.region,
    candidate.raceCity,
    candidate.race_city,
    candidate.raceState,
    candidate.race_state,
    candidate.officialUrl,
    candidate.official_url,
    toArray(candidate.distances || extractedFacts.distances),
    extractedFacts.description,
    metadata.segment_evidence,
  ]);
  const distances = toArray(candidate.distances || extractedFacts.distances).map(lowerText);
  const contact = summarizeContactViability(candidate);
  const officialUrl = candidate.officialUrl || candidate.official_url;
  const registrationUrl = candidate.registrationUrl || candidate.registration_url || candidate.sourceUrl || candidate.source_url;
  const days = eventDaysUntil(candidate.eventDate || candidate.event_date, options.now ? new Date(options.now) : new Date());

  const hits = Object.fromEntries(Object.entries(KEYWORDS).map(([key, words]) => [key, keywordHitCount(text, words)]));
  const hasMultiDistance = distances.length > 1 || /\b(5k|10k|half|marathon|kids|fun run|walk)\b.*\b(5k|10k|half|marathon|kids|fun run|walk)\b/i.test(text);
  const sourceRichness = [
    candidate.eventDate || candidate.event_date || sourceCoverage.date,
    candidate.raceCity || candidate.race_city || candidate.city || sourceCoverage.location,
    distances.length || sourceCoverage.distances,
    registrationUrl || sourceCoverage.registration,
    sourceCoverage.schedule || sourceCoverage.logistics || /packet pickup|schedule|parking|race day/i.test(text),
    officialUrl || sourceCoverage.official_url,
    sourceCoverage.sponsors || sourceCoverage.cause || hits.charity_cause > 0,
  ].filter(Boolean).length;

  const runSignupFirst = hasRunSignupUrl(registrationUrl) && (!officialUrl || hasRunSignupUrl(officialUrl));
  const officialPlusRegistration = Boolean(officialUrl && hasRunSignupUrl(registrationUrl) && !hasRunSignupUrl(officialUrl));
  const runwayScore = typeof days === 'number' && days >= 90 && days <= 300 ? 10 : typeof days === 'number' && days >= 45 && days <= 365 ? 6 : 0;

  const templateFitScores = {
    community: clamp(hits.community * 8 + hits.charity_cause * 4 + (hasMultiDistance ? 12 : 0) + (runSignupFirst ? 8 : 0) + sourceRichness * 3),
    charity_cause: clamp(hits.charity_cause * 10 + hits.community * 3 + sourceRichness * 3),
    performance: clamp(hits.performance * 9 + (distances.some((distance) => /half|marathon|10k/.test(distance)) ? 12 : 0) + sourceRichness * 2),
    destination: clamp(hits.destination * 9 + (officialPlusRegistration ? 6 : 0) + sourceRichness * 2),
    trail_adventure: clamp(hits.trail_adventure * 12 + sourceRichness * 2),
    operator_portfolio: clamp(hits.operator_portfolio * 15 + Number(metadata.operator_event_count || 0) * 5),
  };

  const rankedTemplates = Object.entries(templateFitScores).sort((a, b) => b[1] - a[1]);
  const [primaryTemplateFit, primaryTemplateScore] = rankedTemplates[0] || ['unknown', 0];
  const secondaryTemplateFits = rankedTemplates.slice(1).filter(([, score]) => score >= 25).map(([template]) => template);
  const sourceScore = Math.min(25, sourceRichness * 4);
  const opportunityScore = Math.min(20, (runSignupFirst ? 10 : 0) + (officialPlusRegistration ? 6 : 0) + (sourceRichness >= 5 ? 5 : 0));
  const startlineValueScore = clamp(Math.round(primaryTemplateScore * 0.35 + contact.contactScore + sourceScore + opportunityScore + runwayScore));

  let templateReadinessStatus = 'not_current_priority';
  if (startlineValueScore >= 80 && contact.hasVerifiedEmail && sourceRichness >= 5) {
    templateReadinessStatus = 'ready_to_generate';
  } else if (startlineValueScore >= 65 && contact.hasVerifiedEmail) {
    templateReadinessStatus = 'needs_source_review';
  } else if (startlineValueScore >= 55 && contact.hasContactPath) {
    templateReadinessStatus = 'needs_contact_research';
  }

  const recommendedLane = primaryTemplateFit === 'operator_portfolio'
    ? 'D_operator'
    : primaryTemplateFit === 'performance'
      ? 'performance_candidate'
      : primaryTemplateFit === 'destination'
        ? 'destination_candidate'
        : primaryTemplateFit === 'trail_adventure'
          ? 'trail_adventure_candidate'
          : hits.charity_cause >= 2
            ? 'B_cause_sponsor'
            : 'A_single_race_community';

  return {
    primaryTemplateFit,
    secondaryTemplateFits,
    templateFitScores,
    recommendedLane,
    templateReadinessStatus,
    startlineValueScore,
    sourceRichnessScore: sourceScore,
    opportunityScore,
    runwayScore,
    contactQuality: contact.contactQuality,
    contactScore: contact.contactScore,
    hasVerifiedEmail: contact.hasVerifiedEmail,
    reasons: [
      ...contact.reasons,
      ...(sourceRichness >= 5 ? ['Source-rich enough for a stronger mockup.'] : ['Source data needs review before generation.']),
      ...(runwayScore >= 10 ? ['Event has ideal 3–10 month outreach runway.'] : []),
      ...(runSignupFirst ? ['RunSignup-first presence suggests StartLine opportunity.'] : []),
      ...(officialPlusRegistration ? ['Official site plus RunSignup registration path found.'] : []),
    ],
  };
};
