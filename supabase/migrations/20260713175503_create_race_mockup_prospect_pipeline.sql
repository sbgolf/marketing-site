create table if not exists public.race_mockup_prospects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  race_name text not null,
  race_slug text not null,
  race_city text,
  race_state text,
  region text,
  event_date date,

  source_platform text not null default 'runsignup',
  source_url text not null,
  source_race_id text,
  official_url text,
  official_domain text,
  registration_url text,
  registration_platform text,
  registration_race_id text,

  discovered_from text,
  source_urls jsonb not null default '[]'::jsonb,
  contact_sources jsonb not null default '[]'::jsonb,
  extracted_facts jsonb not null default '{}'::jsonb,
  source_coverage jsonb not null default '{}'::jsonb,

  community_fit_score integer not null default 0,
  business_opportunity_score integer not null default 0,
  source_quality_score integer not null default 0,
  outreach_viability_score integer not null default 0,
  total_score integer not null default 0,
  recommended_template text not null default 'community',
  qualification_status text not null default 'discovered',
  qualification_reason text,
  disqualifiers jsonb not null default '[]'::jsonb,

  owner_approval_status text not null default 'not_requested',
  owner_approved_at timestamptz,
  owner_approved_by text,
  owner_decision_notes text,

  metadata jsonb not null default '{}'::jsonb,

  constraint race_mockup_prospects_source_url_check check (source_url ~ '^https?://'),
  constraint race_mockup_prospects_total_score_check check (total_score between 0 and 100),
  constraint race_mockup_prospects_score_bounds_check check (
    community_fit_score between 0 and 35
    and business_opportunity_score between 0 and 25
    and source_quality_score between 0 and 20
    and outreach_viability_score between 0 and 20
  ),
  constraint race_mockup_prospects_recommended_template_check check (
    recommended_template in ('community')
  ),
  constraint race_mockup_prospects_qualification_status_check check (
    qualification_status in ('discovered', 'scored', 'qualified_for_mockup', 'needs_review', 'skipped', 'mockup_generated', 'outreach_drafted', 'outreach_sent', 'archived')
  ),
  constraint race_mockup_prospects_owner_approval_status_check check (
    owner_approval_status in ('not_requested', 'requested', 'approved', 'rejected', 'changes_requested')
  )
);

create index if not exists race_mockup_prospects_created_at_idx
  on public.race_mockup_prospects (created_at desc);

create index if not exists race_mockup_prospects_status_score_idx
  on public.race_mockup_prospects (qualification_status, total_score desc);

create index if not exists race_mockup_prospects_region_date_idx
  on public.race_mockup_prospects (region, event_date)
  where event_date is not null;

create index if not exists race_mockup_prospects_registration_race_id_idx
  on public.race_mockup_prospects (registration_platform, registration_race_id)
  where registration_race_id is not null;

create unique index if not exists race_mockup_prospects_source_race_key
  on public.race_mockup_prospects (lower(source_platform), source_race_id)
  where source_race_id is not null;

create unique index if not exists race_mockup_prospects_registration_key
  on public.race_mockup_prospects (lower(registration_platform), registration_race_id)
  where registration_race_id is not null;

create table if not exists public.race_mockup_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  prospect_id uuid not null references public.race_mockup_prospects(id) on delete cascade,
  job_status text not null default 'queued',
  template text not null default 'community',
  mockup_token text,
  mockup_url text,
  config_path text,
  branch_name text,
  pull_request_url text,
  deploy_preview_url text,

  source_bundle jsonb not null default '{}'::jsonb,
  source_coverage jsonb not null default '{}'::jsonb,
  qa_status text not null default 'not_started',
  qa_report jsonb not null default '{}'::jsonb,
  site_auditor_status text not null default 'not_requested',
  failure_reason text,

  owner_approval_status text not null default 'not_requested',
  owner_approved_at timestamptz,
  owner_decision_notes text,
  outreach_id uuid references public.race_mockup_outreach(id) on delete set null,

  metadata jsonb not null default '{}'::jsonb,

  constraint race_mockup_generation_jobs_mockup_url_check check (mockup_url is null or mockup_url ~ '^https?://'),
  constraint race_mockup_generation_jobs_template_check check (template in ('community')),
  constraint race_mockup_generation_jobs_status_check check (
    job_status in ('queued', 'extracting_sources', 'config_generated', 'branch_opened', 'qa_running', 'qa_failed', 'ready_for_owner_review', 'owner_changes_requested', 'owner_approved', 'outreach_drafted', 'outreach_sent', 'failed', 'archived')
  ),
  constraint race_mockup_generation_jobs_qa_status_check check (
    qa_status in ('not_started', 'running', 'passed', 'failed', 'blocked')
  ),
  constraint race_mockup_generation_jobs_site_auditor_status_check check (
    site_auditor_status in ('not_requested', 'requested', 'passed', 'failed', 'blocked')
  ),
  constraint race_mockup_generation_jobs_owner_approval_status_check check (
    owner_approval_status in ('not_requested', 'requested', 'approved', 'rejected', 'changes_requested')
  )
);

create index if not exists race_mockup_generation_jobs_prospect_id_idx
  on public.race_mockup_generation_jobs (prospect_id);

create index if not exists race_mockup_generation_jobs_status_idx
  on public.race_mockup_generation_jobs (job_status, created_at desc);

create unique index if not exists race_mockup_generation_jobs_mockup_url_key
  on public.race_mockup_generation_jobs (mockup_url)
  where mockup_url is not null;

drop trigger if exists set_race_mockup_prospects_updated_at on public.race_mockup_prospects;
create trigger set_race_mockup_prospects_updated_at
before update on public.race_mockup_prospects
for each row
execute function public.set_updated_at();

drop trigger if exists set_race_mockup_generation_jobs_updated_at on public.race_mockup_generation_jobs;
create trigger set_race_mockup_generation_jobs_updated_at
before update on public.race_mockup_generation_jobs
for each row
execute function public.set_updated_at();

alter table public.race_mockup_prospects enable row level security;
alter table public.race_mockup_generation_jobs enable row level security;

comment on table public.race_mockup_prospects is 'Internal StartLine prospect queue for local/regional RunSignup-first Community-template private mockup candidates.';
comment on column public.race_mockup_prospects.owner_approval_status is 'Steve approval gate for generating/sending private mockup outreach; default requires approval before send.';
comment on table public.race_mockup_generation_jobs is 'Internal StartLine private mockup generation and QA jobs linked to qualified prospects.';
