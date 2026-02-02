# Multi-tenant — Regras e limites

## Conceitos (o que é “tenant”)

- **Tenant** = organização/empresa dona dos dados.
- Em quase todas as tabelas de domínio existe uma coluna `tenant_id` e o isolamento é feito por esse campo.
- Um usuário “pertence” a um tenant via:
  - `auth.users.app_metadata.tenant_id` (no JWT, preferencial)
  - `public.user_profiles.tenant_id` (fallback)

Referência: [authenticateUser](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/lib/auth.ts#L8-L61)

## Fonte do tenant no request (backend)

O backend resolve o tenant assim:

1. Lê `tenant_id` do JWT (`user.app_metadata.tenant_id`).
2. Se não existir, consulta `user_profiles` usando um client autenticado pelo token (`Bearer`) e lê `tenant_id` dali.

Referência: [auth.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/lib/auth.ts#L28-L61)

## Regras de segregação (como o “não pode” é garantido)

Existem **dois mecanismos** no projeto:

### 1) RLS (Row Level Security) no banco

Algumas tabelas têm RLS/policies versionadas no repo. O padrão é:

- `tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid`

Exemplos:

- CRM entities: [20260125010000_crm_customer_entities.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260125010000_crm_customer_entities.sql#L88-L175)
- Anexos de respostas: [20260126090000_survey_attachments.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260126090000_survey_attachments.sql#L28-L39)

Implicação: **o JWT precisa ter `app_metadata.tenant_id`**, senão o usuário pode perder acesso a dados onde a policy depende dele.

### 2) Filtro por tenant no código (quando usa service role)

Vários handlers usam `getSupabaseServiceClient()` (service role) — que **bypassa RLS** — e então aplicam o isolamento por `tenant_id` no próprio código (via `.eq('tenant_id', user.tenant_id)`).

Referência: [lib/supabase.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/lib/supabase.ts#L21-L38)

Implicação: a segregação depende de:

- `authenticateUser` estar correto; e
- o handler sempre filtrar `tenant_id` (sem esquecer).

## Super admin (exceção controlada)

- Um super admin é identificado por `user.app_metadata.is_super_admin` (ou fallback em `user_profiles.is_super_admin`).
- Endpoints de gestão global validam explicitamente `is_super_admin` (ex.: listagem de todos os tenants).

Referências:

- Contexto/auth: [handlers/auth.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/auth.ts#L20-L56)
- Gestão de tenants: [handlers/tenants.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/tenants.ts#L43-L50)
- Gestão de usuários (admin): [handlers/admin.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/admin.ts)

## Rotas públicas (exceção por design)

Algumas funcionalidades são públicas, especialmente para permitir o cliente final responder pesquisa sem login:

- Página pública: [Survey.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/Survey.jsx)
- Backend (público): `POST /api/surveys?action=create-response` recebe `tenant_id` no body e grava a resposta sem autenticação (valida UUID).

Referência: [handlers/surveys.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/handlers/surveys.ts#L519-L669)

Regra prática: **em rotas públicas, o tenant vem do parâmetro/payload** (não do JWT).

## O que pode / o que não pode (regras objetivas)

- Usuário autenticado:
  - pode operar **apenas** dados do próprio `tenant_id` (por RLS e/ou filtro no código).
  - não deve conseguir listar/alterar dados de outros tenants.
- Super admin:
  - pode listar e administrar múltiplos tenants e usuários.
  - ainda assim, as actions de super admin têm checagem explícita no backend.
- Usuário não autenticado:
  - pode acessar páginas públicas e ações públicas (ex.: responder survey).
  - não deve ter acesso a endpoints que dependem de `authenticateUser`.

## Invariantes importantes (assuma sempre)

- `tenant_id` é obrigatório em todas as entidades de domínio “multi-tenant”.
- `app_metadata.tenant_id` é a **chave** para:
  - performance (evita consultas extras de perfil); e
  - RLS (onde policies existem).
- Service role existe para:
  - onboarding (criar tenant e vincular usuário); e
  - operações admin/sistema.
  - quando usada fora disso, o isolamento depende do filtro no código.

## Lacunas conhecidas no repo (para você não se perder)

- Nem todas as policies RLS das tabelas centrais estão versionadas em `supabase/migrations/` (por exemplo: `survey_responses`, `survey_templates`, `tenants`, `user_profiles` etc.). Existem scripts auxiliares em [database/](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/database), mas não é a mesma coisa que migrations aplicadas.
- Parte do billing/trial é via Edge Functions (fora do repo), então algumas regras de “quem pode criar o quê” (limites/assinatura) também dependem dessas functions.

