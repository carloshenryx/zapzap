# Validação — Auditoria dos Dados de Entrada (Dashboard Avançado)

Este documento registra a checagem de integridade dos dados brutos que alimentam os cálculos do Dashboard em modo Avançado.

## Execução
- Script: [validate-dashboard-advanced.mjs](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/scripts/validate-dashboard-advanced.mjs)
- Execução (exemplo):
  - `node scripts/validate-dashboard-advanced.mjs --json`
- Tenant analisado (default auto-detect): `e20b50a5-2cf0-4a10-8bbb-ec72b2601b6a`
- Amostra: últimas 2 respostas (`limit=1000`, mas só havia 2 no tenant)

## Checagens de integridade aplicadas
- Datas:
  - Presença de `created_at` ou `created_date`
  - Validade de parse de data
  - Divergência entre `created_at` e `created_date` quando ambos existem
- Chaves/relacionamentos:
  - Presença de `template_id`
  - Presença de `source`
- Rating (base dos indicadores de nota e NPS):
  - `overall_rating` numérico OU primeiro número em `custom_answers`
  - `normalizeTo10` deve resultar em `0..10`
- Recomendação:
  - Presença de `would_recommend`
- Estrutura:
  - `custom_answers` deve ser objeto quando presente

## Resultado (status por checagem)

### 1) Datas
- `missingCreatedAtOrDate`: 0
- `invalidDate`: 0
- `createdAtVsCreatedDateMismatch`: 0

### 2) Template/Origem
- `missingTemplateId`: 0
- `missingSource`: 0

### 3) Rating
- `ratingNull`: 2 (100% das respostas analisadas)
  - Exemplos (ids): `e0faf4d5-249b-46b9-9f6f-c5a0a320317f`, `1d93931c-9896-48fe-a921-522ae58d1d18`
- `ratingOutOfExpectedRange`: 0
- `ratingHistogram10`: vazio (não há scores calculáveis)

### 4) Recomendação / Estrutura
- `wouldRecommendMissing`: 0
- `customAnswersNotObject`: 0

## Impacto direto nos indicadores do Dashboard
Como `ratingNull` é 100% na amostra:
- `responsesWithRating` vira 0
- `avgOverall` vira 0
- `fiveStarCount` vira 0
- `nps/promoters/passives/detractors` viram 0

Isso significa que, para este tenant, o Dashboard Avançado vai exibir **contagens totais corretas**, mas os indicadores de **nota/NPS** ficam “zerados” por falta de dado de rating.\n+
