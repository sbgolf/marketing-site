import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const redirectsPath = path.join(repoRoot, 'public/_redirects');

const expectedRedirects = new Map([
  ['/pricing/', { to: '/#pricing', status: '301' }],
  ['/audit/', { to: '/#audit', status: '301' }],
  ['/private-audit/', { to: '/#audit', status: '301' }],
  ['/checklist/', { to: '/race-website-checklist/', status: '301' }],
]);

const parseRedirects = async () => {
  const redirects = await readFile(redirectsPath, 'utf8');
  return redirects
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [from, to, status] = line.split(/\s+/);
      return { from, to, status };
    });
};

test('likely guessed paths redirect to the relevant live page or section', async () => {
  const redirects = await parseRedirects();

  for (const [from, expected] of expectedRedirects) {
    const match = redirects.find((redirect) => redirect.from === from);
    assert.ok(match, `Missing redirect for ${from}`);
    assert.equal(match.to, expected.to, `${from} should redirect to ${expected.to}`);
    assert.equal(match.status, expected.status, `${from} should use a permanent redirect`);
  }
});

test('redirect targets resolve to existing built routes or homepage anchors', async () => {
  const redirects = await parseRedirects();

  for (const { to } of redirects) {
    if (to.startsWith('/#')) {
      await access(path.join(repoRoot, 'src/pages/index.astro'));
      continue;
    }

    const route = to.replace(/^\//, '').replace(/\/$/, '');
    await access(path.join(repoRoot, 'src/pages', `${route}.astro`));
  }
});
