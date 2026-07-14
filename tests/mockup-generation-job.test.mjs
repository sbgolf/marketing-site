import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGenerationJobInputFromConfig,
  buildGenerationJobLookupFilters,
  buildGenerationJobPayload,
  buildMockupUrl,
  mockupTokenFromConfig,
  validateGenerationJobInput,
} from '../scripts/lib/mockup-generation-job.mjs';

const prospectId = '11111111-2222-4333-8444-555555555555';
const config = {
  identity: {
    template: 'community',
    name: 'Example Hometown 5K',
    slug: 'example-hometown-5k',
  },
  event: {
    date: '2026-10-03',
    location: 'Nashville, TN',
  },
  registration: {
    url: 'https://runsignup.com/Race/TN/Nashville/ExampleHometown5K',
    platform: 'runsignup',
  },
  private_mockup: {
    access_token: '0123456789abcdef0123456789abcdef',
    route: '/private/mockups/0123456789abcdef0123456789abcdef/',
    noindex: true,
    template: 'community',
    source_url: 'https://runsignup.com/Race/TN/Nashville/ExampleHometown5K',
    source_platform: 'runsignup',
    source_race_id: '12345',
    registration_race_id: '12345',
    owner_approved_for_generation: true,
    prospect_score: 84,
    qualification_reason: 'Strong local/community language.',
    source_urls: ['https://runsignup.com/Race/TN/Nashville/ExampleHometown5K'],
    provenance: {
      source_confirmed_sections: ['identity', 'event', 'distances', 'registration'],
    },
  },
};

test('generation job input derives token and production mockup URL from generated config', () => {
  const input = buildGenerationJobInputFromConfig(config, {
    prospectId,
    mockupBaseUrl: 'https://mockups.startlinesites.com/',
    configPath: 'src/data/private-mockups/example-hometown-5k.json',
    branchName: 'feat/example-hometown-5k-mockup',
  });

  assert.equal(input.prospectId, prospectId);
  assert.equal(input.template, 'community');
  assert.equal(input.mockupToken, '0123456789abcdef0123456789abcdef');
  assert.equal(input.mockupUrl, 'https://mockups.startlinesites.com/private/mockups/0123456789abcdef0123456789abcdef/');
  assert.equal(input.jobStatus, 'config_generated');
  assert.equal(input.qaStatus, 'not_started');
  assert.equal(input.siteAuditorStatus, 'not_requested');
  assert.equal(input.sourceBundle.race_name, 'Example Hometown 5K');
  assert.equal(input.sourceBundle.registration_race_id, '12345');
  assert.equal(input.metadata.owner_approved_for_generation, true);
  assert.equal(input.metadata.prospect_score, 84);
});

test('generation job payload matches Supabase generation-job table fields', () => {
  const input = buildGenerationJobInputFromConfig(config, {
    prospectId,
    mockupBaseUrl: 'https://mockups.startlinesites.com',
    configPath: 'src/data/private-mockups/example-hometown-5k.json',
    pullRequestUrl: 'https://github.com/sbgolf/race-templates/pull/1',
    deployPreviewUrl: 'https://deploy-preview-1--startline-race-templates.netlify.app/private/mockups/0123456789abcdef0123456789abcdef/',
  });
  assert.deepEqual(validateGenerationJobInput(input), []);

  const payload = buildGenerationJobPayload(input);
  assert.equal(payload.prospect_id, prospectId);
  assert.equal(payload.job_status, 'config_generated');
  assert.equal(payload.template, 'community');
  assert.equal(payload.mockup_token, '0123456789abcdef0123456789abcdef');
  assert.equal(payload.mockup_url, 'https://mockups.startlinesites.com/private/mockups/0123456789abcdef0123456789abcdef/');
  assert.equal(payload.config_path, 'src/data/private-mockups/example-hometown-5k.json');
  assert.equal(payload.pull_request_url, 'https://github.com/sbgolf/race-templates/pull/1');
  assert.equal(payload.qa_status, 'not_started');
  assert.deepEqual(payload.source_bundle.source_urls, ['https://runsignup.com/Race/TN/Nashville/ExampleHometown5K']);
});

test('generation job validation fails closed without prospect id or public mockup URL', () => {
  assert.deepEqual(validateGenerationJobInput({}), [
    'prospectId must be a Supabase UUID.',
    'template is required.',
    'mockupToken is required.',
    'mockupUrl is required.',
  ]);

  assert.deepEqual(validateGenerationJobInput({
    prospectId,
    template: 'performance',
    mockupToken: 'token',
    mockupUrl: 'ftp://mockups.startlinesites.com/private/mockups/token/',
  }), [
    'template must be community for the current pilot.',
    'mockupUrl must be http(s).',
  ]);
});

test('generation job lookup filters support idempotent upsert', () => {
  const payload = buildGenerationJobPayload(buildGenerationJobInputFromConfig(config, {
    prospectId,
    mockupBaseUrl: 'https://mockups.startlinesites.com',
  }));
  const filters = buildGenerationJobLookupFilters(payload).join('\n');
  assert.match(filters, /mockup_url=eq\.https%3A%2F%2Fmockups\.startlinesites\.com/);
  assert.match(filters, /prospect_id=eq\.11111111-2222-4333-8444-555555555555/);
  assert.match(filters, /mockup_token=eq\.0123456789abcdef0123456789abcdef/);
});

test('mockup URL and token helpers accept explicit URL or route-based config', () => {
  assert.equal(mockupTokenFromConfig(config), '0123456789abcdef0123456789abcdef');
  assert.equal(buildMockupUrl({ mockupUrl: 'https://example.test/custom/' }), 'https://example.test/custom/');
  assert.equal(buildMockupUrl({ mockupBaseUrl: 'https://mockups.startlinesites.com/', route: 'private/mockups/token/' }), 'https://mockups.startlinesites.com/private/mockups/token/');
});
