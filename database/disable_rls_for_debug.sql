-- ================================================================
-- DESABILITAR RLS TEMPORARIAMENTE PARA DEBUG
-- Execute no Supabase SQL Editor
-- ================================================================

-- Desab ilitar RLS em todas as tabelas principais
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses DISABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_instances DISABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE consumptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE plans DISABLE ROW LEVEL SECURITY;

-- Verificar se funcionou
SELECT 
  'RLS Status' as info,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('user_profiles', 'tenants', 'survey_templates', 'subscriptions')
ORDER BY tablename;

-- ================================================================
-- RESULTADO ESPERADO: rls_enabled = false para todas as tabelas
-- ================================================================
