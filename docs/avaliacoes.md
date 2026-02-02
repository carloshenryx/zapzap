## Padrão unificado de avaliação

O sistema recebe avaliações em diferentes formatos (ex.: estrelas 1–5, carinhas 0–5 e notas 0–10). Para consolidar métricas e evitar discrepâncias, todas as avaliações são convertidas para uma escala padrão.

### Escala padrão

- Escala de referência interna: **0–10**
- Escala exibida em alguns painéis: **0–5** (derivada de 0–10 dividindo por 2)

### Regras de conversão

1) Se a avaliação estiver em **0–5** (inclui 0):
- `score10 = valor * 2`

2) Se a avaliação estiver em **0–10**:
- `score10 = valor`

3) Se a avaliação estiver em **0–100**:
- `score10 = valor / 10`

4) Caso a avaliação não esteja em um desses intervalos ou não seja numérica:
- é tratada como “sem nota” e fica fora das métricas de nota (mas continua contando como submissão).

### Fonte de nota

Para cada resposta:
- Prioridade 1: `overall_rating` (quando é numérico)
- Fallback: primeiro valor numérico encontrado em `custom_answers`

Isso garante compatibilidade com histórico (ex.: respostas antigas onde `overall_rating` ficou `null`, mas `custom_answers` tem `0`).

### Classificação usada em métricas

No Painel Executivo:
- “Ruins” por padrão: `score5 <= 2` (equivalente a `score10 <= 4`)
- “Boas” por padrão: `score5 >= 4` (equivalente a `score10 >= 8`)

### Rótulos exibidos no sistema (clareza para tratativa)

Na UI, a nota em 0–5 recebe um rótulo para facilitar a leitura e priorização de tratativas:

- `0` → **Muito ruim**
- `1–2` → **Ruim**
- `3` → **Neutra**
- `4` → **Boa**
- `5` → **Excelente**

Em NPS (escala 0–10):
- Promoters: `score10 >= 9`
- Passives: `score10 7–8`
- Detractors: `score10 <= 6`
