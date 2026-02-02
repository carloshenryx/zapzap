import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../lib/auth.js';
import { getSupabaseAuthedClient, getSupabaseServiceClient, hasSupabaseServiceRoleKey } from '../lib/supabase.js';
import { successResponse, errorResponse } from '../lib/response.js';

function parseBody(req: VercelRequest) {
    if (!req.body) return {};
    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch {
            return {};
        }
    }
    return req.body;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = req.query.action as string;

    if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'PUT' && req.method !== 'DELETE') {
        return errorResponse(res, 'Method not allowed', 405);
    }

    switch (action) {
        case 'list-all':
            return await listAllTenants(req, res);
        case 'onboard':
            return await onboard(req, res);
        case 'create':
            return await createTenant(req, res);
        case 'update':
            return await updateTenant(req, res);
        case 'manage-status':
            return await manageStatus(req, res);
        case 'assign-plan':
            return await assignPlan(req, res);
        default:
            return errorResponse(res, 'Invalid action', 400);
    }
}

async function listAllTenants(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);

        // Super admin check
        if (!user.is_super_admin) {
            return errorResponse(res, 'Forbidden: Super admin access required', 403);
        }

        const supabase = hasSupabaseServiceRoleKey()
            ? getSupabaseServiceClient()
            : getSupabaseAuthedClient(user.access_token);

        const { data: tenants, error: tenantsError } = await supabase
            .from('tenants')
            .select('*')
            .order('created_at', { ascending: false });

        if (tenantsError) {
            console.error('List tenants error:', tenantsError);
            return errorResponse(res, 'Failed to list tenants', 500);
        }

        const tenantIds = (tenants || []).map((t: any) => t.id).filter(Boolean);

        let subscriptionsData: any[] = [];
        if (tenantIds.length > 0) {
            const { data: subs, error: subsError } = await supabase
                .from('subscriptions')
                .select('*')
                .in('tenant_id', tenantIds);
            if (subsError) {
                console.error('List subscriptions error:', subsError);
            } else {
                subscriptionsData = subs || [];
            }
        }

        // Get consumption data for current month
        const period = new Date().toISOString().slice(0, 7); // YYYY-MM
        let consumptionData: any[] = [];
        if (tenantIds.length > 0) {
            const { data: consumption, error: consumptionError } = await supabase
                .from('consumption')
                .select('*')
                .eq('period', period)
                .in('tenant_id', tenantIds);
            if (consumptionError) {
                console.error('List consumption error:', consumptionError);
            } else {
                consumptionData = consumption || [];
            }
        }

        // Get user counts per tenant
        let userCounts: any[] = [];
        if (tenantIds.length > 0) {
            const { data: users, error: usersError } = await supabase
                .from('user_profiles')
                .select('tenant_id')
                .in('tenant_id', tenantIds);
            if (usersError) {
                console.error('List user_profiles error:', usersError);
            } else {
                userCounts = users || [];
            }
        }

        // Build consumption map
        const consumptionMap = new Map();
        consumptionData?.forEach(c => {
            consumptionMap.set(c.tenant_id, c);
        });

        const subscriptionMap = new Map<string, any[]>();
        subscriptionsData?.forEach((s: any) => {
            const list = subscriptionMap.get(s.tenant_id) || [];
            list.push(s);
            subscriptionMap.set(s.tenant_id, list);
        });

        // Build user count map
        const userCountMap = new Map();
        userCounts?.forEach(u => {
            const count = userCountMap.get(u.tenant_id) || 0;
            userCountMap.set(u.tenant_id, count + 1);
        });

        const normalizeStatus = (value: any) => String(value ?? '').trim().toLowerCase();

        const getSubscriptionSortTime = (sub: any) => {
            const candidates = [
                sub?.current_period_end,
                sub?.end_date,
                sub?.current_period_start,
                sub?.start_date,
                sub?.updated_at,
                sub?.created_at,
            ];
            for (const candidate of candidates) {
                if (!candidate) continue;
                const ts = new Date(candidate).getTime();
                if (Number.isFinite(ts)) return ts;
            }
            return -Infinity;
        };

        const pickBillingSubscription = (subs: any[]) => {
            if (!Array.isArray(subs) || subs.length === 0) return null;

            const active = subs.find((s: any) => normalizeStatus(s?.status) === 'active');
            if (active) return active;

            const sorted = [...subs].sort((a: any, b: any) => getSubscriptionSortTime(b) - getSubscriptionSortTime(a));
            return sorted[0] || null;
        };

        // Enrich tenant data
        const enrichedTenants = tenants?.map(tenant => {
            const consumption = consumptionMap.get(tenant.id) || {};
            const userCount = userCountMap.get(tenant.id) || 0;
            const subs = subscriptionMap.get(tenant.id) || [];
            const billingSub = pickBillingSubscription(subs);
            const billingStatus = billingSub ? normalizeStatus(billingSub.status) : 'none';
            const hasManualPlan = normalizeStatus(tenant?.status) === 'active' && String(tenant?.plan_type || '').trim().length > 0;
            const effectiveSubscriptionStatus = billingSub ? billingStatus : hasManualPlan ? 'active' : 'none';

            return {
                ...tenant,
                subscription_status: effectiveSubscriptionStatus,
                billing_subscription_status: billingStatus,
                subscription_plan_type: billingSub?.plan_type || tenant?.plan_type || null,
                subscription_current_period_start: billingSub?.current_period_start || billingSub?.start_date || null,
                subscription_current_period_end: billingSub?.current_period_end || billingSub?.end_date || null,
                user_count: userCount,
                consumption: {
                    messages_sent: consumption.messages_sent || 0,
                    messages_sent_webhook: consumption.messages_sent_webhook || 0,
                    messages_sent_manual: consumption.messages_sent_manual || 0,
                    messages_sent_api: consumption.messages_sent_api || 0,
                    surveys_created: consumption.surveys_created || 0,
                    responses_received: consumption.responses_received || 0,
                    responses_received_webhook: consumption.responses_received_webhook || 0,
                    responses_received_manual: consumption.responses_received_manual || 0,
                    responses_received_api: consumption.responses_received_api || 0,
                },
            };
        });

        return successResponse(res, { tenants: enrichedTenants || [] });

    } catch (error: any) {
        console.error('List all tenants error:', error);
        const status = String(error.message || '').toLowerCase().includes('unauthorized') ? 401 : 500;
        return errorResponse(res, error.message || 'Failed to list tenants', status);
    }
}

