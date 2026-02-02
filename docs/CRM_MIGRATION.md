# Migração CRM/Clientes (Base44 → Vercel/Supabase)

## Objetivo
Substituir dependências Base44 por Supabase + arquitetura atual (Vercel), mantendo (ou melhorando) as funcionalidades do CRM e gestão de clientes.

## Mapeamento Base44 → Supabase
| Base44 (scripts/) | Supabase (tabela/fonte) | Observações |
|---|---|---|
| SurveyResponse | survey_responses | Fonte principal de “Clientes” e métricas (NPS/CSAT). |
| CRMTask | crm_tasks | Ações via API `/api/crm?action=...` e/ou leitura direta no front. |
| CustomerSegment | customer_segments | Segmentação no CRM. |
| CRMAutomation | crm_automations | Automação (configurações). |
| CRMDashboardConfig | crm_dashboard_configs | Preferências do dashboard (widgets/view mode). |
| CustomerNote | crm_customer_notes | Notas do cliente (fixar/excluir). |
| CustomerMovement | crm_customer_movements | Movimentações e cálculo de saldo no client. |
| CustomerTreatment | crm_customer_treatments | Tratativas (status/resolução). |
| CustomerInteraction | crm_customer_interactions + whatsapp_messages | `whatsapp_messages` é fonte real de WhatsApp; `crm_customer_interactions` cobre interações manuais/extra. |
| Voucher / VoucherUsage | vouchers / voucher_usage | Uso em CustomerDetail via geração de voucher. |

## Telas afetadas
- CRM: [CRM.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/CRM.jsx)
- Clientes: [Customers.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Customers.jsx)
- Detalhe do cliente: [CustomerDetail.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/CustomerDetail.jsx)
- Tarefas do CRM: [CRMTasks.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/CRMTasks.jsx)
- Exportação: [CustomersExportDialog.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/customers/CustomersExportDialog.jsx)

## API / Vercel (limite de funções)
### Estratégia
- Deploy roteia tudo por um único handler: [api/[...path].ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/[...path].ts).
- Isso evita “estourar” o limite de Functions do plano Hobby, pois o tráfego de `/api/*` e `/functions/*` passa pelo catch-all.

### Rotas (Vercel)
- Configuração em [vercel.json](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/vercel.json): regras de `/api/*` e `/functions/*` vêm antes de `handle: filesystem`.

## Banco de dados (Supabase)
### Migração
- Novas tabelas CRM por cliente + RLS estão em:
  - [20260125010000_crm_customer_entities.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260125010000_crm_customer_entities.sql)

### RLS (visão geral)
- Todas as tabelas novas usam `tenant_id` e políticas `authenticated` por tenant via claim `app_metadata.tenant_id` no JWT.

## Guia rápido de uso (CustomerDetail)
- Notas: criar, fixar, desafixar e excluir.
- Movimentações: registrar valor e tipo (compra/crédito/débito/estorno).
- Tratativas: criar e alterar status (em andamento/resolvida).
- Vouchers: selecionar um voucher ativo e conceder ao cliente (gera código e registra uso).

## Testes
- Runner: Vitest (`npm test`).
- Principais arquivos:
  - [crmUtils.test.js](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/lib/crmUtils.test.js)
  - [ratingUtils.test.js](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/lib/ratingUtils.test.js)
  - [crm.test.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/crm.test.ts)
  - [vouchers.test.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/vouchers.test.ts)

