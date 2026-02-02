alter table if exists public.tenants
  add column if not exists trial_start_date timestamptz null;

alter table if exists public.tenants
  add column if not exists trial_end_date timestamptz null;

create index if not exists tenants_trial_start_date_idx
  on public.tenants (trial_start_date);

