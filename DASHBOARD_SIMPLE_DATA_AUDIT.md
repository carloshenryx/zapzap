# Validação — Auditoria dos Dados de Entrada (Dashboard Simples)

Este documento registra a auditoria de integridade dos dados que alimentam o **Dashboard Simples / Painel Executivo**.

## Execução
- Script: [validate-dashboard-simple.mjs](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/scripts/validate-dashboard-simple.mjs)
- Execução (exemplo):
  - `node scripts/validate-dashboard-simple.mjs --tenant <TENANT_ID> --period month --template all --out validation_runs/simple_month_all.json`
- Snapshot gerado (exemplo real): [simple_month_all.json](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/validation_runs/simple_month_all.json)

## Checagens de integridade aplicadas
- `created_at`: presença e parse válido (impacta filtro por período e tendência)
- `template_id`: presença (impacta filtro por template)
- `overall_rating/custom_answers`: existência de score computável (impacta média, good/bad/neutral, low_ratings)
- `google_redirect_triggered`: presença do campo (quando não existe na tabela, KPI pode ficar zerado)
- `custom_answers`: tipo esperado (objeto quando presente)

## Resultado (tenant analisado no snapshot)
Resumo do snapshot [simple_month_all.json](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/validation_runs/simple_month_all.json):
- Total de respostas no período: 38
- Respostas com rating computável (`total_responses` no KPI): 8
- Respostas sem rating computável: 30 (79%)
- `created_at` ausente/ inválido: 0
- `template_id` ausente: 0
- Campo `google_redirect_triggered`: presente (0 nulos)

## Impacto direto nos KPIs do Painel Executivo
Como parte das respostas não possui rating:
- `avg_rating`, `good_count`, `neutral_count`, `bad_count` e `low_ratings` consideram **somente** respostas com rating computável (8 no snapshot).
- `total_submissions` representa o total bruto de submissões (38 no snapshot), útil para diagnosticar “respostas sem nota”.

