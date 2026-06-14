create extension if not exists pgcrypto;

create table if not exists public.audit_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  race_name text not null,
  current_url text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,

  race_date date,
  registration_url text,
  registration_platform text,
  location text,
  notes text,

  source text not null default 'marketing_site',
  campaign text,
  referrer text,
  landing_page text,
  user_agent text,
  ip_hash text,

  status text not null default 'new',
  lead_score integer,

  audit_summary jsonb,
  top_opportunities jsonb,
  lighthouse_summary jsonb,
  private_mockup_url text,

  outreach_status text not null default 'not_started',
  assigned_to text,

  stripe_customer_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  proposed_setup_tier text,
  proposed_monthly_tier text,
  deposit_status text not null default 'not_sent',

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists audit_requests_created_at_idx
  on public.audit_requests (created_at desc);

create index if not exists audit_requests_status_idx
  on public.audit_requests (status);

create index if not exists audit_requests_contact_email_idx
  on public.audit_requests (lower(contact_email));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_audit_requests_updated_at on public.audit_requests;
create trigger set_audit_requests_updated_at
before update on public.audit_requests
for each row
execute function public.set_updated_at();

alter table public.audit_requests enable row level security;

comment on table public.audit_requests is 'Inbound StartLine Sites private audit requests and sales pipeline metadata.';
comment on column public.audit_requests.metadata is 'Flexible non-secret metadata for attribution and operational notes.';
