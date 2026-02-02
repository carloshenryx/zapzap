# Arquitetura — AvaliaZap System

## Stack (resumo)

- Frontend: React + Vite + React Router + TanStack React Query ([package.json](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/package.json))
- Backend: Vercel Serverless (roteador único) com handlers por recurso ([api/[...path].ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/%5B...path%5D.ts), [handlers/](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers))
- Infra: Supabase (Auth + Postgres + Storage) + migrations SQL versionadas ([supabase/migrations/](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations))

## Organização do código (pontos de entrada)

### Frontend (SPA)

- Rotas/páginas: [src/pages/](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages)
- Layout + guardas (público vs privado + trial): [Layout.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/Layout.jsx)
- Auth (carrega sessão e perfil/contexto): [AuthContext.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/lib/AuthContext.jsx)
- Cliente Supabase + fetch API (injeta Bearer token): [supabase.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/lib/supabase.ts)

### Backend (Vercel Function única)

- Roteamento por recurso: [api/[...path].ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/%5B...path%5D.ts)
- Implementação das “actions”: [handlers/](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers)
- Autenticação: [lib/auth.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/lib/auth.ts)
- Clientes Supabase (service role vs authed): [lib/supabase.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/lib/supabase.ts)

## Convenção de API

O backend expõe rotas no formato:

- `GET/POST /api/<resource>?action=<action>`

Exemplos:

- `GET /api/analytics?action=survey-executive`
- `POST /api/surveys?action=trigger`
- `POST /api/tenants?action=onboard`

O frontend usa `fetchAPI('/analytics?...')`, que resolve para `/api/analytics?...` e injeta `Authorization: Bearer <access_token>` quando existe sessão ([supabase.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/lib/supabase.ts#L33-L58)).

## Diagrama (fluxo principal)

```mermaid
flowchart LR
  U[Usuário (browser)] -->|Login/Signup| SA[Supabase Auth]
  U -->|/api/* + Bearer JWT| VR[Vercel Router /api/[...path].ts]
  VR -->|dispatch| H[handlers/<resource>.ts]
  H -->|Supabase service role (bypass RLS) ou authed client| SP[(Supabase Postgres)]
  H -->|Signed URLs| ST[Supabase Storage]

  U -->|Público: /Survey?tenant_id=...| SUI[Survey público]
  SUI -->|/api/surveys?action=create-response| VR

  U -->|Checkout/Trial (Edge Function)| EF[Supabase Edge Functions]
  EF --> SP
```

## “Porque existe um roteador único?”

A Vercel Hobby limita a quantidade de serverless functions por deploy. O repo mantém a lógica dos endpoints em `handlers/*` e usa um único arquivo em `api/` para roteamento, evitando estourar o limite ([README.md](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/README.md#L125-L132)).

## Dependências externas importantes (fora do repo)

Parte do billing/trial está em Supabase Edge Functions (ex.: `start-free-trial`, `create-asaas-payment`, `upgrade-tenant-plan`). O frontend já está integrado com essas funções, mas o código delas não está versionado aqui (ver [FreeTrialSignup.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/FreeTrialSignup.jsx) e [Checkout.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Checkout.jsx)).

## Variáveis de ambiente (resumo)

Conforme [README.md](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/README.md#L5-L38):

- Frontend (Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Backend (Vercel): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Google Reviews cron (opcional): `CRON_SECRET`
- WhatsApp Evolution API (opcional): `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`

