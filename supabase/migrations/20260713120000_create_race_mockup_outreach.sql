create table if not exists public.race_mockup_outreach (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  race_name text not null,
  race_slug text not null,
  race_city text,
  race_state text,
  official_url text,
  official_domain text,
  registration_url text,
  registration_platform text,
  registration_race_id text,

  mockup_url text not null,
  mockup_token text,
  mockup_template text not null,
  mockup_verified_at timestamptz,

  outreach_status text not null default 'sent',
  sent_at timestamptz,
  subject text,
  resend_email_id text,
  from_email text,
  reply_to_email text,
  to_emails text[] not null default '{}'::text[],
  cc_emails text[] not null default '{}'::text[],
  bcc_emails text[] not null default '{}'::text[],
  contact_sources jsonb not null default '[]'::jsonb,
  notes text,

  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  response_status text,
  owner text,
  metadata jsonb not null default '{}'::jsonb,

  constraint race_mockup_outreach_mockup_url_check check (mockup_url ~ '^https?://'),
  constraint race_mockup_outreach_status_check check (
    outreach_status in ('drafted', 'approved', 'sent', 'replied', 'bounced', 'do_not_contact', 'archived')
  ),
  constraint race_mockup_outreach_response_status_check check (
    response_status is null or response_status in ('none', 'positive', 'neutral', 'not_interested', 'bounced', 'do_not_contact')
  )
);

create index if not exists race_mockup_outreach_created_at_idx
  on public.race_mockup_outreach (created_at desc);

create index if not exists race_mockup_outreach_status_idx
  on public.race_mockup_outreach (outreach_status);

create index if not exists race_mockup_outreach_race_slug_idx
  on public.race_mockup_outreach (race_slug);

create index if not exists race_mockup_outreach_official_domain_idx
  on public.race_mockup_outreach (official_domain)
  where official_domain is not null;

create index if not exists race_mockup_outreach_registration_race_id_idx
  on public.race_mockup_outreach (registration_platform, registration_race_id)
  where registration_race_id is not null;

create unique index if not exists race_mockup_outreach_mockup_url_key
  on public.race_mockup_outreach (mockup_url);

create unique index if not exists race_mockup_outreach_registration_key
  on public.race_mockup_outreach (lower(registration_platform), registration_race_id)
  where registration_race_id is not null;

create unique index if not exists race_mockup_outreach_sent_race_domain_key
  on public.race_mockup_outreach (race_slug, official_domain)
  where official_domain is not null and outreach_status in ('approved', 'sent', 'replied', 'bounced', 'do_not_contact');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_race_mockup_outreach_updated_at on public.race_mockup_outreach;
create trigger set_race_mockup_outreach_updated_at
before update on public.race_mockup_outreach
for each row
execute function public.set_updated_at();

alter table public.race_mockup_outreach enable row level security;

comment on table public.race_mockup_outreach is 'Internal StartLine private mockup outreach log for duplicate-send prevention, contact history, and follow-up tracking.';
comment on column public.race_mockup_outreach.mockup_template is 'Race-template family used to create the mockup, such as community, performance, or destination.';
comment on column public.race_mockup_outreach.contact_sources is 'Non-secret source notes for public contact discovery and confidence levels.';
