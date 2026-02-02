# Validação — Dashboard (Filtro Avançado)

Este relatório consolida a validação pedida: indicadores, dados de entrada, verificação dos cálculos, cenários de filtros, documentação por indicador e inconsistências encontradas.

Arquivos-base:
- Inventário e fórmulas: [DASHBOARD_ADVANCED_INDICATORS.md](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/DASHBOARD_ADVANCED_INDICATORS.md)
- Auditoria de integridade do dado: [DASHBOARD_ADVANCED_DATA_AUDIT.md](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/DASHBOARD_ADVANCED_DATA_AUDIT.md)
- Implementação do Dashboard avançado: [Dashboard.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx)
- Script de validação (reprodução dos cálculos): [validate-dashboard-advanced.mjs](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/scripts/validate-dashboard-advanced.mjs)

## 1) Indicadores validados (resumo)
Indicadores principais (KPIs) validados via reprodução do cálculo do Dashboard:
- Total de Respostas
- Avaliação Média (0–5)
- Taxa de Recomendação (%)
- 5 Estrelas (contagem)
- Distribuição de satisfação (5/4/3/<3)
- NPS (promoters/passives/detractors + score + %)
- Pesquisas por Origem (manual_whatsapp/webhook/totem/qrcode/clicktotem)

Cards adicionais (modo Avançado) com fórmulas reproduzidas:
- Taxa de Conclusão
- Distribuição por Pergunta (primeira pergunta do template ativo)
- Evolução NPS/CSAT (dia/semana/mês)
- Análise de Sentimento
- Palavras-chave
- Análise por Pergunta

### Status por indicador (Aprovado/Reprovado)
Legenda:
- **Aprovado**: cálculo reproduzido e consistente; filtros aplicados como esperado.
- **Reprovado**: fórmula ou escopo de filtros não reflete a semântica do filtro avançado.

| Indicador / Card | Status | Motivo/Observação |
|---|---|---|
| Total de Respostas | Aprovado | Fórmula ok sobre `filteredResponsesForMetrics`. |
| Avaliação Média (0–5) | Aprovado | Fórmula ok (média em `responsesWithRating`). |
| Taxa de Recomendação (%) | Aprovado | Fórmula ok; inclui respostas sem nota no denominador (decisão de produto). |
| 5 Estrelas (contagem) | Aprovado | Fórmula ok (>=4.5). |
| Distribuição de satisfação | Aprovado | Buckets coerentes com o score 0–5. |
| NPS (score + segmentos) | Aprovado | Fórmula ok; filtro por segmento agora exclui respostas sem nota. |
| Pesquisas por origem | Aprovado | Contagem direta de `source`. |
| Taxa de Conclusão | Aprovado | Card agora recebe `filteredResponsesForMetrics`. |
| Distribuição por Pergunta | Aprovado | Card agora recebe `filteredResponsesForMetrics`. |
| Evolução NPS/CSAT | Aprovado | Card agora recebe `filteredResponsesForMetrics` e ordena por data-base. |
| Análise de Sentimento | Aprovado | Card agora recebe `filteredResponsesForMetrics`. |
| Palavras-chave | Aprovado | Card agora recebe `filteredResponsesForMetrics` e usa score normalizado. |
| Análise por Pergunta | Aprovado | Card agora recebe `filteredResponsesForMetrics`. |
| Vouchers e Fallback | Aprovado | Migrado para API Supabase (`/api/vouchers`) e campos alinhados. |

## 2) Validação do dado de entrada (integridade)
Principais achados com dados reais:
- Existe volume relevante de respostas sem rating computável (`overall_rating` e `custom_answers` sem número), o que zera parte das métricas de nota/NPS.
- Em um tenant com 38 respostas, 30 (79%) não possuem rating computável.

Execução reprodutível:
- Baseline com cards: `validation_runs/advanced_with_cards.json`
- Baseline KPI: `validation_runs/advanced_baseline.json`

## 3) Verificação dos cálculos (script vs fórmula)
O script implementa as mesmas fórmulas do Dashboard avançado para KPIs e cards, portanto:
- Resultado “script” == “implementação atual do código”, para os KPIs (aprovado como *consistência interna*).
- Onde houve discrepância, foi por **inconsistência de escopo dos filtros** e/ou **regras de filtro** (detalhado abaixo).

## 4) Teste de cenários (filtro avançado)

### Cenário A — Baseline (sem filtros avançados)
- Arquivo: `validation_runs/advanced_with_cards.json`
- Resultado (KPIs):
  - totalResponses: 38
  - responsesWithRating: 8
  - avgOverall: 2.3
  - recommendRate: 97%
  - fiveStarCount: 2
  - nps: -25
  - sourceCounts: total 38 (qrcode 7, clicktotem 31)
- Status: **Aprovado** (bate com a fórmula implementada)

### Cenário B — Filtro de rating 4–5
- Execução: `--min 4 --max 5`
- Arquivo: `validation_runs/scenario_rating_4_5.json`
- Observado (código atual):
  - responses_after_filters: 34 (não 8)
- Resultado esperado (semântica do filtro):
  - quando o usuário filtra por rating, respostas sem rating deveriam ser excluídas do conjunto filtrado.
- Status: **Reprovado** (antes das correções)

Após correção (INC-01):
- Arquivo: `validation_runs/scenario_rating_4_5_after_fix.json`
- Observado: `responses_after_filters: 4` (apenas respostas com nota na faixa)
- Status: **Aprovado**

### Cenário C — Segmento NPS “Promotores”
- Execução: `--nps promoters`
- Arquivo: `validation_runs/scenario_nps_promoters.json`
- Observado (código atual):
  - responses_after_filters: 32 (inclui 30 respostas sem nota + 2 promotores)
