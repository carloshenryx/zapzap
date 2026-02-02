## Objetivo
Implementar a validação de expiração **internamente no login** (sem cron), cobrindo:
- trial: 7 dias corridos
- mensal: 30 dias corridos
- trimestral: 90 dias corridos
- anual: 12 meses corridos
E, quando expirado, bloquear acesso e conduzir para **upgrade/checkout**.

## Estado Atual (o que já existe)
- Trial expira por cálculo de `trial_start_date + 7 dias` e hoje já há bloqueio/UX via modal/checkout.
- O backend já consulta `subscriptions` em alguns pontos (ex.: listagem de tenants e limites), e há campos como `current_period_start/end` e `start_date/end_date` que podem ser usados como “data de contratação/vigência”.
- Existe um cron criado anteriormente para suspender tenants; você pediu para **não usar** isso.

## Estratégia (Fonte de verdade)
Centralizar a regra de expiração no **backend** e expor o resultado no `GET /api/auth?action=context`:
- Retornar `access` (bloqueado ou não) e `expires_at`/`reason`.
- O frontend (Login/Layout) só consome isso e decide qual modal abrir.

## Regras de cálculo (robustas)
1) **Trial**
- Se `tenant.plan_type` for trial (`freetrial` ou variações) e `trial_start_date` existir: `expires_at = trial_start_date + 7 dias`.

2) **Planos pagos**
- Buscar a “assinatura vigente” em `subscriptions` do tenant.
- Preferência de datas:
  - `expires_at`: `current_period_end` (ou `end_date`)
  - `starts_at`: `current_period_start` (ou `start_date`)
- Se não houver `expires_at` mas houver `starts_at`, calcular por ciclo:
  - mensal: `starts_at + 30 dias`
  - trimestral: `starts_at + 90 dias`
  - anual: `starts_at + 12 meses`
- Para descobrir o ciclo:
  - Preferir `plans.billing_cycle` via join (quando disponível)
  - Fallback: lookup em `plans` pelo nome do plano salvo em `subscriptions.plan_type`.

3) **Bloqueio**
- Se `now > expires_at`, `access.blocked = true` com `reason = 'trial_expired'` ou `reason = 'subscription_expired'`.
- Não alterar `tenants.status` automaticamente (sem cron). O bloqueio é **lógico** via `access`.

## Frontend (interceptor e UX)
1) **Login interceptor**
- Após `signIn`, chamar `GET /api/auth?action=context`.
- Se `access.blocked`:
  - `trial_expired` → abrir modal de upgrade
  - `subscription_expired` → abrir modal de renovação/upgrade
  - `tenant_inactive` → modal informativo (sem checkout) ou mensagem de suporte

2) **Guard dentro do app (sessão já logada)**
- No `Layout`, ao detectar `access.blocked`, exibir o mesmo modal e impedir uso normal.
- Para evitar duplicação de lógica no frontend, o `Layout` vai consumir o mesmo `access` vindo do backend.

3) **Modal único para expiração**
- Ajustar o modal existente para suportar:
  - título e descrição variando conforme o motivo (trial vs assinatura expirada)
  - listagem de planos (do Supabase `plans`) e CTA de checkout
- Redirecionar para `Checkout` com `tenant_id` + `plan` + um flag (`trial_expired` ou `subscription_expired`) mantendo compatibilidade.

## Checkout / Upgrade
- Reutilizar o fluxo atual (pagamento → `upgrade-tenant-plan`), preservando dados do tenant.
- Apenas garantir que, após upgrade, o backend passe a retornar `access.blocked=false`.

## Remoção do cron (o que será removido)
- Remover o endpoint e o agendamento no `vercel.json` relacionados ao cron.
- Manter a expiração 100% baseada no `access` calculado no login/context.

## Ajustes de planos (trimestral)
- Atualizar UI/admin de planos para aceitar `billing_cycle = 'quarterly'`.
- Garantir que o checkout e o modal mostrem corretamente o ciclo (mensal/trimestral/anual).

## Verificação
- Testar cenários:
  - trial dentro e fora do prazo
  - assinatura mensal/trimestral/anual dentro e fora do prazo (com e sem `current_period_end` preenchido)
  - upgrade após expiração liberando acesso
- Rodar build/lint/test do repo.

Se confirmar este plano, eu implemento as mudanças removendo o cron e adicionando a validação de expiração para todos os ciclos no login e no guard do app.