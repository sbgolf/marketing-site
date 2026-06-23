import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const textFileExtensions = new Set(['.astro', '.html', '.md', '.ts', '.js', '.mjs']);

const publicAndDepositFacingTargets = [
  'src/pages',
  'src/layouts',
  'src/data',
  'brand-marketing-site.html',
  // Internal location, but these files are designed to be copied into prospect/customer follow-up.
  'docs/internal/proposals',
  'docs/internal/kickoff',
];

const forbiddenPublicPricingPhrases = [
  {
    label: 'required monthly retainer',
    pattern: /\brequired\s+monthly\s+retainers?\b/i,
  },
  {
    label: 'monthly retainer required',
    pattern: /\bmonthly\s+retainers?\s+(?:is\s+|are\s+)?required\b/i,
  },
  {
    label: 'mandatory monthly retainer',
    pattern: /\bmandatory\s+monthly\s+retainers?\b/i,
  },
  {
    label: 'required monthly support plan',
    pattern: /\brequired\s+monthly\s+support\s+plans?\b/i,
  },
  {
    label: 'monthly support plan required',
    pattern: /\bmonthly\s+support\s+plans?\s+(?:is\s+|are\s+)?required\b/i,
  },
  {
    label: 'monthly subscription framing',
    pattern: /\bmonthly\s+subscriptions?\b/i,
  },
  {
    label: 'recurring subscription framing',
    pattern: /\brecurring\s+subscriptions?\b/i,
  },
  {
    label: 'automatic subscription framing',
    pattern: /\bautomatic\s+subscriptions?\b/i,
  },
  {
    label: 'recurring monthly payment framing',
    pattern: /\brecurring\s+monthly\s+(?:payment|fee|charge|plan|subscription)s?\b/i,
  },
  {
    label: 'locked into monthly service framing',
    pattern: /\blocked\s+into\s+(?:a\s+)?monthly\s+(?:plan|retainer|subscription|service)\b/i,
  },
];

const expectedOneTimePackageSignals = [
  /one-time\s+first-year/i,
  /race-cycle/i,
  /optional\s+one-time\s+services/i,
];

const listFiles = async (target) => {
  const fullPath = path.join(repoRoot, target);
  const stats = await stat(fullPath);

  if (stats.isFile()) {
    return [fullPath];
  }

  const entries = await readdir(fullPath, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(target, entry.name);
    if (entry.isDirectory()) return listFiles(entryPath);
    if (!entry.isFile()) return [];
    return [path.join(repoRoot, entryPath)];
  }));

  return files.flat();
};

const lineAndColumnFor = (content, index) => {
  const before = content.slice(0, index);
  const lines = before.split('\n');
  return {
    line: lines.length,
    column: lines.at(-1).length + 1,
  };
};

const scanFile = async (filePath) => {
  if (!textFileExtensions.has(path.extname(filePath))) return [];

  const content = await readFile(filePath, 'utf8');
  const failures = [];

  for (const { label, pattern } of forbiddenPublicPricingPhrases) {
    const match = pattern.exec(content);
    if (!match) continue;

    const { line, column } = lineAndColumnFor(content, match.index);
    failures.push({
      file: path.relative(repoRoot, filePath),
      line,
      column,
      label,
      match: match[0],
    });
  }

  return failures;
};

test('public and deposit-facing pricing copy avoids monthly-retainer/subscription framing', async () => {
  const files = (await Promise.all(publicAndDepositFacingTargets.map(listFiles))).flat();
  const failures = (await Promise.all(files.map(scanFile))).flat();

  assert.deepEqual(
    failures,
    [],
    `Forbidden pricing copy found:\n${failures
      .map((failure) => `- ${failure.file}:${failure.line}:${failure.column} ${failure.label}: “${failure.match}”`)
      .join('\n')}`,
  );
});

test('homepage pricing copy keeps one-time first-year race-cycle signals', async () => {
  const homepage = await readFile(path.join(repoRoot, 'src/pages/index.astro'), 'utf8');

  for (const signal of expectedOneTimePackageSignals) {
    assert.match(homepage, signal);
  }
});
