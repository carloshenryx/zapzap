-- ================================================================
-- SCRIPT COMPLETO DE SETUP E ONBOARDING
-- Execute TUDO de uma vez no Supabase SQL Editor
-- ================================================================

-- ============================================
-- PARTE 1: CORREÇÕES DE ESTRUTURA
-- ============================================

-- 1.1 Corrigir FK constraint
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS fk_tenant_owner;
ALTER TABLE tenants ADD CONSTRAINT fk_tenant_owner 
  FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 1.2 Adicionar coluna role
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 1.3 Permitir client_id NULL em subscriptions (temporário)
ALTER TABLE subscriptions ALTER COLUMN client_id DROP NOT NULL;

-- 1.4 Desabilitar RLS temporariamente (para debug)
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;

-- ============================================
-- PARTE 2: CRIAR TENANT E VINCULAR USUÁRIO
-- ============================================

DO $$
DECLARE
  user_email TEXT := 'ext.remi@hotmail.com'; -- ⚠️ ALTERE SE NECESSÁRIO
  company_name TEXT := 'Minha Empresa Ltda';  -- ⚠️ ALTERE O NOME DA EMPRESA
  user_id_var UUID;
  new_tenant_id UUID;
BEGIN
  -- 2.1 Buscar ID do usuário
  SELECT id INTO user_id_var 
  FROM user_profiles 
  WHERE email = user_email;
  
  IF user_id_var IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado: %. Execute o signup primeiro!', user_email;
  END IF;

  -- 2.2 Verificar se já tem tenant
  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = user_id_var AND tenant_id IS NOT NULL) THEN
    RAISE NOTICE 'Usuário já possui tenant vinculado. Pulando criação.';
    RETURN;
  END IF;

  -- 2.3 Criar tenant
  INSERT INTO tenants (
    name, 
    company_name, 
    contact_email, 
    plan_type, 
    status,
    owner_user_id
  )
  VALUES (
    company_name, 
    company_name, 
    user_email, 
    'pro', 
    'active',
    user_id_var
  )
  RETURNING id INTO new_tenant_id;

  -- 2.4 Vincular tenant ao user (role admin)
  UPDATE user_profiles 
  SET 
    tenant_id = new_tenant_id,
    role = 'admin'
  WHERE id = user_id_var;

  -- 2.5 Criar subscription (sem client_id, pois referencia tabela clients)
  INSERT INTO subscriptions (tenant_id, plan_type, status, start_date)
  VALUES (new_tenant_id, 'pro', 'active', NOW());

  -- 2.6 Criar template padrão
  INSERT INTO survey_templates (tenant_id, name, questions, active)
  VALUES (
    new_tenant_id,
    'Pesquisa de Satisfação Padrão',
    '[{"id":"1","question":"Como você avalia nosso atendimento?","type":"rating","required":true}]'::jsonb,
    true
  );

  -- 2.7 Log sucesso
  RAISE NOTICE '✅ SUCESSO! Tenant criado: %, User: % (admin)', new_tenant_id, user_email;
END $$;

-- ============================================
-- PARTE 3: REABILITAR RLS
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PARTE 4: VERIFICAÇÃO FINAL
-- ============================================

SELECT 
  'VERIFICAÇÃO FINAL:' as status,
  up.email,
  up.role,
  up.tenant_id,
  t.name as tenant_name,
  t.plan_type,
  CASE 
    WHEN up.tenant_id IS NOT NULL THEN '✅ PRONTO PARA USAR!'
    ELSE '❌ ERRO: tenant_id ainda NULL'
  END as resultado
FROM user_profiles up
LEFT JOIN tenants t ON up.tenant_id = t.id
WHERE up.email = 'ext.remi@hotmail.com'; -- ⚠️ ALTERE SE NECESSÁRIO

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Após executar, faça login em http://localhost:3000
-- O Dashboard deve funcionar perfeitamente! 🎉
-- ============================================
