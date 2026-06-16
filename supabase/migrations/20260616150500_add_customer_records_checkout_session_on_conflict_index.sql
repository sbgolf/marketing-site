-- PostgREST upserts using on_conflict=stripe_checkout_session_id require
-- a non-partial unique index/constraint that exactly matches the conflict target.
-- The earlier partial unique index prevents duplicate non-null checkout sessions,
-- but PostgREST cannot use it for the customer_records upsert in stripe-webhook.
create unique index if not exists customer_records_stripe_checkout_session_id_on_conflict_idx
  on public.customer_records (stripe_checkout_session_id);
