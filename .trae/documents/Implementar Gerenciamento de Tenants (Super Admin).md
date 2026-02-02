## Leitura do sistema (o que existe hoje)
- **Multi-tenant**: quase tudo é filtrado por `tenant_id` (no backend via `authenticateUser` e `.eq('tenant_id', ...)`). Ex.: [surveys.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/surveys.ts#L35-L82), [analytics.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/analytics.ts#L164-L170).
- **Papéis**: `is_super_admin` (Master + Tenants). O backend aplica de verdade em [tenants.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/tenants.ts#L27-L35) e [analytics.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/analytics.ts#L25-L33). No front, o menu filtra por `userProfile?.is_super_admin`: [Layout.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/Layout.jsx#L116-L121).
- **Avaliações (pesquisas internas)**: submissão pública em [surveys.ts:create-response](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/surveys.ts#L386-L474) (valida `tenant_id` como UUID). A conversão de nota para escala comum segue [docs/avaliacoes.md](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/docs/avaliacoes.md) e está implementada em [analytics.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/analytics.ts#L137-L163).
- **Tratativa de pesquisas**: status `open/in_progress/resolved/ignored` via [surveys.ts:update-followup](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/surveys.ts#L35-L83) e colunas adicionadas na migration [dashboard_followup_google.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260124000000_dashboard_followup_google.sql).
- **Google Reviews (scraping)**: módulo completo com `places`, `reviews`, versionamento e auditoria (migration [google_reviews.sql](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/supabase/migrations/20260124002000_google_reviews.sql)). Endpoint cron `GET /api/google-reviews?action=ingest` descrito no [README.md](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/README.md#L82-L114).
- **CRM**: tarefas internas por cliente (email/telefone) via [crm.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/crm.ts).
- **Vouchers**: CRUD + regras de uso (não alterar configuração após uso) em [vouchers.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/vouchers.ts#L87-L178).

## O que está quebrando a tela de Tenants (causa do “Acesso Negado”)
- A UI busca `GET /api/auth?action=context`, mas essa action **não existe** em [api/auth.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/auth.ts#L5-L13). Resultado: `contextData` fica `undefined` e a condição `!contextData?.is_super_admin` cai no bloco “Acesso Negado”: [TenantManagement.jsx](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/src/pages/TenantManagement.jsx#L199-L212).
- A UI chama `POST /api/tenants?action=manage-status` e o Signup/Onboarding chamam `POST /api/tenants?action=onboard`, mas ambas actions **não existem** em [api/tenants.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/tenants.ts#L13-L25).

## Objetivo
- “Criar a parte de tenant” = entregar **um fluxo consistente** (backend + UI) para:
  - Super admin listar/criar/editar/suspender/cancelar tenants.
  - Usuário recém-cadastrado executar onboarding (criar tenant e vincular o usuário).
  - Remover o falso “Acesso Negado” e alinhar UI com as APIs existentes.

## Mudanças propostas (Backend)
1) **Implementar `GET /api/auth?action=context`** em [api/auth.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/auth.ts)
   - Retornar `{ profile, is_super_admin, tenant_id }`.
   - Se `is_super_admin`, retornar também `tenants` (internamente chamando a mesma lógica de listagem do endpoint de tenants).

2) **Expandir `api/tenants.ts`** para cobrir as actions já usadas no front
   - `POST action=onboard`: cria tenant e vincula o usuário atual.
     - Validar token e obter user id.
     - Criar tenant com campos que já aparecem no front (`company_name`, `contact_email`, `contact_phone`, `plan_type`, `status`, `trial_start_date` se aplicável).
     - Upsert em `user_profiles` com `tenant_id` e (para o primeiro usuário) `is_super_admin=false` e `role/admin` se existir (sem inventar colunas; só usar as que o DB já tem).
     - Atualizar `app_metadata` do usuário com `tenant_id` (otimiza `authenticateUser`): [lib/auth.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/lib/auth.ts#L30-L42).
   - `POST action=manage-status`: suportar `suspend`, `activate`, `cancel` e “delete seguro”.
     - Por padrão: **soft delete** (status `canceled`) para não quebrar FKs (survey_responses, etc.).
   - `GET action=list-all`: ajustar retorno para incluir os campos exibidos na UI (hoje retorna poucos campos): [api/tenants.ts](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/api/tenants.ts#L84-L104).
   - `POST action=create/update`: aceitar e persistir os campos que a UI já coleta (sem logar dados sensíveis).

3) **Alinhar documentação**
   - Atualizar o [README.md](file:///c:/Users/supor/OneDrive/Desktop/Zap/avaliazapsystem/README.md) na parte do “roteador único” (ele não existe no repo atual) para evitar confusão.

## Mudanças propostas (Frontend)
1) **TenantManagement**
   - Tratar erro do `useQuery` de contexto (evitar renderizar “Acesso Negado” quando a request falha).
   - Consumir o `context` real (novo) e usar `contextData.tenants` para renderização.
   - Ajustar ações de suspender/deletar para baterem em `manage-status` novo.

2) **Signup/Onboarding**
   - Garantir que o fluxo que chama `onboard` funcione (hoje o endpoint não existe).
   - Revisar `useAuth()` em Signup: o componente espera `signUp`, mas o `AuthContext` atual não expõe. Se for necessário para o fluxo de tenants, corrigir para usar o `supabase.auth.signUp` direto ou adicionar `signUp` no provider.

## Regras de negócio que vou preservar
- **Separação de privilégios**: apenas super admin pode ver/gerir tenants (UI + API).
- **Isolamento por tenant**: ações operacionais devem exigir `tenant_id`.
- **Sem exclusão destrutiva por padrão**: “deletar tenant” vira cancelamento/soft delete, a menos que você peça hard delete.

## Verificação (depois que você aprovar e eu sair do plan mode)
- Abrir a tela “Tenants” com usuário super admin e validar: lista, criar, suspender, cancelar.
- Abrir com usuário normal e validar: mensagem “Acesso Negado” aparece corretamente.
- Executar fluxo de Signup/Onboarding e confirmar que `tenant_id` passa a existir (AuthContext deixa de cair em fallback/erro).
- Smoke test: `GET /api/analytics?action=system-overview` só para super admin.
