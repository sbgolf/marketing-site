alter table public.customer_records
  add column if not exists launch_readiness_status text not null default 'not_started',
  add column if not exists launch_readiness_sent_at timestamptz,
  add column if not exists launch_readiness_submitted_at timestamptz,
  add column if not exists launch_readiness_updated_at timestamptz,
  add column if not exists launch_readiness_dependencies jsonb not null default '{}'::jsonb,
  add column if not exists launch_blocker_summary text,
  add column if not exists domain_dns_status text not null default 'unknown',
  add column if not exists domain_email_status text not null default 'unknown',
  add column if not exists analytics_status text not null default 'unknown',
  add column if not exists search_console_status text not null default 'unknown',
  add column if not exists registration_confirmation_status text not null default 'unknown',
  add column if not exists asset_permission_status text not null default 'unknown',
  add column if not exists final_approver_status text not null default 'unknown';

create index if not exists customer_records_launch_readiness_status_idx
  on public.customer_records (launch_readiness_status);

create index if not exists customer_records_launch_readiness_sent_at_idx
  on public.customer_records (launch_readiness_sent_at desc)
  where launch_readiness_sent_at is not null;

create index if not exists customer_records_launch_readiness_submitted_at_idx
  on public.customer_records (launch_readiness_submitted_at desc)
  where launch_readiness_submitted_at is not null;

create index if not exists customer_records_domain_dns_status_idx
  on public.customer_records (domain_dns_status);

create index if not exists customer_records_registration_confirmation_status_idx
  on public.customer_records (registration_confirmation_status);

create index if not exists customer_records_launch_blocker_idx
  on public.customer_records (launch_readiness_status, updated_at desc)
  where launch_readiness_status in ('needs_follow_up', 'launch_blocked');

comment on column public.customer_records.launch_readiness_status is 'Post-deposit Launch Readiness state: not_started, ready_to_send, sent, submitted, needs_follow_up, build_ready, launch_blocked, launch_ready.';
comment on column public.customer_records.launch_readiness_sent_at is 'Timestamp when the branded Launch Readiness Kit email/checklist link was sent to the customer.';
comment on column public.customer_records.launch_readiness_submitted_at is 'Timestamp when the customer submitted or confirmed the Launch Readiness checklist.';
comment on column public.customer_records.launch_readiness_updated_at is 'Timestamp of the latest Launch Readiness state/dependency update.';
comment on column public.customer_records.launch_readiness_dependencies is 'Non-secret Launch Readiness dependency snapshot grouped by registration, domain/DNS, email safety, analytics/search, assets, and approval.';
comment on column public.customer_records.launch_blocker_summary is 'Short non-secret summary of the current Launch Readiness blocker, if any.';
comment on column public.customer_records.domain_dns_status is 'Domain/DNS access state: unknown, not_needed, requested, customer_unsure, delegated_access_ready, screen_share_needed, confirmed, blocked.';
comment on column public.customer_records.domain_email_status is 'Domain email/MX safety state: unknown, not_needed, requested, customer_unsure, confirmed, blocked.';
comment on column public.customer_records.analytics_status is 'GA4 ownership/access state: unknown, not_needed, requested, customer_unsure, confirmed, blocked.';
comment on column public.customer_records.search_console_status is 'Google Search Console ownership/verification state: unknown, not_needed, requested, customer_unsure, confirmed, blocked.';
comment on column public.customer_records.registration_confirmation_status is 'Official registration URL/status/pricing confirmation state: unknown, requested, customer_unsure, confirmed, blocked.';
comment on column public.customer_records.asset_permission_status is 'Asset availability and reuse-permission state: unknown, requested, customer_unsure, confirmed, blocked.';
comment on column public.customer_records.final_approver_status is 'Final approver identification and launch-approval path state: unknown, requested, customer_unsure, confirmed, blocked.';
