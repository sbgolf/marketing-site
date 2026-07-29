import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const outreachSource = await readFile(new URL('../src/pages/[outreachSlug].astro', import.meta.url), 'utf8');
const outreachData = await readFile(new URL('../src/data/outreachLandingPages.ts', import.meta.url), 'utf8');

test('RunSignup page includes an accessible marketing-to-checkout flow diagram', () => {
  assert.match(outreachData, /slug: 'for-runsignup-races'/);
  assert.match(outreachData, /Marketing path first\. RunSignup checkout stays in place\./);
  assert.match(outreachData, /Search, social, and email/);
  assert.match(outreachData, /StartLine race website/);
  assert.match(outreachData, /RunSignup registration checkout/);
  assert.match(outreachSource, /<ol class="platform-flow" aria-label="Runner path from discovery to registration checkout">/);
});

test('RunSignup flow copy keeps registration and payment operations in RunSignup', () => {
  const flowChunk = outreachData.match(/platformFlow: \{[\s\S]*?campaignOffer:/)?.[0] ?? '';

  assert.match(flowChunk, /RunSignup continues to handle registration, payments, waivers, participant records, and related race operations\./);
  assert.match(flowChunk, /StartLine does not replace RunSignup/);
  assert.match(flowChunk, /does not .*claim a special integration/);
  assert.doesNotMatch(flowChunk, /guarantee|guaranteed|lift|increase registrations|switch away from RunSignup/i);
});

test('RunSignup page includes immediate campaign pain and outcome hooks', () => {
  const runSignupChunk = outreachData.match(/campaignOffer: \{[\s\S]*?\n    },\n    painPoints:/)?.[0] ?? '';

  assert.match(outreachSource, /<section class="campaign-offer-section" aria-labelledby="campaign-offer-title">/);
  assert.match(runSignupChunk, /Three race-director pains this page can speak to directly/);
  assert.match(runSignupChunk, /Runners keep asking basic questions/);
  assert.match(runSignupChunk, /Sponsors and community partners are present/);
  assert.match(runSignupChunk, /Facebook posts or a platform listing/);
  assert.match(runSignupChunk, /Position StartLine as the marketing layer that complements RunSignup/);
  assert.doesNotMatch(runSignupChunk, /guaranteed rankings|guaranteed traffic|double registrations|special integration|switch away from RunSignup|registration lift/i);
});

test('platform and campaign CSS stacks diagrams before tablet/mobile widths', () => {
  assert.match(outreachSource, /\.platform-flow\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(outreachSource, /\.campaign-offer-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(outreachSource, /@media\(max-width:980px\)/);
  assert.match(outreachSource, /\.process-proof-grid,\.platform-flow,\.campaign-offer-grid\{grid-template-columns:1fr\}/);
});
