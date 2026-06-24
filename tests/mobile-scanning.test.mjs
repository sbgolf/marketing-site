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

test('mobile CSS stacks scan units and CTAs at narrow widths', () => {
  assert.match(indexSource, /@media\(max-width:520px\)/);
  assert.match(indexSource, /\.scan-list,\.audit-scan-list\{grid-template-columns:1fr\}/);
  assert.match(indexSource, /\.section-cta\{display:grid\}/);
  assert.match(indexSource, /\.segment-grid\{grid-template-columns:1fr\}/);
  assert.match(indexSource, /\.segment-link\{align-self:stretch;justify-content:center;text-align:center\}/);
  assert.match(baseCss, /\.lead-stack\{display:grid;gap:12px/);
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

test('homepage footer groups buyer, kickoff, and credibility links distinctly', () => {
  for (const label of ['Buyer resources', 'Race fit pages', 'Customer kickoff', 'Company / credibility']) {
    assert.match(indexSource, new RegExp(label.replace('/', '\\/')));
  }

  for (const href of [
    '#audit',
    '#pricing',
    '#faq',
    '#problem',
    '/sample-audit/',
    '/race-website-checklist/',
    '/after-year-one/',
    '/for-race-directors/',
    '/for-community-races/',
    '/for-marathons/',
    '/for-runsignup-races/',
    '/intake/',
    '/asset-checklist/'
  ]) {
    assert.match(indexSource, new RegExp(`href="${href.replaceAll('/', '\\/')}"`));
  }

  assert.match(indexSource, /class="foot-cta"/);
  assert.match(indexSource, /Request a private audit<\/a><a class="foot-secondary" href="\/sample-audit\/">See sample audit/);
  assert.match(indexSource, /\.foot\{grid-template-columns:1fr;gap:28px\}/);
  assert.match(indexSource, /\.foot-cta\{display:grid\}/);
});
