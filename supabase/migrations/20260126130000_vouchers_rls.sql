create table if not exists public.vouchers (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null,
    name text not null,
    code text not null,
    internal_description text,
    description text,
    type text not null,
    discount_percentage numeric,
    discount_fixed numeric,
    gift_description text,
    custom_message text,
    is_active boolean not null default true,
    expiration_days integer,
    usage_limit integer,
    notify_on_limit boolean not null default false,
    design jsonb not null default '{}'::jsonb,
    current_usage integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table if exists public.vouchers
    add column if not exists tenant_id uuid,
    add column if not exists name text,
    add column if not exists code text,
    add column if not exists internal_description text,
    add column if not exists description text,
    add column if not exists type text,
    add column if not exists discount_percentage numeric,
    add column if not exists discount_fixed numeric,
    add column if not exists gift_description text,
    add column if not exists custom_message text,
    add column if not exists is_active boolean,
    add column if not exists expiration_days integer,
    add column if not exists usage_limit integer,
    add column if not exists notify_on_limit boolean,
    add column if not exists design jsonb,
    add column if not exists current_usage integer,
    add column if not exists created_at timestamptz,
    add column if not exists updated_at timestamptz;

create index if not exists idx_vouchers_tenant_created_at
    on public.vouchers (tenant_id, created_at desc);

create unique index if not exists uidx_vouchers_tenant_code
    on public.vouchers (tenant_id, code);

alter table public.vouchers
    alter column tenant_id set default ((auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid),
    alter column is_active set default true,
    alter column notify_on_limit set default false,
    alter column design set default '{}'::jsonb,
    alter column current_usage set default 0;

create table if not exists public.voucher_usage (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null,
    voucher_id uuid not null references public.vouchers (id) on delete cascade,
    generated_code text not null,
    customer_email text,
    customer_name text,
    customer_phone text,
    survey_response_id uuid,
    redeemed boolean not null default false,
    redeemed_at timestamptz,
    expiration_date date,
    created_at timestamptz not null default now()
);

alter table if exists public.voucher_usage
    add column if not exists tenant_id uuid,
    add column if not exists voucher_id uuid,
    add column if not exists generated_code text,
    add column if not exists customer_email text,
    add column if not exists customer_name text,
    add column if not exists customer_phone text,
    add column if not exists survey_response_id uuid,
    add column if not exists redeemed boolean,
    add column if not exists redeemed_at timestamptz,
    add column if not exists expiration_date date,
    add column if not exists created_at timestamptz;

create index if not exists idx_voucher_usage_tenant_voucher_created_at
    on public.voucher_usage (tenant_id, voucher_id, created_at desc);

create unique index if not exists uidx_voucher_usage_generated_code
    on public.voucher_usage (generated_code);

alter table public.voucher_usage
    alter column tenant_id set default ((auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid),
    alter column redeemed set default false;

alter table public.vouchers enable row level security;

drop policy if exists vouchers_select on public.vouchers;
create policy vouchers_select on public.vouchers
    for select to authenticated
    using (
        (auth.jwt() -> 'app_metadata' ->> 'is_super_admin') = 'true'
        or tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    );

drop policy if exists vouchers_insert on public.vouchers;
create policy vouchers_insert on public.vouchers
    for insert to authenticated
    with check (
        (auth.jwt() -> 'app_metadata' ->> 'is_super_admin') = 'true'
        or tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    );

drop policy if exists vouchers_update on public.vouchers;
create policy vouchers_update on public.vouchers
    for update to authenticated
    using (
        (auth.jwt() -> 'app_metadata' ->> 'is_super_admin') = 'true'
        or tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    )
    with check (
        (auth.jwt() -> 'app_metadata' ->> 'is_super_admin') = 'true'
        or tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    );

drop policy if exists vouchers_delete on public.vouchers;
create policy vouchers_delete on public.vouchers
    for delete to authenticated
    using (
        (auth.jwt() -> 'app_metadata' ->> 'is_super_admin') = 'true'
        or tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    );

alter table public.voucher_usage enable row level security;

drop policy if exists voucher_usage_select on public.voucher_usage;
create policy voucher_usage_select on public.voucher_usage
    for select to authenticated
    using (
        (auth.jwt() -> 'app_metadata' ->> 'is_super_admin') = 'true'
        or tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    );

drop policy if exists voucher_usage_insert on public.voucher_usage;
create policy voucher_usage_insert on public.voucher_usage
    for insert to authenticated
    with check (
        (auth.jwt() -> 'app_metadata' ->> 'is_super_admin') = 'true'
        or tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    );
