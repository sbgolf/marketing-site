create extension if not exists pgcrypto;

create table if not exists public.customer_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  audit_request_id uuid references public.audit_requests (id) on delete set null,

  race_name text not null,
  organization_name text,
  current_url text,
  registration_url text,
  live_url text,

  primary_contact_name text,
  primary_contact_email text,
  billing_contact_name text,
  billing_contact_email text,

  setup_tier text not null,
  monthly_tier text not null,
  setup_amount_cents integer not null,
  deposit_amount_cents integer not null,
  final_invoice_amount_cents integer not null,
  monthly_amount_cents integer not null,
  currency text not null default 'usd',

  customer_status text not null default 'prospect',
  deposit_status text not null default 'not_sent',
  final_invoice_status text not null default 'not_sent',
  subscription_status text not null default 'not_started',

  stripe_customer_id text,
  stripe_checkout_session_id text,
  stripe_deposit_payment_intent_id text,
  stripe_final_invoice_id text,
  stripe_subscription_id text,

  deposit_paid_at timestamptz,
  kickoff_started_at timestamptz,
  final_invoice_sent_at timestamptz,
  final_invoice_paid_at timestamptz,
  go_live_at timestamptz,
  subscription_started_at timestamptz,
  first_monthly_report_due_at date,

  approved_exception boolean not null default false,
  exception_summary text,

  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists customer_records_stripe_customer_id_idx
  on public.customer_records (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists customer_records_created_at_idx
  on public.customer_records (created_at desc);

create index if not exists customer_records_customer_status_idx
  on public.customer_records (customer_status);

create index if not exists customer_records_deposit_status_idx
  on public.customer_records (deposit_status);

create index if not exists customer_records_subscription_status_idx
  on public.customer_records (subscription_status);

create index if not exists customer_records_billing_contact_email_idx
  on public.customer_records (lower(billing_contact_email));

create index if not exists customer_records_audit_request_id_idx
  on public.customer_records (audit_request_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_customer_records_updated_at on public.customer_records;
create trigger set_customer_records_updated_at
before update on public.customer_records
for each row
execute function public.set_updated_at();

alter table public.customer_records enable row level security;

comment on table public.customer_records is 'Private StartLine Sites customer records connected to Stripe billing and customer lifecycle status.';
comment on column public.customer_records.metadata is 'Flexible non-secret metadata for operational notes, attribution, and billing workflow context.';
