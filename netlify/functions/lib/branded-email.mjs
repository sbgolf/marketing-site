export const BRAND = {
  bg: '#050A14',
  ink: '#0E1729',
  ink2: '#111D31',
  ink3: '#18263D',
  text: '#F6F8FB',
  muted: '#DDE7F3',
  soft: '#93A4BB',
  cta: '#FF4D3D',
  accentDeep: '#D43B2D',
  coral: '#FF8A7A',
};

export const CLIENT_SIGNATURE_TEXT = [
  'Thanks,',
  'Steve, CEO & Founder',
  'StartLineSites.com',
].join('\n');

export const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export const renderSignatureHtml = () => '<p style="margin:24px 0 0;color:#F6F8FB;font-weight:800;">Thanks,<br>Steve, CEO &amp; Founder<br><a href="https://startlinesites.com/" style="color:#FF8A7A;text-decoration:underline;">StartLineSites.com</a></p>';

export const renderEmailButton = ({ href, label, variant = 'primary' }) => {
  const isPrimary = variant === 'primary';
  const background = isPrimary ? BRAND.cta : BRAND.ink3;
  const border = isPrimary ? BRAND.cta : 'rgba(255,138,122,.32)';
  const shadow = isPrimary ? 'box-shadow:0 0 28px rgba(255,77,61,.34);' : 'box-shadow:none;';
  const variantClass = isPrimary ? 'email-button-primary' : 'email-button-secondary';
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:14px 10px 14px 0;display:inline-table;">
      <tr>
        <td class="email-button ${variantClass}" bgcolor="${background}" style="border-radius:999px;background:${background};border:1px solid ${border};${shadow}mso-padding-alt:14px 20px;">
          <a href="${escapeHtml(href)}" class="email-button-link" style="display:inline-block;padding:14px 20px;color:#ffffff !important;font-size:15px;line-height:1.1;font-weight:900;text-decoration:none !important;border-radius:999px;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
};

export const renderInfoCard = ({ title, children }) => `
    <div class="email-info-card" style="border:1px solid rgba(255,138,122,.24);border-radius:18px;background:#111D31;padding:18px 20px;margin:20px 0;">
      <strong style="display:block;color:#FF8A7A;font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px;">${escapeHtml(title)}</strong>
      ${children}
    </div>`;

export const renderEmailList = (items = []) => `<ul style="margin:0;padding-left:20px;color:#DDE7F3;">${items.map((item) => `<li style="margin:0 0 8px;">${escapeHtml(item)}</li>`).join('')}</ul>`;

