export const clean = (value, max = 500) => {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, max);
};

export const normalizeEmail = (value) => clean(value, 254).toLowerCase();

export const parseEmailList = (value) => {
  if (Array.isArray(value)) return value.map(normalizeEmail).filter(Boolean);
  return clean(value, 4000)
    .split(/[;,]/)
    .map(normalizeEmail)
    .filter(Boolean);
};

export const slugifyRace = (value, fallback = 'race-mockup') => {
  const slug = clean(value, 160)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
    .replace(/-+$/g, '');
  return slug || fallback;
};

export const domainFromUrl = (value) => {
  try {
    const url = new URL(clean(value, 1000));
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
};

export const mockupTokenFromUrl = (value) => {
  try {
    const url = new URL(clean(value, 1000));
    const segments = url.pathname.split('/').filter(Boolean);
    const privateMockupIndex = segments.findIndex((segment, index) => segment === 'mockups' && segments[index - 1] === 'private');
    return privateMockupIndex >= 0 ? clean(segments[privateMockupIndex + 1], 200) : '';
  } catch {
    return '';
  }
};

export const validateMockupOutreachInput = (input) => {
  const errors = [];
  if (!clean(input.raceName)) errors.push('raceName is required.');
  if (!clean(input.mockupUrl)) errors.push('mockupUrl is required.');
  if (!clean(input.mockupTemplate)) errors.push('mockupTemplate is required.');
  if (parseEmailList(input.toEmails).length === 0) errors.push('At least one To email is required.');
  if (clean(input.mockupUrl)) {
    try {
      const url = new URL(clean(input.mockupUrl));
      if (!['http:', 'https:'].includes(url.protocol)) errors.push('mockupUrl must be http(s).');
    } catch {
      errors.push('mockupUrl must be a valid URL.');
    }
  }
  return errors;
};

export const buildMockupOutreachPayload = (input = {}) => {
  const raceName = clean(input.raceName, 160);
  const officialUrl = clean(input.officialUrl, 1000);
  const registrationUrl = clean(input.registrationUrl, 1000);
  const mockupUrl = clean(input.mockupUrl, 1000);
  const sentAt = clean(input.sentAt, 80) || new Date().toISOString();
  const outreachStatus = clean(input.outreachStatus, 80) || 'sent';
  const toEmails = parseEmailList(input.toEmails);
  const ccEmails = parseEmailList(input.ccEmails);
  const bccEmails = parseEmailList(input.bccEmails);

  return {
    race_name: raceName,
    race_slug: clean(input.raceSlug, 120) || slugifyRace(raceName),
    race_city: clean(input.raceCity, 120) || null,
    race_state: clean(input.raceState, 80) || null,
    official_url: officialUrl || null,
    official_domain: clean(input.officialDomain, 255) || domainFromUrl(officialUrl) || null,
    registration_url: registrationUrl || null,
    registration_platform: clean(input.registrationPlatform, 120) || null,
    registration_race_id: clean(input.registrationRaceId, 120) || null,
    mockup_url: mockupUrl,
    mockup_token: clean(input.mockupToken, 220) || mockupTokenFromUrl(mockupUrl) || null,
    mockup_template: clean(input.mockupTemplate, 120),
    mockup_verified_at: clean(input.mockupVerifiedAt, 80) || null,
    outreach_status: outreachStatus,
    sent_at: outreachStatus === 'sent' ? sentAt : clean(input.sentAt, 80) || null,
    subject: clean(input.subject, 300) || null,
    resend_email_id: clean(input.resendEmailId, 200) || null,
    from_email: clean(input.fromEmail, 254) || null,
    reply_to_email: clean(input.replyToEmail, 254) || null,
    to_emails: toEmails,
    cc_emails: ccEmails,
    bcc_emails: bccEmails,
    contact_sources: Array.isArray(input.contactSources) ? input.contactSources : [],
    notes: clean(input.notes, 2000) || null,
    last_contacted_at: outreachStatus === 'sent' ? sentAt : null,
    next_follow_up_at: clean(input.nextFollowUpAt, 80) || null,
    response_status: clean(input.responseStatus, 80) || 'none',
    owner: clean(input.owner, 120) || null,
    metadata: input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : {},
  };
};

const arrayContainsParam = (column, value) => `${column}=cs.%7B${encodeURIComponent(value)}%7D`;

export const buildDuplicateFilters = (payload) => {
  const filters = [`mockup_url=eq.${encodeURIComponent(payload.mockup_url)}`];
  if (payload.registration_platform && payload.registration_race_id) {
    filters.push(`registration_platform=eq.${encodeURIComponent(payload.registration_platform)}&registration_race_id=eq.${encodeURIComponent(payload.registration_race_id)}`);
  }
  if (payload.official_domain) {
    filters.push(`race_slug=eq.${encodeURIComponent(payload.race_slug)}&official_domain=eq.${encodeURIComponent(payload.official_domain)}`);
  }
  for (const email of [...payload.to_emails, ...payload.cc_emails]) {
    filters.push(arrayContainsParam('to_emails', email));
    filters.push(arrayContainsParam('cc_emails', email));
  }
  return filters;
};
