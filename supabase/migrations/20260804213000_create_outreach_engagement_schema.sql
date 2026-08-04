create table if not exists public.outreach_engagement_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  provider text not null default 'resend',
  provider_event_id text not null,
  provider_message_id text,
  resend_email_id text,

  outreach_id uuid references public.race_mockup_outreach(id) on delete set null,
  prospect_id uuid references public.race_mockup_prospects(id) on delete set null,
  generation_job_id uuid references public.race_mockup_generation_jobs(id) on delete set null,

  event_type text not null,
  event_timestamp timestamptz not null,

  recipient_email_hash text,
  recipient_email_masked text,
  clicked_url text,
  campaign_id text,
  raw_event jsonb not null default '{}'::jsonb,

  constraint outreach_engagement_events_provider_check check (provider in ('resend')),
  constraint outreach_engagement_events_provider_event_id_check check (length(trim(provider_event_id)) > 0),
  constraint outreach_engagement_events_type_check check (
    event_type in ('delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'suppressed')
  ),
  constraint outreach_engagement_events_clicked_url_check check (clicked_url is null or clicked_url ~ '^https?://')
);

create unique index if not exists outreach_engagement_events_provider_event_key
  on public.outreach_engagement_events (provider, provider_event_id);

create index if not exists outreach_engagement_events_provider_message_id_idx
  on public.outreach_engagement_events (provider_message_id)
  where provider_message_id is not null;

create index if not exists outreach_engagement_events_resend_email_id_idx
  on public.outreach_engagement_events (resend_email_id)
  where resend_email_id is not null;

create index if not exists outreach_engagement_events_outreach_id_idx
  on public.outreach_engagement_events (outreach_id)
  where outreach_id is not null;

create index if not exists outreach_engagement_events_event_type_idx
  on public.outreach_engagement_events (event_type);

create index if not exists outreach_engagement_events_event_timestamp_idx
  on public.outreach_engagement_events (event_timestamp desc);

create index if not exists outreach_engagement_events_recipient_email_hash_idx
  on public.outreach_engagement_events (recipient_email_hash)
  where recipient_email_hash is not null;

create index if not exists outreach_engagement_events_campaign_id_idx
  on public.outreach_engagement_events (campaign_id)
  where campaign_id is not null;

create table if not exists public.outreach_suppressions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  recipient_email_hash text not null,
  recipient_email_masked text,
  reason text not null,
  source_provider text,
  source_event_id uuid references public.outreach_engagement_events(id) on delete set null,
  source_outreach_id uuid references public.race_mockup_outreach(id) on delete set null,
  notes text,

  constraint outreach_suppressions_recipient_hash_check check (length(trim(recipient_email_hash)) > 0),
  constraint outreach_suppressions_reason_check check (
    reason in ('bounce', 'complaint', 'unsubscribe', 'negative_reply', 'wrong_contact', 'manual_suppression')
  ),
  constraint outreach_suppressions_source_provider_check check (source_provider is null or source_provider in ('resend', 'manual'))
);

create unique index if not exists outreach_suppressions_recipient_email_hash_key
  on public.outreach_suppressions (recipient_email_hash);

create index if not exists outreach_suppressions_reason_idx
  on public.outreach_suppressions (reason);

create index if not exists outreach_suppressions_source_outreach_id_idx
  on public.outreach_suppressions (source_outreach_id)
  where source_outreach_id is not null;

alter table public.race_mockup_outreach
  add column if not exists delivered_at timestamptz,
  add column if not exists first_opened_at timestamptz,
  add column if not exists last_opened_at timestamptz,
  add column if not exists open_count integer not null default 0,
  add column if not exists first_clicked_at timestamptz,
  add column if not exists last_clicked_at timestamptz,
  add column if not exists click_count integer not null default 0,
  add column if not exists clicked_urls text[] not null default '{}'::text[],
  add column if not exists bounced_at timestamptz,
  add column if not exists complained_at timestamptz,
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists suppressed_at timestamptz,
  add column if not exists engagement_status text not null default 'no_activity',
  add column if not exists follow_up_reason text,
  add column if not exists last_engagement_at timestamptz,
  add column if not exists campaign_id text,
  add column if not exists campaign_lane text,
  add column if not exists campaign_wave text,
  add column if not exists send_gate_version text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'race_mockup_outreach_open_count_check'
      and conrelid = 'public.race_mockup_outreach'::regclass
  ) then
    alter table public.race_mockup_outreach
      add constraint race_mockup_outreach_open_count_check check (open_count >= 0) not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'race_mockup_outreach_click_count_check'
      and conrelid = 'public.race_mockup_outreach'::regclass
  ) then
    alter table public.race_mockup_outreach
      add constraint race_mockup_outreach_click_count_check check (click_count >= 0) not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'race_mockup_outreach_engagement_status_check'
      and conrelid = 'public.race_mockup_outreach'::regclass
  ) then
    alter table public.race_mockup_outreach
      add constraint race_mockup_outreach_engagement_status_check check (
        engagement_status in ('suppressed', 'bounced', 'negative_reply', 'replied', 'clicked', 'opened', 'delivered', 'no_activity')
      ) not valid;
  end if;
end $$;

alter table public.race_mockup_outreach validate constraint race_mockup_outreach_open_count_check;
alter table public.race_mockup_outreach validate constraint race_mockup_outreach_click_count_check;
alter table public.race_mockup_outreach validate constraint race_mockup_outreach_engagement_status_check;

create index if not exists race_mockup_outreach_engagement_status_idx
  on public.race_mockup_outreach (engagement_status, last_engagement_at desc);

create index if not exists race_mockup_outreach_campaign_id_idx
  on public.race_mockup_outreach (campaign_id)
  where campaign_id is not null;

drop trigger if exists set_outreach_suppressions_updated_at on public.outreach_suppressions;
create trigger set_outreach_suppressions_updated_at
before update on public.outreach_suppressions
for each row
execute function public.set_updated_at();

alter table public.outreach_engagement_events enable row level security;
alter table public.outreach_suppressions enable row level security;

comment on table public.outreach_engagement_events is 'Append-only normalized StartLine outreach engagement event log for provider webhooks and owner reporting.';
comment on column public.outreach_engagement_events.provider_event_id is 'Provider-supplied or stable derived idempotency key; unique with provider.';
comment on column public.outreach_engagement_events.raw_event is 'Sanitized provider payload only; never store webhook secrets, signatures, auth headers, or API credentials.';
comment on table public.outreach_suppressions is 'Internal suppression list that must block future StartLine outreach before any Resend side effect.';
comment on column public.race_mockup_outreach.engagement_status is 'Derived owner-reporting status; suppression/negative signals must override opens and clicks.';
comment on column public.race_mockup_outreach.campaign_id is 'Optional campaign/wave identifier carried through send, webhook, aggregation, and reporting.';
