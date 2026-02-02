# Validação — Dashboard Simples (Painel Executivo)

Este relatório aplica o mesmo padrão de validação do Dashboard avançado ao **Dashboard simples** (“Painel Executivo”).

Referências:
- Inventário de indicadores/fórmulas: [DASHBOARD_SIMPLE_INDICATORS.md](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/DASHBOARD_SIMPLE_INDICATORS.md)
- Auditoria do dado bruto: [DASHBOARD_SIMPLE_DATA_AUDIT.md](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/DASHBOARD_SIMPLE_DATA_AUDIT.md)
- Script reprodutível: [validate-dashboard-simple.mjs](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/scripts/validate-dashboard-simple.mjs)
- Backend (cálculo): [analytics.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/analytics.ts#L88-L323)
- Frontend (exibição): [ExecutiveDashboard.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/ExecutiveDashboard.jsx)

## 1) Indicadores validados

### KPIs
- Avaliação média (`kpis.avg_rating`)
- Boas (`kpis.good_count`)
- Ruins (`kpis.bad_count`)
- Ruins identificados (`kpis.bad_identified_count`)
- Redirecionados Google (`kpis.google_redirect_count`)
- Base de respostas com nota (`kpis.total_responses`) e total bruto de submissões (`kpis.total_submissions`)

### Tendência
- Série diária com: `good|neutral|bad`, `avg_rating`, `total` (rated) e `total_submissions` (bruto).

### Lista de ruins
- `low_ratings`: ordenação, limite e normalização do `overall_rating` retornado.

### Ao vivo
- Feed de últimas respostas via `survey-live-feed` (validação por integridade de campos e normalização no frontend).

## 2) Validação dos dados de entrada (integridade)
Snapshot usado (tenant de exemplo):
- Mês, todos os templates: [simple_month_all.json](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/validation_runs/simple_month_all.json)

Achados relevantes:
- Alta proporção de respostas sem rating computável (79% no snapshot), o que reduz a base de `avg_rating`, `good/bad/neutral` e `low_ratings`.
- `created_at` e `template_id` consistentes (0 ausências no snapshot).

## 3) Verificação dos cálculos (reprodução do backend)
O script reproduz fielmente:
- normalização de score (0–10 → 0–5),
- thresholds em escala 1..5,
- contagens e médias,
- agregação diária (trend),
- ordenação/limite de `low_ratings`.

Status por indicador:
- **Aprovado** para KPIs/tendência/lista/ao vivo (consistência interna com o cálculo especificado no backend).

## 4) Teste de cenários (filtros do simples)

### Cenário A — Mês / all templates
- Snapshot: [simple_month_all.json](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/validation_runs/simple_month_all.json)
- Resultado (KPIs):
  - `total_submissions`: 38
  - `total_responses` (rated): 8
  - `avg_rating`: 2.25
  - `good_count`: 4
  - `bad_count`: 4
  - `bad_identified_count`: 4
- Status: **Aprovado**

### Cenário B — Mês / template ativo (76f0…)
- Snapshot: [simple_month_active_template.json](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/validation_runs/simple_month_active_template.json)
- Resultado:
  - `total_submissions`: 8 (todas com rating, `ratingNull=0`)
  - métricas iguais ao subconjunto filtrado
- Status: **Aprovado**

### Cenário C — Semana / all templates
- Snapshot: [simple_week_all.json](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/validation_runs/simple_week_all.json)
- Status: **Aprovado** (mesmo conjunto do mês no tenant de exemplo)

### Cenário D — Hoje / all templates
- Snapshot: [simple_today_all.json](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/validation_runs/simple_today_all.json)
- Status: **Aprovado** (0 respostas no dia de execução)

## 5) Inconsistências encontradas e correções aplicadas

### INC-S01 — Rotas do Vercel reescrevendo `/api/*` para `index.html`
- Sintoma: chamadas a `/api/analytics` retornam HTML da SPA (não JSON).
- Causa: `vercel.json` tinha um catch-all para `/(.*) -> /index.html` sem exceção para `/api`.
- Correção aplicada: adicionei rota explícita para `/api/(.*)` antes do catch-all.
  - Arquivo: [vercel.json](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/vercel.json)

### INC-S02 — Período `week` no backend não normalizava start para 00:00
- Sintoma: `period=week` (quando usado diretamente) começava com o horário atual (não meia-noite), podendo “cortar” parte do dia inicial.
- Correção aplicada: `start.setHours(0,0,0,0)` em `getPeriodRange` para `week`.
  - Arquivo: [analytics.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/analytics.ts#L88-L114)

## 6) Verificação geral de integração (estado final)
- Cálculos do Painel Executivo estão coerentes com os dados brutos e com as fórmulas implementadas no backend.
- Após correção de rotas, a infraestrutura de `/api/*` deixa de ser reescrita para SPA no deploy Vercel.\n+
