import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const auditFormScript = await readFile(new URL('../src/scripts/auditForm.ts', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

test('deposit success handoff points customers to intake, asset checklist, and support', () => {
  assert.match(auditFormScript, /Deposit received — here is what happens next\./);
  assert.match(auditFormScript, /href="\/intake\/"/);
  assert.match(auditFormScript, /href="\/asset-checklist\/"/);
  assert.match(auditFormScript, /mailto:support@startlinesites\.com/);
  assert.match(auditFormScript, /The build timeline starts after complete intake details and usable assets are received\./);
});

test('deposit cancelled handoff remains reassuring and routes to pricing and audit', () => {
  assert.match(auditFormScript, /checkout was not completed/);
  assert.match(auditFormScript, /href="\/#pricing"/);
  assert.match(auditFormScript, /href="\/#audit"/);
  assert.match(auditFormScript, /Request a private audit/);
});

test('checkout status actions have responsive button styling', () => {
  assert.match(indexSource, /checkout-status-actions/);
  assert.match(indexSource, /@media\(max-width:640px\).*checkout-status-actions/s);
});
