## Visão Geral
- O app hoje guarda o vínculo em dois lugares: `public.user_profiles.tenant_id` e `auth.users.app_metadata.tenant_id` (usado como “fast path” no AuthContext). O fluxo novo precisa manter ambos sincronizados.
- Vamos suportar 2 entradas:
  - **Join por código**: usuário se cadastra e pede vínculo → **fica pendente** até admin aprovar.
  - **Convite por admin**: admin gera convite por e-mail → usuário se cadastra via link → **vínculo automático** (sem aprovação).

## Banco (migrações Supabase)
1. **Código do tenant**
   - Adicionar `tenants.code text` (único, indexado) e `tenants.allowed_email_domains text[] null`.
   - Criar função/trigger no Postgres para gerar `code` automaticamente a partir de `company_name/name` (ex.: “Avaliazap” → `avaliazap`, com sufixo se já existir).
   - Backfill: preencher `code` para tenants existentes onde estiver `null`.
2. **Solicitações de vínculo (por código)**
   - Tabela `tenant_join_requests` com `tenant_id`, `requester_user_id`, `requester_email`, `status (pending/approved/rejected/cancelled)`, timestamps e quem decidiu.
   - Índices/constraints para evitar duplicados (ex.: um pending por usuário/tenant).
3. **Convites (por admin)**
   - Tabela `tenant_invites` com `tenant_id`, `invited_email`, `token_hash`, `status (pending/accepted/revoked/expired)`, `expires_at`, `invited_by`, `accepted_user_id`.
   - Armazenar **somente hash** do token (token bruto só no e-mail/link).
4. **Rate limit (validação de código)**
   - Tabela `tenant_code_validation_attempts` (ip + timestamp + code) para limitar tentativas.
5. **Auditoria**
   - Tabela `audit_log` (actor_user_id, tenant_id, action, target_user_id/email, metadata jsonb, created_at) para logar: validação, request join, aprovação/rejeição, criação/aceite/revogação de convite.

## Backend (endpoints /api)
1. **Validação pública do código do tenant**
   - `GET /api/tenants?action=validate-code&code=...`
   - Regras: rate limit por IP, validar tenant existente e `status='active'`, retornar apenas `tenant_id`, `name/company_name`, `code` e flag de restrição de domínio (sem dados sensíveis).
2. **Join por código (cria pendência)**
   - `POST /api/tenants?action=request-join-by-code` (auth)
   - Corpo: `{ code }`
   - Regras: valida tenant ativo, valida domínio (se configurado), cria `tenant_join_requests` como `pending`, envia e-mail aos admins do tenant, grava auditoria.
3. **Painel admin: listar e decidir solicitações**
   - `GET /api/tenants?action=list-join-requests` (somente `role='admin'` do tenant ou super admin)
   - `POST /api/tenants?action=decide-join-request` (admin)
     - Corpo: `{ request_id, decision: 'approve'|'reject' }`
     - Approve: seta `user_profiles.tenant_id`, atualiza `auth.users.app_metadata.tenant_id` via admin API, marca request como aprovado, audita.
4. **Convites** (novo handler + wrapper)
   - `POST /api/tenant-invites?action=create` (admin): `{ email, expires_in_days? }` → gera token, grava hash, envia e-mail com link `/signup?invite=TOKEN`.
   - `GET /api/tenant-invites?action=list` (admin) → lista pendentes/expirados/aceitos.
   - `POST /api/tenant-invites?action=revoke` (admin): `{ invite_id }`.
   - `POST /api/tenant-invites?action=accept` (auth): `{ token }` → valida, garante que `user.email` == `invited_email`, vincula automaticamente, marca aceite, audita, notifica admins.

## Regras de permissão e segurança
- **Somente admins do tenant** (`user_profiles.role === 'admin'`) podem: criar/revogar convites, listar/decidir requests.
- **Super admin** também pode operar (fallback de manutenção).
- **Restrição por domínio**: se `tenants.allowed_email_domains` estiver preenchido, aceitar apenas e-mails com domínio permitido tanto em join-by-code quanto em convites.
- **Rate limit**: exemplo de política (ajustável): 10 validações / 5 min / IP.
- **Tokens**: gerar token aleatório forte, armazenar `sha256(token)`; expiração padrão 7 dias; convite revogável.

## Frontend (UI/UX)
1. **Signup.jsx**
   - Adicionar campo opcional “Código da Empresa”.
   - Ao digitar/sair do campo: chamar validação pública e mostrar feedback (empresa encontrada / inválida).
   - Após `signUp`:
     - Se houver sessão (token): chamar `request-join-by-code` para criar pendência.
     - Se não houver sessão (e-mail precisa confirmar): salvar `company_code` localmente e tentar vincular no primeiro login.
2. **Cadastro via convite**
   - Detectar query `?invite=...`.
   - Esconder “Código da Empresa” e mostrar “Você foi convidado para <empresa>” (validando o token no backend opcionalmente).
   - Após login/sessão: chamar `accept` e vincular automaticamente.
3. **Painel Admin (src/pages/Admin.jsx)**
   - Criar uma nova aba/section “Usuários” com:
     - Exibição do **código da empresa** + botão copiar.
     - **Convites**: criar convite (e-mail), listar, revogar.
     - **Pendências por código**: listar solicitações e botões Aprovar/Rejeitar.
   - UI deve esconder ações se `userProfile.role !== 'admin'`.

## Notificações
- Reaproveitar `lib/email.ts` (Resend) para enviar:
  - Para admins do tenant: “Novo pedido de acesso” (join por código) e “Novo membro entrou via convite”.

## Testes/validação
- Adicionar testes unitários (Vitest) para:
  - Permissões (admin vs user comum).
  - Fluxo de convite (create/accept/revoke, expiração, mismatch de e-mail).
  - Fluxo de join por código (pending/approve/reject).
  - Rate limit da validação.

Se você confirmar este plano, eu implemento em etapas (migrações → endpoints → UI → testes) mantendo o padrão atual do repo (handlers em `handlers/`, wrappers em `api/`, UI em `src/pages/` e componentes em `src/components/admin/`).