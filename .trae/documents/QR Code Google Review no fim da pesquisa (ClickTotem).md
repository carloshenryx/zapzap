## Objetivo
Adicionar, ao final da pesquisa, a exibição de um QR Code que leva ao link de avaliação no Google Meu Negócio quando:
- o template tiver `google_redirect.enabled=true`; e
- o canal/origem for **ClickTotem** (`source === 'clicktotem'` / `from_clicktotem=true`).

Se houver voucher gerado, a tela final deve exibir **voucher + QR Code** juntos, de forma responsiva.

## Diagnóstico do estado atual
- A finalização e a tela “Obrigado” ficam em [Survey.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Survey.jsx#L431-L1056).
- O redirecionamento para Google hoje é aplicado apenas para canais que **não** sejam `totem`/`clicktotem` (abre nova aba) e está hardcoded no `handleSubmit`.
- O ClickTotem é identificado via `?from_clicktotem=true` e o `source` vira `clicktotem` ([Survey.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Survey.jsx#L443-L451)).
- O projeto já usa `qrcode.react` (ex.: [TotemDisplay.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/TotemDisplay.jsx#L500-L514)).

## Implementação (Front-end)
1. **Centralizar regra em utilitário**
   - Criar uma função utilitária em [surveyUtils.js](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/lib/surveyUtils.js) para decidir a ação pós-envio do Google:
     - Retornar `mode: 'redirect' | 'qrcode' | 'none'` e o `link`.
     - Aplicar as mesmas condições existentes do template (`conditions[0].min_rating`) e exigir `tenant.google_review_link`.
     - Regra-chave:
       - `source === 'clicktotem'` → `mode='qrcode'`
       - `source !== 'totem' && source !== 'clicktotem'` → `mode='redirect'`
       - `source === 'totem'` → `mode='none'`

2. **Atualizar `Survey.jsx` para usar o utilitário**
   - Importar `QRCodeSVG` de `qrcode.react`.
   - No `handleSubmit`, após obter `firstRating` e `source`, calcular o “modo Google” via utilitário e salvar em state (ex.: `postSubmitGoogle` com `{ mode, link }`).
   - Manter o comportamento atual de abrir nova aba **apenas** quando `mode==='redirect'`.
   - Para `mode==='qrcode'` (ClickTotem), **não abrir nova aba**; apenas renderizar o QR na tela final.

3. **Tela final integrada (voucher + QR)**
   - Refatorar o bloco `if (isSubmitted)` para:
     - Exibir um layout em **grid responsivo**:
       - 1 coluna no mobile
       - 2 colunas em telas maiores quando houver dois cards (voucher + QR)
     - Reutilizar o card de voucher existente sem mudar lógica.
     - Adicionar um card “Avalie no Google” contendo:
       - `QRCodeSVG` com `value={tenant.google_review_link}`
       - Texto curto de instrução.

4. **Tempo de retorno ao Totem (experiência ClickTotem)**
   - Ajustar o auto-retorno do ClickTotem para não atrapalhar o scan do QR:
     - Se `mode==='qrcode'`, aumentar o timeout (ex.: 45s) antes de voltar ao Totem.
     - Caso contrário, manter os 15s atuais.

## Testes (Vitest)
- Adicionar testes unitários em `src/lib/surveyUtils.test.js` cobrindo:
  - ClickTotem + google enabled + link presente + rating >= min → `mode='qrcode'`.
  - ClickTotem + google enabled + link presente + rating < min → `mode='none'`.
  - Canal normal (qrcode/web) + google enabled + link presente + rating ok → `mode='redirect'`.
  - Totem + google enabled → `mode='none'`.
  - Cenários “com voucher” vs “sem voucher”:
    - O utilitário não depende do voucher; o teste garante que o resultado do Google é idêntico independentemente desse estado, assegurando que voucher e QR podem coexistir.

## Verificação manual
- Fluxo normal (não totem): termina pesquisa e abre Google em nova aba quando aplicável.
- ClickTotem: termina pesquisa e mostra QR (com e sem voucher), sem abrir nova aba.
- Totem: termina pesquisa e retorna ao totem sem QR.

Se você confirmar este plano, eu implemento as mudanças e rodo os testes.