async function onboard(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') {
            return errorResponse(res, 'Method not allowed', 405);
        }

        const user = await authenticateUser(req);
        if (!hasSupabaseServiceRoleKey()) {
            return errorResponse(
                res,
                'Missing SUPABASE_SERVICE_ROLE_KEY: onboarding precisa de service role para criar tenant e vincular usuário',
                500
            );
        }

        const supabase = getSupabaseServiceClient();
        const body = parseBody(req);

        const company_name = String(body.company_name || '').trim();
        const contact_phone = body.contact_phone ? String(body.contact_phone).trim() : null;
        const plan_type = body.plan_type ? String(body.plan_type).trim() : null;
        const normalizedPlanType = plan_type ? normalizePlanType(plan_type) : null;

        if (!company_name) {
            return errorResponse(res, 'Missing required field: company_name', 400);
        }

        if (user.tenant_id) {
            const { data: existingTenant, error: existingTenantError } = await supabase
                .from('tenants')
                .select('*')
                .eq('id', user.tenant_id)
                .maybeSingle();

            if (existingTenantError) {
                console.error('Onboard existing tenant lookup error:', existingTenantError);
            }

            return successResponse(res, {
                tenant: existingTenant || null,
                tenant_id: user.tenant_id,
                note: 'User already associated with a tenant',
            });
        }

        const tenantToInsert: any = {
            name: company_name,
            company_name,
            contact_email: user.email,
            contact_phone,
            status: 'active',
        };
        if (normalizedPlanType) tenantToInsert.plan_type = normalizedPlanType;
        if (normalizedPlanType === 'freetrial') {
            tenantToInsert.trial_start_date = new Date().toISOString();
        }

        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .insert(tenantToInsert)
            .select()
            .single();

        if (tenantError) {
            console.error('Onboard create tenant error:', tenantError);
            return errorResponse(res, tenantError.message || 'Failed to create tenant', 500);
        }

        const { data: { user: authUser }, error: authUserError } = await supabase.auth.getUser(user.access_token);
        if (authUserError) {
            console.error('Onboard auth.getUser error:', authUserError);
        }

        const fullNameFromMeta = authUser?.user_metadata?.full_name
            || authUser?.user_metadata?.name
            || body.full_name
            || null;

        const { error: profileError } = await supabase
            .from('user_profiles')
            .upsert({
                id: user.id,
                tenant_id: tenant.id,
                is_super_admin: false,
                email: authUser?.email || user.email || null,
                full_name: fullNameFromMeta,
            }, { onConflict: 'id' });

        if (profileError) {
            console.error('Onboard upsert profile error:', profileError);
        }

        try {
            const { data: adminUserData, error: adminUserError } = await supabase.auth.admin.getUserById(user.id);
            if (adminUserError) {
                console.error('Onboard admin getUserById error:', adminUserError);
            } else {
                const meta = adminUserData?.user?.app_metadata || {};
                await supabase.auth.admin.updateUserById(user.id, {
                    app_metadata: {
                        ...meta,
                        tenant_id: tenant.id,
                        is_super_admin: false,
                    },
                });
            }
        } catch (e: any) {
            console.error('Onboard update app_metadata error:', e?.message || e);
        }

        return successResponse(res, { tenant, tenant_id: tenant.id });
    } catch (error: any) {
        console.error('Onboard error:', error);
        const status = String(error.message || '').toLowerCase().includes('unauthorized') ? 401 : 500;
        return errorResponse(res, error.message || 'Failed to onboard', status);
    }
}

