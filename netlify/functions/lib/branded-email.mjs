export const BRAND = {
  ink: '#0E1729',
  ink2: '#1A2438',
  paper: '#FAFAF7',
  paper2: '#F0EDE5',
  cta: '#FF4D3D',
  accentDeep: '#D43B2D',
  teal: '#1FB8C4',
  gold: '#F5C04A',
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

export const renderSignatureHtml = () => '<p style="margin:22px 0 0;color:#0E1729;font-weight:800;">Thanks,<br>Steve, CEO &amp; Founder<br><a href="https://startlinesites.com/" style="color:#0E1729;text-decoration:underline;">StartLineSites.com</a></p>';

export const renderEmailButton = ({ href, label, variant = 'primary' }) => {
  const isPrimary = variant === 'primary';
  const background = isPrimary ? BRAND.cta : BRAND.ink;
  const border = isPrimary ? BRAND.accentDeep : BRAND.ink2;
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:12px 10px 12px 0;display:inline-table;">
      <tr>
        <td class="email-button" bgcolor="${background}" style="border-radius:999px;background:${background};border:1px solid ${border};mso-padding-alt:13px 18px;">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 18px;color:#ffffff;font-size:15px;line-height:1.1;font-weight:800;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
};

export const renderInfoCard = ({ title, children, tone = 'teal' }) => {
  const border = tone === 'gold' ? 'rgba(245,192,74,.45)' : 'rgba(31,184,196,.36)';
  const background = tone === 'gold' ? '#FFF7DF' : '#EEFBFC';
  return `
    <div class="email-info-card" style="border:1px solid ${border};border-radius:18px;background:${background};padding:16px 18px;margin:18px 0;">
      <strong style="display:block;color:${BRAND.ink};margin-bottom:8px;">${escapeHtml(title)}</strong>
      ${children}
    </div>`;
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
    a { color: ${BRAND.cta}; }
    @media (prefers-color-scheme: dark) {
      body, .email-bg { background: ${BRAND.ink} !important; color: ${BRAND.paper} !important; }
      .email-card { background: ${BRAND.ink2} !important; border-color: rgba(250,250,247,.18) !important; }
      .email-body { color: ${BRAND.paper} !important; }
      .email-body p, .email-body li, .email-body div { color: ${BRAND.paper} !important; }
      .email-header { background: ${BRAND.ink} !important; }
      .email-footer { background: ${BRAND.ink} !important; color: ${BRAND.paper2} !important; border-color: rgba(250,250,247,.16) !important; }
      .email-info-card { background: rgba(31,184,196,.12) !important; border-color: rgba(31,184,196,.44) !important; }
      .email-button { background: ${BRAND.cta} !important; border-color: ${BRAND.cta} !important; }
      a { color: ${BRAND.gold} !important; }
    }
    [data-ogsc] body, [data-ogsc] .email-bg { background: ${BRAND.ink} !important; color: ${BRAND.paper} !important; }
    [data-ogsc] .email-card { background: ${BRAND.ink2} !important; border-color: rgba(250,250,247,.18) !important; }
    [data-ogsc] .email-body, [data-ogsc] .email-body p, [data-ogsc] .email-body li, [data-ogsc] .email-body div { color: ${BRAND.paper} !important; }
    [data-ogsc] .email-footer { background: ${BRAND.ink} !important; color: ${BRAND.paper2} !important; }
    [data-ogsc] a { color: ${BRAND.gold} !important; }
  </style>
</head>
<body style="margin:0;padding:0;background:${BRAND.paper2};color:${BRAND.ink};">
  <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">${escapeHtml(preheader)}</div>
  <div class="email-bg" style="margin:0;padding:0;background:${BRAND.paper2};color:${BRAND.ink};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;background:${BRAND.paper2};">
      <tr>
        <td align="center" style="padding:30px 16px;">
          <table role="presentation" class="email-card" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:640px;border-collapse:separate;border-spacing:0;border:1px solid #DED8CA;border-radius:24px;overflow:hidden;background:${BRAND.paper};box-shadow:0 18px 48px rgba(14,23,41,.10);">
            <tr>
              <td class="email-header" style="padding:28px;background:${BRAND.ink};color:${BRAND.paper};">
                <div style="font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:${BRAND.gold};font-weight:800;">${escapeHtml(eyebrow)}</div>
                <h1 style="margin:10px 0 0;font-size:28px;line-height:1.15;font-weight:900;color:${BRAND.paper};">${escapeHtml(heading)}</h1>
              </td>
            </tr>
            <tr>
              <td class="email-body" style="padding:28px;font-size:16px;line-height:1.62;color:${BRAND.ink2};">
                ${body}
              </td>
            </tr>
            <tr>
              <td class="email-footer" style="padding:18px 28px;border-top:1px solid #DED8CA;background:${BRAND.paper2};color:${BRAND.ink2};font-size:13px;line-height:1.5;">
                StartLine Sites · Race websites built to turn interest into registrations.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
