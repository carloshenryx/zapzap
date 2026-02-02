import { createClient } from '@supabase/supabase-js';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

// Simple Supabase client - default config, no complexity
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        headers: {
            apikey: supabaseAnonKey,
        },
    },
});

// Auth helpers
export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

export async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (error) throw error;
    return data;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

// API helper with auth
export async function fetchAPI(endpoint: string, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error('No active session');
    }

    const response = await fetch(`/api${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response
            .json()
            .catch(() => ({ message: 'Request failed', error: 'Request failed' }));
        const reason = String(error?.details?.access?.reason || '');
        const isCheckout = String(window?.location?.pathname || '').toLowerCase().includes('checkout');
        if (!isCheckout && (response.status === 402 || response.status === 403) && (reason === 'trial_expired' || reason === 'subscription_expired')) {
            const tenantId = error?.details?.tenant?.id || error?.details?.tenant_id || null;
            const params = new URLSearchParams();
            if (tenantId) params.set('tenant_id', String(tenantId));
            if (reason === 'trial_expired') params.set('trial_expired', 'true');
            if (reason === 'subscription_expired') params.set('subscription_expired', 'true');
            params.set('reason', reason);
            window.location.replace(`/checkout?${params.toString()}`);
        }
        throw new Error(error.message || error.error || `API error: ${response.status}`);
    }

    return response.json();
}

// Public API helper (no auth required) - for survey submissions
export async function fetchPublicAPI(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`/api${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response
            .json()
            .catch(() => ({ message: 'Request failed', error: 'Request failed' }));
        throw new Error(error.message || error.error || `API error: ${response.status}`);
    }

    return response.json();
}
