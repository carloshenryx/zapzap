# Banco (Supabase) — Entidades, índices e RLS

Este documento descreve o que está **versionado no repo** (migrations SQL) e também o que o código **assume que exista** no banco.

## Onde estão as migrations

- Migrations versionadas: [supabase/migrations/](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations)
- Scripts auxiliares (não necessariamente aplicados): [database/](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/database)

## Entidades “core” assumidas pelo código (nem todas estão em migrations aqui)

Estas tabelas aparecem em handlers/ UI e são parte do núcleo do sistema:

- `tenants` (multi-tenant; status/plan/trial)
  - Usado em: [handlers/tenants.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/tenants.ts), [Layout.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/Layout.jsx#L50-L62)
- `user_profiles` (perfil de app; vínculo ao tenant; flags)
  - Usado em: [authenticateUser](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/lib/auth.ts#L42-L61), [handlers/tenants.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/tenants.ts#L242-L255)
- `survey_templates` (templates de pesquisa)
  - Usado em: [handlers/surveys.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/surveys.ts)
- `survey_responses` (respostas de pesquisa)
  - Usado em: [handlers/surveys.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/surveys.ts), [handlers/analytics.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/analytics.ts)
- `plans`, `subscriptions`, `consumption` (billing e limites)
  - Usado em: [handlers/plans.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/plans.ts), [handlers/tenants.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/tenants.ts#L68-L95)
- `whatsapp_instances` (instâncias conectadas)
  - Usado em: [handlers/surveys.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/surveys.ts#L334-L376)
- `system_config` (branding global)
  - Usado em: [Layout.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/Layout.jsx#L66-L88), [SystemBrandingManager.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/master/SystemBrandingManager.jsx)

Observação: nem todas as tabelas acima têm DDL/policies versionadas em `supabase/migrations/` neste repo.

## Entidades versionadas em migrations (com regras relevantes)

### 1) Google Reviews (scraping)

Tabelas:

- `google_places`
  - `UNIQUE (tenant_id, place_id)`
  - índices por `(tenant_id, is_active)`
- `google_reviews`
  - `CHECK rating BETWEEN 1 AND 5`
  - `CHECK status IN ('new','in_progress','resolved','ignored')`
  - `UNIQUE (tenant_id, place_id, external_review_id)`
- `google_review_versions` (versionamento por hash)
- `google_review_actions` (auditoria)

Migration: [20260124002000_google_reviews.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260124002000_google_reviews.sql)

### 2) WhatsApp trigger configs (webhooks externos)

Tabela:

- `whatsapp_trigger_configs`
  - `UNIQUE (tenant_id, external_trigger_id)`
  - `UNIQUE (webhook_key)`

Migration: [20260124003000_whatsapp_trigger_configs.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260124003000_whatsapp_trigger_configs.sql)

### 3) CRM (entidades por cliente)

Tabelas:

- `crm_customer_notes`
- `crm_customer_movements`
- `crm_customer_treatments`
- `crm_customer_interactions`

Todas:

- possuem `tenant_id`
- têm **RLS habilitado**
- policies para `authenticated` usando `app_metadata.tenant_id` do JWT

Migration: [20260125010000_crm_customer_entities.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260125010000_crm_customer_entities.sql)

### 4) Survey: follow-up e redirect Google

Campos adicionados em `survey_responses`:

- follow-up: `followup_status`, `followup_note`, `followup_updated_at`, `followup_updated_by`
- redirect: `google_redirect_triggered`, `google_redirect_triggered_at`, `google_redirect_reason`
- índices para acelerar filtros por tenant e período

Migration: [20260124000000_dashboard_followup_google.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260124000000_dashboard_followup_google.sql)

### 5) Survey: anexos (Storage)

Mudanças:

- `survey_templates.allow_attachments` (default false)
- `survey_responses.attachments_token`
- tabela `survey_response_attachments`
  - `UNIQUE (storage_bucket, storage_path)`
  - índice `(tenant_id, response_id, created_at)`
  - RLS habilitado com policies `select/delete` para `authenticated` via `app_metadata.tenant_id`
- cria/atualiza bucket `survey-attachments` como privado

Migration: [20260126090000_survey_attachments.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260126090000_survey_attachments.sql)

### 6) `user_profiles.user_email`

Adiciona `user_email`:

- se existir coluna `email`, `user_email` é **generated always as (email) stored**
- senão, `user_email` é um `text` normal (compatibilidade)

Migration: [20260126100000_user_profiles_user_email.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260126100000_user_profiles_user_email.sql)

## RLS: o que existe no repo vs. o que é esperado

Versionado no repo:

- CRM entities: select/insert/update/delete com `tenant_id = jwt.app_metadata.tenant_id`
- `survey_response_attachments`: select/delete com `tenant_id = jwt.app_metadata.tenant_id`

Não encontrei versionado (mas o sistema presume/usa):

- policies para `tenants`, `user_profiles`, `survey_templates`, `survey_responses`, `whatsapp_instances`, `plans`, `subscriptions`, etc.

Implicação prática:

- Onde não há policy (ou onde o backend usa service role), o isolamento depende do filtro por `tenant_id` no código.
- Para tabelas com policy baseada no JWT, o onboarding precisa setar `app_metadata.tenant_id` corretamente.

