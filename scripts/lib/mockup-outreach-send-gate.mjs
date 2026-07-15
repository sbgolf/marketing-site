import {
  CLIENT_SIGNATURE_TEXT,
  escapeHtml,
  renderBrandedEmail,
  renderEmailButton,
  renderInfoCard,
  renderSignatureHtml,
} from '../../netlify/functions/lib/branded-email.mjs';
import { clean, parseEmailList, validateMockupOutreachInput } from './mockup-outreach-log.mjs';

const REJECTED_CUSTOMER_COPY = [/no-index/i, /\bBailey\b/i];

export const DEFAULT_MOCKUP_OUTREACH_FROM = 'Steve <steve@startlinesites.com>';
export const DEFAULT_MOCKUP_OUTREACH_REPLY_TO = 'support@startlinesites.com';

export const buildDefaultMockupOutreachDetail = (raceName) => {
  const safeRaceName = clean(raceName, 160) || 'your race';
  return `I came across ${safeRaceName} and put together a private StartLine Sites preview showing how the race could look as a dedicated, mobile-friendly website. The goal is not to replace RunSignup — it is to make the race easier for runners to understand, trust, and click through to register, with key race-day details, official registration links, community context, and runner questions organized in one clean place. For a limited time, StartLine Sites is offering 50% off all current website packages for qualified races. This promotional rate is available for a limited number of race websites this season so each build gets the focused launch attention it deserves.`;
};

export const validateMockupOutreachSend = (input = {}) => {
  const errors = validateMockupOutreachInput(input);
  const subject = clean(input.subject, 300);
  const bodyDetail = clean(input.detail, 3000);

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
}) => {
  const safeRaceName = clean(raceName, 160) || 'your race';
  const safeContactName = clean(contactName, 120) || 'there';
  const safeMockupUrl = clean(mockupUrl, 1000);
  const safeSubject = clean(subject, 300) || `A private website mockup for ${safeRaceName}`;
  const safeDetail = clean(detail, 3000) || buildDefaultMockupOutreachDetail(safeRaceName);

  const text = [
    `Hi ${safeContactName},`,
    '',
    safeDetail,
    '',
    `Review the private mockup: ${safeMockupUrl}`,
    '',
    'If this is helpful, reply here and I can share what a practical next step would look like. If someone else owns the race website, feel free to forward this along.',
    '',
    CLIENT_SIGNATURE_TEXT,
  ].join('\n');

  const html = renderBrandedEmail({
    eyebrow: 'Private race website preview',
    preheader: `A private StartLine Sites mockup for ${safeRaceName}.`,
    heading: safeSubject,
    body: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(safeContactName)},</p>
      <p style="margin:0 0 18px;">${escapeHtml(safeDetail)}</p>
      ${renderInfoCard({
        title: 'Private preview',
        children: `<p style="margin:0;color:#DDE7F3;">The mockup is a private preview for review, not a public replacement for your current registration flow.</p>`,
      })}
      ${renderEmailButton({ href: safeMockupUrl, label: 'Review the private mockup' })}
      <p style="margin:18px 0 0;">If this is helpful, reply here and I can share what a practical next step would look like. If someone else owns the race website, feel free to forward this along.</p>
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
}) => {
  if (!apiKey) throw new Error('RESEND_API_KEY or STARTLINE_RESEND_API_KEY is required.');
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
    },
  };
};
