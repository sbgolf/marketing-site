import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const indexSource = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

test('homepage keeps SEO and performance discipline in the condensed proof section', () => {
  assert.doesNotMatch(indexSource, /<section class="technical-proof"/);
  assert.match(indexSource, /Performance and SEO discipline included\./);
  assert.match(indexSource, /Every build is structured around fast pages, mobile clarity, schema\.org Event\/SportsEvent markup, Google Search Console setup, GA4, and tracked registration clicks/);
  assert.match(indexSource, /built for search, speed, and signups/i);
});

test('homepage avoids unapproved ranking guarantees and numeric performance scores', () => {
  assert.match(indexSource, /No fake testimonials, borrowed logos, or guaranteed lifts\./);
  assert.doesNotMatch(indexSource, /Lighthouse Score/);
  assert.doesNotMatch(indexSource, /<span class="score">\d+<\/span>/);
  assert.doesNotMatch(indexSource, /guaranteed rankings?/i);
  assert.doesNotMatch(indexSource, /guaranteed traffic/i);
  assert.doesNotMatch(indexSource, /promise(s|d)? (rankings?|traffic lifts?)/i);
});
