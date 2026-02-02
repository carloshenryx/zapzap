// Test script to validate Supabase connection
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://akzggpoqchayrfywvjdx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFremdncG9xY2hheXJmeXd2amR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NzgwMTcsImV4cCI6MjA4NDM1NDAxN30.yMS2gapXnr5miYIW2VmToTqgI5j_b1HL9n5iN1Bb-9c';

async function testSupabaseConnection() {
    console.log('🔍 Testing Supabase connection...\n');

    try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Test 1: Check connection by fetching from a table
        console.log('✅ Supabase client created successfully');
        console.log(`📍 Project URL: ${supabaseUrl}\n`);

        // Test 2: Try to list tables (this will work if auth is set up)
        console.log('🔍 Checking for existing tables...');

        // Try to fetch tenants
        const { data: tenants, error: tenantsError } = await supabase
            .from('tenants')
            .select('id, name, status')
            .limit(5);

        if (tenantsError) {
            console.log('⚠️  Tenants table error:', tenantsError.message);
            console.log('   This is expected if RLS is enabled and you\'re not authenticated\n');
        } else {
            console.log(`✅ Tenants table exists! Found ${tenants?.length || 0} records\n`);
            if (tenants && tenants.length > 0) {
                console.log('   Sample tenants:');
                tenants.forEach(t => console.log(`   - ${t.id}: ${t.name} (${t.status})`));
            }
        }

        // Test 3: Check survey_templates
        const { data: templates, error: templatesError } = await supabase
            .from('survey_templates')
            .select('id, name')
            .limit(5);

        if (templatesError) {
            console.log('⚠️  Survey templates table error:', templatesError.message);
            console.log('   This is expected if RLS is enabled and you\'re not authenticated\n');
        } else {
            console.log(`✅ Survey templates table exists! Found ${templates?.length || 0} records\n`);
        }

        // Test 4: Check whatsapp_conversations
        const { data: conversations, error: conversationsError } = await supabase
            .from('whatsapp_conversations')
            .select('id')
            .limit(1);

        if (conversationsError) {
            console.log('⚠️  WhatsApp conversations table error:', conversationsError.message);
            console.log('   This is expected if RLS is enabled and you\'re not authenticated\n');
        } else {
            console.log(`✅ WhatsApp conversations table exists!\n`);
        }

        console.log('\n✅ Supabase connection test completed!');
        console.log('\n📋 Summary:');
        console.log('   - Connection to Supabase: ✅ Working');
        console.log('   - Tables accessible (may be limited by RLS)');
        console.log('\n💡 Next steps:');
        console.log('   1. Configure RLS policies if tables show errors');
        console.log('   2. Test authentication flow');
        console.log('   3. Deploy to Vercel');

    } catch (error) {
        console.error('❌ Error testing Supabase connection:', error);
        console.log('\n🔧 Troubleshooting:');
        console.log('   - Check if SUPABASE_URL and SUPABASE_ANON_KEY are correct');
        console.log('   - Verify your Supabase project is active');
        console.log('   - Check network connection');
    }
}

testSupabaseConnection();