- Resultado esperado (semântica do filtro):
  - segmentação NPS deveria considerar somente respostas com score (0–10) válido.
- Status: **Reprovado** (antes das correções)

Após correção (INC-02):
- Arquivo: `validation_runs/scenario_nps_promoters_after_fix.json`
- Observado: `responses_after_filters: 2` (somente promotores com nota válida)
- Status: **Aprovado**

### Cenário D — Template específico (template ativo)
- Execução: `--template 76f0e218-38f8-4737-99c6-af794cfd176b`
- Arquivo: `validation_runs/scenario_template_active.json`
- Observado:
  - responses_after_filters: 8
- Status: **Aprovado** (filtra por `template_id` corretamente)

## 5) Relatório de inconsistências (causa provável + correção sugerida)

### INC-01 — Filtro de Rating não exclui respostas sem nota
- Onde: [applyAdvancedFilters](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx#L289-L322)
- Causa: regra atual só aplica faixa quando `score5 !== null`; se `score5 === null`, a resposta passa.
- Impacto:
  - Filtrar “4–5 estrelas” ainda inclui respostas sem nota.
- Correção sugerida:
  - Se `ratingFilter` estiver diferente do padrão, excluir `score5 === null`.
  - Implementado em [Dashboard.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx#L289-L322).

### INC-02 — Filtro de Segmento NPS não exclui respostas sem nota
- Onde: [applyAdvancedFilters](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx#L289-L322)
- Causa: segmentação só aplica quando `score10 !== null`; se `score10 === null`, a resposta passa.
- Impacto:
  - “Promotores/Passivos/Detratores” inclui respostas sem nota.
- Correção sugerida:
  - Quando `npsSegmentFilter !== 'all'`, exigir `score10 !== null`, senão excluir.
  - Implementado em [Dashboard.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx#L289-L322).

### INC-03 — Cards adicionais não usam o mesmo conjunto filtrado dos KPIs
- Onde: render dos cards no Dashboard avançado (ex.: [CompletionRate render](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx#L757))
- Causa: vários cards recebem `responses` (filtrado só por período), enquanto KPIs usam `filteredResponsesForMetrics` (período + filtros avançados).
- Impacto:
  - KPIs mudam com filtros avançados, mas cards como Conclusão/Sentimento/Palavras-chave etc podem ficar “travados” no conjunto não filtrado.
- Correção sugerida:
  - Passar `filteredResponsesForMetrics` para os cards que devem refletir filtros.
  - Implementado em [Dashboard.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx#L763-L769).

### INC-04 — UI do filtro avançado: estado “filtros ativos” e rótulos NPS
- Onde: [AdvancedFilters.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/AdvancedFilters.jsx)
- Problemas:
  - `hasActiveFilters` usa `ratingFilter.max !== 10` (mas o range real é 0–5)
  - Labels de NPS (“Promotores 4–5⭐ / Passivos 3⭐ / Detratores 1–2⭐”) não batem com a regra aplicada (score10 9+/7..8/<=6).
- Correção sugerida:
  - Ajustar `hasActiveFilters` para `ratingFilter.max !== 5`
  - Corrigir labels para refletir a regra real (ex.: Promotores 4.5–5⭐; Passivos 3.5–4⭐; Detratores 0–3⭐).
  - Implementado em [AdvancedFilters.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/AdvancedFilters.jsx#L22-L101).

### INC-05 — Inconsistência `created_at` vs `created_date` em filtros
- Onde:
  - Filtro de período usa `created_at` apenas: [Dashboard.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx#L154-L198)
  - Filtro avançado usa `created_at || created_date`: [applyAdvancedFilters](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx#L289-L305)
- Impacto:
  - respostas que só tenham `created_date` podem sumir no filtro de período.
- Correção sugerida:
  - Padronizar a data efetiva como `created_at || created_date` em ambos.
  - Implementado no filtro de período em [Dashboard.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Dashboard.jsx#L154-L198).

### INC-06 — Palavras-chave usa `overall_rating` direto (não normalizado)
- Onde: [KeywordExtraction.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/KeywordExtraction.jsx#L29-L47)
- Causa: classifica positivo/negativo baseado em `overall_rating`, mas o dashboard usa `getUnifiedScore*` em outras métricas.
- Impacto:
  - respostas com nota em `custom_answers` (sem `overall_rating`) ficam fora da análise.
- Correção sugerida:
  - Usar `getUnifiedScore5` para classificar positivo/negativo.
  - Implementado em [KeywordExtraction.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/KeywordExtraction.jsx#L1-L46).

### INC-07 — Voucher/Fallback ainda depende de Base44 e campos divergentes
- Onde: [VoucherFallbackAnalytics.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/VoucherFallbackAnalytics.jsx)
- Problemas:
  - Consome `base44` em um projeto já migrado para Supabase
  - Campo `is_used` (UI) não bate com `redeemed` (API/tabela `voucher_usage`)
- Correção sugerida:
  - Migrar para `fetchAPI('/vouchers?...')` e ajustar nomes de campos.
  - Implementado em [VoucherFallbackAnalytics.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/dashboard/VoucherFallbackAnalytics.jsx).

## 6) Confirmação de integridade do sistema (estado atual)
O pipeline geral funciona (há dados, há templates, há dashboard) e, após as correções acima, o **filtro avançado passa a impactar todos os indicadores de forma coesa**. Para reprodução do estado atual com dados reais, use o script e o snapshot `validation_runs/advanced_after_fixes.json`.\n+
