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

test('audit form current URL wiring stays intact', () => {
  assert.match(indexSource, /<label for="currentUrl">Current race site or registration URL<\/label>/);
  assert.match(
    indexSource,
    /<input id="currentUrl" name="currentUrl" type="url" inputmode="url" autocomplete="url" placeholder="https:\/\/\.\.\." aria-describedby="currentUrlHelp" required \/>/,
  );
  assert.match(indexSource, /<input id="packageTier" name="packageTier" type="hidden" value="" \/>/);
  assert.match(indexSource, /<input id="companyWebsite" name="companyWebsite" type="text" tabindex="-1" autocomplete="off" \/>/);
  assert.match(indexSource, /<div class="form-msg" id="formMsg" role="status" aria-live="polite"><\/div>/);

  assert.match(auditFormSource, /current_url: String\(formData\.get\('currentUrl'\) \|\| ''\)/);
  assert.match(auditFormSource, /company_website: String\(formData\.get\('companyWebsite'\) \|\| ''\)/);
  assert.match(auditFormSource, /fetch\('\/.netlify\/functions\/submit-audit-request'/);
  assert.match(auditFormSource, /if \(!form\.checkValidity\(\)\)/);
});
