# Documentação — AvaliaZap System

Este diretório consolida o contexto do sistema (arquitetura, regras de negócio, multi-tenant, API e banco) para você conseguir retomar o desenvolvimento em qualquer IDE sem “caçar” informação no código.

## Comece por aqui

- Visão geral e fluxo ponta-a-ponta: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Regras de multi-tenant e isolamento: [MULTI_TENANT.md](./MULTI_TENANT.md)
- Auth, onboarding e ciclo de vida de usuários: [AUTH_ONBOARDING.md](./AUTH_ONBOARDING.md)
- Regras de negócio por módulo: [DOMAIN_RULES.md](./DOMAIN_RULES.md)
- Referência de API (`/api/<resource>?action=...`): [API_REFERENCE.md](./API_REFERENCE.md)
- Banco (entidades, índices, RLS/policies): [DATABASE.md](./DATABASE.md)
- Operação (env, cron, webhooks, troubleshooting): [OPERATIONS.md](./OPERATIONS.md)
- Contratos das Supabase Edge Functions (fora do repo): [EDGE_FUNCTIONS_CONTRACTS.md](./EDGE_FUNCTIONS_CONTRACTS.md)

## Documentos já existentes no repo (úteis)

- Padrão de conversão de avaliação (0–10 / 0–5 / NPS): [avaliacoes.md](./avaliacoes.md)
- Migração CRM (base44 → Vercel/Supabase): [CRM_MIGRATION.md](./CRM_MIGRATION.md)
- Google Reviews (módulo + cron): [README.md](../README.md)

### Dashboard (auditoria e validação)

- Dashboard simples:
  - Indicadores: [DASHBOARD_SIMPLE_INDICATORS.md](../DASHBOARD_SIMPLE_INDICATORS.md)
  - Auditoria de dados: [DASHBOARD_SIMPLE_DATA_AUDIT.md](../DASHBOARD_SIMPLE_DATA_AUDIT.md)
  - Relatório de validação: [DASHBOARD_SIMPLE_VALIDATION_REPORT.md](../DASHBOARD_SIMPLE_VALIDATION_REPORT.md)
- Dashboard avançado:
  - Indicadores: [DASHBOARD_ADVANCED_INDICATORS.md](../DASHBOARD_ADVANCED_INDICATORS.md)
  - Auditoria de dados: [DASHBOARD_ADVANCED_DATA_AUDIT.md](../DASHBOARD_ADVANCED_DATA_AUDIT.md)
  - Relatório de validação: [DASHBOARD_ADVANCED_VALIDATION_REPORT.md](../DASHBOARD_ADVANCED_VALIDATION_REPORT.md)

## “Mapa mental” do código (onde olhar)

- Frontend (SPA):
  - Rotas/páginas: [`src/pages/*`](../src/pages)
  - Layout e guardas: [`src/Layout.jsx`](../src/Layout.jsx)
  - Auth + sessão: [`src/lib/AuthContext.jsx`](../src/lib/AuthContext.jsx)
  - Helpers de API: [`src/lib/supabase.ts`](../src/lib/supabase.ts)
- Backend (Vercel Function única):
  - Roteador: [`api/[...path].ts`](../api/%5B...path%5D.ts)
  - Handlers por recurso: [`handlers/*`](../handlers)
- Banco (Supabase):
  - Migrations versionadas: [`supabase/migrations/*`](../supabase/migrations)
  - Scripts auxiliares (setup/diagnóstico): [`database/*`](../database)