const launchReadinessTemplateDefinitions = {
  depositKickoff: {
    eyebrow: 'Launch Readiness Kit',
    heading: ({ raceName }) => `Next steps for ${raceName}`,
    preheader: ({ raceName }) => `Deposit received for ${raceName}. Confirm what we found and gather launch assets.`,
    primaryLabel: 'Open Launch Readiness Checklist',
    secondaryLabel: 'Review the Asset Hub',
    cardTitle: 'What to do now',
    cardItems: [
      'Confirm the public race facts StartLine found.',
      'Add private details only your team knows.',
      'Share one asset folder and identify any access owners.',
    ],
  },
  launchReadiness: {
    eyebrow: 'Launch Readiness Checklist',
    heading: ({ raceName }) => `Confirm Launch Readiness for ${raceName}`,
    preheader: ({ raceName }) => `Confirm public facts, registration truth, assets, and access owners for ${raceName}.`,
    primaryLabel: 'Open Launch Readiness Checklist',
    secondaryLabel: 'Review access guides',
    cardTitle: 'Checklist focus',
    cardItems: [
      'Confirm race identity, date, location, distances, and official registration link.',
      'Choose “I don’t know yet” for technical access items another owner controls.',
      'Name one final approver before launch review starts.',
    ],
  },
  missingDependency: {
    eyebrow: 'Launch Readiness follow-up',
    heading: ({ raceName }) => `A few launch dependencies need owners for ${raceName}`,
    preheader: ({ raceName }) => `StartLine needs a short owner list before ${raceName} can move cleanly toward launch.`,
    primaryLabel: 'Open access guides',
    secondaryLabel: 'Update Launch Readiness',
    cardTitle: 'What we still need',
    cardItems: [
      'Owner or status for any missing domain, email, analytics, registration, asset, or approval dependency.',
      'Delegated access or a screenshare path where account changes are needed.',
      'No passwords by email — owner names and next steps are enough.',
    ],
  },
  accessRequest: {
    eyebrow: 'Safe access request',
    heading: ({ raceName }) => `Access owner help for ${raceName}`,
    preheader: ({ raceName }) => `StartLine needs safe delegated access or an owner screenshare for ${raceName}.`,
    primaryLabel: 'Open access guides',
    secondaryLabel: 'Open Launch Readiness Checklist',
    cardTitle: 'Safe access options',
    cardItems: [
      'Add StartLine as a temporary user where the platform supports it.',
      'Schedule a screenshare if delegated access is not available.',
      'Keep the race team as the account owner and avoid emailing passwords.',
    ],
  },
  assetRequest: {
    eyebrow: 'Asset readiness request',
    heading: ({ raceName }) => `Assets and permissions for ${raceName}`,
    preheader: ({ raceName }) => `Send the best available assets for ${raceName}; StartLine will sort rough files and gaps.`,
    primaryLabel: 'Open Asset Hub',
    secondaryLabel: 'Update Launch Readiness',
    cardTitle: 'Best / okay / send what you have',
    cardItems: [
      'Share one folder for logos, race-day photos, maps, sponsors, policies, and registration screenshots.',
      'Label anything permission-pending instead of stalling the whole folder.',
      'Name the person who can approve photo, sponsor, or old-site reuse.',
    ],
  },
  stagingReview: {
    eyebrow: 'Staging review',
    heading: ({ raceName }) => `Review the staging site for ${raceName}`,
    preheader: ({ raceName }) => `Check the staging site for race facts, registration clarity, and launch blockers for ${raceName}.`,
    primaryLabel: 'Open staging preview',
    secondaryLabel: 'Review access guides',
    cardTitle: 'Review pass',
    cardItems: [
      'Check date, location, distances, pricing, policies, sponsor order, and registration CTA truth.',
      'Send one consolidated list of committee feedback.',
      'Flag anything that must be fixed before public launch.',
    ],
  },
  launchApproval: {
    eyebrow: 'Launch approval',
    heading: ({ raceName }) => `Final launch approval for ${raceName}`,
    preheader: ({ raceName }) => `Confirm final approval, registration truth, and launch-owner readiness for ${raceName}.`,
    primaryLabel: 'Review final preview',
    secondaryLabel: 'Open Launch Readiness Checklist',
    cardTitle: 'Before launch',
    cardItems: [
      'Confirm the registration CTA, prices, deadlines, and policy copy match the provider.',
      'Confirm DNS/email safety, analytics/search ownership, and final approver are ready.',
      'Reply with approval only when the race team is ready for StartLine to launch.',
    ],
  },
};

export const launchReadinessEmailTemplateNames = Object.freeze(Object.keys(launchReadinessTemplateDefinitions));

