import assert from 'node:assert/strict';
import test from 'node:test';

import { renderCustomerAuditConfirmationEmail } from '../netlify/functions/submit-audit-request.mjs';
import { renderCustomerIntakeConfirmationEmail } from '../netlify/functions/submit-customer-intake.mjs';
import { renderCustomerKickoffEmail } from '../netlify/functions/stripe-webhook.mjs';
import { renderBrandedEmail, renderEmailButton } from '../netlify/functions/lib/branded-email.mjs';

const assertBrandedCustomerEmail = (html) => {
  assert.match(html, /<meta name="color-scheme" content="light dark">/);
  assert.match(html, /<meta name="supported-color-schemes" content="light dark">/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.match(html, /\[data-ogsc\]/);
  assert.match(html, /StartLine Sites/);
  assert.match(html, /Race websites built to turn interest into registrations\./);

  // Steve's reference screenshot is a cohesive all-dark branded email,
  // not a light paper shell with a dark header.
  assert.match(html, /background:#050A14/);
  assert.match(html, /background:#0E1729/);
  assert.match(html, /background:#111D31/);
  assert.match(html, /#DDE7F3/);
  assert.doesNotMatch(html, /#FAFAF7/i);
  assert.doesNotMatch(html, /#F0EDE5/i);
  assert.doesNotMatch(html, /#F5C04A/i);
  assert.doesNotMatch(html, /#FFF7DF/i);
  assert.doesNotMatch(html, /#EEFBFC/i);

  // CTA and section labels should be coral/salmon, with dark rounded cards.
  assert.match(html, /#FF4D3D/);
  assert.match(html, /#FF8A7A/);
  assert.match(html, /box-shadow:0 0 28px rgba\(255,77,61,\.34\)/);
  assert.match(html, /email-info-card/);
  assert.match(html, /border:1px solid rgba\(255,138,122,\.24\)/);
  assert.match(html, /email-card/);
  assert.match(html, /email-header/);
  assert.match(html, /email-button/);
  assert.match(html, /email-button-link/);
  assert.match(html, /\.email-button a,\s*\.email-button-link \{ color:#ffffff !important;text-decoration:none !important; \}/);
  assert.match(html, /\[data-ogsc\] \.email-button a,\s*\[data-ogsc\] \.email-button-link \{ color:#ffffff !important;text-decoration:none !important; \}/);
  assert.match(html, /<a href="[^"]+" class="email-button-link" style="[^"]*color:#ffffff !important;[^"]*text-decoration:none !important;[^"]*">/);
  assert.match(html, /Thanks,<br>Steve, CEO &amp; Founder<br><a href="https:\/\/startlinesites\.com\//);
};

test('customer audit confirmation uses branded email shell with light/dark mode safeguards', () => {
  const { html } = renderCustomerAuditConfirmationEmail({
    row: {
      contact_name: 'Taylor',
      contact_email: 'director@example.com',
      race_name: 'Ocean Marathon',
      current_url: 'https://example-race.test',
      metadata: { selected_package: { name: 'StartLine Sites Standard Deposit', deposit_amount: '$1,250', url: 'https://checkout.example/standard' } },
    },
  });

  assertBrandedCustomerEmail(html);
  assert.match(html, /Pay the first-year package deposit/);
});

test('customer kickoff email uses branded email shell and CTA buttons for post-deposit next steps', () => {
  const { html } = renderCustomerKickoffEmail({
    customer: {
      race_name: 'Ocean Marathon',
      primary_contact_name: 'Taylor',
      primary_contact_email: 'director@example.com',
    },
    session: { amount_total: 125_000, metadata: { race_name: 'Ocean Marathon' } },
    tier: 'standard',
    intakeUrl: 'https://startlinesites.com/intake',
    assetChecklistUrl: 'https://startlinesites.com/asset-checklist',
  });

  assertBrandedCustomerEmail(html);
  assert.match(html, /Complete the intake form/);
  assert.match(html, /Review the asset checklist/);
});

test('customer intake confirmation uses branded email shell and asset-checklist CTA', () => {
  const { html } = renderCustomerIntakeConfirmationEmail({
    row: {
      contact_name: 'Taylor',
      contact_email: 'director@example.com',
      race_name: 'Ocean Marathon',
    },
    checklistUrl: 'https://startlinesites.com/asset-checklist',
  });

  assertBrandedCustomerEmail(html);
  assert.match(html, /Review the asset checklist/);
});

test('branded email button styles keep CTA text white and preserve secondary treatment in dark-mode overrides', () => {
  const html = renderBrandedEmail({
    heading: 'Button regression check',
    body: `
      ${renderEmailButton({ href: 'https://startlinesites.com/intake', label: 'Complete the intake form' })}
      ${renderEmailButton({ href: 'https://startlinesites.com/asset-checklist', label: 'Review the asset checklist', variant: 'secondary' })}
      ${renderSignatureHtmlForTest()}
    `,
  });

  assert.match(html, /\.email-button a,\s*\.email-button-link \{ color:#ffffff !important;text-decoration:none !important; \}/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)[\s\S]*\.email-button-primary \{ background:#FF4D3D !important;border-color:#FF4D3D !important; \}/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)[\s\S]*\.email-button-secondary \{ background:#18263D !important;border-color:rgba\(255,138,122,\.32\) !important; \}/);
  assert.match(html, /\[data-ogsc\] \.email-button-link \{ color:#ffffff !important;text-decoration:none !important; \}/);
  assert.match(html, /<td class="email-button email-button-primary" bgcolor="#FF4D3D" style="[^"]*background:#FF4D3D;[^"]*border:1px solid #FF4D3D;/);
  assert.match(html, /<td class="email-button email-button-secondary" bgcolor="#18263D" style="[^"]*background:#18263D;[^"]*border:1px solid rgba\(255,138,122,\.32\);/);
  assert.match(html, /<a href="https:\/\/startlinesites\.com\/intake" class="email-button-link" style="[^"]*color:#ffffff !important;[^"]*text-decoration:none !important;[^"]*">Complete the intake form<\/a>/);
  assert.match(html, /<a href="https:\/\/startlinesites\.com\/asset-checklist" class="email-button-link" style="[^"]*color:#ffffff !important;[^"]*text-decoration:none !important;[^"]*">Review the asset checklist<\/a>/);
});

const renderSignatureHtmlForTest = () => '<p style="margin:24px 0 0;">Thanks,<br>Steve, CEO &amp; Founder</p>';
