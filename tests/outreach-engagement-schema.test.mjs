import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = [
  '../supabase/migrations/20260804213000_create_outreach_engagement_schema.sql',
  '../supabase/migrations/20260804224500_add_outreach_next_follow_up_at.sql',
].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

const normalized = migration.replace(/\s+/g, ' ').toLowerCase();

test('outreach engagement schema creates idempotent raw event log with canonical Resend events', () => {
  assert.match(migration, /create table if not exists public\.outreach_engagement_events/);
  assert.match(migration, /provider_event_id text not null/);
  assert.match(migration, /provider_message_id text/);
  assert.match(migration, /resend_email_id text/);
  assert.match(migration, /outreach_id uuid references public\.race_mockup_outreach\(id\) on delete set null/);
  assert.match(migration, /prospect_id uuid references public\.race_mockup_prospects\(id\) on delete set null/);
  assert.match(migration, /generation_job_id uuid references public\.race_mockup_generation_jobs\(id\) on delete set null/);
  assert.match(migration, /raw_event jsonb not null default '\{\}'::jsonb/);
  assert.match(normalized, /event_type in \('delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'suppressed'\)/);
  assert.match(migration, /create unique index if not exists outreach_engagement_events_provider_event_key\s+on public\.outreach_engagement_events \(provider, provider_event_id\)/);
});

test('outreach suppression schema is fail-closed for future send gates', () => {
  assert.match(migration, /create table if not exists public\.outreach_suppressions/);
  assert.match(migration, /recipient_email_hash text not null/);
  assert.match(normalized, /reason in \('bounce', 'complaint', 'unsubscribe', 'negative_reply', 'wrong_contact', 'manual_suppression'\)/);
  assert.match(migration, /create unique index if not exists outreach_suppressions_recipient_email_hash_key\s+on public\.outreach_suppressions \(recipient_email_hash\)/);
  assert.match(migration, /source_event_id uuid references public\.outreach_engagement_events\(id\) on delete set null/);
  assert.match(migration, /source_outreach_id uuid references public\.race_mockup_outreach\(id\) on delete set null/);
});

test('race_mockup_outreach receives engagement aggregate fields and precedence status constraint', () => {
  for (const field of [
    'delivered_at',
    'first_opened_at',
    'last_opened_at',
    'open_count',
    'first_clicked_at',
    'last_clicked_at',
    'click_count',
    'clicked_urls',
    'bounced_at',
    'complained_at',
    'unsubscribed_at',
    'suppressed_at',
    'engagement_status',
    'next_follow_up_at',
    'follow_up_reason',
    'last_engagement_at',
    'campaign_id',
    'campaign_lane',
    'campaign_wave',
    'send_gate_version',
  ]) {
    assert.match(normalized, new RegExp(`add column if not exists ${field}`));
  }

  assert.match(normalized, /engagement_status in \('suppressed', 'bounced', 'negative_reply', 'replied', 'clicked', 'opened', 'delivered', 'no_activity'\)/);
  assert.match(migration, /race_mockup_outreach_engagement_status_idx/);
  assert.match(migration, /race_mockup_outreach_campaign_id_idx/);
});

test('new engagement tables keep row level security enabled and document sensitive payload hygiene', () => {
  assert.match(migration, /alter table public\.outreach_engagement_events enable row level security/);
  assert.match(migration, /alter table public\.outreach_suppressions enable row level security/);
  assert.match(migration, /never store webhook secrets, signatures, auth headers, or API credentials/i);
  const liveSecretPatterns = [
    'RESEND' + '_API_KEY\\s*=',
    'SUPABASE' + '_SERVICE_ROLE_KEY\\s*=',
    'sk_' + 'live',
    'cs_' + 'live',
  ];
  assert.doesNotMatch(migration, new RegExp(liveSecretPatterns.join('|')));
});
