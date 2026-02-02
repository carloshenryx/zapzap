# Validação — Indicadores do Dashboard (Filtro Avançado)

Este documento lista os indicadores exibidos no **Dashboard em modo Avançado**, suas **fórmulas**, e a **fonte de dados** (tabelas/campos) usada pelo sistema.

Escopo: modo Avançado do Dashboard (com “Filtros Avançados” ativo). Implementação principal em [Dashboard.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx).

## 1) Filtros que impactam os indicadores

### 1.1. Filtro de Período (sempre aplicado no modo Avançado)
- UI: [PeriodFilter](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx#L154-L198) (com preferências em `dashboard_preferences`).
- Aplicação: filtra `allResponses` → `responses` antes dos filtros avançados.
- Fonte: `survey_responses.created_at` (observação: há usos mistos de `created_date` em outras partes do código; ver relatório de inconsistências).

### 1.2. Filtros Avançados (quando “Filtros Avançados” está visível)
- UI: [AdvancedFilters.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/AdvancedFilters.jsx)
- Aplicação: [applyAdvancedFilters](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx#L289-L322) e [filteredResponsesForMetrics](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx#L324-L327)

Filtros:
- **Template**: `response.template_id === selectedTemplate`
- **Data Inicial**: `responseDate >= startDate` (normaliza 00:00)
- **Data Final**: `responseDate <= endDate` (normaliza 23:59:59.999)
- **Faixa de Rating (0–5)**: `getUnifiedScore5(response)` dentro de `[min, max]`
- **Segmento NPS** (na prática usa score 0–10 derivado do rating): `getUnifiedScore10(response)`
  - promotores: `>= 9`
  - passivos: `7..8`
  - detratores: `<= 6`

## 2) Fonte de dados (modo Avançado)
- Respostas: `survey_responses` via Supabase client (frontend): [Dashboard.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx#L139-L152)
- Templates: `survey_templates` (frontend): [Dashboard.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx#L245-L256)
- Normalização de rating (0–10 e 0–5): [ratingUtils.js](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/lib/ratingUtils.js#L1-L61)

## 3) Indicadores principais (cards “Indicadores Principais”)

Implementação: bloco `useMemo` em [Dashboard.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx#L328-L408).

### 3.1 Total de Respostas
- Nome na UI: “Total de Respostas”
- Fórmula: `totalResponses = filteredResponsesForMetrics.length`
- Fonte: `survey_responses` (após filtro período + filtros avançados)

### 3.2 Respostas com Nota
- Uso interno (não aparece como card dedicado): `responsesWithRating`
- Fórmula: `filteredResponsesForMetrics.filter(r => getUnifiedScore10(r) !== null)`
- Fonte: `survey_responses.overall_rating` ou primeiro número em `survey_responses.custom_answers`

### 3.3 Avaliação Média (0–5)
- Nome na UI: “Avaliação Média”
- Fórmula:
  - `avgOverall = average(getUnifiedScore5(r))` somente em `responsesWithRating`
  - exibido com 1 casa: `toFixed(1)` (string)
- Fonte: `survey_responses.overall_rating` ou `custom_answers` (normalizado)

### 3.4 Taxa de Recomendação (%)
- Nome na UI: “Taxa de Recomendação”
- Fórmula: `recommendRate = round(count(would_recommend==true) / totalResponses * 100)`
- Fonte: `survey_responses.would_recommend`
- Observação: usa `totalResponses` como denominador (inclui respostas sem nota).

### 3.5 5 Estrelas (contagem)
- Nome na UI: “5 Estrelas”
- Fórmula: `fiveStarCount = count(getUnifiedScore5(r) >= 4.5)` em `responsesWithRating`
- Fonte: rating normalizado

## 4) Distribuição de satisfação (pizza)
- Nome na UI: dentro do card de “Avaliações” (pizza)
- Fórmula (apenas em `responsesWithRating`):
  - 5 estrelas: `score5 >= 4.5`
  - 4 estrelas: `3.5 <= score5 < 4.5`
  - 3 estrelas: `2.5 <= score5 < 3.5`
  - <3: `score5 < 2.5`
- Fonte: rating normalizado

## 5) NPS (card “Análise NPS”)
- Implementação: [Dashboard.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx#L373-L407)
- População-base: `responsesWithRating` (com `score10 != null`)
- Segmentação:
  - Promotores: `score10 >= 9`
  - Passivos: `7 <= score10 <= 8`
  - Detratores: `score10 <= 6`
- Fórmulas:
  - `nps = round(((promoters - detractors) / responsesWithRating) * 100)`
  - `% detratores = round(detractors / responsesWithRating * 100)`
  - `% promotores = round(promoters / responsesWithRating * 100)`
- Fonte: rating normalizado (0–10) + `survey_responses`

## 6) Pesquisas por origem (card “Pesquisas por Origem”)
- Implementação: [Dashboard.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx#L384-L407)
- Fórmula:
  - `manual_whatsapp = count(source=='manual_whatsapp')`
  - `webhook = count(source=='webhook')`
  - `totem = count(source=='totem')`
  - `qrcode = count(source=='qrcode')`
  - `clicktotem = count(source=='clicktotem')`
  - `total = totalResponses`
- Fonte: `survey_responses.source`
- Observação: qualquer outro `source` não entra nos buckets (apenas no total).

## 7) Taxa de Conclusão (card “Taxa de Conclusão”)
- Implementação: [CompletionRate.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/CompletionRate.jsx#L6-L33)
- Base usada pelo componente: `responses` (filtrado apenas por período) e `templates` (tenant).
- Fórmula:
  - `totalQuestions = activeTemplate.questions.length`
  - `answeredQuestions = Object.keys(response.custom_answers || {}).length`
  - completas: `answeredQuestions === totalQuestions`
  - parciais: `0 < answeredQuestions < totalQuestions`
  - abandonadas: `total - completas - parciais`
  - taxa: `(completas / total) * 100`
- Fonte: `survey_templates.questions` e `survey_responses.custom_answers`
- Observação: ignora filtro avançado; ver relatório.

## 8) Distribuição por Pergunta (card “Distribuição por Pergunta”)
- Implementação: [QuestionDistribution.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/QuestionDistribution.jsx#L8-L43)
- Base: `responses` (período) + template ativo (tenant).
- Fórmula:
  - Seleciona a pergunta do template ativo.
  - Conta ocorrências por alternativa: `answerCounts[String(answer)]++` para `custom_answers[question.id]` não vazio.
  - `Total de respostas` do rodapé = soma dos counts.
- Fonte: `survey_templates.questions` e `survey_responses.custom_answers`
- Observação: ignora filtro avançado; ver relatório.

## 9) Evolução NPS/CSAT (card “NPS/CSAT ao Longo do Tempo”)
- Implementação: [NPSCSATTrend.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/NPSCSATTrend.jsx#L12-L62)
- Base: `responses` (período).
- Agrupamento:
  - day: `dd/MM`
  - week: `startOfWeek(date)` formatado `dd/MM`
  - month: `startOfMonth(date)` formatado `MMM/yy`
- Fórmulas por bucket:
  - `nps = ((promoters - detractors) / total_score10) * 100` (1 casa)
  - `csat = (count(score5 >= 4) / total_score5) * 100` (1 casa)
- Fonte: `survey_responses.created_at||created_date`, rating normalizado
- Observação: ordena por `period.localeCompare`, o que é frágil para datas; ver relatório.

## 10) Análise de Sentimento (card “Análise de Sentimento”)
- Implementação: [SentimentAnalysis.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/SentimentAnalysis.jsx#L23-L47)
- Base: respostas com `comment` não vazio.
- Fórmula: classificador por palavras-chave (positivo/negativo/neutral) e percentuais sobre `total comentários analisados`.
- Fonte: `survey_responses.comment`

## 11) Palavras-chave (card “Palavras-Chave Mais Mencionadas”)
- Implementação: [KeywordExtraction.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/KeywordExtraction.jsx#L29-L47)
- Base: respostas com `comment` e `overall_rating` em faixas fixas.
- Fórmula:
  - positivos: `comment` onde `overall_rating >= 4`
  - negativos: `comment` onde `overall_rating < 3`
  - tokenização (remove pontuação), stopwords, mantém palavras com tamanho > 3, top 15 por frequência.
- Fonte: `survey_responses.comment` + `survey_responses.overall_rating`
- Observação: usa `overall_rating` diretamente, diferente do restante que usa `getUnifiedScore*`; ver relatório.

## 12) Análise por Pergunta (card “Análise por Pergunta”)
- Implementação: [QuestionBreakdown.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/QuestionBreakdown.jsx#L9-L64)
- Base: template ativo + `responses` (período).
- Fórmulas:
  - para `stars|rating`: média simples e distribuição (1..5 ou 1..10) por igualdade.
  - para `boolean`: conta `true|'Sim'` e `false|'Não'`.
  - para `text`: amostra das primeiras 5 respostas.
- Fonte: `survey_templates.questions` e `survey_responses.custom_answers`
- Observação: ignora filtro avançado; ver relatório.

## 13) Vouchers e Fallback (card “Vouchers e Fallback”)
- Implementação atual: [VoucherFallbackAnalytics.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/VoucherFallbackAnalytics.jsx#L21-L46)
- Métricas:
  - `totalVouchersIssued = count(voucherUsages)`
  - `vouchersUsed = count(is_used)`
  - `taxa = vouchersUsed/total * 100`
  - “Templates perto do limite”: `current_uses/max_uses >= 0.8`
- Fonte prevista (pós-migração): tabelas `vouchers` e `voucher_usage` (API em [handlers/vouchers.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/vouchers.ts#L69-L85)); implementação atual ainda usa Base44 e precisa ser validada/ajustada no relatório.\n+