function normalizePlanType(planType: string) {
    const v = String(planType || '').trim().toLowerCase();
    if (!v) return null;
    if (v === 'freetrial' || v === 'free_trial' || v === 'trial' || v === 'teste grátis' || v === 'teste gratis') {
        return 'freetrial';
    }
    return String(planType).trim();
}

async function createTenant(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') {
            return errorResponse(res, 'Method not allowed', 405);
        }

        const user = await authenticateUser(req);

        if (!user.is_super_admin) {
            return errorResponse(res, 'Forbidden: Super admin access required', 403);
        }

        const body = parseBody(req);
        const name = String(body.name || '').trim();
        const company_name = body.company_name ? String(body.company_name).trim() : null;
        const contact_email = String(body.contact_email || '').trim();
        const contact_phone = body.contact_phone ? String(body.contact_phone).trim() : null;
        const plan_type = body.plan_type ? String(body.plan_type).trim() : null;
        const status = body.status ? String(body.status).trim() : 'active';

        if (!name || !contact_email) {
            return errorResponse(res, 'Missing required fields: name, contact_email', 400);
        }

        const supabase = hasSupabaseServiceRoleKey()
            ? getSupabaseServiceClient()
            : getSupabaseAuthedClient(user.access_token);

        const insertData: any = { name, contact_email, status };
        if (company_name) insertData.company_name = company_name;
        if (contact_phone) insertData.contact_phone = contact_phone;
        if (plan_type) insertData.plan_type = plan_type;

        // Create tenant
        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .insert(insertData)
            .select()
            .single();

        if (tenantError) {
            console.error('Create tenant error:', tenantError);
            return errorResponse(res, 'Failed to create tenant', 500);
        }

        return successResponse(res, { tenant });

    } catch (error: any) {
        console.error('Create tenant error:', error);
        return errorResponse(res, error.message || 'Failed to create tenant', 500);
    }
}

