# Avaliação das ideias (sem IA) + plano de evolução

## Leitura geral
Você descreveu exatamente o salto de “dashboard” para “sistema que reduz ansiedade”: sair de coleta passiva para **monitoramento ativo**, **organização de tratativas** e **sinais visuais simples**. Isso está totalmente alinhado com o foco do produto em notas ruins e tratativas (<=3 estrelas) e no fluxo de ação, não de dados.<mccoremem id="01KFQ3MCJKYKDP3QK5W6623HEP|01KFQ4SB1MK769RD1D2ZKS8W90" />

## Avaliação por ideia (impacto x esforço x risco)
1) **Monitoramento ativo (alertas)**
- **Impacto:** altíssimo (vira hábito; reduz necessidade de abrir painel).
- **Esforço:** médio (motor de regras + canal de notificação).
- **Risco:** baixo/médio ("tempo real" depende de frequência do scraping; dá para prometer “quase em tempo real”).
- **Sugestão prática:** começar com alertas por evento (nova review <= X) e por “risco” (review crítica sem tratativa em Y horas).

2) **Linha do tempo pública vs interna (CRM de reputação)**
- **Impacto:** altíssimo (transforma review em caso/tratativa).
- **Esforço:** médio (modelo de “ações internas” + UI em timeline).
- **Risco:** baixo.
- **Pulo do gato:** toda review negativa vira um “card” com status: Novo → Em tratativa → Resolvido → Reavaliação solicitada.

3) **Resposta oficial no Google (sem API) via “copiar + link direto”**
- **Impacto:** alto (remove fricção: dono odeia escrever).
- **Esforço:** baixo.
- **Risco:** baixo (não está postando no Google; só facilitando).
- **Recomendação:** manter histórico de respostas sugeridas/coladas para medir adoção e consistência de tom.

4) **Classificação manual da dor (tags)**
- **Impacto:** alto (gera visão gerencial simples: “qual dor mais dói”).
- **Esforço:** baixo/médio (tags + filtros + agregações).
- **Risco:** baixo.
- **Boa prática:** 5–8 tags fixas inicialmente + 1 “Outro”; permitir marcar múltiplas.

5) **Pós-tratativa com prova social (pedir nova avaliação)**
- **Impacto:** médio/alto (crescimento e “sensação de recuperar estrela”).
- **Esforço:** médio (estado da tratativa + geração de link/roteiro).
- **Risco:** médio (ética/ToS/experiência do cliente; precisa ser sugestão suave, não spam).
- **Recomendação:** gatilho somente para casos resolvidos + controle de cooldown.

6) **Comparação consigo mesmo (mês vs mês)**
- **Impacto:** médio (ajuda retenção; conversa com ego/controle).
- **Esforço:** baixo (agregações por período).
- **Risco:** baixo.
- **Nota:** é ótimo para o “painel de risco” (tendência).

7) **Painel de risco (verde/amarelo/vermelho)**
- **Impacto:** altíssimo (o dono quer cor, não gráfico).
- **Esforço:** baixo/médio (regras claras + UI).
- **Risco:** baixo.
- **Recomendação:** explicar “por que está vermelho” com 1 frase acionável.

8) **Histórico imutável (mesmo se o Google apagar)**
- **Impacto:** alto (confiança + auditoria).
- **Esforço:** baixo/médio (marcar removida + manter snapshot).
- **Risco:** baixo (cuidar de LGPD/termos: guardar conteúdo público é geralmente ok, mas precisa política clara).

## Priorização sugerida (MVP vs Plus)
**MVP (vira hábito em 2 semanas de uso)**
1. Alertas de nova review crítica + “sem tratativa”
2. Painel de risco (cor + motivo)
3. Timeline pública vs interna (ações + status)
4. Resposta sugerida + copiar + link direto
5. Tags manuais básicas + visão “top dores”
6. Histórico imutável (flag removida)

**Plus (aprofunda LTV e time-to-value)**
- Alertas de queda de média (com janela configurável)
- “Reclamou e voltou” (reativação de caso)
- Solicitar nova avaliação pós-resolução (com limites)
- Relatórios de comparação (mês a mês, SLA de resposta, etc.)

## Regras e dados necessários (alto nível)
- **Entidades novas/estendidas:**
  - Review: status (ativa/removida), link no Google, snapshot do texto/nota/data
  - Treatativa/Caso: status, responsável, prazos
  - Ações internas: tipo (ligação/WhatsApp/voucher/resposta), data, observação
  - Tags: catálogo + ligação review↔tags
  - Alertas: regras por empresa (limites) + logs de disparo (dedupe)
  - Notificações: canal (email/WhatsApp/push), destinatários, estado (enviado/erro)

## Monitoramento ativo (como entregar “tempo real” sem dor)
- Manter o cron atual e adicionar uma camada de detecção por diferença (novas reviews).
- Permitir “modo intenso” configurável (ex.: a cada 10–15 min) para empresas que pagam Plus.
- Dedupe por review_id externo + empresa e por janela (não alertar 5 vezes a mesma coisa).

## Painel de risco (regras simples e auditáveis)
- **Verde:** sem reviews críticas recentes OU todas com tratativa iniciada.
- **Amarelo:** média do período caiu X% OU entrou review 3 estrelas sem resposta.
- **Vermelho:** entrou review <=2 estrelas e está sem tratativa há > Y horas.
- Sempre mostrar 1 CTA: “Abrir casos em vermelho” / “Responder 2 pendências”.

## Métricas que validam “vício saudável”
- % de reviews críticas com tratativa iniciada em 24h
- Tempo médio até primeira ação
- Adoção: quantas respostas copiadas / quantas tags marcadas
- Retenção: frequência de acesso cai, mas resposta a alertas sobe (isso é bom)

## Riscos e cuidados
- Evitar prometer postagem automática no Google (sem API).
- Atenção a privacidade: armazenar só o necessário; política de retenção; trilha de auditoria.

## Próxima execução (quando sair do plan mode)
1. Mapear no código onde hoje entram reviews e onde rodam crons.
2. Implementar modelo de “caso/tratativa” + ações internas.
3. Implementar motor de alertas + canal inicial (email) + dedupe.
4. Implementar painel de risco + listas filtradas por cor.
5. Implementar tags + agregações e histórico imutável.

Se você aprovar, eu entro no repositório e começo pelo MVP (alertas + painel de risco + timeline), porque isso entrega o salto de percepção mais rápido.