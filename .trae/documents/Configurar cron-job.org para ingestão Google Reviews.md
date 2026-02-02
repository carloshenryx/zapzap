## Passo a Passo (cron-job.org)
- **1) Escolha a URL do endpoint**
  - URL base do cron no seu sistema: `https://SEU_DOMINIO/api/google-reviews?action=ingest`
  - Para autenticar, o endpoint aceita `cron_secret` na querystring (mais fácil no cron-job.org): `https://SEU_DOMINIO/api/google-reviews?action=ingest&cron_secret=SEU_CRON_SECRET`.
  - Opcional (rodar só 1 tenant): adicione `&tenant_id=UUID_DO_TENANT`.

- **2) Faça login e crie o job**
  - Acesse `cron-job.org` → `Create job`.
  - **Title**: algo como `Google Reviews Ingest`.
  - **URL**: cole a URL completa (com `action=ingest` e `cron_secret`).

- **3) Configure o request**
  - **Request method**: `GET`.
  - **Timeout**: deixe o padrão ou aumente se existir opção (o endpoint pode levar até ~60s em alguns casos).
  - Se o cron-job.org tiver opção de **Custom Headers**, você pode preferir header `x-cron-secret: SEU_CRON_SECRET` (mas a alternativa via querystring já resolve).

- **4) Configure o horário (schedule)**
  - Se a tela permitir **cron expression**, use: `0 */6 * * *` (a cada 6 horas).
  - Se for por seleção de horas/minutos:
    - Minuto: `0`
    - Horas: `0, 6, 12, 18`
  - **Timezone**: escolha o fuso que você quer. Se quiser previsibilidade igual Vercel, use `UTC`.

- **5) Alertas e histórico**
  - Habilite notificação por e-mail em caso de falha (se existir).
  - Salve o job.

- **6) Teste**
  - Use o botão de “Run now / Test” (se existir).
  - Vá em **History/Logs** do job:
    - Sucesso: HTTP 200 com JSON `{ ingested: ..., critical_new: ... }`
    - Falha por segredo: HTTP 403 `Forbidden` (se `CRON_SECRET` estiver configurado no servidor).

## Por que esse jeito funciona aqui
- O endpoint do cron é a ação `ingest` em [google-reviews.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/google-reviews.ts#L619-L657).
- Ele aceita o segredo por `?cron_secret=...` e (se disponível) header `x-cron-secret`.
- Documentação do módulo está no [README.md](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/README.md#L82-L114).

## Próximo passo (se você confirmar)
- Eu reviso contigo quais campos aparecem exatamente na tela do cron-job.org (baseado no que você está vendo) e te digo exatamente onde clicar em cada um, e qual schedule escolher para o seu fuso.