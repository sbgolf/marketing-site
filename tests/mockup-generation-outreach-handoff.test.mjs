import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOutreachInputFromGenerationJob,
  buildPreparedMockupOutreach,
  extractProspectEmails,
  validateGenerationJobSendReadiness,
} from '../scripts/lib/mockup-generation-outreach-handoff.mjs';

const generationJob = {
  id: 'job-123',
  prospect_id: '11111111-2222-4333-8444-555555555555',
  job_status: 'mockup_rendered',
  template: 'community',
  mockup_token: '0123456789abcdef0123456789abcdef',
  mockup_url: 'https://mockups.startlinesites.com/private/mockups/0123456789abcdef0123456789abcdef/',
  config_path: 'src/data/private-mockups/example-hometown-5k.json',
  pull_request_url: 'https://github.com/sbgolf/race-templates/pull/12',
  deploy_preview_url: 'https://deploy-preview-12--startline-race-templates.netlify.app/private/mockups/0123456789abcdef0123456789abcdef/',
  source_bundle: {
    race_name: 'Example Hometown 5K',
    race_slug: 'example-hometown-5k',
    source_url: 'https://runsignup.com/Race/TN/Nashville/ExampleHometown5K',
    source_platform: 'runsignup',
    registration_url: 'https://runsignup.com/Race/TN/Nashville/ExampleHometown5K',
    registration_platform: 'runsignup',
    registration_race_id: '12345',
  },
  qa_status: 'passed',
  site_auditor_status: 'passed',
  owner_approval_status: 'approved_to_send',
};

const prospect = {
  id: '11111111-2222-4333-8444-555555555555',
  race_city: 'Nashville',
  race_state: 'TN',
  official_url: 'https://examplehometown5k.test',
  contact_sources: [
    { type: 'email', email: 'director@example.test' },
    { type: 'form', url: 'https://runsignup.com/Race/Contact/TN/Nashville/ExampleHometown5K' },
  ],
};

test('generation-job outreach handoff extracts prospect contact emails', () => {
  assert.deepEqual(extractProspectEmails({
    contact_email: 'Owner@Example.test',
    contact_sources: [{ email: 'Director@Example.test' }, 'team@example.test'],
  }), ['owner@example.test', 'director@example.test', 'team@example.test']);
});

test('generation-job outreach handoff requires QA, Site Auditor, owner approval, and explicit send flag', () => {
  assert.deepEqual(validateGenerationJobSendReadiness({
    ...generationJob,
    qa_status: 'not_started',
    site_auditor_status: 'not_requested',
    owner_approval_status: 'not_requested',
  }, { ownerApprovedSend: false }), [
    'generation job qa_status must be passed/approved before outreach; received not_started.',
    'generation job site_auditor_status must be passed/approved before outreach; received not_requested.',
    'generation job owner_approval_status must be approved before outreach; received not_requested.',
    'explicit --owner-approved-send is required for this race-director send.',
  ]);
});

test('generation-job outreach handoff builds send-gate input from approved job and prospect', () => {
  const input = buildOutreachInputFromGenerationJob({ generationJob, prospect });

  assert.equal(input.raceName, 'Example Hometown 5K');
  assert.equal(input.mockupTemplate, 'community');
  assert.equal(input.mockupUrl, 'https://mockups.startlinesites.com/private/mockups/0123456789abcdef0123456789abcdef/');
  assert.equal(input.registrationPlatform, 'runsignup');
  assert.equal(input.registrationRaceId, '12345');
  assert.deepEqual(input.toEmails, ['director@example.test']);
  assert.equal(input.metadata.generation_job_id, 'job-123');
  assert.equal(input.metadata.race_template_pr_url, 'https://github.com/sbgolf/race-templates/pull/12');
});

test('generation-job outreach handoff prepares branded dry-run payload without sending', () => {
  const prepared = buildPreparedMockupOutreach({
    generationJob,
    prospect,
    ownerApprovedSend: true,
    overrides: { contactName: 'Taylor' },
  });

  assert.equal(prepared.ok, true);
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.email.html_checks, 'passed');
  assert.match(prepared.email.text, /Hi Taylor/);
  assert.match(prepared.email.text, /Review the private mockup:/);
  assert.equal(prepared.payload.outreach_status, 'approved_ready_to_send');
  assert.equal(prepared.payload.mockup_template, 'community');
  assert.deepEqual(prepared.payload.to_emails, ['director@example.test']);
  assert.ok(prepared.duplicate_filters.some((filter) => filter.includes('mockup_url=eq.')));
});

test('generation-job outreach handoff blocks duplicate-send jobs and rejected customer copy', () => {
  const prepared = buildPreparedMockupOutreach({
    generationJob: { ...generationJob, outreach_id: 'already-sent' },
    prospect,
    ownerApprovedSend: true,
    overrides: { subject: 'A no-index mockup from Bailey' },
  });

  assert.equal(prepared.ok, false);
  assert.ok(prepared.errors.some((error) => error.includes('already has outreach_id')));
  assert.ok(prepared.errors.some((error) => error.includes('no-index')));
  assert.ok(prepared.errors.some((error) => error.includes('Bailey')));
});
