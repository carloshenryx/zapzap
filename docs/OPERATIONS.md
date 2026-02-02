# Operação — Ambiente, cron, webhooks e troubleshooting

## Variáveis de ambiente

Definição base (local): [README.md](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/README.md#L5-L38)

### Frontend (Vite)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Backend (Vercel Functions /api)

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (crítico para onboarding e operações admin)

### Google Reviews (cron)

- `CRON_SECRET` (opcional; recomendado)

### WhatsApp (Evolution API)

- `EVOLUTION_API_URL` (opcional)
- `EVOLUTION_API_KEY` (opcional)

## Rotas no deploy (Vercel)

O projeto reescreve:

- `/api/<resource>` → roteador único `api/[...path].ts`
- `/functions/<name>` → `webhooks/<name>` (dentro do roteador)
- fallback SPA para `/index.html`

Referência: [vercel.json](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/vercel.json#L6-L22)

## Banco / migrations (Supabase)

- Migrations versionadas: [supabase/migrations/](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations)
- Scripts úteis de CLI (se você usa Supabase CLI):
  - `npm run db:link`
  - `npm run db:push`

Referência: [package.json](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/package.json#L6-L18)

## Cron de ingestão (Google Reviews)

Endpoint:

- `GET /api/google-reviews?action=ingest`

Proteção (recomendado):

- Enviar `x-cron-secret: <CRON_SECRET>` ou `?cron_secret=<CRON_SECRET>`

Comportamento:

- se passar `tenant_id`, ingere somente aquele tenant
- se não passar, ingere todos os tenants com `google_places.is_active = true`

Referência: [README.md](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/README.md#L82-L99)

## Webhooks externos (WhatsApp trigger)

Regra:

- O webhook externo valida `X-Webhook-Key` (cada trigger tem um `webhook_key`).
- O roteador libera o header no CORS: [api/[...path].ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/%5B...path%5D.ts#L24-L28)

Dados:

- Configurações ficam em `whatsapp_trigger_configs` (multi-tenant).

Migration: [20260124003000_whatsapp_trigger_configs.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260124003000_whatsapp_trigger_configs.sql)

## Troubleshooting (problemas comuns)

### 1) “User not registered” / sem tenant

Sintoma:

- usuário consegue logar, mas o app não carrega contexto/tenant.

Causa típica:

- onboarding não rodou, ou falhou por falta de `SUPABASE_SERVICE_ROLE_KEY`.

Onde ver:

- erro explícito no endpoint `tenants?action=onboard`: [handlers/tenants.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/tenants.ts#L174-L181)

Correção:

- configurar `SUPABASE_SERVICE_ROLE_KEY` no backend e rodar onboarding de novo; ou
- super admin usar `admin?action=assign-user-tenant` para atribuir tenant.

### 2) Erros de RLS “permission denied”

Sintoma:

- select/insert falha em tabelas com RLS.

Causa típica:

- JWT não tem `app_metadata.tenant_id` (policy depende disso); ou
- policy não existe no banco (não foi aplicada).

Onde ver:

- policies versionadas no repo usam `auth.jwt()->app_metadata->>tenant_id`, por exemplo CRM:
  - [20260125010000_crm_customer_entities.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260125010000_crm_customer_entities.sql#L93-L113)

### 3) Rotas públicas de Survey não carregam template/tenant

Sintoma:

- página `/Survey?tenant_id=...` não carrega dados.

Causa típica:

- tabelas acessadas no browser (anon key) estão com RLS “fechado” sem policy para leitura pública.

Onde ver (front):

- [Survey.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Survey.jsx#L56-L153)

### 4) Webhook externo retorna 401/403

Causa típica:

- `X-Webhook-Key` não enviado ou incorreto.

Onde gerenciar:

- [WebhookTriggerManager.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/components/admin/WebhookTriggerManager.jsx)

## Transferência / backup do projeto (entre computadores)

O deploy na Vercel não é “copiar pasta”: ele roda o build do Vite e empacota a Function. Para evitar “abrir em outro PC e estar desatualizado”, use um fluxo padronizado.

### Fonte de verdade da versão

- Recomendado: usar Git como fonte de verdade (repositório remoto + `pull/clone` no outro computador).
- Alternativa (sem Git): exportar o projeto por zip usando o script de exportação deste repositório e sempre reconstruir (`npm ci` + `npm run build`) no destino.

### Exportar por zip (recomendado para cópia manual)

- Script: `scripts/export-project.ps1` (gera um zip em `exports/`)
- Por padrão, não inclui `node_modules/`, `dist/` e `.env.local` (evita zip enorme e vazamento de secrets).

### O que precisa existir no destino

- Código-fonte (ex.: `src/`, `handlers/`, `lib/`, `api/`, configs, `package.json` e `package-lock.json`).
- Variáveis de ambiente equivalentes às da Vercel (ver [README.md](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/README.md#L5-L38)).

### O que não deve ser usado como “prova de versão”

- `dist/`: é artefato de build e pode estar velho se você não rodou build antes de copiar.
- `node_modules/`: não copie; reinstale no destino.

### Gerar o mesmo output do deploy (Vercel)

- Este repositório já tem a pasta `.vercel/` com o link do projeto.
- Para reproduzir localmente o que a Vercel publicaria, use `vercel pull` (para baixar envs) e `vercel build` (gera `.vercel/output`).
- O output em `.vercel/output` pode ser compactado e transferido como “deploy pronto” (útil para auditoria e cópias bit-a-bit).
