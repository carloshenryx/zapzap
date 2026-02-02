import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../lib/auth.js';
import { getSupabaseAuthedClient, getSupabaseServiceClient, hasSupabaseServiceRoleKey } from '../lib/supabase.js';
import { successResponse, errorResponse } from '../lib/response.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = req.query.action as string;

    if (action === 'context') {
        return await getAuthContext(req, res);
    }

    if (action === 'profile') {
        return await getUserProfile(req, res);
    }

    return errorResponse(res, 'Invalid action', 400);
}

async function getAuthContext(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);
        const supabase = hasSupabaseServiceRoleKey()
            ? getSupabaseServiceClient()
            : getSupabaseAuthedClient(user.access_token);

        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError) {
            console.error('Context profile query error:', profileError);
        }

        let tenant: any | null = null;
        if (user.tenant_id) {
            const { data: tenantData, error: tenantError } = await supabase
                .from('tenants')
                .select('*')
                .eq('id', user.tenant_id)
                .maybeSingle();
            if (tenantError) {
                console.error('Context tenant query error:', tenantError);
            } else {
                tenant = tenantData || null;
            }
        }

        const subscription = await loadTenantSubscription(supabase, user.tenant_id || null);
        const subscriptionState = await computeSubscriptionState(supabase, subscription);
        const trial = computeTrialState(tenant, subscriptionState);
        const access = computeAccessState(tenant, trial, subscriptionState);

        let tenants: any[] | null = null;
        if (user.is_super_admin) {
            const { data: tenantsData, error: tenantsError } = await supabase
                .from('tenants')
                .select('*')
                .order('created_at', { ascending: false });

            if (tenantsError) {
                console.error('Context tenants query error:', tenantsError);
            } else {
                tenants = tenantsData || [];
            }
        }

        return successResponse(res, {
            profile: profile || null,
            tenant_id: user.tenant_id || null,
            is_super_admin: !!user.is_super_admin,
            tenants: tenants || [],
            tenant,
            trial,
            access,
            subscription: subscriptionState,
        });
    } catch (error: any) {
        console.error('Auth context error:', error);
        const status = String(error.message || '').toLowerCase().includes('unauthorized') ? 401 : 500;
        return errorResponse(res, error.message || 'Internal error', status);
    }
}

function normalizePlanType(planType: any) {
    const raw = String(planType || '').trim();
    const v = raw.toLowerCase();
    if (!v) return null;
    if (v === 'freetrial' || v === 'free_trial' || v === 'trial' || v === 'teste grátis' || v === 'teste gratis') {
        return 'freetrial';
    }
    return raw;
}

function computeTrialState(tenant: any | null, subscription: any) {
    if (!tenant) return { is_trial: false, expired: false, started_at: null, expires_at: null };
    if (subscription?.is_active_paid) return { is_trial: false, expired: false, started_at: null, expires_at: null };
    const planType = normalizePlanType(tenant.plan_type);
    if (planType !== 'freetrial') return { is_trial: false, expired: false, started_at: null, expires_at: null };

    const startedAt = tenant.trial_start_date || tenant.created_at || null;
    if (!startedAt) return { is_trial: true, expired: false, started_at: null, expires_at: null };

    const start = new Date(startedAt);
    const expires = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    return {
        is_trial: true,
        expired: now.getTime() > expires.getTime(),
        started_at: start.toISOString(),
        expires_at: expires.toISOString(),
    };
}

function computeAccessState(tenant: any | null, trial: any, subscription: any) {
    if (!tenant) return { blocked: true, reason: 'no_tenant' };
    const status = String(tenant.status || '').toLowerCase();
    if (trial?.is_trial && trial?.expired) return { blocked: true, reason: 'trial_expired' };
    if (subscription?.is_subscription && subscription?.expired) {
        return {
            blocked: true,
            reason: 'subscription_expired',
            expires_at: subscription?.expires_at || null,
            plan_name: subscription?.plan_name || null,
            billing_cycle: subscription?.billing_cycle || null,
        };
    }
    if (status && status !== 'active') return { blocked: true, reason: 'tenant_inactive', status };
    return { blocked: false, reason: 'active' };
}

