## Diagnóstico (o que está quebrando)

* **Voucher não aparece**: o frontend chama `POST /api/vouchers?action=generate` via `fetchPublicAPI`, que **lança erro quando a API responde != 2xx**. No backend, `generateVoucherUsage` em [vouchers.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/vouchers.ts) só lê `req.body` quando já é objeto; se o body vier como **string JSON** (comportamento comum em serverless), `voucher_id` fica ausente e a API responde 400 → o frontend cai no `catch` e não seta `generatedVoucher`.

* **QR Code do Google não aparece**: a ação é decidida por [getGoogleReviewPostSubmitAction](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/lib/surveyUtils.js#L286-L311) e a renderização depende de `postSubmitGoogle.mode === 'qrcode'` em [Survey.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Survey.jsx). Quando existe `min_rating` configurado, o resultado pode virar `none` se a nota enviada estiver `null` ou em escala diferente da esperada.

## Mudanças de código (correções)

1. **Backend: aceitar body string no generate do voucher**

* Atualizar [handlers/vouchers.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/vouchers.ts) para fazer parse do body quando `typeof req.body === 'string'` (mesmo padrão já usado em [handlers/surveys.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/surveys.ts)).

* Garantir que `voucher_id`, `survey_response_id` e dados do cliente sejam extraídos do body já parseado.

1. **Frontend: tornar** **`overall_rating`** **confiável para Google/voucher**

* Em [Survey.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Survey.jsx), substituir a heurística `firstRating = Object.values(custom_answers).find(number)` por uma captura mais determinística:

  * manter um estado `overallRating` atualizado quando o usuário responde questões do tipo `stars | faces | rating`.

  * usar `overallRating` (com fallback para o método atual) ao enviar `create-response`, ao calcular `googleAction` e ao chamar geração de voucher.

1. **Google pós-envio: reduzir falso-negativo por escala/nota nula**

* Ajustar [getGoogleReviewPostSubmitAction](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/lib/surveyUtils.js#L286-L311) para lidar melhor com:

  * `overall_rating` ausente → se não houver `min_rating`, permitir QR/redirect normalmente.

  * `min_rating` configurado em escala diferente → aplicar normalização simples quando `overall_rating` estiver no range 0–5 e `min_rating` estiver no range 6–10 (converter `min_rating` para a escala 0–5/1–5 antes da comparação).

1. **UI de finalização: feedback quando configuração impede exibição**

* Em [Survey.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Survey.jsx), quando `google_redirect.enabled=true` mas `tenant.google_review_link` estiver vazio, exibir aviso curto na tela de “Obrigado” (para não parecer “bug” quando é falta de link).

## Verificação (como vou validar)

* Adicionar/ajustar teste em [handlers/vouchers.test.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/vouchers.test.ts) cobrindo body em formato string (não deve falhar com “Missing voucher\_id”).

* Rodar a suíte de testes (vitest) e validar manualmente no fluxo:

  * abrir TotemDisplay → clicar (from\_clicktotem) → completar survey → confirmar que **voucher aparece** quando habilitado e que **QR do Google aparece** quando habilitado e condições atendidas.

## Observações de configuração (checagem rápida)

* O QR do Google só aparece se o tenant tiver `google_review_link` preenchido (além do `google_redirect.enabled` no template).

