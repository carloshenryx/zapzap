---

## Setup do projeto (Supabase + CRM + Avaliações do Google)

### Variáveis de ambiente

Crie `.env.local` para rodar localmente (pode copiar de `.env.example`).

**Frontend (Vite)**

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

**Backend (Vercel Functions em /api)**

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

**Módulo “Avaliações do Google” (scraping público)**

Opcional, mas recomendado para proteger o endpoint de cron:

```
CRON_SECRET=uma_senha_forte
```

**WhatsApp (Evolution API) – opcional**

```
EVOLUTION_API_URL=...
EVOLUTION_API_KEY=...
```

### Banco de dados (migrations)

O módulo “Avaliações do Google” cria estas tabelas:
- `google_places` (unidades/empresas por Place ID)
- `google_reviews` (avaliações coletadas)
- `google_review_versions` (versionamento por hash)
- `google_review_actions` (auditoria das ações)

Migration: [20260124002000_google_reviews.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260124002000_google_reviews.sql)

Execute as migrations no Supabase (SQL Editor) ou via Supabase CLI (se você usa CLI no seu fluxo).

---

## Avaliações do Google (MVP) – 100% público (sem API oficial)

### O que este módulo faz

- Coleta reviews publicamente (scraping controlado) a partir de **Place IDs** cadastrados por tenant.
- Deduplica por `(tenant_id, place_id, external_review_id)` para não criar loop de alertas.
- Define **Avaliação Crítica** automaticamente quando `rating <= 3`.
- Exibe:
  - Widget no Dashboard (“Avaliações do Google”)
  - Painel “Avaliações Google” com filtros e ações (tratativa/tarefa/vínculo com cliente)
  - Integração no perfil do cliente (aba “Google” e linha do tempo)

### Como configurar (operacional)

1) Acesse no menu: **Avaliações Google**

2) Cadastre as unidades em **Unidades**:
- Informe o `place_id` (preferível)
- Opcional: nome e URL do Google Maps (só para contexto)

3) Clique em **Coletar agora**:
- Executa a coleta pública para o seu tenant e já popula as listas/alertas.

### Como obter o Place ID

Sem API oficial, o Place ID precisa ser obtido por fora. Opções práticas:
- Usar um “Place ID Finder” (ferramenta pública de terceiros): cole a URL do Google Maps e copie o Place ID.
- Se você já tiver o Place ID registrado internamente (ex.: em cadastro anterior), use diretamente.

### Automação (cron) – recomendado

Endpoint de ingestão (cron):
- `GET /api/google-reviews?action=ingest`

Proteção:
- Envie `x-cron-secret: <CRON_SECRET>` (header) ou `?cron_secret=<CRON_SECRET>`.

Comportamento:
- Se você passar `tenant_id`, coleta só daquele tenant.
- Se não passar `tenant_id`, coleta todos os tenants que tenham `google_places.is_active = true`.

Exemplo (curl):

```bash
curl -X GET "https://SEU_DOMINIO/api/google-reviews?action=ingest" \
  -H "x-cron-secret: SEU_CRON_SECRET"
```

Exemplo (Vercel Cron via `vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/google-reviews?action=ingest&cron_secret=SEU_CRON_SECRET",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Se você preferir, dá para configurar o cron direto no painel da Vercel (mesma URL/path).

### Endpoints úteis (para debug)

- Resumo (widget do dashboard):
  - `GET /api/google-reviews?action=summary`
- Lista de críticas (painel):
  - `GET /api/google-reviews?action=list&is_critical=true`
- Executar ingestão agora (autenticado, por tenant):
  - `POST /api/google-reviews?action=ingest-now`

### Vercel Hobby (limite de 12 Functions)

No plano Hobby, a Vercel limita a quantidade de Serverless Functions por deploy. Em projetos com muitos arquivos em `api/*.ts`, cada arquivo conta como 1 Function.

Este repositório está preparado para não estourar o limite:
- Existe um roteador único em [api/[...path].ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/%5B...path%5D.ts) que atende rotas do tipo `/api/<recurso>?action=...`.
- A lógica das rotas fica em `handlers/*` (fora de `api/`, então não conta como Function).

### Observações importantes (scraping)

- Scraping público é “best-effort”: o Google pode mudar o formato do payload.
- O parser e a normalização estão isolados em [googleReviews.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/lib/googleReviews.ts) para ficar fácil ajustar sem impactar UI/CRM.
