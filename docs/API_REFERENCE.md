# API — Referência (Vercel `/api`)

## Convenções

- Base URL: `/api/<resource>?action=<action>`
- Autenticação (quando aplicável): `Authorization: Bearer <access_token>`
  - O frontend injeta esse header em `fetchAPI` ([supabase.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/lib/supabase.ts#L33-L58))
- Resposta padrão:
  - sucesso: `{ success: true, ...data }`
  - erro: `{ success: false, error: string, message: string }`

Referência: [response.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/lib/response.ts#L4-L19)

## Roteamento

O recurso é o primeiro segmento do path depois de `/api/` e o roteamento acontece em um único arquivo:

- [api/[...path].ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/%5B...path%5D.ts#L20-L80)

## Recursos e actions

### `auth`

- `GET /api/auth?action=context` (autenticado)
  - Retorna `tenant_id`, `is_super_admin` e dados úteis para montar o contexto no frontend.
  - Handler: [handlers/auth.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/auth.ts#L20-L57)

### `tenants`

- `GET /api/tenants?action=list-all` (super admin)
- `POST /api/tenants?action=onboard` (autenticado; exige service role no backend)
- `POST /api/tenants?action=create` (super admin)
- `POST /api/tenants?action=update` (super admin)
- `POST /api/tenants?action=manage-status` (super admin)
- `POST /api/tenants?action=assign-plan` (super admin)

Handler: [handlers/tenants.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/tenants.ts#L18-L40)

### `admin` (super admin)

- `GET /api/admin?action=list-users`
- `POST /api/admin?action=set-user-password`
- `POST /api/admin?action=set-user-ban`
- `DELETE /api/admin?action=delete-user`
- `POST /api/admin?action=assign-user-tenant`
- `POST /api/admin?action=set-super-admin`
- `GET /api/admin?action=list-tenant-users`

Handler: [handlers/admin.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/admin.ts#L26-L43)

### `surveys`

#### Templates (autenticado)

- `POST /api/surveys?action=create-template`
- `GET /api/surveys?action=list-templates`
- `POST /api/surveys?action=update-template`
- `POST /api/surveys?action=delete-template`

#### Operações de envio (autenticado)

- `POST /api/surveys?action=trigger` (envia pesquisa via WhatsApp)

#### Operações públicas (sem login)

- `POST /api/surveys?action=create-response` (grava resposta; `tenant_id` no body)
- `POST /api/surveys?action=update-template-usage`
- `POST /api/surveys?action=create-attachment-uploads` (fluxo público protegido por token)
- `POST /api/surveys?action=confirm-attachment-uploads` (fluxo público protegido por token)

#### Operações autenticadas (pós-resposta)

- `GET /api/surveys?action=list-attachments` (lista anexos com signed URLs)
- `POST /api/surveys?action=update-followup` (tratativa/follow-up em `survey_responses`)

Handler: [handlers/surveys.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/surveys.ts#L127-L154)

### `analytics` (autenticado)

- `GET /api/analytics?action=system-overview`
- `GET /api/analytics?action=survey-executive`
- `GET /api/analytics?action=survey-live-feed`

Handler: [handlers/analytics.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/analytics.ts#L20-L35)

Docs de indicadores (cálculo e parâmetros):

- [DASHBOARD_SIMPLE_INDICATORS.md](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/DASHBOARD_SIMPLE_INDICATORS.md)

### `crm` (autenticado)

- `GET /api/crm?action=list-customer-tasks`
- `POST /api/crm?action=create-task`
- `POST /api/crm?action=update-task`

Handler: [handlers/crm.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/crm.ts#L7-L18)

### `clients` (autenticado)

- `GET /api/clients?action=list`
- `POST /api/clients?action=create`
- `POST /api/clients?action=update`
- `POST /api/clients?action=delete`

Handler: [handlers/clients.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/clients.ts#L11-L19)

### `google-reviews`

#### Tenant (autenticado)

- `GET /api/google-reviews?action=summary`
- `GET /api/google-reviews?action=list`
- `GET /api/google-reviews?action=list-by-customer`
- `GET /api/google-reviews?action=list-places`
- `POST /api/google-reviews?action=upsert-place`
- `POST /api/google-reviews?action=toggle-place`
- `POST /api/google-reviews?action=update-status`
- `POST /api/google-reviews?action=link-customer`
- `POST /api/google-reviews?action=create-task`
- `GET /api/google-reviews?action=get-alert-settings`
- `POST /api/google-reviews?action=set-alert-settings`
- `GET /api/google-reviews?action=list-actions`
- `GET /api/google-reviews?action=list-actions-by-customer`
- `POST /api/google-reviews?action=add-action`
- `POST /api/google-reviews?action=ingest-now` (roda ingestão “agora” para o tenant)

#### Cron / sistema (pode exigir segredo)

- `GET /api/google-reviews?action=ingest` (coleta para um tenant ou para todos com `google_places.is_active=true`)
- `POST /api/google-reviews?action=ingest-manual`

Handler: [handlers/google-reviews.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/google-reviews.ts#L8-L45)

Observação operacional: ver [README.md](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/README.md#L82-L99) (`CRON_SECRET` em header ou query).

### `whatsapp` (autenticado)

- `GET /api/whatsapp?action=list-instances`
- `POST /api/whatsapp?action=create-instance`
- `POST /api/whatsapp?action=delete`
- `POST /api/whatsapp?action=check-status`
- `GET /api/whatsapp?action=get-qr`
- `POST /api/whatsapp?action=disconnect`
- `POST /api/whatsapp?action=configure-webhook`

Handler: [handlers/whatsapp.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/whatsapp.ts#L10-L24)

### `webhooks` (mix de autenticado e chaveado)

- `GET /api/webhooks?action=list-trigger-configs` (autenticado)
- `POST /api/webhooks?action=create-trigger-config` (autenticado)
- `POST /api/webhooks?action=update-trigger-config` (autenticado)
- `POST /api/webhooks?action=delete-trigger-config` (autenticado)
- `POST /api/webhooks?action=trigger-whatsapp-survey` (externo; valida `X-Webhook-Key`)

Handler: [handlers/webhooks.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/webhooks.ts#L42-L54)

### `vouchers` (autenticado)

- `GET /api/vouchers?action=list`
- `POST /api/vouchers?action=create`
- `POST /api/vouchers?action=update`
- `POST /api/vouchers?action=delete`
- `POST /api/vouchers?action=redeem`
- `GET /api/vouchers?action=usage-list`

Handler: [handlers/vouchers.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/vouchers.ts#L44-L59)

### `plans` (autenticado)

- `POST /api/plans?action=validate-limits`
- `POST /api/plans?action=check-feature`
- `GET /api/plans?action=list`

Handler: [handlers/plans.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/plans.ts#L7-L14)

### `health` (público)

- `GET /api/health` (sem `action`)

Handler: [handlers/health.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/health.ts#L4-L10)

### `notifications` (autenticado; parte super admin)

- `GET /api/notifications?action=active` (autenticado)
  - Retorna `{ videos, notices, preferences }` baseado na data/hora atual.
- Preferências por usuário (autenticado)
  - `GET /api/notifications?action=preferences:get`
  - `POST /api/notifications?action=preferences:record-view`
  - `POST /api/notifications?action=preferences:dismiss-today`
- Administração (super admin)
  - `GET /api/notifications?action=list`
  - `POST /api/notifications?action=create`
  - `POST /api/notifications?action=update`
  - `POST /api/notifications?action=delete`

Referências:

- [handlers/notifications.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/notifications.ts)

### `payments` / `subscriptions` / `consumption`

Esses recursos existem, mas no momento estão marcados como “not fully implemented yet” no handler.

Referências:

- [handlers/payments.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/payments.ts)
- [handlers/subscriptions.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/subscriptions.ts)
- [handlers/consumption.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/consumption.ts)
