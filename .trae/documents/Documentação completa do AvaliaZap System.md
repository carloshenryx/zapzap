## Objetivo
Consolidar o contexto do sistema (arquitetura, regras de negócio e multi-tenant) em documentação Markdown dentro do repo, para você usar em qualquer IDE.

## O que já levantei (base para a doc)
- Arquitetura React/Vite + Vercel (roteador único) + Supabase (Auth/Postgres/Storage).
- Multi-tenant por `tenant_id` + `app_metadata.tenant_id` no JWT; super admin por `app_metadata.is_super_admin`.
- Fluxos de onboarding (Signup → `/api/tenants?action=onboard`), rotas públicas (Survey), e dependências externas (Supabase Edge Functions para trial/checkout).

## Entregáveis (arquivos novos/atualizados em `docs/`)
1. `docs/INDEX.md`: mapa do projeto e links para cada doc.
2. `docs/ARCHITECTURE.md`: visão geral + diagrama (Mermaid) de fluxos (UI → API Vercel → Supabase / UI → Edge Functions).
3. `docs/MULTI_TENANT.md`: regras de isolamento, fontes de tenant, RLS vs service-role, exceções (rotas públicas/super admin).
4. `docs/AUTH_ONBOARDING.md`: criação de usuário, `user_profiles`, como/onde `app_metadata` é setado, e o que quebra se faltar.
5. `docs/DOMAIN_RULES.md`: regras de negócio por módulo (Surveys, Dashboard métricas, CRM, Google Reviews, WhatsApp triggers, Vouchers, tratativas/follow-up, anexos).
6. `docs/API_REFERENCE.md`: catálogo dos endpoints `/api/<resource>?action=...` (inputs/outputs, auth required, erros).
7. `docs/DATABASE.md`: entidades/tabelas principais, chaves/índices, políticas RLS versionadas no repo e lacunas.
8. `docs/OPERATIONS.md`: variáveis de ambiente, cron de ingestão, webhooks, troubleshooting (auth/tenant/RLS) e checklist de deploy.
9. `docs/EDGE_FUNCTIONS_CONTRACTS.md`: contrato (o que o front espera) das Edge Functions usadas no Checkout/Trial, com pontos a completar quando você trouxer o código dessas functions.

## Método
- Ler os handlers e as migrations como “fonte de verdade” e cruzar com os docs existentes (Dashboard audits, `docs/avaliacoes.md`, README).
- Documentar regras como: permissões, validações, invariantes (ex.: `tenant_id` obrigatório), e limites/planos.
- Criar links diretos para arquivos e trechos importantes do código.

## Validação
- Conferir que cada endpoint citado existe e que cada regra tem referência no código/migration.
- Rodar `npm test`/`npm run lint` depois (quando sair do plan mode) para garantir que a doc não introduz mudanças acidentais.

## Pendência conhecida
- O repo não contém o código das Supabase Edge Functions (trial/checkout/upgrade). Vou documentar o contrato atual e deixar marcado o que depende delas.
