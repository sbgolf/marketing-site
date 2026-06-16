create extension if not exists pgcrypto;

create table if not exists public.customer_intake_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  organization_name text,
  race_name text not null,
  contact_name text not null,
  contact_email text not null,
  event_date text,
  event_location text,
  registration_url text not null,

  status text not null default 'new',
  source text not null default 'marketing_site_intake',
  referrer text,
  landing_page text,
  user_agent text,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists customer_intake_submissions_created_at_idx
  on public.customer_intake_submissions (created_at desc);

create index if not exists customer_intake_submissions_status_idx
  on public.customer_intake_submissions (status);

create index if not exists customer_intake_submissions_contact_email_idx
  on public.customer_intake_submissions (lower(contact_email));

create index if not exists customer_intake_submissions_race_name_idx
  on public.customer_intake_submissions (lower(race_name));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_customer_intake_submissions_updated_at on public.customer_intake_submissions;
create trigger set_customer_intake_submissions_updated_at
before update on public.customer_intake_submissions
for each row
execute function public.set_updated_at();

alter table public.customer_intake_submissions enable row level security;

comment on table public.customer_intake_submissions is 'Private StartLine Sites customer kickoff intake submissions from the public intake form.';
comment on column public.customer_intake_submissions.metadata is 'Flexible non-secret intake details including template preference, course/logistics, FAQs, assets link, and analytics notes.';
