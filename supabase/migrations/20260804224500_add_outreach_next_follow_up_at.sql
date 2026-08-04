alter table public.race_mockup_outreach
  add column if not exists next_follow_up_at timestamptz;

create index if not exists race_mockup_outreach_next_follow_up_at_idx
  on public.race_mockup_outreach (next_follow_up_at)
  where next_follow_up_at is not null;

comment on column public.race_mockup_outreach.next_follow_up_at is 'Derived owner-reviewed follow-up recommendation date; never an automatic customer send schedule.';
