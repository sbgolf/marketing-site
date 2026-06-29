import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const indexSource = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const baseCss = await readFile(new URL('../src/styles/base.css', import.meta.url), 'utf8');

test('homepage keeps mobile scanning helpers and post-section audit CTAs', () => {
  assert.match(indexSource, /class="lead-stack"/);
  assert.match(indexSource, /class="scan-list"/);
  assert.match(indexSource, /class="audit-scan-list"/);
  assert.match(indexSource, /class="section-cta reveal"/);
  assert.match(indexSource, /Want the same runner-confidence review on your race site\?/);
  assert.match(indexSource, /Need proof specific to your current site\?/);
});

test('H-09 adds a compact section-purpose jump path before dense proof and pricing sections', () => {
  assert.match(indexSource, /class="section-purpose-strip" aria-label="Fast homepage scan paths"/);
  assert.match(indexSource, /const sectionPurposeLinks = \[/);
  for (const [label, href] of [
    ['Proof', '#proof-points'],
    ['Process', '#how'],
    ['Pricing', '#pricing'],
    ['Audit form', '#audit']
  ]) {
    assert.match(indexSource, new RegExp(`\\['${label}', '${href}'`));
  }
  assert.match(indexSource, /Already know what you need\?/);
  assert.match(indexSource, /go straight to the private audit form/);
});

test('H-09 trims repeated pre-audit disclaimers into shorter scan copy', () => {
  assert.match(indexSource, /Illustrative cards use synthetic assets and respectful before states/);
  assert.match(indexSource, /Illustrative cards use sample details and synthetic assets; the before state shows an opportunity, not a failing\./);
  assert.doesNotMatch(indexSource, /The before\/after cards are illustrative placeholder proof only:[\s\S]*The before state represents normal race-site growth over time/);
  assert.doesNotMatch(indexSource, /These cards are illustrative placeholder proof only,[\s\S]*The before state shows an opportunity to reorganize useful information, not a failing/);
});

test('homepage explore menu section links have explicit accessible names', () => {
  for (const [href, label] of [
    ['#problem', 'Jump to why StartLine matters'],
    ['#fit', 'Jump to who StartLine fits'],
    ['#templates', 'Jump to template examples'],
    ['#proof-points', 'Jump to proof points'],
    ['#how', 'Jump to how StartLine works'],
    ['/after-year-one/', 'Read about after-year-one services'],
    ['/race-website-checklist/', 'Open the race website checklist']
  ]) {
    assert.match(indexSource, new RegExp(`<a href="${href.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}" aria-label="${label}">`));
  }
});

test('homepage hero makes the primary audit path clear', () => {
  assert.match(indexSource, /data-scroll="audit">Request a private audit/);
  assert.match(indexSource, /data-scroll="sample-audit">See sample audit/);
  assert.match(indexSource, /class="hero-journey" aria-label="StartLine private audit path"/);
  assert.match(indexSource, /1\. Request audit/);
  assert.match(indexSource, /2\. Get recommendation/);
  assert.match(indexSource, /3\. Choose next step/);
  assert.match(indexSource, /Audit first\. Deposit only after a clear fit\./);
  assert.doesNotMatch(indexSource, /data-scroll="templates">Explore example templates/);
});

test('homepage hero adds compact evidence-safe trust cues near the first CTA', () => {
  assert.match(indexSource, /const heroTrustCues = \[/);
  assert.match(indexSource, /Why race directors can trust the private audit path/);
  assert.match(indexSource, /Audit-first review/);
  assert.match(indexSource, /No platform switch/);
  assert.match(indexSource, /Proof you can preview/);
  assert.match(indexSource, /href="\/sample-audit\/">Preview the sample audit →/);

  const trustCueChunk = indexSource.match(/const heroTrustCues = \[[\s\S]*?\];/)?.[0] ?? '';
  assert.doesNotMatch(trustCueChunk, /testimonial|customer logo|case stud|guarantee|guaranteed/i);
});

test('mobile CSS stacks scan units and CTAs at narrow widths', () => {
  assert.match(indexSource, /@media\(max-width:520px\)/);
  assert.match(indexSource, /\.hero-trust-cues\{grid-template-columns:1fr\}/);
  assert.match(indexSource, /\.scan-list,\.audit-scan-list\{grid-template-columns:1fr\}/);
  assert.match(indexSource, /\.section-cta\{display:grid\}/);
  assert.match(indexSource, /\.segment-grid\{grid-template-columns:1fr\}/);
  assert.match(indexSource, /\.segment-link\{align-self:stretch;justify-content:center;text-align:center\}/);
  assert.match(indexSource, /\.section-purpose-links\{grid-template-columns:1fr\}/);
  assert.match(indexSource, /\.outcome-card,\.segment-card,\.trust-proof-card,\.technical-proof-card,\.timeline-card,\.audit-path-card\{padding:18px\}/);
  assert.match(indexSource, /\.templates,\.built-for,\.finale,\.trust-proof,\.cred,\.how,\.pricing,\.sample-audit\{padding-top:64px;padding-bottom:64px\}/);
  assert.match(baseCss, /\.lead-stack\{display:grid;gap:12px/);
});

test('M-09 keeps mobile CTAs and audit form controls touch-friendly', () => {
  assert.match(indexSource, /\.hero-trust-link\{[^}]*min-height:44px/);
  assert.match(indexSource, /\.segment-link\{[^}]*min-height:44px/);
  assert.match(indexSource, /\.fit-actions\{display:grid;grid-template-columns:1fr\}/);
  assert.match(indexSource, /\.fit-actions \.btn\{width:100%;justify-content:center;min-height:48px\}/);
  assert.match(indexSource, /\.sample-audit-actions\{display:grid;grid-template-columns:1fr\}/);
  assert.match(indexSource, /\.sample-audit-actions \.btn\{width:100%;justify-content:center;min-height:48px\}/);
  assert.match(indexSource, /\.field input,\.field textarea\{min-height:52px\}/);
  assert.match(indexSource, /\.field label\{line-height:1\.35\}/);
  assert.match(indexSource, /\.section-purpose-links a\{min-height:64px;padding:14px 16px\}/);
});

test('homepage fit cards link to public persona pages without replacing audit CTA', () => {
  for (const [href, label] of [
    ['/for-community-races/', 'Explore community race website fit'],
    ['/for-marathons/', 'Explore marathon website fit'],
    ['/for-runsignup-races/', 'Explore RunSignup marketing layer fit'],
    ['/for-race-directors/', 'Explore race director website fit']
  ]) {
    assert.match(indexSource, new RegExp(`personaHref: '${href}'`));
    assert.match(indexSource, new RegExp(`personaLabel: '${label}'`));
  }

  assert.match(indexSource, /<a class="segment-link" href=\{item\.personaHref\}>\{item\.personaLabel\} →<\/a>/);
  assert.match(indexSource, /<div class="fit-actions"><button class="btn btn-accent" data-scroll="audit">Request a private audit<\/button><a class="btn btn-ghost" href="\/sample-audit\/">See sample audit<\/a><\/div>/);
});

test('homepage qualification copy respectfully explains who StartLine is not for', () => {
  assert.match(indexSource, /Who this is not for/);
  assert.match(indexSource, /StartLine is a marketing website layer, not every race-operations tool\./);

  for (const phrase of [
    'Custom registration software',
    'Same-day emergency rebuilds',
    'Real-time race operations',
    'Unlimited edits or open-ended retainers'
  ]) {
    assert.match(indexSource, new RegExp(phrase));
  }

  assert.match(indexSource, /not the replacement for that operations system/);
  assert.match(indexSource, /private audit will say so when that is the better next step/);
  const notForChunk = indexSource.match(/const notForGuidance = \[[\s\S]*?\];/)?.[0] ?? '';
  assert.doesNotMatch(notForChunk, /guarantee|guaranteed|must buy|unlimited support/i);
});

test('homepage footer groups buyer, race, kickoff, and credibility links', () => {
  for (const label of ['Buyer resources', 'For race types', 'Customer kickoff', 'Company / credibility']) {
    assert.match(indexSource, new RegExp(`<div class="foot-title">${label}<\\/div>`));
  }

  for (const href of [
    '#pricing',
    '/sample-audit/',
    '/race-website-checklist/',
    '/after-year-one/',
    '/for-race-directors/',
    '/for-community-races/',
    '/for-marathons/',
    '/for-runsignup-races/',
    '/intake/',
    '/asset-checklist/',
    '#proof-points'
  ]) {
    assert.match(indexSource, new RegExp(`href="${href.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}"`));
  }

  assert.match(indexSource, /class="btn btn-accent foot-primary" data-scroll="audit">Request a private audit/);
  assert.match(indexSource, /@media\(max-width:520px\)\{\.foot\{grid-template-columns:1fr\}/);
});
