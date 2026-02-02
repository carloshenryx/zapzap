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
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables', { supabaseUrl: !!supabaseUrl, supabaseServiceKey: !!supabaseServiceKey });
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function checkAndCreateUser() {
    const email = 'ext.remi@hotmail.com';
    const password = '85851010aA@';

    console.log(`Checking for user: ${email}`);

    // Check if user exists
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
        console.error('Error listing users:', listError);
        return;
    }

    const existingUser = users.find(u => u.email === email);
    let userId;

    if (existingUser) {
        console.log('User already exists:', existingUser.id);
        userId = existingUser.id;

        // Update password just in case
        const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password });
        if (updateError) console.error('Error updating password:', updateError);
        else console.log('Password updated successfully');
    } else {
        console.log('User does not exist, creating...');
        const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (createError) {
            console.error('Error creating user:', createError);
            return;
        }
        console.log('User created successfully:', user.id);
        userId = user.id;
    }

    // Check for user_profile
    console.log('Checking for user_profile...');
    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    if (profileError) {
        console.error('Error fetching profile:', profileError);
    } else if (!profile) {
        console.log('Profile missing, creating...');
        const { error: insertError } = await supabase
            .from('user_profiles')
            .insert({
                id: userId,
                email: email,
                full_name: 'User Test',
            });
        if (insertError) console.error('Error inserting profile:', insertError);
        else console.log('Profile created successfully');
    } else {
        console.log('Profile exists:', profile);
    }
}

checkAndCreateUser();
