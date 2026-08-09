-- Phase 3B-1 controlled transaction-safety remediation.
-- Additive-only migration: supports resumable Stripe events, audit submission idempotency,
-- durable outreach send attempts, and deterministic alert dedupe.

alter table public.stripe_webhook_events
  add column if not exists processing_claim_id text,
  add column if not exists processing_claimed_at timestamptz,
  add column if not exists processing_attempts integer not null default 0;

create index if not exists stripe_webhook_events_retryable_idx
  on public.stripe_webhook_events (processing_status, updated_at)
  where processing_status in ('processing', 'failed_retryable', 'failed_terminal');

alter table public.audit_requests
  add column if not exists submission_idempotency_key text,
  add column if not exists submission_idempotency_response jsonb;

create unique index if not exists audit_requests_submission_idempotency_key_idx
  on public.audit_requests (submission_idempotency_key)
  where submission_idempotency_key is not null;

create table if not exists public.outreach_send_attempts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  business_key text not null,
  attempt_status text not null default 'claimed',
  provider text not null default 'resend',
  provider_message_id text,
  generation_job_id uuid,
  prospect_id uuid,
  outreach_id uuid references public.race_mockup_outreach(id) on delete set null,
  recipient_emails text[] not null default '{}'::text[],
  campaign_id text,
  approved_send_version text,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  constraint outreach_send_attempts_status_check check (
    attempt_status in ('claimed', 'sending', 'sent', 'delivery_unknown', 'failed_safe_to_retry', 'cancelled')
  )
);

create unique index if not exists outreach_send_attempts_business_key_idx
  on public.outreach_send_attempts (business_key);

create index if not exists outreach_send_attempts_status_idx
  on public.outreach_send_attempts (attempt_status, updated_at);

create trigger set_outreach_send_attempts_updated_at
before update on public.outreach_send_attempts
for each row
execute function public.set_updated_at();

alter table public.outreach_send_attempts enable row level security;

create table if not exists public.transaction_reconciliation_alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  anomaly_key text not null,
  anomaly_state text not null,
  last_alerted_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists transaction_reconciliation_alerts_key_state_idx
  on public.transaction_reconciliation_alerts (anomaly_key, anomaly_state)
  where resolved_at is null;

create trigger set_transaction_reconciliation_alerts_updated_at
before update on public.transaction_reconciliation_alerts
for each row
execute function public.set_updated_at();

alter table public.transaction_reconciliation_alerts enable row level security;

comment on table public.outreach_send_attempts is 'Phase 3B-1 durable pre-send attempts. Ambiguous provider outcomes are delivery_unknown and require reconciliation before resend.';
comment on column public.audit_requests.submission_idempotency_key is 'Opaque public audit form submission token; no PII; one token maps to one logical audit request.';
comment on table public.transaction_reconciliation_alerts is 'Minimal alert-dedupe state for deterministic transaction reconciliation monitor.';
