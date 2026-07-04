import assert from 'node:assert/strict';
import test from 'node:test';

import { renderCustomerAuditConfirmationEmail } from '../netlify/functions/submit-audit-request.mjs';
import { renderCustomerIntakeConfirmationEmail } from '../netlify/functions/submit-customer-intake.mjs';
import { renderCustomerKickoffEmail } from '../netlify/functions/stripe-webhook.mjs';

const assertBrandedCustomerEmail = (html) => {
  assert.match(html, /<meta name="color-scheme" content="light dark">/);
  assert.match(html, /<meta name="supported-color-schemes" content="light dark">/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.match(html, /\[data-ogsc\]/);
  assert.match(html, /StartLine Sites/);
  assert.match(html, /Race websites built to turn interest into registrations\./);
  assert.match(html, /#0E1729/);
  assert.match(html, /#FAFAF7/);
  assert.match(html, /#FF4D3D/);
  assert.match(html, /email-card/);
  assert.match(html, /email-header/);
  assert.match(html, /email-button/);
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
