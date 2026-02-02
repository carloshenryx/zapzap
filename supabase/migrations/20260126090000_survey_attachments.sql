alter table if exists public.survey_templates
    add column if not exists allow_attachments boolean not null default false;

alter table if exists public.default_survey_template
    add column if not exists allow_attachments boolean not null default false;

alter table if exists public.survey_responses
    add column if not exists attachments_token text;

create table if not exists public.survey_response_attachments (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null,
    response_id uuid not null,
    storage_bucket text not null default 'survey-attachments',
    storage_path text not null,
    original_name text,
    mime_type text,
    size_bytes bigint,
    created_at timestamptz not null default now()
);

create index if not exists idx_survey_response_attachments_tenant_response_created_at
    on public.survey_response_attachments (tenant_id, response_id, created_at asc);

create unique index if not exists uidx_survey_response_attachments_bucket_path
    on public.survey_response_attachments (storage_bucket, storage_path);

alter table public.survey_response_attachments enable row level security;

drop policy if exists survey_response_attachments_select on public.survey_response_attachments;
create policy survey_response_attachments_select on public.survey_response_attachments
    for select to authenticated
    using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

drop policy if exists survey_response_attachments_delete on public.survey_response_attachments;
create policy survey_response_attachments_delete on public.survey_response_attachments
    for delete to authenticated
    using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

insert into storage.buckets (id, name, public)
values ('survey-attachments', 'survey-attachments', false)
on conflict (id) do update set public = excluded.public;
