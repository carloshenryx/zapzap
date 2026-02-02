## Diagnóstico (Estado Atual)
- Os arquivos em scripts/ (xCRM.jsx, xCRMTasks.jsx, xCustomerDetail.jsx, etc.) são referência do legado Base44: eles dependem de base44.auth.me() e base44.entities.*.
- O app atual já migrou boa parte do CRM/Clientes para Supabase direto no frontend:
  - CRM principal: usa survey_responses, crm_tasks, customer_segments, crm_automations, crm_dashboard_configs.
  - Customers: usa survey_responses + cruza com crm_tasks.
- Pendências principais de paridade com os scripts Base44:
  - Página CRMTasks (src/pages/CRMTasks.jsx) ainda usa Base44.
  - CustomersExportDialog (src/components/customers/CustomersExportDialog.jsx) ainda usa Base44 para “user” e “tenant”.
  - CustomerDetail atual não cobre as funcionalidades extras do xCustomerDetail.jsx (notas, movimentações/saldo, tratativas, histórico de vouchers e interações manuais).
- Vercel: vercel.json já reescreve /api/* para api/[...path].ts, mas existem vários arquivos em api/*.ts e api/webhooks/* que potencialmente contam como “funções” no plano Hobby.

## 1) Análise Minuciosa dos Arquivos Base44 (scripts/)
### Funcionalidades mapeadas
- xCRM.jsx
  - Dashboard CRM com: viewMode list/kanban, “detratores urgentes”, estatísticas, widgets configuráveis e persistência por usuário (CRMDashboardConfig).
  - Fontes de dados: SurveyResponse, CRMTask, CustomerSegment, CRMAutomation.
- xCRMTasks.jsx
  - Lista global de tarefas do tenant.
  - Filtros (status/prioridade) e ações de update (pending → in_progress/completed).
- xCRMAutomations.jsx
  - Placeholder (sem lógica).
- xCustomers.jsx
  - Lista de clientes derivada de respostas, modal com histórico, exportação.
- xcustomers/CustomersExportDialog.jsx
  - Exportação Excel/PDF com seleção de campos + cabeçalho com tenant e usuário.
- xCustomerDetail.jsx
  - “Ficha completa do cliente” com tabs: Timeline, Notas, Movimentações, Tratativas, Vouchers, Pesquisas, Tarefas.
  - CRUD adicional:
    - Notas: criar, fixar (pin), excluir.
    - Movimentações: criar e manter saldo.
    - Tratativas: criar e atualizar status/resolução.
    - Vouchers: conceder ao cliente (criar voucher_usage e incrementar vouchers.current_usage).
    - Interações: agrega mensagens e eventos.

## 2) Mapeamento Base44 → Supabase/Vercel (o que será migrado)
### Tabelas/Entidades
- SurveyResponse → survey_responses (já existe/uso atual).
- CRMTask → crm_tasks (já existe/uso atual; API /api/crm já opera nela).
- CustomerSegment → customer_segments (já existe/uso atual).
- CRMAutomation → crm_automations (já existe/uso atual).
- CRMDashboardConfig → crm_dashboard_configs (já existe/uso atual).
- CustomerNote → NOVA tabela crm_customer_notes.
- CustomerMovement → NOVA tabela crm_customer_movements (+ view opcional com saldo calculado).
- CustomerTreatment → NOVA tabela crm_customer_treatments.
- CustomerInteraction → NOVA tabela crm_customer_interactions (para registrar interações manuais/automação; whatsapp_messages permanece como fonte real de WhatsApp).
- Voucher/VoucherUsage → vouchers e voucher_usage (já existe via handlers/vouchers.ts).

### Endpoints/API (mantendo o limite de 12 funções)
- Estratégia: consolidar para 1 única Function (api/[...path].ts) e mover/centralizar tudo em handlers/.
- CRM:
  - Reusar /api/crm?action=... (handlers/crm.ts) e estender ações somente se necessário.
- Vouchers:
  - Reusar /api/vouchers?action=generate (já cria voucher_usage e incrementa uso) ou criar ação autenticada “grant” (melhor segurança).
- Para notas/movimentações/tratativas/interações: preferir Supabase direto no frontend com RLS (reduz dependência de API e evita criar novas rotas).

## 3) Implementação da Migração (sem Base44)
### 3.1 Remover dependências base44 na área CRM/Clientes
- Refatorar src/pages/CRMTasks.jsx para:
  - usar useAuth() (tenant_id) + supabase.from('crm_tasks') para listar.
  - usar fetchAPI('/crm?action=update-task') OU supabase.update com RLS para atualizar status.
- Refatorar src/components/customers/CustomersExportDialog.jsx para:
  - usar useAuth() e supabase para buscar tenants (tabela tenants) e dados do usuário (user_profiles e/ou auth user).
  - manter Excel/PDF e seleção de campos idênticas.

### 3.2 Paridade do xCustomerDetail.jsx (ficha completa)
- Expandir src/pages/CustomerDetail.jsx para incluir:
  - Tabs extras: Notas, Movimentações, Tratativas, Vouchers.
  - Timeline unificada (pesquisas + whatsapp_messages + tarefas + notas + interações manuais).
  - Dialogs de criação (nota, movimentação, tratativa, conceder voucher) com validação.
- Persistência de dados:
  - Notas: supabase insert/update/delete em crm_customer_notes.
  - Movimentações: supabase insert em crm_customer_movements; saldo calculado via view (recomendado) ou soma no client.
  - Tratativas: supabase insert/update em crm_customer_treatments.
  - Vouchers: chamar fetchAPI('/vouchers?action=generate') passando voucher_id + customer_email/phone/name.

### 3.3 Consolidação para não exceder 12 Functions na Vercel
- Remover arquivos redundantes em api/*.ts e api/webhooks/*, mantendo apenas api/[...path].ts.
- Garantir que vercel.json roteie também /functions/* para o catch-all (ou para /api/[...path].ts?path=webhooks/...).
- Manter handlers/* como módulos internos (não contam como functions).

## 4) Integração com Padrões Existentes
- Usar AuthContext (userProfile.tenant_id) como fonte de tenant.
- Usar supabase (frontend) para leituras/gravações com RLS e fetchAPI apenas onde houver necessidade de lógica privilegiada/atômica.
- Manter convenções atuais: react-query, toasts (sonner), tratamento de erro via mensagens legíveis.

## 5) Banco de Dados (Supabase): migrações e RLS
- Criar migrations Supabase para:
  - crm_customer_notes, crm_customer_movements, crm_customer_treatments, crm_customer_interactions.
  - índices por (tenant_id, customer_email) e (tenant_id, customer_phone) e created_at.
  - políticas RLS: permitir CRUD por tenant_id conforme claim tenant_id no JWT (app_metadata) e/ou join com user_profiles.
  - view opcional crm_customer_movements_with_balance usando window function para balance.

## 6) Testes e Validação
- Adicionar Vitest (dev) e criar testes mínimos:
  - unit: agrupamento de clientes e cálculo de métricas (rating/segmentos) extraídos para util.
  - unit: montagem de timeline (merge/sort) para CustomerDetail.
  - integração (mock): handlers/crm.ts update-task e vouchers generate (mockando supabase client).
- Validações manuais guiadas:
  - CRM (list/kanban, widgets, filtros), Customers (export), CRMTasks (filtros/updates), CustomerDetail (CRUD completo).

## 7) Documentação
- Criar docs/CRM_MIGRATION.md com:
  - tabela Base44 → Supabase (entidades/tabelas), ações e telas.
  - fluxo de dados (front ↔ supabase ↔ api catch-all) e justificativa do limite de funções.
  - checklist de deploy Vercel e variáveis.

## Entregáveis (após execução)
- CRM/Clientes 100% sem imports de base44.
- CustomerDetail com funcionalidades equivalentes/superiores ao xCustomerDetail.
- Apenas 1 function exposta (api/[...path].ts) para manter plano Hobby seguro.
- Migrações + RLS + testes + documentação.
