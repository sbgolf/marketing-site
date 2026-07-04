import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const intakeSource = await readFile(new URL('../src/pages/intake.astro', import.meta.url), 'utf8');
const assetChecklistSource = await readFile(new URL('../src/pages/asset-checklist.astro', import.meta.url), 'utf8');
const astroConfigSource = await readFile(new URL('../astro.config.mjs', import.meta.url), 'utf8');

test('intake page is framed as a customer kickoff resource with prospect escape routes', () => {
  assert.match(intakeSource, /Customer Kickoff Intake — StartLine Sites/);
  assert.match(intakeSource, /Customer kickoff resource/);
  assert.match(intakeSource, /Complete this form after your private audit, package recommendation, and StartLine kickoff/);
  assert.match(intakeSource, /Not a customer yet\?/);
  assert.match(intakeSource, /href="\/#audit">Request a private audit/);
  assert.match(intakeSource, /href="\/#pricing">View pricing/);
  assert.match(intakeSource, /href="\/sample-audit\/">See sample audit/);
});

test('customer kickoff pages opt out of search indexing while remaining static routes', () => {
  assert.match(intakeSource, /canonicalPath="\/intake"/);
  assert.match(intakeSource, /noindex=\{true\}/);
  assert.match(assetChecklistSource, /canonicalPath="\/asset-checklist"/);
  assert.match(assetChecklistSource, /noindex=\{true\}/);
});

test('customer kickoff pages are excluded from generated sitemap output', () => {
  assert.match(astroConfigSource, /['"]\/intake\/['"]/);
  assert.match(astroConfigSource, /['"]\/asset-checklist\/['"]/);
  assert.match(astroConfigSource, /filter: \(page\) => !sitemapExcludedPaths\.some/);
});

test('asset checklist page is framed as customer kickoff preparation with prospect escape routes', () => {
  assert.match(assetChecklistSource, /Customer Kickoff Asset Checklist — StartLine Sites/);
  assert.match(assetChecklistSource, /Customer kickoff resource/);
  assert.match(assetChecklistSource, /Use this list after your audit, package approval, and StartLine kickoff/);
  assert.match(assetChecklistSource, /This checklist is for customer kickoff/);
  assert.match(assetChecklistSource, /href="\/#audit">Request a private audit/);
  assert.match(assetChecklistSource, /href="\/#pricing">View pricing/);
  assert.match(assetChecklistSource, /href="\/sample-audit\/">See sample audit/);
});

test('intake form support fallback appears near form and error copy stays aligned', () => {
  assert.match(intakeSource, /If the form fails or a field does not fit your race/);
  assert.match(intakeSource, /mailto:support@startlinesites\.com\?subject=Customer%20intake%20fallback/);
  assert.match(intakeSource, /with your race name and project link/);
  assert.match(intakeSource, /email support@startlinesites\.com with your race name/);
});

test('intake form wiring and required-field attributes remain intact', () => {
  assert.match(intakeSource, /<form id="customerIntakeForm" class="intake-form" novalidate>/);
  assert.match(intakeSource, /name="company_website" class="hp"/);
  assert.match(intakeSource, /fetch\('\/.netlify\/functions\/submit-customer-intake'/);

  for (const name of ['race_name', 'contact_name', 'contact_email', 'event_date', 'event_location', 'registration_url']) {
    assert.match(intakeSource, new RegExp(`name="${name}"[^>]*required`));
  }

  for (const name of ['organization_name', 'contact_phone', 'template_preference', 'registration_platform', 'distances_pricing', 'course_logistics', 'bq_certification', 'race_schedule', 'sponsors', 'faqs', 'assets_link', 'analytics_access_notes', 'optional_notes']) {
    assert.match(intakeSource, new RegExp(`name="${name}"`));
  }
});

test('intake page uses inline required markers and confirm-edit framing', () => {
  assert.match(intakeSource, /Confirm your race details/);
  assert.match(intakeSource, /Review and edit anything that looks off/);
  assert.match(intakeSource, /Secure prefill is not active yet/);
  assert.doesNotMatch(intakeSource, /we (pre[- ]filled|prefilled)/i);

  const requiredMarkerCount = (intakeSource.match(/class="required-marker" aria-hidden="true">\*<\/span>/g) || []).length;
  assert.equal(requiredMarkerCount, 6);
  assert.match(intakeSource, /<span class="field-label">Race name <span class="required-marker" aria-hidden="true">\*<\/span><\/span><input name="race_name"/);
  assert.match(intakeSource, /\.field-label\{display:inline/);
  assert.match(intakeSource, /\.required-marker\{display:inline/);
});

test('intake page includes mobile spacing and lighter optional admin notes', () => {
  assert.match(intakeSource, /padding:56px clamp\(18px,5vw,56px\) calc\(96px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(intakeSource, /scroll-margin-block:24px calc\(112px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(intakeSource, /overflow-x:clip/);
  assert.match(intakeSource, /font-size:16px/);
  assert.match(intakeSource, /<details class="optional-group">/);
  assert.match(intakeSource, /<summary>Optional admin and launch notes<\/summary>/);
});
