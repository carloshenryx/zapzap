# Guia de Migração - Base44 para Supabase + Vercel

Este guia documenta os passos para completar a migração do sistema AvaliaZap.

## ✅ Concluído

### Estrutura do Projeto
- ✅ Criado `.env.local` com variáveis de ambiente
- ✅ Criado `vercel.json` para configuração do Vercel
- ✅ Atualizado `.gitignore`
- ✅ Removidas dependências do Base44
- ✅ Adicionado `@supabase/supabase-js` e `@vercel/node`

### Estrutura da API (`/api`)
- ✅ Criados helpers em `/api/lib`:
  - `supabase.ts` - Clientes Supabase
  - `auth.ts` - Middleware de autenticação
  - `response.ts` - Helpers de resposta

### Funções Convertidas (5/44)
- ✅ `/api/tenants/create.ts` - Criar tenant
- ✅ `/api/whatsapp/webhook.ts` - Webhook WhatsApp
- ✅ `/api/payments/asaas-webhook.ts` - Webhook Asaas
- ✅ `/api/auth/me.ts` - Dados do usuário
- ✅ `/api/auth/tenant-context.ts` - Contexto do tenant

### Frontend
- ✅ Criado `src/lib/supabase.ts` com cliente e helpers
- ✅ Criado `src/hooks/useAuth.ts` para gerenciar auth
- ✅ Removido plugin Base44 do `vite.config.js`

---

## 📋 Próximos Passos

### 1. Configurar Supabase
Você precisa configurar seu projeto Supabase:

#### 1.1. Atualizar `.env.local`
Substitua os valores placeholder pelas suas credenciais:
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
```

Você encontra essas informações em:
- Vá para https://app.supabase.com
- Selecione seu projeto
- Settings → API
- Copie `Project URL` e as chaves

### 1.3. Migrações via Supabase CLI (recomendado)
Para aplicar alterações de banco com versionamento (sem depender do SQL Editor), use as migrações em `supabase/migrations`.

#### 1.3.1. Vincular o projeto (uma vez)
```bash
npm run db:link
```

#### 1.3.2. Aplicar migrações no banco remoto
```bash
npm run db:push
```

Notas:
- Você precisa estar autenticado no Supabase CLI (ele pode pedir login/token) e pode solicitar a senha do banco.
- A migração do painel (tratativa + google redirect tracking) está em `supabase/migrations/20260124000000_dashboard_followup_google.sql`.

#### 1.2. Configurar Row Level Security (RLS)
Execute este SQL no Supabase SQL Editor:

```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver seus próprios dados
CREATE POLICY "Users can view own tenant"
ON tenants FOR SELECT
USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can view own profile"
ON user_profiles FOR SELECT
USING (auth.uid() = id);

-- Super admins podem ver tudo
CREATE POLICY "Super admins full access"
ON tenants FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND is_super_admin = true
  )
);
```

### 2. Converter Funções Restantes
Ainda faltam 39 funções para converter. As mais importantes são:

**Prioridade Alta:**
- `sendSurvey.ts` → `/api/surveys/send.ts`
- `recordSurveyResponse.ts` → `/api/surveys/record-response.ts`
- `createInstance.ts` → `/api/whatsapp/create-instance.ts`
- `getQRCode.ts` → `/api/whatsapp/qrcode.ts`
- `manageSubscription.ts` → `/api/subscriptions/manage.ts`

**Prioridade Média:**
- Todas as funções de `manageClient`, `managePlans`, etc.

### 3. Instalar Dependências
Execute no terminal:
```bash
cd c:\Users\supor\OneDrive\Desktop\Zap\avaliazapsystem
npm install
```

### 4. Configurar Vercel

#### 4.1. Instalar Vercel CLI (opcional, para testes locais)
```bash
npm install -g vercel
```

#### 4.2. Testar localmente
```bash
vercel dev
```

#### 4.3. Deploy no Vercel
1. Vá para https://vercel.com
2. Clique em "Add New Project"
3. Importe seu repositório do GitHub
4. Configure as variáveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `EVOLUTION_API_URL`
   - `EVOLUTION_API_KEY`
   - `ASAAS_API_KEY`
   - `ASAAS_WEBHOOK_SECRET`
5. Clique em "Deploy"

### 5. Atualizar Frontend
Você precisará atualizar os componentes React que usavam Base44:

**Exemplo de conversão:**
```javascript
// ANTES (Base44)
import { useAuth } from '@base44/sdk';

function MyComponent() {
  const { user } = useAuth();
  // ...
}

// DEPOIS (Supabase)
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const { user } = useAuth();
  // ...
}
```

### 6. Configurar Webhooks
Após deploy no Vercel, você terá URLs como:
```
https://seu-app.vercel.app/api/whatsapp/webhook
https://seu-app.vercel.app/api/payments/asaas-webhook
```

Configure essas URLs em:
- **Evolution API**: Para receber mensagens do WhatsApp
- **Asaas**: Para receber notificações de pagamento

---

## 🧪 Testando

### Teste Local
```bash
# Terminal 1 - Rodar Vercel dev
vercel dev

# Terminal 2 - Testar endpoint
curl -X POST http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer SEU_TOKEN_JWT"
```

### Teste em Produção
Após deploy, teste os endpoints:
```bash
curl https://seu-app.vercel.app/api/auth/me \
  -H "Authorization: Bearer SEU_TOKEN_JWT"
```

---

## ❓ Dúvidas Frequentes

### Como obter um token JWT?
Após login via Supabase Auth, o token estará em:
```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session.access_token;
```

### Onde configurar webhooks?
- **Evolution API**: No painel de configuração da instância
- **Asaas**: Em Configurações → Webhooks

### Como debugar funções serverless?
- Localmente: `vercel dev` mostra logs no terminal
- Produção: Veja logs em https://vercel.com → seu projeto → Deployments → Functions

---

## 📞 Próximos Passos

1. Configure suas credenciais no `.env.local`
2. Execute `npm install`
3. Teste localmente com `vercel dev`
4. Me avise quando estiver pronto para converter mais funções!
