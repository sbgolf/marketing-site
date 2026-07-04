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
