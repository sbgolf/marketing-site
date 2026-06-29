import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const indexSource = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const auditFormSource = await readFile(new URL('../src/scripts/auditForm.ts', import.meta.url), 'utf8');

test('audit form current URL helper clarifies accepted public links', () => {
  assert.match(
    indexSource,
    /<p class="field-help" id="currentUrlHelp">Race website, RunSignup, Race Roster\/BikeReg, other registration-platform page, placeholder page, or best public link all work\.<\/p>/,
  );

  for (const phrase of [
    'Race website',
    'RunSignup',
    'Race Roster/BikeReg',
    'registration-platform page',
    'placeholder page',
    'best public link',
  ]) {
    assert.match(indexSource, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('audit form support fallback appears near form without changing wiring', () => {
  assert.match(indexSource, /Form not fitting your situation\? Email/);
  assert.match(indexSource, /mailto:support@startlinesites\.com\?subject=Private%20audit%20fallback/);
  assert.match(indexSource, /with your race name and best public link/);
  assert.match(auditFormSource, /email support@startlinesites\.com with your race name and best public link/);
});

test('audit form no-sales-call reassurance appears without blocking optional package conversation', () => {
  assert.match(indexSource, /<p class="sales-reassurance"><strong>No sales call required for the audit\.<\/strong> You’ll get a written review within 2 business days first, and we can talk only if a package looks like a fit\.<\/p>/);
  assert.match(indexSource, /responds within 2 business days/);
  assert.match(indexSource, /private written review/);

  assert.match(auditFormSource, /written review within 2 business days[\s\S]*no sales call required for the audit/);
  assert.match(auditFormSource, /No deposit is required for the audit response/);
});

test('audit form current URL wiring stays intact', () => {
  assert.match(indexSource, /<form class="audit-form" id="auditForm">/);
  assert.match(indexSource, /<label for="currentUrl">Current race site or registration URL<\/label>/);
  assert.match(
    indexSource,
    /<input id="currentUrl" name="currentUrl" type="url" inputmode="url" autocomplete="url" placeholder="https:\/\/\.\.\." aria-describedby="currentUrlHelp" required \/>/,
  );
  assert.match(indexSource, /<input id="raceName" name="raceName" type="text"[^>]+required \/>/);
  assert.match(indexSource, /<input id="auditName" name="auditName" type="text"[^>]+required \/>/);
  assert.match(indexSource, /<input id="auditEmail" name="auditEmail" type="email"[^>]+required \/>/);
  assert.match(indexSource, /<input id="packageTier" name="packageTier" type="hidden" value="" \/>/);
  assert.match(indexSource, /<textarea id="notes" name="notes" rows="3" maxlength="1200"/);
  assert.match(indexSource, /<input id="companyWebsite" name="companyWebsite" type="text" tabindex="-1" autocomplete="off" \/>/);
  assert.match(indexSource, /<button type="submit" class="btn btn-accent">Send audit request →<\/button>/);
  assert.match(indexSource, /<div class="form-msg" id="formMsg" role="status" aria-live="polite"><\/div>/);

  assert.match(auditFormSource, /race_name: String\(formData\.get\('raceName'\) \|\| ''\)/);
  assert.match(auditFormSource, /current_url: String\(formData\.get\('currentUrl'\) \|\| ''\)/);
  assert.match(auditFormSource, /contact_name: String\(formData\.get\('auditName'\) \|\| ''\)/);
  assert.match(auditFormSource, /contact_email: String\(formData\.get\('auditEmail'\) \|\| ''\)/);
  assert.match(auditFormSource, /notes: String\(formData\.get\('notes'\) \|\| ''\)/);
  assert.match(auditFormSource, /company_website: String\(formData\.get\('companyWebsite'\) \|\| ''\)/);
  assert.match(auditFormSource, /package_tier: isPackageKey\(selectedTier\) \? selectedTier : ''/);
  assert.match(auditFormSource, /fetch\('\/.netlify\/functions\/submit-audit-request'/);
  assert.match(auditFormSource, /if \(!form\.checkValidity\(\)\)/);
});

test('audit form hides honeypot and shows unmistakable success overlay copy', () => {
  assert.match(indexSource, /<div class="field hp-field" hidden aria-hidden="true">/);
  assert.match(indexSource, /\.hp-field\{display:none!important;position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;/);
  assert.match(auditFormSource, /className = 'audit-success-overlay'/);
  assert.match(auditFormSource, /role', 'dialog'/);
  assert.match(auditFormSource, /Your private audit request is in\./);
  assert.match(auditFormSource, /email a written review within 2 business days/);
  assert.match(auditFormSource, /Steve reviews the findings before your response is sent/);
  assert.match(indexSource, /Every recommendation is tied to specific outcomes we identify on your current site, with a private written response before any deposit decision\./);
  assert.doesNotMatch(indexSource, /Every mockup direction is tied to specific outcomes/);
});
