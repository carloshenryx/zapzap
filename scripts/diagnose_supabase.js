import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');

// Manual .env parsing
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
        env[match[1].trim()] = match[2].trim();
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n=== DIAGNÓSTICO SUPABASE ===\n');

// Teste 1: Conexão básica
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function runDiagnostics() {
    try {
        // 1. Testar autenticação
        console.log('1. Testando login...');
        const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
            email: 'ext.remi@hotmail.com',
            password: '85851010aA@'
        });

        if (authError) {
            console.error('❌ Erro no login:', authError.message);
            return;
        }
        console.log('✅ Login OK - User ID:', authData.user.id);

        // 2. Testar query user_profiles COM anon key (mesmo que o app usa)
        console.log('\n2. Testando query user_profiles COM anon key...');
        const startTime = Date.now();

        try {
            const { data: profile, error: profileError } = await supabaseAnon
                .from('user_profiles')
                .select('*')
                .eq('id', authData.user.id)
                .maybeSingle();

            const duration = Date.now() - startTime;
            console.log(`Query completou em ${duration}ms`);

            if (profileError) {
                console.error('❌ Erro na query:', profileError);
            } else {
                console.log('✅ Profile encontrado:', profile ? 'SIM' : 'NÃO');
                if (profile) {
                    console.log('   - tenant_id:', profile.tenant_id);
                    console.log('   - is_super_admin:', profile.is_super_admin);
                }
            }
        } catch (err) {
            const duration = Date.now() - startTime;
            console.error(`❌ Query falhou após ${duration}ms:`, err.message);
        }

        // 3. Testar query user_profiles COM service role (admin)
        console.log('\n3. Testando query user_profiles COM service role...');
        const startTime2 = Date.now();

        try {
            const { data: profileAdmin, error: profileErrorAdmin } = await supabaseAdmin
                .from('user_profiles')
                .select('*')
                .eq('id', authData.user.id)
                .maybeSingle();

            const duration2 = Date.now() - startTime2;
            console.log(`Query admin completou em ${duration2}ms`);

            if (profileErrorAdmin) {
                console.error('❌ Erro na query admin:', profileErrorAdmin);
            } else {
                console.log('✅ Profile Admin encontrado:', profileAdmin ? 'SIM' : 'NÃO');
            }
        } catch (err) {
            const duration2 = Date.now() - startTime2;
            console.error(`❌ Query admin falhou após ${duration2}ms:`, err.message);
        }

        // 4. Verificar RLS
        console.log('\n4. Verificando RLS em user_profiles...');
        const { data: tableInfo, error: tableError } = await supabaseAdmin.rpc('pg_get_tabledef', {
            tablename: 'user_profiles'
        }).catch(() => ({ data: null, error: 'RPC não disponível' }));

        if (tableInfo) {
            console.log('Informações da tabela:', tableInfo);
        } else {
            console.log('⚠️ Não foi possível consultar definição da tabela');
        }

        // 5. Listar políticas RLS
        console.log('\n5. Listando políticas RLS...');
        const { data: policies, error: policiesError } = await supabaseAdmin
            .from('pg_policies')
            .select('*')
            .eq('tablename', 'user_profiles')
            .catch(() => ({ data: null, error: 'Não foi possível acessar pg_policies' }));

        if (policies && policies.length > 0) {
            console.log(`Encontradas ${policies.length} política(s):`);
            policies.forEach(p => {
                console.log(`  - ${p.policyname}: ${p.cmd} usando ${p.qual || 'N/A'}`);
            });
        } else {
            console.log('⚠️ Não foi possível listar políticas ou nenhuma política encontrada');
        }

        console.log('\n=== FIM DO DIAGNÓSTICO ===\n');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERRO GERAL:', error);
        process.exit(1);
    }
}

runDiagnostics();
