create extension if not exists pgcrypto;

create table if not exists public.survey_templates (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid,
    name text not null,
    description text,
    questions jsonb not null default '[]'::jsonb,
    is_active boolean not null default false,
    active boolean not null default false,
    send_via_whatsapp boolean not null default false,
    send_via_whatsapp_conversation boolean not null default false,
    send_via_email boolean not null default false,
    send_via_sms boolean not null default false,
    allow_anonymous boolean not null default false,
    allow_attachments boolean not null default false,
    completion_period jsonb,
    google_redirect jsonb,
    usage_limit jsonb,
    voucher_config jsonb,
    design jsonb,
    created_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_survey_templates_tenant_created_at
    on public.survey_templates (tenant_id, created_at desc);

create table if not exists public.survey_responses (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null,
    template_id uuid,
    customer_name text,
    customer_email text,
    customer_phone text,
    customer_cpf text,
    is_anonymous boolean not null default false,
    overall_rating integer,
    would_recommend boolean,
    comment text,
    custom_answers jsonb not null default '{}'::jsonb,
    source text,
    attachments_token text,
    followup_status text,
    followup_note text,
    followup_updated_at timestamptz,
    followup_updated_by uuid,
    google_redirect_triggered boolean default false,
    google_redirect_triggered_at timestamptz,
    google_redirect_reason text,
    created_at timestamptz not null default now()
);

create index if not exists idx_survey_responses_tenant_created_at
    on public.survey_responses (tenant_id, created_at desc);

create index if not exists idx_survey_responses_tenant_rating
    on public.survey_responses (tenant_id, overall_rating);

create table if not exists public.default_survey_template (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    category text,
    questions jsonb not null default '[]'::jsonb,
    allow_attachments boolean not null default false,
    created_at timestamptz not null default now()
);
