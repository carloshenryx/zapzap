## Status Atual (o que já foi feito)
- Mapeei onde o modo **Avançado** do Dashboard calcula e exibe indicadores (cálculo no frontend) e onde o modo **Simples** usa `/api/analytics` (cálculo no backend).
- Identifiquei os arquivos-chave do filtro avançado e dos cálculos:
  - [Dashboard.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx)
  - [AdvancedFilters.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/AdvancedFilters.jsx)
  - Componentes de cards no modo avançado: [CompletionRate.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/CompletionRate.jsx), [QuestionDistribution.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/QuestionDistribution.jsx), [NPSCSATTrend.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/NPSCSATTrend.jsx), [SentimentAnalysis.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/SentimentAnalysis.jsx), [KeywordExtraction.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/KeywordExtraction.jsx), [QuestionBreakdown.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/QuestionBreakdown.jsx), [VoucherFallbackAnalytics.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/VoucherFallbackAnalytics.jsx).

## O que falta para cumprir 100% do que você pediu
A sua última mensagem pede **validação completa e detalhada**, com checagem dos dados brutos, cálculo manual/script, testes de cenários, documentação e relatório de inconsistências. Eu ainda não executei essas validações numéricas com dados reais — apenas o levantamento do “o que existe” e “onde calcula”.

## Plano de Execução (para atender todos os 7 passos)
## 1) Identificação dos Indicadores (inventário formal)
- Gerar uma tabela (documento) listando **todos os indicadores que aparecem no modo Avançado**:
  - Nome do indicador (UI)
  - Definição / fórmula exata
  - Campo(s) e tabela(s) de origem (ex.: `survey_responses`, `consumption`, `subscriptions`, `survey_templates`, etc.)
  - Onde a fórmula está implementada (arquivo + função/bloco)
- Incluir também indicadores “derivados” (ex.: detractorsPercent, promotersPercent, CSAT) e os cards de drilldown.

## 2) Validação dos Dados de Entrada (integridade do dado bruto)
- Definir um checklist de integridade para `survey_responses`:
  - Campos de data: `created_at` vs `created_date` (uso misto no código)
  - Campos de rating: `overall_rating` vs respostas em `custom_answers` (uso misto)
  - Campos NPS/recomendação: `would_recommend` e como isso é preenchido
  - `template_id` presente vs filtro por template
  - `source` (manual_whatsapp/webhook/totem/qrcode/clicktotem) e consistência
- Produzir queries/relatórios (via scripts) para detectar:
  - Valores nulos/fora de faixa
  - Datas inválidas
  - Respostas sem template
  - Respostas com `custom_answers` inconsistentes

## 3) Verificação dos Cálculos (comparação “script vs dashboard”)
- Criar um script de verificação (Node/TS) que:
  - Busca dados diretamente do Supabase (idealmente com Service Role via env local)
  - Reimplementa as fórmulas exatamente como no frontend (Dashboard avançado)
  - Computa cada KPI (total, avgOverall, recommendRate, fiveStarCount, NPS, detractors/promoters %, distribuição por origem, etc.)
- Executar o script e comparar com os números renderizados (ou com “snapshots” exportados do dashboard).

## 4) Teste de Cenários (combinações do filtro avançado)
- Definir uma matriz de cenários e rodar o script com os mesmos filtros:
  - Intervalos de datas (somente start, somente end, ambos)
  - Template específico (ativo e inativo)
  - Faixa de rating (ex.: 0–5, 4–5, 1–2)
  - Segmento NPS (promoters/passives/detractors)
- Validar propriedades esperadas:
  - Monotonicidade (ex.: estreitar filtros não pode aumentar contagens indevidamente)
  - Coerência (ex.: promoters+passives+detractors == responsesWithRating)

## 5) Documentação das Validações
- Gerar um relatório em Markdown (ex.: `DASHBOARD_ADVANCED_VALIDATION.md`) contendo, para cada indicador:
  - Entrada usada (filtros + amostra/consulta)
  - Passos do cálculo
  - Resultado esperado (script)
  - Resultado observado (dashboard)
  - Status (aprovado/reprovado)

## 6) Relatório de Inconsistências e Sugestões
- Para cada divergência:
  - Indicador afetado
  - Exemplos de registros que causam a diferença
  - Causa provável (ex.: uso de `overall_rating` em um componente e `getUnifiedScore5` em outro; filtros min/max inconsistentes; período/parse de data; etc.)
  - Correção proposta no código (frontend ou backend)

## 7) Verificação Geral de Integração
- Conferir ponta a ponta:
  - A busca de respostas usada no modo avançado (Supabase direto) é consistente com o modo simples (`/api/analytics`)
  - Exportações (CSV/XLS) e drilldowns refletem os mesmos filtros
  - Cards (CompletionRate/QuestionDistribution/NPSCSATTrend/Sentiment/Keyword/Voucher) usam **a mesma base filtrada** quando aplicável

## Entregáveis
- Documento de inventário de indicadores (tabela completa)
- Script de validação reproduzível (rodável localmente)
- Relatório final com “aprovado/reprovado” por indicador
- Lista de correções no código (se houver divergências)

Confirma para eu sair do modo de planejamento e executar essas validações (incluindo criar scripts/arquivos e rodar verificações)?