async function loadTenantSubscription(supabase: any, tenantId: string | null) {
    if (!tenantId) return null;
    try {
        const { data, error } = await supabase
            .from('subscriptions')
            .select('*, plans(name, billing_cycle)')
            .eq('tenant_id', tenantId);
        if (error) return null;
        if (!Array.isArray(data) || data.length === 0) return null;

        const normalizeStatus = (value: any) => String(value ?? '').trim().toLowerCase();
        const getSubscriptionSortTime = (sub: any) => {
            const candidates = [
                sub?.current_period_end,
                sub?.end_date,
                sub?.current_period_start,
                sub?.start_date,
                sub?.updated_at,
                sub?.created_at,
                sub?.created_date,
            ];
            for (const candidate of candidates) {
                if (!candidate) continue;
                const ts = new Date(candidate).getTime();
                if (Number.isFinite(ts)) return ts;
            }
            return -Infinity;
        };

        const active = data.find((s: any) => normalizeStatus(s?.status) === 'active');
        if (active) return active;
        const sorted = [...data].sort((a: any, b: any) => getSubscriptionSortTime(b) - getSubscriptionSortTime(a));
        return sorted[0] || null;
    } catch {
        return null;
    }
}

function normalizeBillingCycle(value: any) {
    const v = String(value ?? '').trim().toLowerCase();
    if (!v) return null;
    if (v === 'monthly' || v === 'mensal') return 'monthly';
    if (v === 'quarterly' || v === 'trimestral') return 'quarterly';
    if (v === 'annual' || v === 'yearly' || v === 'anual') return 'annual';
    return v;
}

function parseIsoDate(value: any) {
    if (!value) return null;
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return null;
    return d;
}

function addMonths(start: Date, months: number) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + months);
    return d;
}

async function computeSubscriptionState(supabase: any, subscription: any | null) {
    if (!subscription) {
        return {
            is_subscription: false,
            is_active_paid: false,
            expired: false,
            started_at: null,
            expires_at: null,
            plan_name: null,
            billing_cycle: null,
            status: null,
        };
    }

    const planName = String(subscription?.plan_type || subscription?.plans?.name || '').trim() || null;
    const status = String(subscription?.status || '').trim().toLowerCase() || null;

    const startedAt =
        parseIsoDate(subscription?.current_period_start) ||
        parseIsoDate(subscription?.start_date) ||
        parseIsoDate(subscription?.created_at) ||
        parseIsoDate(subscription?.created_date);

    let expiresAt =
        parseIsoDate(subscription?.current_period_end) ||
        parseIsoDate(subscription?.end_date);

    let billingCycle = normalizeBillingCycle(subscription?.plans?.billing_cycle || subscription?.billing_cycle || null);

    if (!billingCycle && planName) {
        try {
            const { data, error } = await supabase
                .from('plans')
                .select('billing_cycle')
                .eq('name', planName)
                .maybeSingle();
            if (!error && data?.billing_cycle) {
                billingCycle = normalizeBillingCycle(data.billing_cycle);
            }
        } catch {
            billingCycle = null;
        }
    }

    if (!expiresAt && startedAt && billingCycle) {
        if (billingCycle === 'monthly') expiresAt = new Date(startedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
        if (billingCycle === 'quarterly') expiresAt = new Date(startedAt.getTime() + 90 * 24 * 60 * 60 * 1000);
        if (billingCycle === 'annual') expiresAt = addMonths(startedAt, 12);
    }

    const now = new Date();
    const expired = !!(expiresAt && now.getTime() > expiresAt.getTime());

    const isActivePaid = status === 'active' && !expired;

    return {
        is_subscription: true,
        is_active_paid: isActivePaid,
        expired,
        started_at: startedAt ? startedAt.toISOString() : null,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        plan_name: planName,
        billing_cycle: billingCycle,
        status,
    };
}

async function getUserProfile(req: VercelRequest, res: VercelResponse) {
    try {
        // Get user from auth header
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return errorResponse(res, 'No authorization header', 401);
        }

        const token = authHeader.substring(7);
        const supabase = getSupabaseServiceClient();

        // Get user from token
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return errorResponse(res, 'Invalid token', 401);
        }

        // Get profile using SERVICE ROLE (bypasses RLS)
        const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        if (error) {
            console.error('Profile query error:', error);
            return errorResponse(res, 'Failed to load profile', 500);
        }

        return successResponse(res, { profile });
    } catch (error: any) {
        console.error('Get profile error:', error);
        return errorResponse(res, error.message || 'Internal error', 500);
    }
}
