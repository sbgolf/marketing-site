import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOwnerPreviewText,
  buildPrivateMockupUrl,
  isHttpUrl,
  isOriginOnlyUrl,
  isTokenizedPrivateMockupUrl,
  mergeAuditSummary,
  mergeAuditWorkflowMetadata,
  slugify,
} from '../scripts/audit-private-mockup-handoff.mjs';

const TEST_TOKEN = '35a001229594dde99d184e2ab18b50e9';

test('audit private mockup helper builds tokenized private route URL from origin and token', () => {
  assert.equal(
    buildPrivateMockupUrl({
      baseUrl: 'https://mockups.startlinesites.com/',
      slug: 'example-marathon-audit-123',
      token: TEST_TOKEN,
    }),
    `https://mockups.startlinesites.com/private/mockups/${TEST_TOKEN}/`
  );
});

test('audit private mockup helper requires externally usable http(s) URL', () => {
  assert.equal(isHttpUrl(`https://example.com/private/mockups/${TEST_TOKEN}/`), true);
  assert.equal(isHttpUrl(`http://example.com/private/mockups/${TEST_TOKEN}/`), true);
  assert.equal(isHttpUrl(`ftp://example.com/private/mockups/${TEST_TOKEN}/`), false);
  assert.equal(isHttpUrl(`/private/mockups/${TEST_TOKEN}/`), false);
  assert.throws(
    () => buildPrivateMockupUrl({ baseUrl: '', slug: 'race', token: TEST_TOKEN }),
    /STARTLINE_PRIVATE_MOCKUP_BASE_URL/
  );
});

test('audit private mockup helper enforces origin-only base URL and tokenized private URLs', () => {
  assert.equal(isOriginOnlyUrl('https://mockups.startlinesites.com'), true);
  assert.equal(isOriginOnlyUrl('https://mockups.startlinesites.com/'), true);
  assert.equal(isOriginOnlyUrl('https://mockups.startlinesites.com/private/mockups'), false);

  assert.equal(isTokenizedPrivateMockupUrl(`https://mockups.startlinesites.com/private/mockups/${TEST_TOKEN}/`), true);
  assert.equal(isTokenizedPrivateMockupUrl(`https://mockups.startlinesites.com/private/mockups/example-race/${TEST_TOKEN}/`), false);
  assert.equal(isTokenizedPrivateMockupUrl(`https://mockups.startlinesites.com/private/mockups/example-race/?token=${TEST_TOKEN}`), false);
  assert.equal(isTokenizedPrivateMockupUrl('https://mockups.startlinesites.com/private/mockups/example-race/'), false);
  assert.equal(isTokenizedPrivateMockupUrl('https://mockups.startlinesites.com/private/mockups/'), false);

  assert.throws(
    () => buildPrivateMockupUrl({ baseUrl: 'https://mockups.startlinesites.com/private/mockups', slug: 'race', token: TEST_TOKEN }),
    /origin only/
  );
  assert.throws(
    () => buildPrivateMockupUrl({ baseUrl: 'https://mockups.startlinesites.com', slug: 'race' }),
    /Predictable slug-only mockup URLs are not allowed/
  );
  assert.throws(
    () => buildPrivateMockupUrl({ explicitUrl: 'https://mockups.startlinesites.com/private/mockups/race/' }),
    /tokenized private mockup URL/
  );
});

test('audit private mockup helper merges Steve approval gate into JSON metadata fields', () => {
  const merged = mergeAuditWorkflowMetadata({
    currentMetadata: {
      submitted_from: 'startlinesites.com',
      audit_workflow: { existing_step: 'kept' },
    },
    privateMockupUrl: `https://preview.example/private/mockups/${TEST_TOKEN}/`,
    slug: 'example-race',
    sourceUrl: 'https://example-race.test',
    generatedAt: '2026-06-27T20:00:00.000Z',
    route: `/private/mockups/${TEST_TOKEN}/`,
  });

  assert.equal(merged.submitted_from, 'startlinesites.com');
  assert.equal(merged.audit_workflow.existing_step, 'kept');
  assert.equal(merged.audit_workflow.private_mockup_url, `https://preview.example/private/mockups/${TEST_TOKEN}/`);
  assert.equal(merged.audit_workflow.private_mockup_status, 'steve_review_only');
  assert.equal(merged.audit_workflow.customer_delivery_blocked_until, 'steve_approval');

  const summary = mergeAuditSummary({
    currentSummary: { score: 72 },
    privateMockupUrl: `https://preview.example/private/mockups/${TEST_TOKEN}/`,
    generatedAt: '2026-06-27T20:00:00.000Z',
  });
  assert.equal(summary.score, 72);
  assert.equal(summary.private_mockup_url, `https://preview.example/private/mockups/${TEST_TOKEN}/`);
  assert.equal(summary.private_mockup_status, 'steve_review_only');
});

test('owner preview text includes private mockup URL and delivery block', () => {
  const text = buildOwnerPreviewText({
    record: {
      race_name: 'Example Marathon',
      current_url: 'https://examplemarathon.com',
      contact_name: 'Race Director',
      contact_email: 'director@example.com',
      notes: 'Uses public race images only.',
      metadata: { selected_package: { name: 'StartLine Sites Standard First-Year Package Deposit' } },
    },
    privateMockupUrl: `https://preview.example/private/mockups/${TEST_TOKEN}/`,
    route: `/private/mockups/${TEST_TOKEN}/`,
    generated: true,
    patchStored: true,
  });

  assert.match(text, new RegExp(`Private mockup URL: https:\\/\\/preview\\.example\\/private\\/mockups\\/${TEST_TOKEN}\\/`));
  assert.match(text, /Steve approval is required before any customer delivery/);
  assert.match(text, /Do not send this private mockup URL to the race director until Steve approves/);
});

test('slugify makes stable private mockup slugs', () => {
  assert.equal(slugify('Example Marathon & 10K audit-123'), 'example-marathon-and-10k-audit-123');
  assert.equal(slugify('***'), 'audit-private-mockup');
});
