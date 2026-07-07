import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const intakeSource = await readFile(new URL('../src/pages/intake.astro', import.meta.url), 'utf8');
const assetChecklistSource = await readFile(new URL('../src/pages/asset-checklist.astro', import.meta.url), 'utf8');
const accessGuidesSource = await readFile(new URL('../src/pages/access-guides.astro', import.meta.url), 'utf8');
const stagingReviewSource = await readFile(new URL('../src/pages/staging-review.astro', import.meta.url), 'utf8');
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
  assert.match(accessGuidesSource, /canonicalPath="\/access-guides"/);
  assert.match(accessGuidesSource, /noindex=\{true\}/);
  assert.match(stagingReviewSource, /canonicalPath="\/staging-review"/);
  assert.match(stagingReviewSource, /noindex=\{true\}/);
});

test('customer kickoff pages are excluded from generated sitemap output', () => {
  assert.match(astroConfigSource, /['"]\/access-guides\/['"]/);
  assert.match(astroConfigSource, /['"]\/intake\/['"]/);
  assert.match(astroConfigSource, /['"]\/staging-review\/['"]/);
  assert.match(astroConfigSource, /['"]\/asset-checklist\/['"]/);
  assert.match(astroConfigSource, /filter: \(page\) => !sitemapExcludedPaths\.some/);
});

test('access guides page gives nontechnical Launch Readiness access help without password sharing', () => {
  assert.match(accessGuidesSource, /Customer Access Guides — StartLine Sites/);
  assert.match(accessGuidesSource, /Launch Readiness access guides/);
  assert.match(accessGuidesSource, /Tell us who owns access\. Do not send passwords\./);
  assert.match(accessGuidesSource, /Owner \+ status \+ next step/);
  assert.match(accessGuidesSource, /Race keeps ownership/);
  assert.match(accessGuidesSource, /Delegated access or screenshare/);
  assert.match(accessGuidesSource, /No passwords by email/);
  assert.match(accessGuidesSource, /These guides are for post-deposit Launch Readiness/);
  assert.match(accessGuidesSource, /href="\/intake">Open Launch Readiness Checklist/);
});

test('access guides cover launch dependency groups and safe answer examples', () => {
  for (const label of ['Domain / DNS owner', 'Domain email safety', 'GA4 / Search Console ownership', 'Registration link and status', 'Current-site access']) {
    assert.match(accessGuidesSource, new RegExp(label.replace(/[\/]/g, '\\/')));
  }
  assert.match(accessGuidesSource, /Do not email domain passwords/);
  assert.match(accessGuidesSource, /Do not change mail records casually/);
  assert.match(accessGuidesSource, /We track public site visits and registration-click intent only/);
  assert.match(accessGuidesSource, /Open, closed, sold out, waitlist, transfer-only, access-code, or coming-soon status/);
  assert.match(accessGuidesSource, /do not send credentials unless StartLine explicitly asks through a safe path/);
  assert.match(accessGuidesSource, /“I don’t know yet” is a valid Launch Readiness answer/);
});

test('access guide links and mobile layout guards stay in place', () => {
  assert.match(intakeSource, /href="\/access-guides">Access guides/);
  assert.match(assetChecklistSource, /href="\/access-guides">Access guides/);
  assert.match(accessGuidesSource, /href="\/asset-checklist">Asset hub/);
  assert.match(accessGuidesSource, /class="guide-layout" aria-label="Customer access guide workspace"/);
  assert.match(accessGuidesSource, /class="index-links"/);
  assert.match(accessGuidesSource, /class="guide-grid" aria-label="Nontechnical access guides"/);
  assert.match(accessGuidesSource, /overflow-x:clip/);
  assert.match(accessGuidesSource, /@media\(max-width:1080px\).*\.guide-layout\{grid-template-columns:1fr\}/s);
  assert.match(accessGuidesSource, /@media\(max-width:760px\).*\.index-links\{grid-template-columns:1fr\}/s);
});

test('staging review page separates review feedback from explicit launch approval', () => {
  assert.match(stagingReviewSource, /Staging Review Checklist — StartLine Sites/);
  assert.match(stagingReviewSource, /Staging review handoff/);
  assert.match(stagingReviewSource, /Review the staging site once\. Approve launch only when it is safe\./);
  assert.match(stagingReviewSource, /Staging ready is not launch approved/);
  assert.match(stagingReviewSource, /Staging ready for review/);
  assert.match(stagingReviewSource, /Approved for public launch/);
  assert.match(stagingReviewSource, /one consolidated race-team review/);
  assert.match(stagingReviewSource, /one consolidated list/);
  assert.match(stagingReviewSource, /one final approver/);
  assert.match(stagingReviewSource, /href="\/#audit">Request a private audit/);
});

test('staging review page explains when staging exists and where customer inputs go first', () => {
  assert.match(stagingReviewSource, /Before staging exists/);
  assert.match(stagingReviewSource, /StartLine creates the private staging preview after Launch Readiness/);
  assert.match(stagingReviewSource, /There is not one permanent staging preview for every customer/);
  assert.match(stagingReviewSource, /Once those inputs are clear enough to build, StartLine sends your private staging preview link/);
  assert.match(stagingReviewSource, /Tell us what only your team knows/);
  assert.match(stagingReviewSource, /confirm date, distances, pricing, registration status, policies, sponsors, approvals, and the final decision maker/);
  assert.match(stagingReviewSource, /Point us to assets and account owners/);
  assert.match(stagingReviewSource, /DNS owner, domain email, analytics\/search ownership, current site access, and registration platform status/);
  assert.match(stagingReviewSource, /href="\/intake">Open Launch Readiness Checklist/);
  assert.match(stagingReviewSource, /href="\/asset-checklist">Asset Hub/);
  assert.match(stagingReviewSource, /href="\/access-guides">Access Guides/);
});

test('staging review page locks conversion and launch safety approval checks', () => {
  for (const label of ['Registration conversion truth', 'Race facts runners trust', 'Launch safety gates']) {
    assert.match(stagingReviewSource, new RegExp(label));
  }
  assert.match(stagingReviewSource, /Registration button goes to the correct public destination/);
  assert.match(stagingReviewSource, /Prices, provider fees, deadlines, refunds, transfer rules, and policy dates/);
  assert.match(stagingReviewSource, /Date, start time, location, distances, and course\/map claims/);
  assert.match(stagingReviewSource, /Sponsor order, logos, photo rights, and required credits/);
  assert.match(stagingReviewSource, /Domain\/DNS owner and launch timing are known/);
  assert.match(stagingReviewSource, /Domain email, MX\/SPF\/DKIM, GA4, and Search Console ownership are protected/);
  assert.match(stagingReviewSource, /Approved for public launch\. Registration status and pricing are current/);
});

test('staging review links and mobile layout guards stay in place', () => {
  assert.match(intakeSource, /href="\/staging-review">Staging review/);
  assert.match(assetChecklistSource, /href="\/staging-review">Staging review/);
  assert.match(accessGuidesSource, /href="\/staging-review">Staging review/);
  assert.match(stagingReviewSource, /class="handoff-layout" aria-label="Customer staging review workspace"/);
  assert.match(stagingReviewSource, /class="check-grid" aria-label="Staging review checklist sections"/);
  assert.match(stagingReviewSource, /overflow-x:clip/);
  assert.match(stagingReviewSource, /@media\(max-width:1080px\).*\.before-staging,\.before-grid,\.handoff-layout\{grid-template-columns:1fr\}/s);
  assert.match(stagingReviewSource, /@media\(max-width:760px\).*\.before-staging\{padding:20px;border-radius:24px\}/s);
  assert.match(stagingReviewSource, /@media\(max-width:760px\).*\.approval-card\{align-items:flex-start;flex-direction:column\}/s);
});

test('asset checklist page is framed as a post-deposit Launch Readiness asset hub with prospect escape routes', () => {
  assert.match(assetChecklistSource, /Launch Readiness Asset Hub — StartLine Sites/);
  assert.match(assetChecklistSource, /Launch Readiness resource/);
  assert.match(assetChecklistSource, /Use this after your deposit to gather one shared folder/);
  assert.match(assetChecklistSource, /label what is best, what is okay, and what still needs permission/);
  assert.match(assetChecklistSource, /This hub is for post-deposit Launch Readiness/);
  assert.match(assetChecklistSource, /href="\/#audit">Request a private audit/);
  assert.match(assetChecklistSource, /href="\/#pricing">View pricing/);
  assert.match(assetChecklistSource, /href="\/sample-audit\/">See sample audit/);
});

test('asset checklist page visually pairs with branded Launch Readiness structure', () => {
  assert.match(assetChecklistSource, /class="trust-row" aria-label="StartLine asset checklist progress"/);
  assert.match(assetChecklistSource, /Deposit received/);
  assert.match(assetChecklistSource, /One folder shared with StartLine/);
  assert.match(assetChecklistSource, /Permissions and gaps tracked before launch/);
  assert.match(assetChecklistSource, /Asset readiness pass/);
  assert.match(assetChecklistSource, /Best \/ okay \/ send what you have/);
  assert.match(assetChecklistSource, /class="prep-card"/);
  assert.match(assetChecklistSource, /class="checklist-workspace" aria-label="Customer asset checklist workspace"/);
  assert.match(assetChecklistSource, /What happens next/);
  assert.match(assetChecklistSource, /one focused follow-up list/);
  assert.match(assetChecklistSource, /public launch waits on rights/);
  assert.match(assetChecklistSource, /\.simple-nav\{position:relative;z-index:2;.*background:#071426/s);
  assert.match(assetChecklistSource, /\.checklist-hero\{display:grid;.*background:radial-gradient/s);
  assert.match(assetChecklistSource, /overflow-x:clip/);
});

test('asset checklist locks best okay send-what-you-have guidance and permission safety', () => {
  assert.match(assetChecklistSource, /class="readiness-tier-card"/);
  assert.match(assetChecklistSource, /Best is ideal\. Okay is useful\. “Send what you have” prevents stalls\./);
  assert.match(assetChecklistSource, /Original files, high resolution, rights confirmed/);
  assert.match(assetChecklistSource, /Usable fallback files, older versions/);
  assert.match(assetChecklistSource, /Contacts, screenshots, old folders/);
  assert.match(assetChecklistSource, /Registration URL and status/);
  assert.match(assetChecklistSource, /open\/closed\/waitlist\/access-code status/);
  assert.match(assetChecklistSource, /Access owners and permissions/);
  assert.match(assetChecklistSource, /do not email passwords/);
  assert.match(assetChecklistSource, /Do not email passwords\. Name the owner who can grant delegated access or schedule a screenshare\./);
  assert.match(assetChecklistSource, /\.tier-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(assetChecklistSource, /@media\(max-width:1080px\).*\.tier-grid\{grid-template-columns:1fr\}/s);
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
