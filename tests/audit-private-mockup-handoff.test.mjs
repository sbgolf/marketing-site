import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOwnerPreviewText,
  buildPrivateMockupUrl,
  isHttpUrl,
  mergeAuditSummary,
  mergeAuditWorkflowMetadata,
  slugify,
} from '../scripts/audit-private-mockup-handoff.mjs';

test('audit private mockup helper builds private route URL from deploy origin and slug', () => {
  assert.equal(
    buildPrivateMockupUrl({
      baseUrl: 'https://deploy-preview-8--race-templates.netlify.app/',
      slug: 'example-marathon-audit-123',
    }),
    'https://deploy-preview-8--race-templates.netlify.app/private/mockups/example-marathon-audit-123/'
  );
});

test('audit private mockup helper requires externally usable http(s) URL', () => {
  assert.equal(isHttpUrl('https://example.com/private/mockups/race/'), true);
  assert.equal(isHttpUrl('http://example.com/private/mockups/race/'), true);
  assert.equal(isHttpUrl('ftp://example.com/private/mockups/race/'), false);
  assert.equal(isHttpUrl('/private/mockups/race/'), false);
  assert.throws(
    () => buildPrivateMockupUrl({ baseUrl: '', slug: 'race' }),
    /STARTLINE_PRIVATE_MOCKUP_BASE_URL/
  );
});

test('audit private mockup helper merges Steve approval gate into JSON metadata fields', () => {
  const merged = mergeAuditWorkflowMetadata({
    currentMetadata: {
      submitted_from: 'startlinesites.com',
      audit_workflow: { existing_step: 'kept' },
    },
    privateMockupUrl: 'https://preview.example/private/mockups/example-race/',
    slug: 'example-race',
    sourceUrl: 'https://example-race.test',
    generatedAt: '2026-06-27T20:00:00.000Z',
    route: '/private/mockups/example-race/',
  });

  assert.equal(merged.submitted_from, 'startlinesites.com');
  assert.equal(merged.audit_workflow.existing_step, 'kept');
  assert.equal(merged.audit_workflow.private_mockup_url, 'https://preview.example/private/mockups/example-race/');
  assert.equal(merged.audit_workflow.private_mockup_status, 'steve_review_only');
  assert.equal(merged.audit_workflow.customer_delivery_blocked_until, 'steve_approval');

  const summary = mergeAuditSummary({
    currentSummary: { score: 72 },
    privateMockupUrl: 'https://preview.example/private/mockups/example-race/',
    generatedAt: '2026-06-27T20:00:00.000Z',
  });
  assert.equal(summary.score, 72);
  assert.equal(summary.private_mockup_url, 'https://preview.example/private/mockups/example-race/');
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
    privateMockupUrl: 'https://preview.example/private/mockups/example-marathon/',
    route: '/private/mockups/example-marathon/',
    generated: true,
    patchStored: true,
  });

  assert.match(text, /Private mockup URL: https:\/\/preview\.example\/private\/mockups\/example-marathon\//);
  assert.match(text, /Steve approval is required before any customer delivery/);
  assert.match(text, /Do not send this private mockup URL to the race director until Steve approves/);
});

test('slugify makes stable private mockup slugs', () => {
  assert.equal(slugify('Example Marathon & 10K audit-123'), 'example-marathon-and-10k-audit-123');
  assert.equal(slugify('***'), 'audit-private-mockup');
});
