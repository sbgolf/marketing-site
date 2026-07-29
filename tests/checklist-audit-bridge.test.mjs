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

test('checklist page adds a simple race website scorecard interpretation', () => {
  const scorecardSection = checklistSource.match(/<section class="scorecard-section"[\s\S]*?<\/section>/)?.[0] ?? '';

  assert.match(scorecardSection, /2-minute scorecard/);
  assert.match(scorecardSection, /Give each category 0, 1, or 2 points/);
  assert.match(checklistSource, /Several runner-decision gaps/);
  assert.match(checklistSource, /Usable, but likely leaking clarity/);
  assert.match(checklistSource, /Strong foundation to polish/);
  assert.doesNotMatch(scorecardSection, /broken site|failing|guarantee|guaranteed|increase registrations|registration lift|traffic lift|revenue lift/i);
});

test('checklist bridge copy avoids shame and unsupported urgency claims', () => {
  assert.doesNotMatch(
    bridgeSection,
    /broken site|failing|costing you registrations|urgent|immediately|guarantee|guaranteed|increase registrations|registration lift|traffic lift|revenue lift/i
  );
});
