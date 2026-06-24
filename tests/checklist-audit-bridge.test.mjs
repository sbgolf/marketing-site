import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const checklistSource = await readFile(new URL('../src/pages/race-website-checklist.astro', import.meta.url), 'utf8');

const bridgeSection = checklistSource.match(/<section class="interpretation-bridge"[\s\S]*?<\/section>/)?.[0] ?? '';

test('checklist page interprets yellow/red results before the next action', () => {
  assert.match(bridgeSection, /Interpret your score/);
  assert.match(bridgeSection, /If two or more areas feel yellow or red/);
  assert.match(bridgeSection, /a private audit can help prioritize the next fixes/);
  assert.match(bridgeSection, /does not mean your current site is broken/);
});

test('checklist interpretation bridge routes to approved audit and sample-audit CTAs', () => {
  assert.match(bridgeSection, /<a class="btn btn-accent" href="\/#audit">Request a private audit<\/a>/);
  assert.match(bridgeSection, /<a class="btn btn-ghost" href="\/sample-audit\/">See sample audit<\/a>/);
});

test('checklist bridge copy avoids shame and unsupported urgency claims', () => {
  assert.doesNotMatch(
    bridgeSection,
    /broken site|failing|costing you registrations|urgent|immediately|guarantee|guaranteed|increase registrations|registration lift|traffic lift|revenue lift/i
  );
});
