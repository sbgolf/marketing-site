import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);

import {
  buildOutreachFollowUpDraft,
  buildOutreachFollowUpDraftFromRow,
  FOLLOW_UP_SCENARIOS,
  validateOutreachFollowUpDraft,
} from '../scripts/lib/outreach-follow-up-drafts.mjs';

process.env.STARTLINE_POSTAL_ADDRESS = 'PO Box 123, Nashville, TN 37201';

const baseInput = {
  raceName: 'Sample River 5K',
  contactName: 'Jordan',
  mockupUrl: 'https://mockups.startlinesites.com/private/sample-river-5k?t=abc',
  recommendedPackage: 'Standard',
  raceContext: 'making the course details, race-day schedule, sponsor visibility, and registration handoff easier to scan on mobile',
  packageReason: 'the race has enough runner detail and sponsor context to benefit from more than a single-page starter site',
};

const assertCleanCustomerBody = (body) => {
  assert.doesNotMatch(body, /—/u, 'customer-facing bodies must not use em dashes');
  assert.doesNotMatch(body, /opened|clicked|tracking|track(ed|ing)?|I saw you|we saw you/i);
  assert.doesNotMatch(body, /early partner|newly formed|new company|beta/i);
  assert.match(body, /Thanks,\nSteve, CEO & Founder\nStartLineSites\.com/);
  assert.match(body, /Unsubscribe: (?:mailto:support@startlinesites\.com\?subject=Unsubscribe%20from%20StartLine%20Sites|https:\/\/startlinesites\.com\/\.netlify\/functions\/unsubscribe\?p=)/);
  assert.match(body, /Mailing address: PO Box 123, Nashville, TN 37201/);
};

test('clicked scenario builds a high-intent owner-review draft without surveillance language', () => {
  const draft = buildOutreachFollowUpDraft({ ...baseInput, scenario: 'clicked' });

  assert.equal(draft.scenario, FOLLOW_UP_SCENARIOS.clicked.id);
  assert.equal(draft.subject.recommended, 'Quick next step for Sample River 5K');
  assert.deepEqual(draft.subject.alternates, [
    'One suggested direction for Sample River 5K',
    'A website path for Sample River 5K',
  ]);
  assert.match(draft.body, /Hi Jordan,/);
  assert.match(draft.body, /private StartLine preview for Sample River 5K/);
  assert.match(draft.body, /https:\/\/mockups\.startlinesites\.com\/private\/sample-river-5k\?t=abc/);
  assert.match(draft.body, /Would you like me to send over the recommended next step, or would you rather reply with anything you would want changed first\?/);
  assertCleanCustomerBody(draft.body);
  assert.equal(validateOutreachFollowUpDraft(draft).ok, true);
});

test('opened scenario uses a softer one-idea angle without saying the prospect opened anything', () => {
  const draft = buildOutreachFollowUpDraft({ ...baseInput, scenario: 'opened', contactName: '' });

  assert.equal(draft.subject.recommended, 'One website idea for Sample River 5K');
  assert.match(draft.body, /Hi there,/);
  assert.match(draft.body, /I wanted to resend the private StartLine preview/);
  assert.match(draft.body, /The idea is simple: give runners a clearer path/);
  assertCleanCustomerBody(draft.body);
});

test('delivered scenario creates a low-pressure close-the-loop draft', () => {
  const draft = buildOutreachFollowUpDraft({ ...baseInput, scenario: 'delivered' });

  assert.equal(draft.subject.recommended, 'Should I close the loop on Sample River 5K?');
  assert.match(draft.body, /Just closing the loop on the private StartLine preview/);
  assert.match(draft.body, /If improving the race website is not a priority right now, no problem at all/);
  assert.match(draft.body, /Should I keep this open, or is now not the right time\?/);
  assertCleanCustomerBody(draft.body);
});

test('final close scenario gives a respectful easy out', () => {
  const draft = buildOutreachFollowUpDraft({ ...baseInput, scenario: 'final_close' });

  assert.equal(draft.subject.recommended, 'I’ll close the loop for now');
  assert.match(draft.body, /I will close the loop for now/);
  assert.match(draft.body, /If the website becomes a priority later, you can reply here/);
  assertCleanCustomerBody(draft.body);
});

test('suppressed scenario returns internal no-send guidance instead of a customer email', () => {
  const draft = buildOutreachFollowUpDraft({ ...baseInput, scenario: 'suppressed' });

  assert.equal(draft.sendable, false);
  assert.equal(draft.subject.recommended, 'No customer email');
  assert.match(draft.body, /Internal action only/);
  assert.match(draft.body, /Do not send a follow-up/);
  assert.equal(validateOutreachFollowUpDraft(draft).ok, true);
});

test('row adapter maps engagement status to the right scenario and masks no owner data in customer body', () => {
  const draft = buildOutreachFollowUpDraftFromRow({
    race_name: 'Example Town 10K',
    mockup_url: 'https://mockups.startlinesites.com/private/example-town-10k?t=abc',
    engagement_status: 'clicked',
    recommended_package: 'Standard',
    metadata: {
      contact_name: 'Alex',
      race_context: 'clarifying the event cause, start time, route basics, and official registration path',
      package_reason: 'the race needs enough context to help new runners decide with confidence',
    },
  });

  assert.equal(draft.scenario, 'clicked');
  assert.equal(draft.subject.recommended, 'Quick next step for Example Town 10K');
  assert.match(draft.body, /Hi Alex,/);
  assert.doesNotMatch(draft.body, /example\.com|\*\*\*\[at\]/i);
  assertCleanCustomerBody(draft.body);
});

test('CLI prints an owner-review draft from direct flags without side effects', async () => {
  const { stdout } = await execFileAsync('node', [
    'scripts/build-outreach-follow-up-draft.mjs',
    '--scenario', 'opened',
    '--race-name', 'Sample River 5K',
    '--contact-name', 'Jordan',
    '--mockup-url', 'https://mockups.startlinesites.com/private/sample-river-5k?t=abc',
    '--race-context', 'making the course details and registration path easier to scan',
    '--recommended-package', 'Standard',
  ], { cwd: process.cwd() });

  assert.match(stdout, /Recommended subject:\nOne website idea for Sample River 5K/);
  assert.match(stdout, /Recommended body:\nHi Jordan,/);
  assert.match(stdout, /no email, no contact-form submit, no Supabase write/);
  assert.doesNotMatch(stdout, /—/u);
  assert.doesNotMatch(stdout, /tracking|I saw you|we saw you/i);
});

test('validator catches em dashes and tracking language in customer-facing bodies', () => {
  const bad = {
    scenario: 'clicked',
    sendable: true,
    subject: { recommended: 'Quick next step for Sample River 5K', alternates: [] },
    body: 'Hi Jordan,\n\nI saw you clicked the preview — wanted to follow up.\n\nThanks,\nSteve, CEO & Founder\nStartLineSites.com',
  };

  const result = validateOutreachFollowUpDraft(bad);
  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /em dash/i);
  assert.match(result.issues.join('\n'), /tracking|surveillance/i);
});
