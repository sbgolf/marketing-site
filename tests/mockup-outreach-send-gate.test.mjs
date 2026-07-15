import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_MOCKUP_OUTREACH_FROM,
  DEFAULT_MOCKUP_OUTREACH_REPLY_TO,
  assertBrandedMockupOutreachHtml,
  buildResendMockupOutreachPayload,
  renderPrivateMockupOutreachEmail,
  validateMockupOutreachSend,
} from '../scripts/lib/mockup-outreach-send-gate.mjs';

test('private mockup outreach send gate renders branded customer-facing email', () => {
  const mockupUrl = 'https://mockups.startlinesites.com/private/mockups/exampletoken/';
  const { subject, text, html } = renderPrivateMockupOutreachEmail({
    raceName: 'Example 10K',
    contactName: 'Taylor',
    mockupUrl,
    subject: 'A Nashville-local website mockup for Example 10K',
  });

  assert.equal(subject, 'A Nashville-local website mockup for Example 10K');
  assert.match(text, /Hi Taylor/);
  assert.match(text, /The goal is not to replace RunSignup/);
  assert.match(text, /50% off all current website packages/);
  assert.match(text, /Review the private mockup: https:\/\/mockups\.startlinesites\.com\/private\/mockups\/exampletoken\//);
  assert.match(html, /email-card/);
  assert.match(html, /email-button-link/);
  assert.match(html, /Private race website preview/);
  assert.match(html, /The goal is not to replace RunSignup/);
  assert.match(html, /50% off all current website packages/);
  assert.match(html, /Steve, CEO &amp; Founder/);
  assert.deepEqual(assertBrandedMockupOutreachHtml({ html, mockupUrl }), []);
});

test('private mockup outreach send gate rejects missing template and rejected wording', () => {
  const errors = validateMockupOutreachSend({
    raceName: 'Example 10K',
    mockupUrl: 'https://mockups.startlinesites.com/private/mockups/exampletoken/',
    toEmails: 'director@example.test',
    subject: 'A no-index mockup from Bailey',
  });

  assert.ok(errors.includes('mockupTemplate is required.'));
  assert.ok(errors.some((error) => error.includes('no-index')));
  assert.ok(errors.some((error) => error.includes('Bailey')));
});

test('resend payload uses StartLine founder sender and support reply-to defaults', () => {
  const payload = buildResendMockupOutreachPayload({
    apiKey: 'test-key',
    to: 'director@example.test',
    cc: 'events@example.test',
    subject: 'A private website mockup',
    text: 'Text body',
    html: '<p>HTML body</p>',
  });

  assert.equal(payload.endpoint, 'https://api.resend.com/emails');
  assert.equal(payload.body.from, DEFAULT_MOCKUP_OUTREACH_FROM);
  assert.deepEqual(payload.body.reply_to, [DEFAULT_MOCKUP_OUTREACH_REPLY_TO]);
  assert.deepEqual(payload.body.to, ['director@example.test']);
  assert.deepEqual(payload.body.cc, ['events@example.test']);
  assert.equal(payload.body.subject, 'A private website mockup');
  assert.equal(payload.body.text, 'Text body');
  assert.equal(payload.body.html, '<p>HTML body</p>');
});
