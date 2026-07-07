import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const intakeSource = await readFile(new URL('../src/pages/intake.astro', import.meta.url), 'utf8');
const assetChecklistSource = await readFile(new URL('../src/pages/asset-checklist.astro', import.meta.url), 'utf8');
const astroConfigSource = await readFile(new URL('../astro.config.mjs', import.meta.url), 'utf8');

test('intake page is framed as a post-deposit Launch Readiness Checklist with prospect escape routes', () => {
  assert.match(intakeSource, /Launch Readiness Checklist — StartLine Sites/);
  assert.match(intakeSource, /Post-deposit Launch Readiness Kit/);
  assert.match(intakeSource, /<h1>Confirm what we found\. Add what only you know\.<\/h1>/);
  assert.match(intakeSource, /turn StartLine’s public research into a build-ready source of truth/);
  assert.match(intakeSource, /choose “I don’t know yet” for technical items/);
  assert.match(intakeSource, /Not a customer yet\?/);
  assert.match(intakeSource, /href="\/#audit">Request a private audit/);
  assert.match(intakeSource, /href="\/#pricing">View pricing/);
  assert.match(intakeSource, /href="\/sample-audit\/">See sample audit/);
});

test('intake page separates build inputs from launch blockers', () => {
  assert.match(intakeSource, /class="trust-row" aria-label="StartLine intake progress"/);
  assert.match(intakeSource, /class="trust-item is-complete"/);
  assert.match(intakeSource, /class="trust-icon" aria-hidden="true">✓<\/span><span>Current site reviewed/);
  assert.match(intakeSource, /class="trust-icon" aria-hidden="true">✓<\/span><span>Deposit received/);
  assert.match(intakeSource, /class="trust-item is-next"/);
  assert.match(intakeSource, /class="trust-icon" aria-hidden="true">→<\/span><span>Build starts after essentials are confirmed/);
  assert.match(intakeSource, /What happens next/);
  assert.match(intakeSource, /Build inputs first\. Launch blockers later\./);
  assert.match(intakeSource, /we compare your answers against the site, registration platform/);
  assert.match(intakeSource, /DNS, analytics, assets, or approver details are unknown/);
  assert.match(intakeSource, /once race identity, date\/location, registration truth, package scope, and usable assets are clear/);
});

test('intake page keeps asset guidance low-friction and branded', () => {
  assert.match(intakeSource, /Assets can be rough/);
  assert.match(intakeSource, /Paste one folder link if you have it\./);
  assert.match(intakeSource, /available photos, logos, course maps, sponsor marks, policy docs, or folder links/);
  assert.match(intakeSource, /we’ll keep it on the launch checklist/);
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
  assert.match(assetChecklistSource, /Use this list after your audit, package approval, or StartLine kickoff/);
  assert.match(assetChecklistSource, /Drive, Dropbox, Box, or folder link/);
  assert.match(assetChecklistSource, /StartLine will follow up if a better version is needed/);
  assert.match(assetChecklistSource, /This checklist is for customer kickoff/);
  assert.match(assetChecklistSource, /href="\/#audit">Request a private audit/);
  assert.match(assetChecklistSource, /href="\/#pricing">View pricing/);
  assert.match(assetChecklistSource, /href="\/sample-audit\/">See sample audit/);
});

