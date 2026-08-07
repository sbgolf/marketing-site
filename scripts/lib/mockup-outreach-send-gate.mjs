import {
  CLIENT_SIGNATURE_TEXT,
  escapeHtml,
  renderBrandedEmail,
  renderEmailButton,
  renderInfoCard,
  renderSignatureHtml,
} from '../../netlify/functions/lib/branded-email.mjs';
import {
  DEFAULT_MOCKUP_OUTREACH_CAMPAIGN_ID,
  DEFAULT_MOCKUP_OUTREACH_SEND_GATE_VERSION,
  clean,
  parseEmailList,
  validateMockupOutreachInput,
} from './mockup-outreach-log.mjs';

const REJECTED_CUSTOMER_COPY = [
  /no-index/i,
  /\bBailey\b/i,
  /early partner/i,
  /early race partner/i,
  /newly formed/i,
  /new company/i,
  /\bbeta\b/i,
];
const PRELIMINARY_MOCKUP_NOTE = 'This is intentionally a preliminary mockup and a starting point to show the direction. If it looks useful, we can fine-tune the copy, sections, sponsor placement, and race-specific details before anything goes live.';
const SELECTED_RACE_WEBSITE_CREDIT_OFFER = 'As part of this private mockup campaign, StartLine is offering a selected-race website credit for a limited number of organizations. If the preview feels useful and you decide to move forward, I can apply 25% off the first website build, up to $750.\n\nThe goal is to make the first build easier to start while still giving the race a polished, production-ready site we can stand behind.';
const OPERATOR_PORTFOLIO_TEMPLATE_KEY = 'operator_portfolio_v1';
const OPERATOR_PORTFOLIO_OFFER = 'As part of this private mockup campaign, StartLine is offering a selected-race website credit for a limited number of organizations. If this portfolio approach looks useful and you decide to start with a small first set of events, I can apply 25% off the first website build, up to $750.\n\nThe goal is to make the first build easier to start while still giving the race a polished, production-ready site we can stand behind.';

export const DEFAULT_MOCKUP_OUTREACH_FROM = 'Steve <steve@startlinesites.com>';
export const DEFAULT_MOCKUP_OUTREACH_REPLY_TO = 'support@startlinesites.com';

const cleanMultilineDetail = (value, max = 3000) => {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim().replace(/[^\S\n]+/g, ' '))
    .filter(Boolean)
    .join('\n\n')
    .slice(0, max);
};

const splitDetailParagraphs = (detail) => detail
  .split(/\n{2,}/)
  .map((paragraph) => paragraph.trim())
  .filter(Boolean);

const renderDetailParagraphs = (detail) => splitDetailParagraphs(detail)
  .map((paragraph) => `<p style="margin:0 0 18px;">${escapeHtml(paragraph)}</p>`)
  .join('\n      ');

const ensureSelectedRaceOffer = (detail, offer = SELECTED_RACE_WEBSITE_CREDIT_OFFER) => (/25% off the first website build|selected-race website credit/i.test(detail)
  ? detail
  : [detail, offer].filter(Boolean).join('\n\n'));

export const buildDefaultMockupOutreachDetail = (raceName) => {
  const safeRaceName = clean(raceName, 160) || 'your race';
  return [
    `I came across ${safeRaceName} and put together a private StartLine Sites preview showing how the race could look as a dedicated, mobile-friendly website.`,
    'The goal is not to replace RunSignup. It is to make the race easier for runners to understand, trust, and click through to register, with key race-day details, official registration links, community context, and runner questions organized in one clean place.',
    SELECTED_RACE_WEBSITE_CREDIT_OFFER,
  ].join('\n\n');
};

export const buildOperatorPortfolioSubject = ({ companyName, raceName } = {}) => {
  const safeCompanyName = clean(companyName, 160);
  const safeRaceName = clean(raceName, 160);
  if (safeCompanyName) return `A private website system idea for ${safeCompanyName}`;
  if (safeRaceName) return `A private website system idea using ${safeRaceName} as an example`;
  return 'A private website system idea for your event portfolio';
};

