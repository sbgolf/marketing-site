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

test('homepage uses grouped parent navigation so the header stays uncluttered', () => {
  assert.doesNotMatch(indexSource, /<summary>Explore<\/summary>/);
  assert.match(indexSource, /<summary>Services<\/summary>/);
  assert.match(indexSource, /<summary>Resources<\/summary>/);

  for (const [href, label] of [
    ['/for-race-directors/', 'Explore StartLine services for race directors'],
    ['/for-community-races/', 'Explore StartLine services for community races'],
    ['/for-marathons/', 'Explore StartLine services for marathons and BQ races'],
    ['/for-runsignup-races/', 'Explore StartLine services for RunSignup and platform-hosted races'],
    ['/after-year-one/', 'Read about optional after-year-one services'],
    ['/sample-audit/', 'Preview a sample StartLine private audit'],
    ['/race-website-checklist/', 'Open the race website checklist'],
    ['#proof-points', 'Jump to StartLine proof approach'],
    ['#how', 'Jump to how StartLine works'],
    ['#faq', 'Jump to frequently asked questions']
  ]) {
    assert.match(indexSource, new RegExp(`<a href="${href.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}" aria-label="${label}">`));
  }
});

test('homepage condensation moves heavy demo sections off the homepage', () => {
  for (const removedSection of [
    /<section class="section-purpose-strip"/,
    /<section class="templates" id="templates"/,
    /<section class="sponsor-value" id="sponsors"/,
    /<section class="proof community-before-after" id="mockups"/,
    /<section class="proof performance-before-after" id="performance-mockup"/,
    /<section class="technical-proof"/,
    /<section class="launch-timeline"/,
    /<section class="audit-path"/
  ]) {
    assert.doesNotMatch(indexSource, removedSection);
  }

  assert.match(indexSource, /Proof without pretend testimonials/);
  assert.match(indexSource, /Example deliverable/);
  assert.match(indexSource, /Pricing/);
});

test('homepage parent navigation preserves key resource and service destinations', () => {
  for (const href of [
    '#pricing',
    '/for-race-directors/',
    '/for-community-races/',
    '/for-marathons/',
    '/for-runsignup-races/',
    '/after-year-one/',
    '/sample-audit/',
    '/race-website-checklist/',
    '#proof-points',
    '#how',
    '#faq'
  ]) {
    assert.match(indexSource, new RegExp(`href="${href.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}"`));
  }

  assert.doesNotMatch(indexSource, /href="#templates"/);
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
  assert.match(indexSource, /\.field input,\.field textarea\{display:block;width:100%;max-width:100%;min-width:0/);
  assert.match(indexSource, /\.field input\[type="date"\]\{-webkit-appearance:none;appearance:none\}/);
  assert.match(indexSource, /\.field input,\.field textarea\{min-height:52px\}/);
  assert.match(indexSource, /\.field label\{line-height:1\.35\}/);
  assert.match(indexSource, /\.section-purpose-links a\{min-height:64px;padding:14px 16px\}/);
  assert.match(indexSource, /\.faq-q\{[^}]*display:grid;grid-template-columns:minmax\(0,1fr\) 26px/);
  assert.match(indexSource, /\.pm\{width:26px;height:26px;min-width:26px;justify-self:end/);
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

test('homepage footer mirrors services and resources without crowding the header', () => {
  for (const label of ['Services', 'Resources', 'Customer kickoff', 'Company / credibility']) {
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