test('asset checklist page visually pairs with branded intake kickoff structure', () => {
  assert.match(assetChecklistSource, /class="trust-row" aria-label="StartLine asset checklist progress"/);
  assert.match(assetChecklistSource, /Audit or package approved/);
  assert.match(assetChecklistSource, /Assets gathered in one folder/);
  assert.match(assetChecklistSource, /Folder link added to intake/);
  assert.match(assetChecklistSource, /Asset prep pass/);
  assert.match(assetChecklistSource, /One clean folder beats scattered uploads/);
  assert.match(assetChecklistSource, /class="prep-card"/);
  assert.match(assetChecklistSource, /class="checklist-workspace" aria-label="Customer asset checklist workspace"/);
  assert.match(assetChecklistSource, /What happens next/);
  assert.match(assetChecklistSource, /one focused follow-up list/);
  assert.match(assetChecklistSource, /the build can move into staging/);
  assert.match(assetChecklistSource, /\.simple-nav\{position:relative;z-index:2;.*background:#071426/s);
  assert.match(assetChecklistSource, /\.checklist-hero\{display:grid;.*background:radial-gradient/s);
  assert.match(assetChecklistSource, /overflow-x:clip/);
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
  assert.match(intakeSource, /Submit Launch Readiness Checklist/);

  for (const name of ['race_name', 'contact_name', 'contact_email', 'event_date', 'event_location', 'registration_url']) {
    assert.match(intakeSource, new RegExp(`name="${name}"[^>]*required`));
  }

  for (const name of ['organization_name', 'contact_phone', 'template_preference', 'registration_platform', 'registration_status', 'pricing_confidence', 'distances_pricing', 'course_logistics', 'bq_certification', 'race_schedule', 'sponsors', 'faqs', 'assets_link', 'domain_dns_status', 'domain_email_status', 'analytics_search_status', 'final_approver', 'analytics_access_notes', 'optional_notes']) {
    assert.match(intakeSource, new RegExp(`name="${name}"`));
  }
});

test('intake page uses inline required markers and Launch Readiness confirm-edit framing', () => {
  assert.match(intakeSource, /Confirm public race facts/);
  assert.match(intakeSource, /correct anything stale here/);
  assert.match(intakeSource, /Confirm what we found, then fill the gaps/);
  assert.match(intakeSource, /public facts StartLine found/);
  assert.match(intakeSource, /“I don’t know yet” options/);
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
  assert.match(intakeSource, /<legend class="visually-hidden">Confirm public race facts<\/legend>/);
  assert.match(intakeSource, /<h2 id="race-details-title" class="fieldset-title">Confirm public race facts<\/h2>/);
  assert.match(intakeSource, /<h2 id="registration-details-title" class="fieldset-title">Confirm registration truth and race details<\/h2>/);
  assert.match(intakeSource, /<h2 id="content-assets-title" class="fieldset-title">Assets, access owners, and launch approvals<\/h2>/);
  assert.match(intakeSource, /\.visually-hidden\{position:absolute!important/);
  assert.match(intakeSource, /\.fieldset-title\{/);
  assert.doesNotMatch(intakeSource, /legend\{font-family:"Instrument Serif"/);
});

test('intake textareas are tall enough for long placeholder guidance', () => {
  for (const [name, rows] of [
    ['distances_pricing', 5],
    ['course_logistics', 5],
    ['race_schedule', 5],
    ['sponsors', 5],
    ['faqs', 5],
    ['optional_notes', 5],
  ]) {
    assert.match(intakeSource, new RegExp(`name="${name}" rows="${rows}" class="textarea-large"`));
  }
  assert.match(intakeSource, /textarea\{line-height:1\.5;min-height:140px;resize:vertical\}/);
  assert.match(intakeSource, /\.textarea-large\{min-height:170px\}/);
  assert.match(intakeSource, /@media\(max-width:760px\).*\.textarea-large\{min-height:170px\}/s);
  assert.match(intakeSource, /Marathon \$120; Half \$95; 5K \$35/);
  assert.doesNotMatch(intakeSource, /Community builds can use a simple logistics section/);
});

test('intake page includes mobile spacing and lighter optional admin notes', () => {
  assert.match(intakeSource, /padding:56px clamp\(18px,5vw,56px\) calc\(96px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(intakeSource, /\.intake-hero\{display:grid;.*background:radial-gradient/s);
  assert.match(intakeSource, /@media\(max-width:760px\).*\.intake-hero\{padding:30px 22px 26px;border-radius:28px/s);
  assert.match(intakeSource, /scroll-margin-block:24px calc\(112px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(intakeSource, /overflow-x:clip/);
  assert.match(intakeSource, /font-size:16px/);
  assert.match(intakeSource, /@media\(max-width:1080px\)/);
  assert.match(intakeSource, /@media\(max-width:760px\)/);
  assert.match(intakeSource, /\.intake-workspace\{display:grid;grid-template-columns:minmax\(0,1fr\) 330px/);
  assert.match(intakeSource, /\.trust-row\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(intakeSource, /\.trust-row\{grid-template-columns:1fr\}/);
  assert.match(intakeSource, /class="field-hint">Filename, folder note, or “choose best available.”/);
  assert.match(intakeSource, /placeholder="Shared folder URL"/);
  assert.match(intakeSource, /<details class="optional-group">/);
  assert.match(intakeSource, /<summary>Optional notes for access owners<\/summary>/);
});
