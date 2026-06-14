create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  stripe_event_id text not null,
  event_type text not null,
  stripe_created timestamptz,
  livemode boolean,
  processing_status text not null default 'processing',
  ignored_reason text,
  error_message text,

  checkout_session_id text,
  payment_intent_id text,
  stripe_customer_id text,

  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz
);

create unique index if not exists stripe_webhook_events_stripe_event_id_idx
  on public.stripe_webhook_events (stripe_event_id);

create index if not exists stripe_webhook_events_created_at_idx
  on public.stripe_webhook_events (created_at desc);

create index if not exists stripe_webhook_events_processing_status_idx
  on public.stripe_webhook_events (processing_status);

create index if not exists stripe_webhook_events_event_type_idx
  on public.stripe_webhook_events (event_type);

create index if not exists stripe_webhook_events_checkout_session_id_idx
  on public.stripe_webhook_events (checkout_session_id)
  where checkout_session_id is not null;

alter table public.stripe_webhook_events enable row level security;

drop trigger if exists set_stripe_webhook_events_updated_at on public.stripe_webhook_events;
create trigger set_stripe_webhook_events_updated_at
before update on public.stripe_webhook_events
for each row
execute function public.set_updated_at();

alter table public.audit_requests
  add column if not exists deposit_paid_at timestamptz;

create index if not exists audit_requests_deposit_paid_at_idx
  on public.audit_requests (deposit_paid_at desc)
  where deposit_paid_at is not null;

create unique index if not exists audit_requests_stripe_checkout_session_id_idx
  on public.audit_requests (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists audit_requests_stripe_payment_intent_id_idx
  on public.audit_requests (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.customer_records
  add column if not exists kickoff_status text not null default 'not_started',
  add column if not exists intake_status text not null default 'not_sent',
  add column if not exists intake_sent_at timestamptz;

create index if not exists customer_records_kickoff_status_idx
  on public.customer_records (kickoff_status);

create index if not exists customer_records_intake_status_idx
  on public.customer_records (intake_status);

create index if not exists customer_records_primary_contact_email_idx
  on public.customer_records (lower(primary_contact_email));

create unique index if not exists customer_records_stripe_checkout_session_id_idx
  on public.customer_records (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists customer_records_stripe_deposit_payment_intent_id_idx
  on public.customer_records (stripe_deposit_payment_intent_id)
  where stripe_deposit_payment_intent_id is not null;

comment on table public.stripe_webhook_events is 'Private audit trail for Stripe webhook deliveries and processing outcomes.';
comment on column public.customer_records.kickoff_status is 'Post-deposit kickoff automation state: not_started, ready, started, blocked, complete.';
comment on column public.customer_records.intake_status is 'Post-deposit intake state: not_sent, ready_to_send, sent, received, incomplete, complete.';