export const buildOperatorPortfolioOutreachDetail = ({ companyName, raceName } = {}) => {
  const safeCompanyName = clean(companyName, 160) || 'your team';
  const safeRaceName = clean(raceName, 160) || 'one of your events';
  return [
    `I came across ${safeCompanyName} and noticed the opportunity to give multiple events a clearer runner-facing web front door.`,
    `I put together a private StartLine Sites example using ${safeRaceName} to show what that could look like in practice.`,
    'StartLine Sites is not meant to replace RunSignup, Race Roster, timing systems, or the registration tools your events already use. It complements them with fast, polished landing pages that help runners understand each race, trust the details, and click through to register.',
    'For an operator or event company, the opportunity is bigger than one race page. Each event can get a consistent, search-friendly landing page while your company gets a clearer portfolio system that is easier to promote, sponsor, and reuse year after year.',
    OPERATOR_PORTFOLIO_OFFER,
  ].join('\n\n');
};

export const validateMockupOutreachSend = (input = {}) => {
  const errors = validateMockupOutreachInput(input);
  const subject = clean(input.subject, 300);
  const bodyDetail = cleanMultilineDetail(input.detail);

  if (!subject) errors.push('subject is required.');

  const customerCopy = [subject, bodyDetail].join('\n');
  for (const pattern of REJECTED_CUSTOMER_COPY) {
    if (pattern.test(customerCopy)) errors.push(`Customer-facing copy contains rejected wording: ${pattern}`);
  }

  return errors;
};

