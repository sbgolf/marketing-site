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

test('audit private mockup helper builds tokenized private route URL from origin, slug, and token', () => {
  assert.equal(
    buildPrivateMockupUrl({
      baseUrl: 'https://mockups.startlinesites.com/',
      slug: 'example-marathon-audit-123',
      token: 'tok_1234567890abcdef',
    }),
    'https://mockups.startlinesites.com/private/mockups/example-marathon-audit-123/tok_1234567890abcdef/'
  );
});

test('audit private mockup helper requires externally usable http(s) URL', () => {
  assert.equal(isHttpUrl('https://example.com/private/mockups/race/tok_1234567890abcdef/'), true);
  assert.equal(isHttpUrl('http://example.com/private/mockups/race/tok_1234567890abcdef/'), true);
  assert.equal(isHttpUrl('ftp://example.com/private/mockups/race/tok_1234567890abcdef/'), false);
  assert.equal(isHttpUrl('/private/mockups/race/tok_1234567890abcdef/'), false);
  assert.throws(
    () => buildPrivateMockupUrl({ baseUrl: '', slug: 'race', token: 'tok_1234567890abcdef' }),
    /STARTLINE_PRIVATE_MOCKUP_BASE_URL/
  );
});

test('audit private mockup helper enforces origin-only base URL and tokenized private URLs', () => {
  assert.equal(isOriginOnlyUrl('https://mockups.startlinesites.com'), true);
  assert.equal(isOriginOnlyUrl('https://mockups.startlinesites.com/'), true);
  assert.equal(isOriginOnlyUrl('https://mockups.startlinesites.com/private/mockups'), false);

  assert.equal(isTokenizedPrivateMockupUrl('https://mockups.startlinesites.com/private/mockups/example-race/tok_1234567890abcdef/'), true);
  assert.equal(isTokenizedPrivateMockupUrl('https://mockups.startlinesites.com/private/mockups/example-race/?token=tok_1234567890abcdef'), true);
  assert.equal(isTokenizedPrivateMockupUrl('https://mockups.startlinesites.com/private/mockups/example-race/'), false);
  assert.equal(isTokenizedPrivateMockupUrl('https://mockups.startlinesites.com/private/mockups/'), false);

  assert.throws(
    () => buildPrivateMockupUrl({ baseUrl: 'https://mockups.startlinesites.com/private/mockups', slug: 'race', token: 'tok_1234567890abcdef' }),
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
    privateMockupUrl: 'https://preview.example/private/mockups/example-race/tok_1234567890abcdef/',
    slug: 'example-race',
    sourceUrl: 'https://example-race.test',
    generatedAt: '2026-06-27T20:00:00.000Z',
    route: '/private/mockups/example-race/tok_1234567890abcdef/',
  });

  assert.equal(merged.submitted_from, 'startlinesites.com');
  assert.equal(merged.audit_workflow.existing_step, 'kept');
  assert.equal(merged.audit_workflow.private_mockup_url, 'https://preview.example/private/mockups/example-race/tok_1234567890abcdef/');
  assert.equal(merged.audit_workflow.private_mockup_status, 'steve_review_only');
  assert.equal(merged.audit_workflow.customer_delivery_blocked_until, 'steve_approval');

  const summary = mergeAuditSummary({
    currentSummary: { score: 72 },
    privateMockupUrl: 'https://preview.example/private/mockups/example-race/tok_1234567890abcdef/',
    generatedAt: '2026-06-27T20:00:00.000Z',
  });
  assert.equal(summary.score, 72);
  assert.equal(summary.private_mockup_url, 'https://preview.example/private/mockups/example-race/tok_1234567890abcdef/');
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
    privateMockupUrl: 'https://preview.example/private/mockups/example-marathon/tok_1234567890abcdef/',
    route: '/private/mockups/example-marathon/tok_1234567890abcdef/',
    generated: true,
    patchStored: true,
  });

  assert.match(text, /Private mockup URL: https:\/\/preview\.example\/private\/mockups\/example-marathon\/tok_1234567890abcdef\//);
  assert.match(text, /Steve approval is required before any customer delivery/);
  assert.match(text, /Do not send this private mockup URL to the race director until Steve approves/);
});

test('slugify makes stable private mockup slugs', () => {
  assert.equal(slugify('Example Marathon & 10K audit-123'), 'example-marathon-and-10k-audit-123');
  assert.equal(slugify('***'), 'audit-private-mockup');
});
