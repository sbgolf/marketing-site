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
  const flowChunk = outreachData.match(/platformFlow: \{[\s\S]*?painPoints:/)?.[0] ?? '';

  assert.match(flowChunk, /RunSignup continues to handle registration, payments, waivers, participant records, and related race operations\./);
  assert.match(flowChunk, /StartLine does not replace RunSignup/);
  assert.match(flowChunk, /does not .*claim a special integration/);
  assert.doesNotMatch(flowChunk, /guarantee|guaranteed|lift|increase registrations|switch away from RunSignup/i);
});

test('platform flow CSS stacks the diagram before tablet/mobile widths', () => {
  assert.match(outreachSource, /\.platform-flow\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(outreachSource, /@media\(max-width:980px\)/);
  assert.match(outreachSource, /\.platform-flow\{grid-template-columns:1fr\}/);
});
