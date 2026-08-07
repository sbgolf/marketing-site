import {
  appendComplianceFooterText,
  assertCustomerEmailCompliance,
} from '../../netlify/functions/lib/branded-email.mjs';

const clean = (value, max = 1000) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const cleanMultiline = (value, max = 4000) => String(value ?? '')
  .replace(/\r\n/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim()
  .slice(0, max);

const metadataOf = (row = {}) => row.metadata && typeof row.metadata === 'object' ? row.metadata : {};

const readablePackage = (value) => clean(value || 'Standard', 80);

const packageLine = ({ recommendedPackage, packageReason }) => {
  const tier = readablePackage(recommendedPackage);
  const reason = clean(packageReason, 280);
  if (!reason) return `If you want to move forward, I would likely point you toward the ${tier} package as the practical starting point.`;
  return `If you want to move forward, I would likely point you toward the ${tier} package because ${reason}.`;
};

const contextLine = (raceContext) => {
  const context = clean(raceContext, 320);
  if (!context) return 'The goal is to make the runner path clearer before someone decides whether to register.';
  return `The main opportunity I noticed is ${context}.`;
};

const greeting = (contactName) => {
  const name = clean(contactName, 80);
  return name ? `Hi ${name},` : 'Hi there,';
};

const signoff = 'Thanks,\nSteve, CEO & Founder\nStartLineSites.com';

export const FOLLOW_UP_SCENARIOS = Object.freeze({
  clicked: {
    id: 'clicked',
    label: 'Clicked or high-interest follow-up',
    recommendedSubject: (raceName) => `Quick next step for ${raceName}`,
    alternates: (raceName) => [
      `One suggested direction for ${raceName}`,
      `A website path for ${raceName}`,
    ],
  },
  opened: {
    id: 'opened',
    label: 'Opened or light-interest follow-up',
    recommendedSubject: (raceName) => `One website idea for ${raceName}`,
    alternates: (raceName) => [
      `A clearer website path for ${raceName}`,
      `Private preview for ${raceName}`,
    ],
  },
  delivered: {
    id: 'delivered',
    label: 'Delivered with no visible engagement follow-up',
    recommendedSubject: (raceName) => `Should I close the loop on ${raceName}?`,
    alternates: (raceName) => [
      `Last note on the ${raceName} preview`,
      'Worth keeping this open?',
    ],
  },
  final_close: {
    id: 'final_close',
    label: 'Final no-pressure close',
    recommendedSubject: () => 'I’ll close the loop for now',
    alternates: (raceName) => [
      'No problem if now is not the right time',
      `Closing the loop on ${raceName}`,
    ],
  },
  suppressed: {
    id: 'suppressed',
    label: 'Suppression or negative deliverability signal',
    recommendedSubject: () => 'No customer email',
    alternates: () => [],
  },
});

const normalizeScenario = (scenario) => {
  const key = clean(scenario || 'delivered', 80).toLowerCase().replace(/[\s-]+/g, '_');
  if (key === 'click' || key === 'clicked' || key === 'high_interest') return 'clicked';
  if (key === 'open' || key === 'opened' || key === 'light_interest') return 'opened';
  if (key === 'no_engagement' || key === 'delivered' || key === 'no_reply') return 'delivered';
  if (key === 'final' || key === 'final_close' || key === 'close') return 'final_close';
  if (key === 'bounced' || key === 'complained' || key === 'unsubscribed' || key === 'suppressed') return 'suppressed';
  return FOLLOW_UP_SCENARIOS[key] ? key : 'delivered';
};

const subjectFor = (scenario, raceName) => {
  const template = FOLLOW_UP_SCENARIOS[scenario] || FOLLOW_UP_SCENARIOS.delivered;
  return {
    recommended: template.recommendedSubject(raceName),
    alternates: template.alternates(raceName),
  };
};

const bodyFor = ({ scenario, raceName, contactName, mockupUrl, recommendedPackage, raceContext, packageReason }) => {
  const safeRace = clean(raceName || 'your race', 120) || 'your race';
  const url = clean(mockupUrl, 500);
  const intro = greeting(contactName);
  const previewSentence = url
    ? `Here is the private preview again: ${url}`
    : 'I can resend the private preview link if helpful.';

  if (scenario === 'suppressed') {
    return cleanMultiline(`Internal action only.

Do not send a follow-up for ${safeRace}. This row has a suppression, bounce, complaint, unsubscribe, or other negative deliverability signal. Ask Steve to verify a replacement contact before any future customer outreach.`);
  }

  if (scenario === 'clicked') {
    return appendComplianceFooterText(cleanMultiline(`${intro}

I wanted to follow up on the private StartLine preview for ${safeRace}. ${contextLine(raceContext)}

${previewSentence}

${packageLine({ recommendedPackage, packageReason })}

Would you like me to send over the recommended next step, or would you rather reply with anything you would want changed first?

${signoff}`));
  }

  if (scenario === 'opened') {
    return appendComplianceFooterText(cleanMultiline(`${intro}

I wanted to resend the private StartLine preview for ${safeRace} in case it is useful as you think about the next race cycle. The idea is simple: give runners a clearer path from interest to registration, especially on mobile.

${previewSentence}

${contextLine(raceContext)}

If it would help, I can send a short recommendation for what I would change first.

${signoff}`));
  }

  if (scenario === 'final_close') {
    return appendComplianceFooterText(cleanMultiline(`${intro}

I will close the loop for now on the private StartLine preview for ${safeRace}.

${previewSentence}

If the website becomes a priority later, you can reply here and I will be happy to take another look.

${signoff}`));
  }

  return appendComplianceFooterText(cleanMultiline(`${intro}

Just closing the loop on the private StartLine preview for ${safeRace}.

${previewSentence}

If improving the race website is not a priority right now, no problem at all. If it is worth keeping open, I can send over the practical next step I would recommend.

Should I keep this open, or is now not the right time?

${signoff}`));
};

export const buildOutreachFollowUpDraft = (input = {}) => {
  const raceName = clean(input.raceName || input.race_name || 'your race', 120) || 'your race';
  const scenario = normalizeScenario(input.scenario || input.engagementStatus || input.engagement_status);
  const draft = {
    scenario,
    scenario_label: FOLLOW_UP_SCENARIOS[scenario].label,
    sendable: scenario !== 'suppressed',
    race_name: raceName,
    subject: subjectFor(scenario, raceName),
    body: bodyFor({
      scenario,
      raceName,
      contactName: input.contactName || input.contact_name,
      mockupUrl: input.mockupUrl || input.mockup_url,
      recommendedPackage: input.recommendedPackage || input.recommended_package,
      raceContext: input.raceContext || input.race_context,
      packageReason: input.packageReason || input.package_reason,
    }),
  };
  draft.validation = validateOutreachFollowUpDraft(draft);
  return draft;
};

export const buildOutreachFollowUpDraftFromRow = (row = {}, overrides = {}) => {
  const metadata = metadataOf(row);
  return buildOutreachFollowUpDraft({
    raceName: overrides.raceName || row.race_name || metadata.race_name,
    contactName: overrides.contactName || row.contact_name || metadata.contact_name || metadata.recommended_contact_name,
    mockupUrl: overrides.mockupUrl || row.mockup_url || metadata.mockup_url,
    scenario: overrides.scenario || row.engagement_status || row.outreach_status,
    recommendedPackage: overrides.recommendedPackage || row.recommended_package || metadata.recommended_package || metadata.package_recommendation,
    raceContext: overrides.raceContext || row.race_context || metadata.race_context || metadata.follow_up_context,
    packageReason: overrides.packageReason || row.package_reason || metadata.package_reason || metadata.recommended_package_reason,
  });
};

const rejectedBodyPatterns = [
  { label: 'tracking or surveillance language', pattern: /\b(opened|clicked|tracking|tracked|I saw you|we saw you|you opened|you clicked)\b/i },
  { label: 'rejected early-partner or beta framing', pattern: /early partner|newly formed|new company|beta/i },
  { label: 'unapproved visible email address', pattern: /\b(?!support@startlinesites\.com\b)[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
];

export const validateOutreachFollowUpDraft = (draft = {}) => {
  const issues = [];
  const body = String(draft.body ?? '');
  const subject = draft.subject && typeof draft.subject === 'object' ? draft.subject : {};

  if (draft.sendable !== false && !clean(subject.recommended, 160)) issues.push('Missing recommended subject.');
  if (!body.trim()) issues.push('Missing body.');
  if (body.includes('—')) issues.push('Customer-facing body contains an em dash.');
  for (const { label, pattern } of rejectedBodyPatterns) {
    if (pattern.test(body)) issues.push(`Customer-facing body contains ${label}.`);
  }
  if (draft.sendable !== false) {
    const complianceErrors = assertCustomerEmailCompliance({ text: body });
    for (const issue of complianceErrors.filter((item) => !/HTML/.test(item))) issues.push(issue);
  }
  if (draft.sendable !== false && !/Thanks,\s*\nSteve, CEO & Founder\s*\nStartLineSites\.com/.test(body)) {
    issues.push('Customer-facing body is missing the approved StartLine signature.');
  }
  return { ok: issues.length === 0, issues };
};

export const formatOutreachFollowUpDraftForOwner = (draft = {}) => {
  const alternates = Array.isArray(draft.subject?.alternates) ? draft.subject.alternates : [];
  const validation = draft.validation || validateOutreachFollowUpDraft(draft);
  return [
    `Scenario: ${draft.scenario_label || draft.scenario || 'follow-up draft'}`,
    `Sendable: ${draft.sendable === false ? 'no' : 'yes, after Steve approval'}`,
    '',
    'Recommended subject:',
    draft.subject?.recommended || 'No customer email',
    '',
    'Alternate subjects:',
    ...(alternates.length ? alternates.map((item, index) => `${index + 1}. ${item}`) : ['- None']),
    '',
    'Recommended body:',
    draft.body || '',
    '',
    'Validation:',
    ...(validation.ok ? ['- Passed customer-facing guardrails.'] : validation.issues.map((issue) => `- ${issue}`)),
  ].join('\n');
};