async function updateTenant(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') {
            return errorResponse(res, 'Method not allowed', 405);
        }

        const user = await authenticateUser(req);

        if (!user.is_super_admin) {
            return errorResponse(res, 'Forbidden: Super admin access required', 403);
        }

        const body = parseBody(req);
        const tenant_id = body.tenant_id ? String(body.tenant_id).trim() : '';

        if (!tenant_id) {
            return errorResponse(res, 'Missing required field: tenant_id', 400);
        }

        const supabase = hasSupabaseServiceRoleKey()
            ? getSupabaseServiceClient()
            : getSupabaseAuthedClient(user.access_token);

        const allowedKeys = new Set([
            'name',
            'company_name',
            'contact_email',
            'contact_phone',
            'plan_type',
            'status',
            'trial_start_date',
            'trial_end_date',
        ]);

        const updates: any = {};
        for (const [k, v] of Object.entries(body || {})) {
            if (!allowedKeys.has(k)) continue;
            if (v === undefined) continue;
            updates[k] = v;
        }

        if (Object.keys(updates).length === 0) {
            return errorResponse(res, 'No valid fields to update', 400);
        }

        const { data: tenant, error } = await supabase
            .from('tenants')
            .update(updates)
            .eq('id', tenant_id)
            .select()
            .single();

        if (error) {
            console.error('Update tenant error:', error);
            return errorResponse(res, 'Failed to update tenant', 500);
        }

        return successResponse(res, { tenant });

    } catch (error: any) {
        console.error('Update tenant error:', error);
        return errorResponse(res, error.message || 'Failed to update tenant', 500);
    }
}

async function manageStatus(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') {
            return errorResponse(res, 'Method not allowed', 405);
        }

        const user = await authenticateUser(req);
        if (!user.is_super_admin) {
            return errorResponse(res, 'Forbidden: Super admin access required', 403);
        }

        const body = parseBody(req);
        const tenant_id = body.tenant_id ? String(body.tenant_id).trim() : '';
        const action = body.action ? String(body.action).trim() : '';

        if (!tenant_id) return errorResponse(res, 'Missing required field: tenant_id', 400);
        if (!action) return errorResponse(res, 'Missing required field: action', 400);

        const statusByAction: Record<string, string | null> = {
            activate: 'active',
            suspend: 'suspended',
            cancel: 'canceled',
            delete: 'canceled',
        };

        if (!(action in statusByAction)) {
            return errorResponse(res, 'Invalid action', 400);
        }

        const nextStatus = statusByAction[action];
        const supabase = hasSupabaseServiceRoleKey()
            ? getSupabaseServiceClient()
            : getSupabaseAuthedClient(user.access_token);

        const { data: tenant, error } = await supabase
            .from('tenants')
            .update({ status: nextStatus })
            .eq('id', tenant_id)
            .select()
            .single();

        if (error) {
            console.error('Manage status error:', error);
            return errorResponse(res, error.message || 'Failed to update tenant status', 500);
        }

        return successResponse(res, { tenant });
    } catch (error: any) {
        console.error('Manage status error:', error);
        const status = String(error.message || '').toLowerCase().includes('unauthorized') ? 401 : 500;
        return errorResponse(res, error.message || 'Failed to manage tenant status', status);
    }
}

async function assignPlan(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);

        if (!user.is_super_admin) {
            return errorResponse(res, 'Forbidden: Super admin access required', 403);
        }

        // TODO: Implement plan assignment when plans table is ready
        // Need to add plan_id column to subscriptions table first
        return errorResponse(res, 'Plan assignment not yet implemented - plans table pending', 501);

    } catch (error: any) {
        console.error('Assign plan error:', error);
        return errorResponse(res, error.message || 'Failed to assign plan', 500);
    }
}
