import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGenerationJobQuery,
  buildGenerationJobSendPreparation,
  sendMockupOutreachFromGenerationJob,
} from '../scripts/lib/mockup-generation-send-gate.mjs';

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
  contact_sources: [{ type: 'email', email: 'director@example.test' }],
};

const makeSupabaseStub = ({ duplicates = [] } = {}) => {
  const calls = [];
  const supabaseRequest = async (request) => {
    calls.push(request);
    if (request.path.startsWith('race_mockup_generation_jobs?')) return [generationJob];
    if (request.path.startsWith('race_mockup_prospects?')) return [prospect];
    if (request.path.startsWith('race_mockup_outreach?')) return duplicates;
    if (request.path === 'race_mockup_outreach' && request.method === 'POST') {
      return [{ id: 'outreach-456', ...request.body }];
    }
    if (request.path === 'race_mockup_generation_jobs?id=eq.job-123' && request.method === 'PATCH') {
      return [{ ...generationJob, ...request.body }];
    }
    throw new Error(`Unexpected Supabase request: ${request.method || 'GET'} ${request.path}`);
  };
  return { calls, supabaseRequest };
};

test('generation-job send gate builds a precise Supabase job lookup query', () => {
  assert.equal(
    buildGenerationJobQuery('job-123'),
    'race_mockup_generation_jobs?select=*&id=eq.job-123&limit=1',
  );
});

test('generation-job send gate dry-run fetches Supabase rows and prepares outreach without side effects', async () => {
  const { calls, supabaseRequest } = makeSupabaseStub();

  const result = await sendMockupOutreachFromGenerationJob({
    generationJobId: 'job-123',
    ownerApprovedSend: true,
    dryRun: true,
    overrides: { contactName: 'Taylor' },
    supabaseRequest,
    sendWithResend: async () => { throw new Error('dry-run must not send'); },
  });

  assert.equal(result.ok, true);
  assert.equal(result.dry_run, true);
  assert.equal(result.side_effects, 'none: no email, no Supabase insert, no generation-job mutation');
  assert.equal(result.payload.metadata.generation_job_id, 'job-123');
  assert.equal(result.email.html_checks, 'passed');
  assert.match(result.email.text, /Hi Taylor/);
  assert.match(result.email.text, /As part of this private mockup campaign, StartLine is offering 50% off the first website build for a limited number of selected race organizations\./);
  assert.doesNotMatch(result.email.text, /early partner|early race partner|newly formed|new company|beta/i);
  assert.deepEqual(calls.map((call) => `${call.method || 'GET'} ${call.path}`), [
    'GET race_mockup_generation_jobs?select=*&id=eq.job-123&limit=1',
    'GET race_mockup_prospects?select=*&id=eq.11111111-2222-4333-8444-555555555555&limit=1',
  ]);
});

test('generation-job send gate sends, records outreach, and patches the generation job after provider acceptance', async () => {
  const { calls, supabaseRequest } = makeSupabaseStub();
  const sent = [];

  const result = await sendMockupOutreachFromGenerationJob({
    generationJobId: 'job-123',
    ownerApprovedSend: true,
    dryRun: false,
    overrides: { contactName: 'Taylor' },
    supabaseRequest,
    sendWithResend: async (message) => {
      sent.push(message);
      return { id: 'resend-789' };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.id, 'outreach-456');
  assert.equal(result.resend_email_id, 'resend-789');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'director@example.test');
  assert.match(sent[0].text, /50% off the first website build/);
  assert.match(sent[0].html, /50% off the first website build/);
  assert.doesNotMatch(`${sent[0].text}\n${sent[0].html}`, /early partner|early race partner|newly formed|new company|beta/i);
  assert.ok(calls.some((call) => call.path.startsWith('race_mockup_outreach?select=')));
  assert.ok(calls.some((call) => call.path === 'race_mockup_outreach' && call.method === 'POST'));
  assert.ok(calls.some((call) => call.path === 'race_mockup_generation_jobs?id=eq.job-123' && call.method === 'PATCH' && call.body.outreach_id === 'outreach-456'));
});

test('generation-job send preparation uses D-specific operator portfolio copy and subject', () => {
  const prepared = buildGenerationJobSendPreparation({
    generationJob: {
      ...generationJob,
      metadata: {
        campaign_lane: 'D',
        prospect_type: 'race_management_company',
        email_template_key: 'operator_portfolio_v1',
        operator_event_count: 5,
        segment_evidence: ['5 active/known events tied to this operator.', 'Company describes itself as race/event management or production.'],
      },
    },
    prospect: {
      ...prospect,
      company_name: 'Example Timing Company',
      metadata: { recipient_type: 'company_routing_email' },
    },
    ownerApprovedSend: true,
    overrides: { contactName: 'Morgan' },
  });

  assert.equal(prepared.ok, true);
  assert.equal(prepared.email.subject, 'A private website system idea for Example Timing Company');
  assert.match(prepared.email.text, /give multiple events a clearer runner-facing web front door/);
  assert.match(prepared.email.text, /bigger than one race page/);
  assert.match(prepared.email.text, /clearer portfolio system/);
  assert.doesNotMatch(prepared.email.text, /A free private website mockup for/);
  assert.equal(prepared.payload.metadata.email_template_key, 'operator_portfolio_v1');
});

test('generation-job send preparation blocks D operator template without operator evidence', () => {
  const prepared = buildGenerationJobSendPreparation({
    generationJob: {
      ...generationJob,
      metadata: {
        campaign_lane: 'A',
        prospect_type: 'runsignup_only_community_race',
        email_template_key: 'operator_portfolio_v1',
        operator_event_count: 1,
        segment_evidence: ['Some community race language found.'],
      },
    },
    prospect,
    ownerApprovedSend: true,
  });

  assert.equal(prepared.ok, false);
  assert.ok(prepared.errors.some((error) => error.includes('operator_portfolio_v1 is only allowed for lane')));
  assert.ok(prepared.errors.some((error) => error.includes('operator_event_count >= 3')));
  assert.ok(prepared.errors.some((error) => error.includes('company/org/routing recipient type')));
});

test('generation-job send gate blocks duplicate outreach before sending or mutating rows', async () => {
  const { calls, supabaseRequest } = makeSupabaseStub({ duplicates: [{ id: 'existing-outreach', outreach_status: 'sent' }] });

  const result = await sendMockupOutreachFromGenerationJob({
    generationJobId: 'job-123',
    ownerApprovedSend: true,
    dryRun: false,
    supabaseRequest,
    sendWithResend: async () => { throw new Error('duplicate must not send'); },
  });

  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.reason, 'prior_mockup_outreach_found');
  assert.equal(calls.some((call) => call.path === 'race_mockup_outreach' && call.method === 'POST'), false);
  assert.equal(calls.some((call) => call.path.startsWith('race_mockup_generation_jobs?id=eq.') && call.method === 'PATCH'), false);
});
