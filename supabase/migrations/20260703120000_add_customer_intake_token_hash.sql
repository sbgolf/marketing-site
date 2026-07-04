alter table public.customer_records
  add column if not exists intake_token_hash text,
  add column if not exists intake_token_created_at timestamptz;

create unique index if not exists customer_records_intake_token_hash_idx
  on public.customer_records (intake_token_hash)
  where intake_token_hash is not null;
