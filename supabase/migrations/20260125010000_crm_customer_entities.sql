create table if not exists public.crm_customer_notes (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null,
    customer_email text,
    customer_phone text,
    customer_name text,
    title text,
    content text not null,
    note_type text not null default 'internal',
    priority text not null default 'medium',
    tags text[] not null default '{}'::text[],
    is_pinned boolean not null default false,
    created_by_user text,
    created_at timestamptz not null default now()
);

create index if not exists idx_crm_customer_notes_tenant_email_created_at
    on public.crm_customer_notes (tenant_id, customer_email, created_at desc);

create index if not exists idx_crm_customer_notes_tenant_phone_created_at
    on public.crm_customer_notes (tenant_id, customer_phone, created_at desc);

create table if not exists public.crm_customer_movements (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null,
    customer_email text,
    customer_phone text,
    customer_name text,
    movement_type text not null,
    description text,
    amount numeric not null,
    payment_method text,
    status text not null default 'completed',
    created_by_user text,
    created_at timestamptz not null default now()
);

create index if not exists idx_crm_customer_movements_tenant_email_created_at
    on public.crm_customer_movements (tenant_id, customer_email, created_at desc);

create index if not exists idx_crm_customer_movements_tenant_phone_created_at
    on public.crm_customer_movements (tenant_id, customer_phone, created_at desc);

create table if not exists public.crm_customer_treatments (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null,
    customer_email text,
    customer_phone text,
    customer_name text,
    treatment_type text not null,
    title text not null,
    description text,
    priority text not null default 'medium',
    status text not null default 'open',
    started_at timestamptz not null default now(),
    resolved_at timestamptz,
    resolution text,
    actions_taken jsonb not null default '[]'::jsonb,
    created_by_user text,
    created_at timestamptz not null default now()
);

create index if not exists idx_crm_customer_treatments_tenant_email_created_at
    on public.crm_customer_treatments (tenant_id, customer_email, created_at desc);

create index if not exists idx_crm_customer_treatments_tenant_phone_created_at
    on public.crm_customer_treatments (tenant_id, customer_phone, created_at desc);

create table if not exists public.crm_customer_interactions (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null,
    customer_email text,
    customer_phone text,
    customer_name text,
    interaction_type text not null,
    summary text,
    metadata jsonb not null default '{}'::jsonb,
    created_by_user text,
    created_at timestamptz not null default now()
);

create index if not exists idx_crm_customer_interactions_tenant_email_created_at
    on public.crm_customer_interactions (tenant_id, customer_email, created_at desc);

create index if not exists idx_crm_customer_interactions_tenant_phone_created_at
    on public.crm_customer_interactions (tenant_id, customer_phone, created_at desc);

alter table public.crm_customer_notes enable row level security;
alter table public.crm_customer_movements enable row level security;
alter table public.crm_customer_treatments enable row level security;
alter table public.crm_customer_interactions enable row level security;

drop policy if exists crm_customer_notes_select on public.crm_customer_notes;
create policy crm_customer_notes_select on public.crm_customer_notes
    for select to authenticated
    using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

drop policy if exists crm_customer_notes_insert on public.crm_customer_notes;
create policy crm_customer_notes_insert on public.crm_customer_notes
    for insert to authenticated
    with check (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

drop policy if exists crm_customer_notes_update on public.crm_customer_notes;
create policy crm_customer_notes_update on public.crm_customer_notes
    for update to authenticated
    using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
    with check (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

drop policy if exists crm_customer_notes_delete on public.crm_customer_notes;
create policy crm_customer_notes_delete on public.crm_customer_notes
    for delete to authenticated
    using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

drop policy if exists crm_customer_movements_select on public.crm_customer_movements;
create policy crm_customer_movements_select on public.crm_customer_movements
    for select to authenticated
    using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

drop policy if exists crm_customer_movements_insert on public.crm_customer_movements;
create policy crm_customer_movements_insert on public.crm_customer_movements
    for insert to authenticated
    with check (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

drop policy if exists crm_customer_movements_update on public.crm_customer_movements;
create policy crm_customer_movements_update on public.crm_customer_movements
    for update to authenticated
    using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
    with check (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

drop policy if exists crm_customer_movements_delete on public.crm_customer_movements;
create policy crm_customer_movements_delete on public.crm_customer_movements
    for delete to authenticated
    using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

drop policy if exists crm_customer_treatments_select on public.crm_customer_treatments;
create policy crm_customer_treatments_select on public.crm_customer_treatments
    for select to authenticated
    using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

drop policy if exists crm_customer_treatments_insert on public.crm_customer_treatments;
create policy crm_customer_treatments_insert on public.crm_customer_treatments
    for insert to authenticated
    with check (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

drop policy if exists crm_customer_treatments_update on public.crm_customer_treatments;
create policy crm_customer_treatments_update on public.crm_customer_treatments
    for update to authenticated
    using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
    with check (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

drop policy if exists crm_customer_treatments_delete on public.crm_customer_treatments;
create policy crm_customer_treatments_delete on public.crm_customer_treatments
    for delete to authenticated
    using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

drop policy if exists crm_customer_interactions_select on public.crm_customer_interactions;
create policy crm_customer_interactions_select on public.crm_customer_interactions
    for select to authenticated
    using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

drop policy if exists crm_customer_interactions_insert on public.crm_customer_interactions;
create policy crm_customer_interactions_insert on public.crm_customer_interactions
    for insert to authenticated
    with check (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

drop policy if exists crm_customer_interactions_update on public.crm_customer_interactions;
create policy crm_customer_interactions_update on public.crm_customer_interactions
    for update to authenticated
    using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
    with check (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

drop policy if exists crm_customer_interactions_delete on public.crm_customer_interactions;
create policy crm_customer_interactions_delete on public.crm_customer_interactions
    for delete to authenticated
    using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

