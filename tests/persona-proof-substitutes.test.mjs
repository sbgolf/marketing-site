import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const outreachSource = await readFile(new URL('../src/pages/[outreachSlug].astro', import.meta.url), 'utf8');
const outreachData = await readFile(new URL('../src/data/outreachLandingPages.ts', import.meta.url), 'utf8');

const personaSegments = [
  {
    slug: 'for-community-races',
    cue: 'Local logistics checklist',
    copy: 'volunteer asks'
  },
  {
    slug: 'for-marathons',
    cue: 'Certification and course review',
    copy: 'certification or qualifying notes'
  },
  {
    slug: 'for-runsignup-races',
    cue: 'Checkout handoff cue',
    copy: 'Keep registration, payments, waivers, participant records, and race operations in RunSignup'
  },
  {
    slug: 'for-race-directors',
    cue: 'Workload scan',
    copy: 'repeated runner questions'
  }
];

test('each persona page has a segment-specific process proof substitute', () => {
  assert.match(outreachSource, /<section class="process-proof-section" aria-labelledby="process-proof-title">/);
  assert.match(outreachSource, /page\.processProof\.cues\.map/);

  for (const segment of personaSegments) {
    const pageChunk = outreachData.match(new RegExp(`slug: '${segment.slug}'[\\s\\S]*?(?=\\n  },\\n  \\{|\\n  }\\n\\];)`))?.[0] ?? '';

    assert.match(pageChunk, /processProof: \{/);
    assert.match(pageChunk, new RegExp(segment.cue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(pageChunk, new RegExp(segment.copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('persona proof substitutes stay evidence-safe and generic', () => {
  const proofChunks = [...outreachData.matchAll(/processProof: \{[\s\S]*?\n    },/g)].map((match) => match[0]);
  assert.equal(proofChunks.length, 4);

  for (const chunk of proofChunks) {
    assert.match(chunk, /audit|review|check|map|inventory/i);
    assert.doesNotMatch(
      chunk,
      /customer logo|case stud|screenshot|our customers|client said|guarantee|guaranteed|increase registrations|registration lift|traffic lift|revenue lift/i
    );
  }

  assert.match(outreachData, /generic handoff map, not a claim of customer proof/);
  assert.match(outreachData, /not fabricated quotes, unsupported examples, or promised registration outcomes/);
});

test('persona CTAs still route only to the audit and sample audit paths', () => {
  assert.match(outreachSource, /<a class="btn btn-accent" href="\/#audit">\{page\.primaryCta\} →<\/a>/);
  assert.match(outreachSource, /<a class="btn btn-ghost" href="\/sample-audit\/">\{page\.secondaryCta\}<\/a>/);
  assert.match(outreachSource, /<a class="btn btn-accent" href="\/#audit">Request a private audit →<\/a>/);
  assert.match(outreachSource, /<a class="btn btn-ghost" href="\/sample-audit\/">See sample audit<\/a>/);

  const processSection = outreachSource.match(/<section class="process-proof-section"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.doesNotMatch(processSection, /href=/);
});

test('process proof cards stack before tablet/mobile widths', () => {
  assert.match(outreachSource, /\.process-proof-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(outreachSource, /@media\(max-width:980px\)/);
  assert.match(outreachSource, /\.process-proof-grid,\.platform-flow\{grid-template-columns:1fr\}/);
});
