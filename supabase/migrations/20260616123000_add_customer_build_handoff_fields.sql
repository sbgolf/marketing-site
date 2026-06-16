alter table public.customer_records
  add column if not exists customer_intake_submission_id uuid references public.customer_intake_submissions (id) on delete set null,
  add column if not exists build_status text not null default 'not_ready',
  add column if not exists build_handoff_at timestamptz,
  add column if not exists build_handoff_checklist jsonb not null default '{}'::jsonb;

create index if not exists customer_records_customer_intake_submission_id_idx
  on public.customer_records (customer_intake_submission_id)
  where customer_intake_submission_id is not null;

create index if not exists customer_records_build_status_idx
  on public.customer_records (build_status);

create index if not exists customer_records_build_handoff_at_idx
  on public.customer_records (build_handoff_at desc)
  where build_handoff_at is not null;

create index if not exists customer_records_build_queue_idx
  on public.customer_records (build_status, build_handoff_at desc)
  where build_status in ('ready_for_build', 'build_queued', 'in_progress');

comment on column public.customer_records.customer_intake_submission_id is 'Latest matched customer intake submission that moved this customer into the build handoff queue.';
comment on column public.customer_records.build_status is 'Build lifecycle state after intake handoff: not_ready, ready_for_build, in_progress, blocked, launched.';
comment on column public.customer_records.build_handoff_at is 'Timestamp when customer intake was handed off to the site build process.';
comment on column public.customer_records.build_handoff_checklist is 'Non-secret build handoff checklist snapshot derived from the customer intake submission.';
