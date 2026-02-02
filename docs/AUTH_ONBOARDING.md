# Auth e Onboarding — Novos usuários

## Entidades envolvidas

- `auth.users` (Supabase Auth): identidade, senha, JWT.
- `public.user_profiles`: “perfil de aplicação” (tenant_id, nome, flags).
- `public.tenants`: empresa/organização do usuário.

O sistema usa **`app_metadata` no JWT** como caminho rápido para saber `tenant_id` e `is_super_admin` sem precisar consultar o banco toda hora.

Referências:

- Backend: [authenticateUser](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/lib/auth.ts#L8-L61)
- Frontend: [AuthContext.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/lib/AuthContext.jsx)

## Login (usuário já existente)

1. Front faz login via `supabase.auth.*`.
2. Front tenta carregar contexto pelo backend: `GET /api/auth?action=context`.
3. Se falhar, faz fallback lendo `user_profiles` diretamente pelo client Supabase no browser.

Referências:

- Contexto: [handlers/auth.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/auth.ts#L20-L56)
- Loader do profile: [AuthContext.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/lib/AuthContext.jsx#L56-L150)

## Signup “padrão” (cria usuário e cria tenant)

### O que acontece no frontend

- O signup cria o usuário no Supabase Auth e adiciona metadados do usuário:
  - `full_name`
  - `company_name`

Referência: [AuthContext.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/lib/AuthContext.jsx#L198-L220)

Logo após isso, a tela de Signup chama:

- `POST /api/tenants?action=onboard` com `company_name` e `plan_type` (hoje, `pro`)

Referência: [Signup.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Signup.jsx#L53-L95)

### O que acontece no backend (onboard)

O onboarding exige service role, porque ele precisa:

1. Criar um registro em `tenants`.
2. Fazer `upsert` em `user_profiles` vinculando o usuário ao tenant.
3. Setar `auth.users.app_metadata.tenant_id` e `auth.users.app_metadata.is_super_admin=false`.

Referência: [onboard](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/tenants.ts#L168-L275)

Regra prática: **se `SUPABASE_SERVICE_ROLE_KEY` não estiver configurada, o onboarding falha** (e o usuário fica “criado” no Auth, mas sem tenant).

## Vincular usuário a um tenant existente (super admin)

Quando você precisa “mover”/atribuir um usuário a outro tenant, existe uma action de admin:

- `POST /api/admin?action=assign-user-tenant`

Essa action (super admin):

- Atualiza `user_profiles.tenant_id`.
- Atualiza `auth.users.app_metadata.tenant_id` (Admin API).

Referência: [handlers/admin.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/admin.ts#L202-L280)

## Super admin (criação e gestão)

- A flag `is_super_admin` é avaliada a partir do JWT e/ou `user_profiles`.
- Existe action para setar/remover super admin:
  - `POST /api/admin?action=set-super-admin`

Referência: [handlers/admin.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/admin.ts#L287-L357)

## Free Trial e Checkout (dependem de Edge Functions)

O repo contém a UI e o “contrato” esperado, mas o código das functions não está versionado aqui.

### Free Trial

- Página: [FreeTrialSignup.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/FreeTrialSignup.jsx)
- Chama Edge Function: `start-free-trial`
- Possíveis resultados:
  - `data.user_linked=true` → vai para Dashboard
  - senão → redireciona para Login com parâmetros para linkar tenant depois

### Checkout / Upgrade

- Página: [Checkout.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Checkout.jsx)
- Edge Functions chamadas: `create-asaas-payment`, `check-asaas-payment-status`, `upgrade-tenant-plan`, `create-tenant-only`, `link-tenant-to-user`

## Campos relevantes em `user_profiles`

- `tenant_id`: vínculo ao tenant.
- `is_super_admin`: flag de acesso global.
- `role`: existe com default `'user'` (há uso em UI para “tipo de conta”).
- `user_email`: coluna auxiliar (gerada a partir de `email`, quando existir).

Referências:

- `user_email`: [20260126100000_user_profiles_user_email.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260126100000_user_profiles_user_email.sql)
- UI (exibição de role): [Profile.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Profile.jsx#L298-L301)

