import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const indexSource = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

test('homepage explains SEO and performance discipline in race-director language', () => {
  assert.match(indexSource, /Technical credibility/);
  assert.match(indexSource, /Built for search, speed, and signups — without overclaiming results\./);
  assert.match(indexSource, /clean structure, fast pages, metadata\/schema where appropriate, content hierarchy, and analytics readiness/);
  assert.match(indexSource, /Clean structure for people and search engines/);
  assert.match(indexSource, /Fast, mobile-first pages without score theater/);
  assert.match(indexSource, /Metadata and schema where they help/);
  assert.match(indexSource, /Analytics-ready registration paths/);
});

test('homepage avoids unapproved ranking guarantees and numeric performance scores', () => {
  assert.match(indexSource, /No ranking guarantees, traffic promises, or unapproved numeric scores\./);
  assert.doesNotMatch(indexSource, /Lighthouse Score/);
  assert.doesNotMatch(indexSource, /<span class="score">\d+<\/span>/);
  assert.doesNotMatch(indexSource, /guaranteed rankings?/i);
  assert.doesNotMatch(indexSource, /guaranteed traffic/i);
  assert.doesNotMatch(indexSource, /promise(s|d)? (rankings?|traffic lifts?)/i);
});
