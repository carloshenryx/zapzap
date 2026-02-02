# Validação — Indicadores do Dashboard Simples (Painel Executivo)

Este documento lista os indicadores exibidos no **Dashboard em modo Simples** (“Painel Executivo”), incluindo **nomes**, **fórmulas**, **fontes de dados** e **onde o cálculo acontece**.

Escopo: componente [ExecutiveDashboard.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/ExecutiveDashboard.jsx) consumindo o backend `/api/analytics?action=survey-executive` (cálculo em [analytics.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/analytics.ts#L164-L323)).

## 1) Fontes de dados e endpoint

### 1.1 Endpoint
- GET `/api/analytics?action=survey-executive`
  - Chamado via `fetchAPI('/analytics?...')` (frontend injeta `/api`): [supabase.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/lib/supabase.ts#L34-L56)
  - Implementação: [getSurveyExecutive](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/analytics.ts#L164-L323)

### 1.2 Parâmetros relevantes
- `period`: `today|week|month|all|custom`
- `start`, `end`: usados quando `period=custom` (ISO string)
- `template_id`: `all` ou id do template
- `bad_threshold`: limiar “ruim” em escala 1..5 (default 2)
- `good_threshold`: limiar “bom” em escala 1..5 (default 4)
- `low_ratings_limit`: limite de itens na lista “Clientes que avaliaram ruim” (default 30, max 100)

### 1.3 Tabela/campos de origem
Tabela: `survey_responses`, campos usados no cálculo:
- `created_at` (obrigatório para filtros e tendência)
- `template_id` (filtro)
- `overall_rating` e/ou `custom_answers` (para score e média, via normalização)
- `google_redirect_triggered` (se existir; senão fallback sem esse campo)
- `customer_name`, `customer_phone`, `customer_email` (para “identificados” e cards)
- `followup_status`, `followup_note` (tratativa na lista de ruins, se existir)

## 2) Normalização de rating (regra do backend)
Implementação: [analytics.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/analytics.ts#L141-L162)
- Se `overall_rating` é número: usa ele
- Senão: pega o primeiro número em `custom_answers`
- Normaliza para score 0–10:
  - `<=5` → multiplica por 2
  - `<=10` → usa como está
  - `<=100` → divide por 10
- Converte para “estrelas” (0–5) como `score10 / 2` (1 casa no retorno de low_ratings; 2 casas no avg)

## 3) Indicadores exibidos (KPIs e seções)

### 3.1 KPI — Avaliação média (0–5)
- UI: “Avaliação média”
- Fonte do valor exibido: `kpis.avg_rating`
- Fórmula:
  - Base: apenas respostas com score válido (`ratingCount`)
  - `avg_rating = round2( (sum(score10) / ratingCount) / 2 )`
- Base exibida na UI: `kpis.total_responses` (que na verdade é `ratingCount`)

### 3.2 KPI — Boas (≥ good_threshold)
- UI: “Boas (≥4)”
- Fonte: `kpis.good_count`
- Fórmula: `count(score10 >= good_threshold*2)` em respostas “rated”
- Observação: `good_threshold` é parametrizável; UI usa 4 como padrão.

### 3.3 KPI — Ruins (≤ bad_threshold)
- UI: “Ruins (≤2)”
- Fonte: `kpis.bad_count`
- Fórmula: `count(score10 <= bad_threshold*2)` em respostas “rated”
- Extra exibido: “Identificados”: `kpis.bad_identified_count`
  - Fórmula: `count(score10 <= bad_threshold*2 AND (name OR phone OR email))`

### 3.4 KPI — Redirecionados Google
- UI: “Redirecionados Google”
- Fonte: `kpis.google_redirect_count`
- Fórmula: `count(google_redirect_triggered == true)` (considera todas as respostas do período, com ou sem rating)
- Observação: backend tenta buscar o campo; se não existir na tabela, faz fallback para um select menor (sem esse campo), o que zera este KPI.

### 3.5 Tendência (stacked bars + linha de média)
Seção: “Tendência”
- Fonte: `trend[]`
- Agrupamento: por dia (chave `YYYY-MM-DD` via `created_at`)
- Para cada dia:
  - `total_submissions`: total de respostas do dia (com ou sem rating)
  - `total`: total de respostas com rating no dia
  - `good|neutral|bad`: contagens em respostas com rating, conforme thresholds
  - `avg_rating`: média diária em 0–5 (2 casas)

### 3.6 Lista — Clientes que avaliaram ruim
Seção: “Clientes que avaliaram ruim”
- Fonte: `low_ratings[]`
- Regra:
  - filtra respostas com rating e `score10 <= bad_threshold*2`
  - ordena por `created_at DESC`
  - limita por `low_ratings_limit`
- O backend devolve `overall_rating` normalizado em 0–5 quando possível (1 casa), para a UI exibir.

### 3.7 Painel “Ao vivo”
Componente: [LiveResponsesPanel.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/LiveResponsesPanel.jsx)
- Endpoint: GET `/api/analytics?action=survey-live-feed&limit=20&template_id=...`
- Fonte: `survey_responses` (últimas N respostas por `created_at DESC`)
- UI usa `getUnifiedScore5` para exibir nota (0–5) e rótulo.