export const renderPrivateMockupOutreachEmail = ({
  raceName,
  contactName = 'there',
  mockupUrl,
  subject,
  detail,
  emailTemplateKey,
  companyName,
}) => {
  const safeRaceName = clean(raceName, 160) || 'your race';
  const safeContactName = clean(contactName, 120) || 'there';
  const safeMockupUrl = clean(mockupUrl, 1000);
  const safeCompanyName = clean(companyName, 160);
  const isOperatorPortfolio = clean(emailTemplateKey, 120) === OPERATOR_PORTFOLIO_TEMPLATE_KEY;
  const defaultSubject = isOperatorPortfolio
    ? buildOperatorPortfolioSubject({ companyName: safeCompanyName, raceName: safeRaceName })
    : `A free private website mockup for ${safeRaceName}`;
  const defaultDetail = isOperatorPortfolio
    ? buildOperatorPortfolioOutreachDetail({ companyName: safeCompanyName, raceName: safeRaceName })
    : buildDefaultMockupOutreachDetail(safeRaceName);
  const safeSubject = clean(subject, 300) || defaultSubject;
  const safeDetail = ensureSelectedRaceOffer(cleanMultilineDetail(detail) || defaultDetail, isOperatorPortfolio ? OPERATOR_PORTFOLIO_OFFER : SELECTED_RACE_WEBSITE_CREDIT_OFFER);
  const nextStepCopy = isOperatorPortfolio
    ? 'If this is helpful, reply here and I can share how the same structure could scale across a small first set of your events. If someone else owns the event portfolio or website system, feel free to forward this along.'
    : 'If this is helpful, reply here and I can share what a practical next step would look like. If someone else owns the race website, feel free to forward this along.';

  const text = [
    `Hi ${safeContactName},`,
    '',
    safeDetail,
    '',
    PRELIMINARY_MOCKUP_NOTE,
    '',
    `Review the private mockup: ${safeMockupUrl}`,
    '',
    nextStepCopy,
    '',
    CLIENT_SIGNATURE_TEXT,
  ].join('\n');

  const html = renderBrandedEmail({
    eyebrow: 'Private race website preview',
    preheader: isOperatorPortfolio && safeCompanyName
      ? `A private StartLine Sites portfolio idea for ${safeCompanyName}.`
      : `A private StartLine Sites mockup for ${safeRaceName}.`,
    heading: safeSubject,
    body: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(safeContactName)},</p>
      ${renderDetailParagraphs(safeDetail)}
      ${renderInfoCard({
        title: 'Private preliminary mockup',
        children: `<p style="margin:0;color:#DDE7F3;">${escapeHtml(PRELIMINARY_MOCKUP_NOTE)} The preview is for review only, not a public replacement for your current registration flow.</p>`,
      })}
      ${renderEmailButton({ href: safeMockupUrl, label: 'Review the private mockup' })}
      <p style="margin:18px 0 0;">${escapeHtml(nextStepCopy)}</p>
      ${renderSignatureHtml()}
    `,
  });

  return { subject: safeSubject, text, html };
};
export const assertBrandedMockupOutreachHtml = ({ html, mockupUrl }) => {
  const errors = [];
  if (!/email-card/.test(html)) errors.push('branded email-card shell missing.');
  if (!/email-button-link/.test(html)) errors.push('branded CTA button missing.');
  if (!/<meta name="color-scheme" content="light dark">/.test(html)) errors.push('light/dark color-scheme metadata missing.');
  if (!/Steve, CEO &amp; Founder/.test(html)) errors.push('approved StartLine signature missing.');
  if (mockupUrl && !html.includes(escapeHtml(mockupUrl))) errors.push('mockup URL missing from HTML.');
  for (const pattern of REJECTED_CUSTOMER_COPY) {
    if (pattern.test(html)) errors.push(`HTML contains rejected wording: ${pattern}`);
  }
  return errors;
};

const RESEND_TAG_NAME_RE = /[^A-Za-z0-9_-]+/g;
const RESEND_TAG_VALUE_RE = /[^A-Za-z0-9_./:@+-]+/g;

const sanitizeResendTagName = (value) => clean(value, 256)
  .replace(RESEND_TAG_NAME_RE, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 256);

const sanitizeResendTagValue = (value) => clean(value, 256)
  .replace(RESEND_TAG_VALUE_RE, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 256);

export const buildResendMockupOutreachTags = ({
  campaignId = DEFAULT_MOCKUP_OUTREACH_CAMPAIGN_ID,
  campaignLane,
  campaignWave,
  sendGateVersion = DEFAULT_MOCKUP_OUTREACH_SEND_GATE_VERSION,
  mockupTemplate,
  generationJobId,
  prospectId,
} = {}) => {
  const tagEntries = [
    ['campaign_id', campaignId || DEFAULT_MOCKUP_OUTREACH_CAMPAIGN_ID],
    ['send_gate_version', sendGateVersion || DEFAULT_MOCKUP_OUTREACH_SEND_GATE_VERSION],
    ['mockup_template', mockupTemplate],
    ['campaign_lane', campaignLane],
    ['campaign_wave', campaignWave],
    ['generation_job_id', generationJobId],
    ['prospect_id', prospectId],
  ];

  return tagEntries
    .map(([name, value]) => ({ name: sanitizeResendTagName(name), value: sanitizeResendTagValue(value) }))
    .filter((tag) => tag.name && tag.value);
};

export const assertResendTrackingTags = (tags = []) => {
  const tagMap = new Map((Array.isArray(tags) ? tags : []).map((tag) => [tag.name, tag.value]));
  const errors = [];
  if (!tagMap.get('campaign_id')) errors.push('Resend campaign_id tag missing.');
  if (!tagMap.get('send_gate_version')) errors.push('Resend send_gate_version tag missing.');
  return errors;
};

export const buildResendMockupOutreachPayload = ({
  apiKey,
  from = DEFAULT_MOCKUP_OUTREACH_FROM,
  replyTo = DEFAULT_MOCKUP_OUTREACH_REPLY_TO,
  to,
  cc,
  bcc,
  subject,
  text,
  html,
  campaignId,
  campaignLane,
  campaignWave,
  sendGateVersion,
  mockupTemplate,
  generationJobId,
  prospectId,
}) => {
  if (!apiKey) throw new Error('RESEND_API_KEY or STARTLINE_RESEND_API_KEY is required.');
  const tags = buildResendMockupOutreachTags({
    campaignId,
    campaignLane,
    campaignWave,
    sendGateVersion,
    mockupTemplate,
    generationJobId,
    prospectId,
  });
  const tagErrors = assertResendTrackingTags(tags);
  if (tagErrors.length) throw new Error(`Resend tracking tag validation failed: ${tagErrors.join(' ')}`);

  return {
    endpoint: 'https://api.resend.com/emails',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'user-agent': 'StartLineSites/1.0 (mockup-outreach-send-gate)',
    },
    body: {
      from: clean(from, 254) || DEFAULT_MOCKUP_OUTREACH_FROM,
      reply_to: [clean(replyTo, 254) || DEFAULT_MOCKUP_OUTREACH_REPLY_TO],
      to: parseEmailList(to),
      cc: parseEmailList(cc),
      bcc: parseEmailList(bcc),
      subject: clean(subject, 300),
      text,
      html,
      tags,
    },
  };
};
