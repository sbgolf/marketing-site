import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const intakeSource = await readFile(new URL('../src/pages/intake.astro', import.meta.url), 'utf8');
const assetChecklistSource = await readFile(new URL('../src/pages/asset-checklist.astro', import.meta.url), 'utf8');

test('intake page is framed as a customer kickoff resource with prospect escape routes', () => {
  assert.match(intakeSource, /Customer Kickoff Intake — StartLine Sites/);
  assert.match(intakeSource, /Customer kickoff resource/);
  assert.match(intakeSource, /Complete this form after your private audit, package recommendation, and StartLine kickoff/);
  assert.match(intakeSource, /Not a customer yet\?/);
  assert.match(intakeSource, /href="\/#audit">Request a private audit/);
  assert.match(intakeSource, /href="\/#pricing">View pricing/);
  assert.match(intakeSource, /href="\/sample-audit\/">See sample audit/);
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
