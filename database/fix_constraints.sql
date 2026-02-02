-- ============================================
-- PASSO 1: CORRIGIR CONSTRAINT DE FOREIGN KEY
-- ============================================

-- Remover constraint incorreto (aponta para 'users' em vez de 'auth.users')
ALTER TABLE tenants 
DROP CONSTRAINT IF EXISTS fk_tenant_owner;

-- Adicionar constraint CORRETO
ALTER TABLE tenants 
ADD CONSTRAINT fk_tenant_owner 
FOREIGN KEY (owner_user_id) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;

-- ============================================
-- PASSO 2: ADICIONAR COLUNA ROLE
-- ============================================

-- Adicionar coluna role se não existir
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- ============================================
-- RESULTADO ESPERADO
-- ============================================

-- ✅ Constraint corrigido
-- ✅ Coluna 'role' adicionada
-- ✅ Sistema pronto para onboarding automático
