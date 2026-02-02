# Regras de negócio — Por módulo

Este documento descreve “o que pode / não pode” e as regras centrais de domínio que aparecem repetidamente no código.

## 1) Pesquisas (Surveys)

### Templates

- Um template vive em `survey_templates` e é sempre “do tenant” (`tenant_id`).
- Templates podem habilitar anexos via `allow_attachments` (default `false`).

Referência (migrations): [20260126090000_survey_attachments.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260126090000_survey_attachments.sql#L1-L6)

### Disparo de pesquisa via WhatsApp (autenticado)

- Endpoint: `POST /api/surveys?action=trigger` (precisa login).
- Cria link público de pesquisa com `tenant_id` + `template_id`.

Referência (backend): [handlers/surveys.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/surveys.ts#L334-L517)

### Resposta pública de pesquisa (sem login)

- Endpoint público: `POST /api/surveys?action=create-response`
- Regra: recebe `tenant_id` no body e valida formato UUID; grava em `survey_responses`.

Referência: [handlers/surveys.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/surveys.ts#L519-L669)

### Anexos (bucket privado + fluxo assinado)

Regras:

- Só aparece no front se `template.allow_attachments` e `source !== 'clicktotem'`.
- A resposta salva um `attachments_token` (usado como “prova” para o fluxo público de upload).
- O bucket é privado (`survey-attachments`) e o upload é via URL assinada.

Referências:

- UI (gating + upload): [Survey.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Survey.jsx#L474-L533)
- Backend (create/confirm): [handlers/surveys.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/surveys.ts#L684-L917)
- Schema/RLS + bucket: [20260126090000_survey_attachments.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260126090000_survey_attachments.sql#L7-L42)

## 2) Dashboard (métricas e normalização)

### Normalização de nota (regra transversal)

O sistema consolida vários formatos de nota (0–5, 0–10, 0–100) para uma escala interna 0–10 e derivada 0–5.

Referências:

- Regra geral (doc): [avaliacoes.md](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/docs/avaliacoes.md)
- Implementação no backend (executivo): [DASHBOARD_SIMPLE_INDICATORS.md](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/DASHBOARD_SIMPLE_INDICATORS.md#L31-L40)

### Follow-up / tratativa em respostas

`survey_responses` tem colunas para tratativa do time:

- `followup_status`, `followup_note`, `followup_updated_at`, `followup_updated_by`

Referência: [20260124000000_dashboard_followup_google.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260124000000_dashboard_followup_google.sql#L1-L5)

## 3) Google Reviews (MVP scraping)

Regras:

- Reviews são deduplicadas por `(tenant_id, place_id, external_review_id)`.
- “Crítica” é marcada quando `rating <= 3`.
- Status permitido: `new | in_progress | resolved | ignored`.
- Existe versionamento por hash (para detectar alterações no conteúdo).

Referências:

- README do módulo: [README.md](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/README.md#L53-L113)
- Schema/constraints: [20260124002000_google_reviews.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260124002000_google_reviews.sql#L1-L52)

## 4) WhatsApp (Evolution API + gatilhos externos)

Existem dois cenários:

### Envio manual (app → WhatsApp)

- O módulo “Enviar Pesquisa” chama o backend para disparar link de survey via instância WhatsApp conectada.

Referência (backend): [handlers/surveys.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/surveys.ts#L334-L517)

### Webhook externo (sistema terceiro → dispara pesquisa)

Regras:

- Existe uma tabela `whatsapp_trigger_configs` com:
  - `external_trigger_id`, `survey_template_id`, `whatsapp_instance_name`, `webhook_key`, `is_active`
- O webhook valida `X-Webhook-Key`.

Referências:

- Schema: [20260124003000_whatsapp_trigger_configs.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260124003000_whatsapp_trigger_configs.sql)
- CORS headers incluem `X-Webhook-Key`: [api/[...path].ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/%5B...path%5D.ts#L24-L28)
- Documentação/gestão no admin: [WebhookTriggerManager.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/admin/WebhookTriggerManager.jsx)

## 5) CRM (tarefas e histórico do cliente)

Regras:

- “Cliente” é identificado principalmente por `customer_email` e/ou `customer_phone` (não há entidade única global; é “soft identity”).
- Dados do CRM são multi-tenant e têm RLS com base no `app_metadata.tenant_id` do JWT.

Referências:

- Backend de tarefas: [handlers/crm.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/crm.ts)
- Tabelas e RLS: [20260125010000_crm_customer_entities.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260125010000_crm_customer_entities.sql#L1-L175)

## 6) Planos, consumo e limites

Regras (no backend):

- A action `validate-limits` calcula se o tenant pode criar algo com base em:
  - assinatura ativa (`subscriptions` + `plans`) ou fallback “Free”
  - consumo do mês em `consumption` por `period=YYYY-MM`

Referência: [handlers/plans.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/plans.ts#L36-L91)

Regras (na UI):

- Páginas privadas checam trial expirado e redirecionam para `/Checkout`.

Referência: [Layout.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/Layout.jsx#L124-L138)

## 7) Branding global (sistema)

Regras:

- A marca (logo/website) é global e lida de `system_config` (não por tenant).
- O menu lateral e o totem exibem a marca quando configurada.

Referências:

- Leitura no layout: [Layout.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/Layout.jsx#L66-L88)
- Edição (Master): [SystemBrandingManager.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/master/SystemBrandingManager.jsx)
- Exibição no totem: [TotemDisplay.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/TotemDisplay.jsx#L58-L61)