export const renderLaunchReadinessCustomerEmail = ({
  template,
  raceName = 'your race',
  customerName = 'there',
  primaryUrl,
  secondaryUrl,
  detail = '',
}) => {
  const definition = launchReadinessTemplateDefinitions[template];
  if (!definition) throw new Error(`Unknown Launch Readiness email template: ${template}`);

  const safeRaceName = raceName || 'your race';
  const subject = definition.heading({ raceName: safeRaceName });
  const detailLine = detail ? `${detail}\n\n` : '';
  const text = [
    `Hi ${customerName || 'there'},`,
    '',
    detailLine ? detailLine.trim() : `This is the next Launch Readiness step for ${safeRaceName}.`,
    '',
    definition.cardTitle + ':',
    ...definition.cardItems.map((item, index) => `${index + 1}. ${item}`),
    '',
    primaryUrl ? `${definition.primaryLabel}: ${primaryUrl}` : null,
    secondaryUrl ? `${definition.secondaryLabel}: ${secondaryUrl}` : null,
    '',
    'Reply here if anything changed or if a different account owner should be included.',
    '',
    CLIENT_SIGNATURE_TEXT,
  ].filter(Boolean).join('\n');

  const html = renderBrandedEmail({
    eyebrow: definition.eyebrow,
    preheader: definition.preheader({ raceName: safeRaceName }),
    heading: subject,
    body: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(customerName || 'there')},</p>
      <p style="margin:0 0 18px;">${detail ? escapeHtml(detail) : `This is the next Launch Readiness step for ${escapeHtml(safeRaceName)}.`}</p>
      ${renderInfoCard({
        title: definition.cardTitle,
        children: renderEmailList(definition.cardItems),
      })}
      ${primaryUrl ? renderEmailButton({ href: primaryUrl, label: definition.primaryLabel }) : ''}
      ${secondaryUrl ? renderEmailButton({ href: secondaryUrl, label: definition.secondaryLabel, variant: 'secondary' }) : ''}
      <p style="margin:18px 0 0;">Reply here if anything changed or if a different account owner should be included.</p>
      ${renderSignatureHtml()}
    `,
  });

  return { subject, text, html };
};

export const renderBrandedEmail = ({ preheader = '', heading, eyebrow = 'StartLine Sites', body }) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(heading || 'StartLine Sites')}</title>
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    a { color: ${BRAND.coral}; }
    .email-button a,
    .email-button-link { color:#ffffff !important;text-decoration:none !important; }
    @media (prefers-color-scheme: dark) {
      body, .email-bg { background: ${BRAND.bg} !important; color: ${BRAND.text} !important; }
      .email-card { background: ${BRAND.ink} !important; border-color: rgba(255,255,255,.12) !important; }
      .email-header, .email-body, .email-footer { background: transparent !important; color: ${BRAND.text} !important; }
      .email-body p, .email-body li, .email-body div { color: ${BRAND.muted} !important; }
      .email-info-card { background: ${BRAND.ink2} !important; border-color: rgba(255,138,122,.24) !important; }
      .email-info-card strong { color: ${BRAND.coral} !important; }
      .email-button-primary { background:${BRAND.cta} !important;border-color:${BRAND.cta} !important; }
      .email-button-secondary { background:${BRAND.ink3} !important;border-color:rgba(255,138,122,.32) !important; }
      a { color: ${BRAND.coral} !important; }
      .email-button a,
      .email-button-link { color:#ffffff !important;text-decoration:none !important; }
    }
    [data-ogsc] body, [data-ogsc] .email-bg { background: ${BRAND.bg} !important; color: ${BRAND.text} !important; }
    [data-ogsc] .email-card { background: ${BRAND.ink} !important; border-color: rgba(255,255,255,.12) !important; }
    [data-ogsc] .email-body, [data-ogsc] .email-body p, [data-ogsc] .email-body li, [data-ogsc] .email-body div { color: ${BRAND.muted} !important; }
    [data-ogsc] .email-info-card { background: ${BRAND.ink2} !important; border-color: rgba(255,138,122,.24) !important; }
    [data-ogsc] .email-button-primary { background:${BRAND.cta} !important;border-color:${BRAND.cta} !important; }
    [data-ogsc] .email-button-secondary { background:${BRAND.ink3} !important;border-color:rgba(255,138,122,.32) !important; }
    [data-ogsc] a { color: ${BRAND.coral} !important; }
    [data-ogsc] .email-button a,
    [data-ogsc] .email-button-link { color:#ffffff !important;text-decoration:none !important; }
  </style>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};color:${BRAND.text};">
  <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">${escapeHtml(preheader)}</div>
  <div class="email-bg" style="margin:0;padding:0;background:${BRAND.bg};color:${BRAND.text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;background:${BRAND.bg};background-image:linear-gradient(180deg,#050A14 0%,#0B1322 52%,#050A14 100%);">
      <tr>
        <td align="center" style="padding:34px 14px;">
          <table role="presentation" class="email-card" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:640px;border-collapse:separate;border-spacing:0;border:1px solid rgba(255,255,255,.12);border-radius:28px;overflow:hidden;background:#0E1729;box-shadow:0 26px 70px rgba(0,0,0,.42);">
            <tr>
              <td class="email-header" style="padding:32px 28px 14px;background:#0E1729;color:#F6F8FB;">
                <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#FF8A7A;font-weight:900;">${escapeHtml(eyebrow)}</div>
                <h1 style="margin:12px 0 0;font-size:32px;line-height:1.12;font-weight:900;color:#F6F8FB;">${escapeHtml(heading)}</h1>
              </td>
            </tr>
            <tr>
              <td class="email-body" style="padding:14px 28px 30px;font-size:17px;line-height:1.68;color:#DDE7F3;background:#0E1729;">
                ${body}
              </td>
            </tr>
            <tr>
              <td class="email-footer" style="padding:0 28px 28px;background:#0E1729;color:#93A4BB;font-size:13px;line-height:1.5;">
                <div style="border-top:1px solid rgba(255,255,255,.10);padding-top:18px;">StartLine Sites · Race websites built to turn interest into registrations.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
