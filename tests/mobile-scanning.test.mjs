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

test('mobile CSS stacks scan units and CTAs at narrow widths', () => {
  assert.match(indexSource, /@media\(max-width:520px\)/);
  assert.match(indexSource, /\.scan-list,\.audit-scan-list\{grid-template-columns:1fr\}/);
  assert.match(indexSource, /\.section-cta\{display:grid\}/);
  assert.match(baseCss, /\.lead-stack\{display:grid;gap:12px/);
});
