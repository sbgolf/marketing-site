import assert from 'node:assert/strict';
import test from 'node:test';

import { renderCustomerIntakeConfirmationEmail } from '../netlify/functions/submit-customer-intake.mjs';
import { handler as unsubscribeHandler } from '../netlify/functions/unsubscribe.mjs';
import {
  createSignedUnsubscribeUrl,
  verifySignedUnsubscribeToken,
} from '../netlify/functions/lib/unsubscribe-link.mjs';

const withEnv = async (env, fn) => {
  const previous = {};
  for (const key of Object.keys(env)) previous[key] = process.env[key];
  Object.assign(process.env, env);
  try {
    await fn();
  } finally {
    for (const key of Object.keys(env)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
};

test('signed unsubscribe URL is used in branded email footer when recipient and secret are available', async () => {
  await withEnv({
    STARTLINE_POSTAL_ADDRESS: 'PO Box 123, Nashville, TN 37201',
    STARTLINE_SITE_URL: 'https://startlinesites.com',
    UNSUBSCRIBE_SECRET: 'test-secret',
  }, async () => {
    const { html, text } = renderCustomerIntakeConfirmationEmail({
      row: {
        contact_name: 'Taylor',
        contact_email: 'director@example.com',
        race_name: 'Ocean Marathon',
      },
      checklistUrl: 'https://startlinesites.com/asset-checklist',
    });

    assert.match(html, /href="https:\/\/startlinesites\.com\/\.netlify\/functions\/unsubscribe\?p=[^"]+&amp;s=[^"]+"/);
    assert.match(text, /Unsubscribe: https:\/\/startlinesites\.com\/\.netlify\/functions\/unsubscribe\?p=/);
    assert.match(`${html}\n${text}`, /PO Box 123, Nashville, TN 37201/);
  });
});

test('signed unsubscribe token verifies the intended recipient', async () => {
  await withEnv({ UNSUBSCRIBE_SECRET: 'test-secret', STARTLINE_SITE_URL: 'https://startlinesites.com' }, async () => {
    const signedUrl = createSignedUnsubscribeUrl({
      recipientEmail: 'Director@Example.com',
      campaignId: 'mockup-outreach',
      createdAt: '2026-08-08T12:00:00.000Z',
    });
    const url = new URL(signedUrl);
    const verification = verifySignedUnsubscribeToken({
      payload: url.searchParams.get('p'),
      signature: url.searchParams.get('s'),
    });

    assert.equal(verification.ok, true);
    assert.equal(verification.email, 'director@example.com');
    assert.equal(verification.campaignId, 'mockup-outreach');
  });
});

test('unsubscribe function records suppression without exposing raw recipient email', async () => {
  await withEnv({
    UNSUBSCRIBE_SECRET: 'test-secret',
    SUPABASE_URL: 'https://supabase.example',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  }, async () => {
    const signedUrl = createSignedUnsubscribeUrl({ recipientEmail: 'director@example.com', campaignId: 'mockup-outreach' });
    const url = new URL(signedUrl);
    const calls = [];
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async (requestUrl, options = {}) => {
      calls.push({ url: requestUrl.toString(), body: JSON.parse(options.body) });
      if (requestUrl.toString().includes('outreach_engagement_events')) {
        return new Response(JSON.stringify([{ id: '11111111-1111-4111-8111-111111111111' }]), { status: 200 });
      }
      return new Response('', { status: 200 });
    };

    try {
      const response = await unsubscribeHandler({
        httpMethod: 'GET',
        queryStringParameters: {
          p: url.searchParams.get('p'),
          s: url.searchParams.get('s'),
        },
      });

      assert.equal(response.statusCode, 200);
      assert.match(response.body, /You are unsubscribed/);
      assert.equal(calls.length, 2);
      assert.equal(calls[0].body.event_type, 'unsubscribed');
      assert.equal(calls[1].body.reason, 'unsubscribe');
      assert.equal(calls[1].body.recipient_email_masked, 'di***[at]example.com');
      assert.doesNotMatch(JSON.stringify(calls), /director@example\.com/);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});
