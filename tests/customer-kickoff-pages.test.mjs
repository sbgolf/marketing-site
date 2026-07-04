import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const intakeSource = await readFile(new URL('../src/pages/intake.astro', import.meta.url), 'utf8');
const assetChecklistSource = await readFile(new URL('../src/pages/asset-checklist.astro', import.meta.url), 'utf8');
const astroConfigSource = await readFile(new URL('../astro.config.mjs', import.meta.url), 'utf8');

test('intake page is framed as a customer kickoff resource with prospect escape routes', () => {
  assert.match(intakeSource, /Customer Kickoff Intake — StartLine Sites/);
  assert.match(intakeSource, /Customer kickoff resource/);
  assert.match(intakeSource, /<h1>Confirm your race details<\/h1>/);
  assert.match(intakeSource, /Use this as the source of truth for your StartLine build/);
  assert.match(intakeSource, /not starting from scratch/);
  assert.match(intakeSource, /Not a customer yet\?/);
  assert.match(intakeSource, /href="\/#audit">Request a private audit/);
  assert.match(intakeSource, /href="\/#pricing">View pricing/);
  assert.match(intakeSource, /href="\/sample-audit\/">See sample audit/);
});

test('intake page adds branded process reassurance and next-step guidance', () => {
  assert.match(intakeSource, /class="trust-row" aria-label="StartLine intake progress"/);
  assert.match(intakeSource, /class="trust-item is-complete"/);
  assert.match(intakeSource, /class="trust-icon" aria-hidden="true">✓<\/span><span>Current site reviewed/);
  assert.match(intakeSource, /class="trust-icon" aria-hidden="true">✓<\/span><span>Private mockup prepared/);
  assert.match(intakeSource, /class="trust-item is-next"/);
  assert.match(intakeSource, /class="trust-icon" aria-hidden="true">→<\/span><span>Build starts after confirmation/);
  assert.match(intakeSource, /What happens next/);
  assert.match(intakeSource, /we check this against your current site, private mockup, and kickoff notes/);
  assert.match(intakeSource, /one short follow-up list/);
  assert.match(intakeSource, /the staging build begins/);
});

test('intake page keeps asset guidance low-friction and branded', () => {
  assert.match(intakeSource, /Assets can be rough/);
  assert.match(intakeSource, /Send the best files you have now\./);
  assert.match(intakeSource, /available photos, logos, course maps, sponsor marks, policy docs, or folder links/);
  assert.match(intakeSource, /StartLine will follow up if a better version is needed/);
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
  assert.match(intakeSource, /get-customer-intake-prefill\?token=/);
  assert.match(intakeSource, /searchParams\.delete\('token'\)/);
  assert.match(intakeSource, /history\.replaceState/);
  assert.match(intakeSource, /StartLine customer record suggestions/);
  assert.match(intakeSource, /Please review and edit anything that changed/);

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
  assert.match(intakeSource, /For now, please enter the details below/);
  assert.match(intakeSource, /source of truth for your kickoff/);
  assert.doesNotMatch(intakeSource, /Secure prefill is not active yet/);

  const requiredMarkerCount = (intakeSource.match(/class="required-marker" aria-hidden="true">\*<\/span>/g) || []).length;
  assert.equal(requiredMarkerCount, 6);
  assert.match(intakeSource, /<span class="field-label"><span class="required-label">Race name <span class="required-marker" aria-hidden="true">\*<\/span><\/span><\/span><input name="race_name"/);
  assert.match(intakeSource, /\.field-label\{display:inline/);
  assert.match(intakeSource, /\.required-label\{display:inline-flex;align-items:baseline;gap:\.18em;white-space:nowrap\}/);
  assert.match(intakeSource, /\.required-marker\{display:inline/);
});


test('intake form card headings avoid native legend border collision', () => {
  assert.match(intakeSource, /<fieldset aria-labelledby="race-details-title">/);
  assert.match(intakeSource, /<legend class="visually-hidden">Confirm your race details<\/legend>/);
  assert.match(intakeSource, /<h2 id="race-details-title" class="fieldset-title">Confirm your race details<\/h2>/);
  assert.match(intakeSource, /<h2 id="registration-details-title" class="fieldset-title">Registration and race details<\/h2>/);
  assert.match(intakeSource, /<h2 id="content-assets-title" class="fieldset-title">Content, assets, and access<\/h2>/);
  assert.match(intakeSource, /\.visually-hidden\{position:absolute!important/);
  assert.match(intakeSource, /\.fieldset-title\{/);
  assert.doesNotMatch(intakeSource, /legend\{font-family:"Instrument Serif"/);
});

test('intake textareas are tall enough for long placeholder guidance', () => {
  for (const [name, rows] of [
    ['distances_pricing', 7],
    ['course_logistics', 8],
    ['race_schedule', 6],
    ['sponsors', 6],
    ['faqs', 8],
    ['optional_notes', 6],
  ]) {
    assert.match(intakeSource, new RegExp(`name="${name}" rows="${rows}" class="textarea-large"`));
  }
  assert.match(intakeSource, /textarea\{line-height:1\.5;min-height:140px\}/);
  assert.match(intakeSource, /\.textarea-large\{min-height:190px\}/);
  assert.match(intakeSource, /@media\(max-width:760px\).*\.textarea-large\{min-height:280px\}/s);
});

test('intake page includes mobile spacing and lighter optional admin notes', () => {
  assert.match(intakeSource, /padding:56px clamp\(18px,5vw,56px\) calc\(96px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(intakeSource, /scroll-margin-block:24px calc\(112px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(intakeSource, /overflow-x:clip/);
  assert.match(intakeSource, /font-size:16px/);
  assert.match(intakeSource, /@media\(max-width:1080px\)/);
  assert.match(intakeSource, /@media\(max-width:760px\)/);
  assert.match(intakeSource, /\.intake-workspace\{display:grid;grid-template-columns:minmax\(0,1fr\) 330px/);
  assert.match(intakeSource, /\.trust-row\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(intakeSource, /\.trust-row\{grid-template-columns:1fr\}/);
  assert.match(intakeSource, /<details class="optional-group">/);
  assert.match(intakeSource, /<summary>Optional admin and launch notes<\/summary>/);
});
