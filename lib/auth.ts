import { getSupabaseAuthedClient, getSupabaseClient } from './supabase.js';

/**
 * Authenticate user from Vercel request
 * Extracts JWT token from Authorization header and validates with Supabase
 * OPTIMIZED: Uses app_metadata from JWT to avoid database query on every request
 */
export async function authenticateUser(req) {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Unauthorized: No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    try {
        const supabase = getSupabaseClient();

        // Validate token with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            if (error) console.error('Auth error:', error);
            throw new Error('Unauthorized: Invalid token');
        }

        // OPTIMIZATION: Use app_metadata from JWT if available (set during login)
        // This avoids database query on EVERY API request
        const tenantIdFromMeta = user.app_metadata?.tenant_id;

        if (tenantIdFromMeta) {
            return {
                id: user.id,
                email: user.email,
                tenant_id: tenantIdFromMeta,
                is_super_admin: user.app_metadata?.is_super_admin || false,
                access_token: token,
            };
        }

        // Fallback: Query database only if not in metadata (slow path)
        const supabaseAuthed = getSupabaseAuthedClient(token);
        const { data: profile, error: profileError } = await supabaseAuthed
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError) {
            console.error('Profile query error:', profileError);
        }

        return {
            id: user.id,
            email: user.email,
            tenant_id: profile?.tenant_id,
            is_super_admin: profile?.is_super_admin || false,
            access_token: token,
            ...profile
        };
    } catch (error) {
        console.error('authenticateUser error:', error);
        throw new Error('Unauthorized: ' + error.message);
    }
}
