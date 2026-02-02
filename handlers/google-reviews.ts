import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../lib/auth.js';
import { getSupabaseServiceClient } from '../lib/supabase.js';
import { successResponse, errorResponse, errorFromException } from '../lib/response.js';
import { computeReviewContentHash, isCriticalRating, scrapeGoogleReviewsPublic } from '../lib/googleReviews.js';
import { sendEmail } from '../lib/email.js';
import { requirePermission } from '../lib/authorize.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = req.query.action as string;

    switch (action) {
        case 'summary':
            return await getSummary(req, res);
        case 'list':
            return await listReviews(req, res);
        case 'list-by-customer':
            return await listReviewsByCustomer(req, res);
        case 'list-places':
            return await listPlaces(req, res);
        case 'upsert-place':
            return await upsertPlace(req, res);
        case 'toggle-place':
            return await togglePlace(req, res);
        case 'update-status':
            return await updateStatus(req, res);
        case 'link-customer':
            return await linkCustomer(req, res);
        case 'create-task':
            return await createTaskFromReview(req, res);
        case 'get-alert-settings':
            return await getAlertSettings(req, res);
        case 'set-alert-settings':
            return await setAlertSettings(req, res);
        case 'list-actions':
            return await listReviewActions(req, res);
        case 'list-actions-by-customer':
            return await listReviewActionsByCustomer(req, res);
        case 'add-action':
            return await addReviewAction(req, res);
        case 'ingest-now':
            return await ingestNow(req, res);
        case 'ingest':
            return await ingestPublic(req, res);
        case 'ingest-manual':
            return await ingestManual(req, res);
        default:
            return errorResponse(res, 'Invalid action', 400);
    }
}

async function listReviewsByCustomer(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);
        if (!user.tenant_id) return errorResponse(res, 'User not associated with a tenant', 403);
        if (!(await requirePermission(res, user, 'google_reviews.view'))) return;

        const email = (req.query.email as string) || null;
        const phone = (req.query.phone as string) || null;
        const limit = Math.min(Number(req.query.limit || 200), 500);

        if (!email && !phone) return errorResponse(res, 'Missing email or phone', 400);

        const supabase = getSupabaseServiceClient();

        let query = supabase
            .from('google_reviews')
            .select('*')
            .eq('tenant_id', user.tenant_id)
            .order('review_published_at', { ascending: false })
            .limit(limit);

        if (email && phone) {
            query = query.or(`linked_customer_email.eq.${email},linked_customer_phone.eq.${phone}`);
        } else if (email) {
            query = query.eq('linked_customer_email', email);
        } else {
            query = query.eq('linked_customer_phone', phone);
        }

        const { data, error } = await query;
        if (error) throw error;

        return successResponse(res, { reviews: data || [] });
    } catch (error: any) {
        console.error('listReviewsByCustomer error:', error);
        return errorFromException(res, error, error.message || 'Failed to list customer reviews', 500);
    }
}

async function listPlaces(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);
        if (!user.tenant_id) return errorResponse(res, 'User not associated with a tenant', 403);
        if (!(await requirePermission(res, user, 'google_reviews.view'))) return;

        const supabase = getSupabaseServiceClient();
        const { data, error } = await supabase
            .from('google_places')
            .select('*')
            .eq('tenant_id', user.tenant_id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return successResponse(res, { places: data || [] });
    } catch (error: any) {
        console.error('listPlaces error:', error);
        return errorFromException(res, error, error.message || 'Failed to list places', 500);
    }
}

async function upsertPlace(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);

        const user = await authenticateUser(req);
        if (!user.tenant_id) return errorResponse(res, 'User not associated with a tenant', 403);
        if (!(await requirePermission(res, user, 'google_reviews.manage'))) return;

        const { place_id, maps_url, display_name, is_active } = req.body || {};
        if (!place_id) return errorResponse(res, 'Missing required field: place_id', 400);

        const supabase = getSupabaseServiceClient();

        const payload: any = {
            tenant_id: user.tenant_id,
            place_id: String(place_id).trim(),
            maps_url: maps_url ? String(maps_url).trim() : null,
            display_name: display_name ? String(display_name).trim() : null,
            is_active: typeof is_active === 'boolean' ? is_active : true,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('google_places')
            .upsert(payload, { onConflict: 'tenant_id,place_id' })
            .select()
            .single();

        if (error) throw error;
        return successResponse(res, { place: data });
    } catch (error: any) {
        console.error('upsertPlace error:', error);
        return errorFromException(res, error, error.message || 'Failed to upsert place', 500);
    }
}

async function togglePlace(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);

        const user = await authenticateUser(req);
        if (!user.tenant_id) return errorResponse(res, 'User not associated with a tenant', 403);
        if (!(await requirePermission(res, user, 'google_reviews.manage'))) return;

        const { place_id, is_active } = req.body || {};
        if (!place_id) return errorResponse(res, 'Missing required field: place_id', 400);
        if (typeof is_active !== 'boolean') return errorResponse(res, 'Missing required field: is_active', 400);

        const supabase = getSupabaseServiceClient();
        const { data, error } = await supabase
            .from('google_places')
            .update({ is_active, updated_at: new Date().toISOString() })
            .eq('tenant_id', user.tenant_id)
            .eq('place_id', String(place_id).trim())
            .select()
            .single();

        if (error) throw error;
        return successResponse(res, { place: data });
    } catch (error: any) {
        console.error('togglePlace error:', error);
        return errorFromException(res, error, error.message || 'Failed to toggle place', 500);
    }
}

async function getSummary(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);
        if (!user.tenant_id) return errorResponse(res, 'User not associated with a tenant', 403);
        if (!(await requirePermission(res, user, 'google_reviews.view'))) return;

        const place_id = (req.query.place_id as string) || null;
        const start = (req.query.start as string) || null;
        const end = (req.query.end as string) || null;
        const limit = Math.min(Number(req.query.limit || 20), 100);

        const supabase = getSupabaseServiceClient();

        let baseQuery = supabase
            .from('google_reviews')
            .select('id, rating, status, is_critical, author_name, comment, review_published_at, place_id, linked_customer_email, linked_customer_phone, linked_customer_name')
            .eq('tenant_id', user.tenant_id);

        if (place_id) baseQuery = baseQuery.eq('place_id', place_id);
        if (start) baseQuery = baseQuery.gte('review_published_at', new Date(start).toISOString());
        if (end) baseQuery = baseQuery.lte('review_published_at', new Date(end).toISOString());

        const { data: all, error } = await baseQuery.order('review_published_at', { ascending: false }).limit(1000);
        if (error) throw error;

        const total = all?.length || 0;
        const avg = total ? all.reduce((s, r: any) => s + (Number(r.rating) || 0), 0) / total : 0;
        const positive = (all || []).filter((r: any) => Number(r.rating) >= 4).length;
        const neutral = (all || []).filter((r: any) => Number(r.rating) === 3).length;
        const negative = (all || []).filter((r: any) => Number(r.rating) <= 2).length;
        const critical = (all || []).filter((r: any) => r.is_critical === true).length;
        const criticalNew = (all || []).filter((r: any) => r.is_critical === true && (r.status === 'new' || r.status === 'in_progress')).length;

        const recent = (all || []).slice(0, limit);
        const criticalRecent = (all || []).filter((r: any) => r.is_critical === true).slice(0, limit);

        return successResponse(res, {
            summary: {
                total,
                avg_rating: Number.isFinite(avg) ? Number(avg.toFixed(2)) : 0,
                counts: { positive, neutral, negative, critical, critical_open: criticalNew },
            },
            recent,
            critical_recent: criticalRecent,
        });
    } catch (error: any) {
        console.error('getSummary error:', error);
        return errorFromException(res, error, error.message || 'Failed to load summary', 500);
    }
}

async function listReviews(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);
        if (!user.tenant_id) return errorResponse(res, 'User not associated with a tenant', 403);
        if (!(await requirePermission(res, user, 'google_reviews.view'))) return;

        const place_id = (req.query.place_id as string) || null;
        const status = (req.query.status as string) || null;
        const is_critical = req.query.is_critical as string | undefined;
        const rating_min = req.query.rating_min ? Number(req.query.rating_min) : null;
        const rating_max = req.query.rating_max ? Number(req.query.rating_max) : null;
        const start = (req.query.start as string) || null;
        const end = (req.query.end as string) || null;
        const limit = Math.min(Number(req.query.limit || 50), 200);
        const offset = Math.max(Number(req.query.offset || 0), 0);

        const supabase = getSupabaseServiceClient();

        let query = supabase
            .from('google_reviews')
            .select('*')
            .eq('tenant_id', user.tenant_id)
            .order('review_published_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (place_id) query = query.eq('place_id', place_id);
        if (status && status !== 'all') query = query.eq('status', status);
        if (is_critical === 'true') query = query.eq('is_critical', true);
        if (is_critical === 'false') query = query.eq('is_critical', false);
        if (rating_min !== null && Number.isFinite(rating_min)) query = query.gte('rating', rating_min);
        if (rating_max !== null && Number.isFinite(rating_max)) query = query.lte('rating', rating_max);
        if (start) query = query.gte('review_published_at', new Date(start).toISOString());
        if (end) query = query.lte('review_published_at', new Date(end).toISOString());

        const { data, error } = await query;
        if (error) throw error;

        return successResponse(res, { reviews: data || [] });
    } catch (error: any) {
        console.error('listReviews error:', error);
        return errorFromException(res, error, error.message || 'Failed to list reviews', 500);
    }
}

async function updateStatus(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);

        const user = await authenticateUser(req);
        if (!user.tenant_id) return errorResponse(res, 'User not associated with a tenant', 403);
        if (!(await requirePermission(res, user, 'google_reviews.manage'))) return;

        const { review_id, status } = req.body || {};
        if (!review_id) return errorResponse(res, 'Missing required field: review_id', 400);
        if (!status) return errorResponse(res, 'Missing required field: status', 400);
        if (!['new', 'in_progress', 'resolved', 'ignored'].includes(status)) return errorResponse(res, 'Invalid status', 400);

        const supabase = getSupabaseServiceClient();

        const { data: updated, error } = await supabase
            .from('google_reviews')
            .update({ status, status_updated_at: new Date().toISOString() })
            .eq('tenant_id', user.tenant_id)
            .eq('id', review_id)
            .select()
            .single();

        if (error) throw error;

        await supabase.from('google_review_actions').insert({
            tenant_id: user.tenant_id,
            review_id,
            action_type: 'status_change',
            payload: { status },
            created_by: user.email || null,
        });

        return successResponse(res, { review: updated });
    } catch (error: any) {
        console.error('updateStatus error:', error);
        return errorFromException(res, error, error.message || 'Failed to update status', 500);
    }
}

async function linkCustomer(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);

        const user = await authenticateUser(req);
        if (!user.tenant_id) return errorResponse(res, 'User not associated with a tenant', 403);
        if (!(await requirePermission(res, user, 'google_reviews.manage'))) return;

        const { review_id, customer_email, customer_phone, customer_name } = req.body || {};
        if (!review_id) return errorResponse(res, 'Missing required field: review_id', 400);
        if (!customer_email && !customer_phone) return errorResponse(res, 'Missing customer_email or customer_phone', 400);

        const supabase = getSupabaseServiceClient();

        const { data: updated, error } = await supabase
            .from('google_reviews')
            .update({
                linked_customer_email: customer_email || null,
                linked_customer_phone: customer_phone || null,
                linked_customer_name: customer_name || null,
            })
            .eq('tenant_id', user.tenant_id)
            .eq('id', review_id)
            .select()
            .single();

        if (error) throw error;

        await supabase.from('google_review_actions').insert({
            tenant_id: user.tenant_id,
            review_id,
            action_type: 'linked_customer',
            payload: {
                linked_customer_email: customer_email || null,
                linked_customer_phone: customer_phone || null,
                linked_customer_name: customer_name || null,
            },
            created_by: user.email || null,
        });

        return successResponse(res, { review: updated });
    } catch (error: any) {
        console.error('linkCustomer error:', error);
        return errorFromException(res, error, error.message || 'Failed to link customer', 500);
    }
}

async function createTaskFromReview(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);

        const user = await authenticateUser(req);
        if (!user.tenant_id) return errorResponse(res, 'User not associated with a tenant', 403);
        if (!(await requirePermission(res, user, 'google_reviews.manage'))) return;

        const { review_id, title, description, priority, due_date } = req.body || {};
        if (!review_id) return errorResponse(res, 'Missing required field: review_id', 400);
        if (!title) return errorResponse(res, 'Missing required field: title', 400);

        const supabase = getSupabaseServiceClient();

        const { data: review, error: reviewError } = await supabase
            .from('google_reviews')
            .select('*')
            .eq('tenant_id', user.tenant_id)
            .eq('id', review_id)
            .single();

        if (reviewError) throw reviewError;

        const taskPayload: any = {
            tenant_id: user.tenant_id,
            customer_email: review.linked_customer_email || null,
            customer_phone: review.linked_customer_phone || null,
            customer_name: review.linked_customer_name || review.author_name || 'Cliente',
            title,
            description: description || review.comment || null,
            task_type: 'google_review_follow_up',
            priority: priority || (review.is_critical ? 'high' : 'medium'),
            status: 'pending',
            due_date: due_date ? new Date(due_date).toISOString() : null,
            assigned_to: user.email || null,
            created_at: new Date().toISOString(),
        };

        const { data: task, error: taskError } = await supabase
            .from('crm_tasks')
            .insert(taskPayload)
            .select()
            .single();

        if (taskError) throw taskError;

        await supabase.from('google_review_actions').insert({
            tenant_id: user.tenant_id,
            review_id,
            action_type: 'created_task',
            payload: { task_id: task.id },
            created_by: user.email || null,
        });

        return successResponse(res, { task });
    } catch (error: any) {
        console.error('createTaskFromReview error:', error);
        return errorFromException(res, error, error.message || 'Failed to create task', 500);
    }
}

async function getAlertSettings(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);
        if (!user.tenant_id) return errorResponse(res, 'User not associated with a tenant', 403);
        if (!(await requirePermission(res, user, 'google_reviews.view'))) return;

        const supabase = getSupabaseServiceClient();
        const { data, error } = await supabase
            .from('google_review_alert_settings')
            .select('*')
            .eq('tenant_id', user.tenant_id)
            .maybeSingle();

        if (error) throw error;

        return successResponse(res, {
            settings: data || {
                tenant_id: user.tenant_id,
                enabled: true,
                rating_max: 3,
                notify_email: user.email || null,
                cooldown_minutes: 60,
            },
        });
    } catch (error: any) {
        console.error('getAlertSettings error:', error);
        return errorFromException(res, error, error.message || 'Failed to load alert settings', 500);
    }
}

async function setAlertSettings(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);

        const user = await authenticateUser(req);
        if (!user.tenant_id) return errorResponse(res, 'User not associated with a tenant', 403);
        if (!(await requirePermission(res, user, 'google_reviews.manage'))) return;

        const { enabled, rating_max, notify_email, cooldown_minutes } = req.body || {};

        const cleaned: any = { tenant_id: user.tenant_id, updated_at: new Date().toISOString() };
        if (typeof enabled === 'boolean') cleaned.enabled = enabled;
        if (rating_max !== undefined && rating_max !== null) cleaned.rating_max = Number(rating_max);
        if (notify_email !== undefined) cleaned.notify_email = notify_email ? String(notify_email).trim() : null;
        if (cooldown_minutes !== undefined && cooldown_minutes !== null) cleaned.cooldown_minutes = Number(cooldown_minutes);

        if ('rating_max' in cleaned) {
            if (!Number.isFinite(cleaned.rating_max) || cleaned.rating_max < 1 || cleaned.rating_max > 5) {
                return errorResponse(res, 'Invalid rating_max', 400);
            }
        }
        if ('cooldown_minutes' in cleaned) {
            if (!Number.isFinite(cleaned.cooldown_minutes) || cleaned.cooldown_minutes < 0 || cleaned.cooldown_minutes > 1440) {
                return errorResponse(res, 'Invalid cooldown_minutes', 400);
            }
        }

        const supabase = getSupabaseServiceClient();
        const { data, error } = await supabase
            .from('google_review_alert_settings')
            .upsert(cleaned, { onConflict: 'tenant_id' })
            .select()
            .single();

        if (error) throw error;
        return successResponse(res, { settings: data });
    } catch (error: any) {
        console.error('setAlertSettings error:', error);
        return errorFromException(res, error, error.message || 'Failed to save alert settings', 500);
    }
}

async function listReviewActions(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);
        if (!user.tenant_id) return errorResponse(res, 'User not associated with a tenant', 403);
        if (!(await requirePermission(res, user, 'google_reviews.view'))) return;

        const review_id = (req.query.review_id as string) || null;
        const limit = Math.min(Number(req.query.limit || 200), 500);
        if (!review_id) return errorResponse(res, 'Missing review_id', 400);

        const supabase = getSupabaseServiceClient();

        const { data, error } = await supabase
            .from('google_review_actions')
            .select('*')
            .eq('tenant_id', user.tenant_id)
            .eq('review_id', review_id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return successResponse(res, { actions: data || [] });
    } catch (error: any) {
        console.error('listReviewActions error:', error);
        return errorFromException(res, error, error.message || 'Failed to list review actions', 500);
    }
}

async function listReviewActionsByCustomer(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);
        if (!user.tenant_id) return errorResponse(res, 'User not associated with a tenant', 403);
        if (!(await requirePermission(res, user, 'google_reviews.view'))) return;

        const email = (req.query.email as string) || null;
        const phone = (req.query.phone as string) || null;
        const limit = Math.min(Number(req.query.limit || 500), 1000);

        if (!email && !phone) return errorResponse(res, 'Missing email or phone', 400);

        const supabase = getSupabaseServiceClient();

        let reviewsQuery = supabase
            .from('google_reviews')
            .select('id')
            .eq('tenant_id', user.tenant_id)
            .order('review_published_at', { ascending: false })
            .limit(500);

        if (email && phone) {
            reviewsQuery = reviewsQuery.or(`linked_customer_email.eq.${email},linked_customer_phone.eq.${phone}`);
        } else if (email) {
            reviewsQuery = reviewsQuery.eq('linked_customer_email', email);
        } else {
            reviewsQuery = reviewsQuery.eq('linked_customer_phone', phone);
        }

        const { data: reviews, error: reviewsError } = await reviewsQuery;
        if (reviewsError) throw reviewsError;

        const reviewIds = (reviews || []).map((r: any) => r.id).filter(Boolean);
        if (reviewIds.length === 0) return successResponse(res, { actions: [] });

        const { data: actions, error: actionsError } = await supabase
            .from('google_review_actions')
            .select('*')
            .eq('tenant_id', user.tenant_id)
            .in('review_id', reviewIds)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (actionsError) throw actionsError;
        return successResponse(res, { actions: actions || [] });
    } catch (error: any) {
        console.error('listReviewActionsByCustomer error:', error);
        return errorFromException(res, error, error.message || 'Failed to list customer review actions', 500);
    }
}

async function addReviewAction(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);

        const user = await authenticateUser(req);
        if (!user.tenant_id) return errorResponse(res, 'User not associated with a tenant', 403);
        if (!(await requirePermission(res, user, 'google_reviews.manage'))) return;

        const { review_id, action_type, payload } = req.body || {};
        if (!review_id) return errorResponse(res, 'Missing required field: review_id', 400);
        if (!action_type) return errorResponse(res, 'Missing required field: action_type', 400);

        const normalizedType = String(action_type).trim();
        const allowed = new Set([
            'phone_call',
            'whatsapp_action',
            'voucher',
            'internal_note',
            'google_reply',
            'status_change',
            'linked_customer',
            'created_task',
            'ingested_critical',
        ]);
        if (!allowed.has(normalizedType)) return errorResponse(res, 'Invalid action_type', 400);

        const supabase = getSupabaseServiceClient();
        const { data, error } = await supabase
            .from('google_review_actions')
            .insert({
                tenant_id: user.tenant_id,
                review_id,
                action_type: normalizedType,
                payload: payload && typeof payload === 'object' ? payload : null,
                created_by: user.email || null,
            })
            .select()
            .single();

        if (error) throw error;
        return successResponse(res, { action: data });
    } catch (error: any) {
        console.error('addReviewAction error:', error);
        return errorFromException(res, error, error.message || 'Failed to add review action', 500);
    }
}

async function ingestNow(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);

        const user = await authenticateUser(req);
        if (!user.tenant_id) return errorResponse(res, 'User not associated with a tenant', 403);
        if (!(await requirePermission(res, user, 'google_reviews.manage'))) return;

        const supabase = getSupabaseServiceClient();
        const result = await ingestTenantReviews(supabase, user.tenant_id);
        return successResponse(res, result);
    } catch (error: any) {
        console.error('ingestNow error:', error);
        return errorFromException(res, error, error.message || 'Failed to ingest now', 500);
    }
}

async function ingestPublic(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST' && req.method !== 'GET') return errorResponse(res, 'Method not allowed', 405);

        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret) {
            const received = String(req.headers['x-cron-secret'] || req.query.cron_secret || '');
            if (!received || received !== cronSecret) return errorResponse(res, 'Forbidden', 403);
        }

        const supabase = getSupabaseServiceClient();
        const tenantFromReq = (req.method === 'POST' ? (req.body?.tenant_id as string) : null) || (req.query.tenant_id as string) || null;

        let tenantIds: string[] = [];
        if (tenantFromReq) {
            tenantIds = [tenantFromReq];
        } else {
            const { data: tenants, error: tenantsError } = await supabase
                .from('google_places')
                .select('tenant_id')
                .eq('is_active', true);
            if (tenantsError) throw tenantsError;
            tenantIds = Array.from(new Set((tenants || []).map((t: any) => t.tenant_id).filter(Boolean)));
        }

        if (tenantIds.length === 0) return successResponse(res, { message: 'No tenants with active places', ingested: 0, critical_new: 0 });

        let ingestedTotal = 0;
        let criticalNewTotal = 0;
        const results: any[] = [];
        for (const tenant_id of tenantIds) {
            const r = await ingestTenantReviews(supabase, tenant_id);
            ingestedTotal += r.ingested;
            criticalNewTotal += r.critical_new;
            results.push(r);
        }

        return successResponse(res, { ingested: ingestedTotal, critical_new: criticalNewTotal, tenants: results });
    } catch (error: any) {
        console.error('ingestPublic error:', error);
        return errorFromException(res, error, error.message || 'Failed to ingest', 500);
    }
}

async function ingestTenantReviews(supabase: any, tenant_id: string) {
    const runStartedAt = new Date();

    const { data: places, error: placesError } = await supabase
        .from('google_places')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('is_active', true);

    if (placesError) throw placesError;

    const placeIds = (places || []).map((p: any) => p.place_id).filter(Boolean);
    if (placeIds.length === 0) return { tenant_id, ingested: 0, critical_new: 0, places: 0 };

    let ingestedCount = 0;
    for (const placeId of placeIds) {
        const scraped = await scrapeGoogleReviewsPublic(placeId, { limit: 100 });
        if (!scraped?.reviews?.length) continue;

        const nowIso = new Date().toISOString();
        const rows = scraped.reviews.map((r: any) => ({
            tenant_id,
            place_id: placeId,
            external_review_id: r.external_review_id,
            author_name: r.author_name,
            rating: r.rating,
            comment: r.comment,
            review_published_at: r.review_published_at,
            source: 'scraping',
            last_seen_at: nowIso,
            is_critical: isCriticalRating(r.rating),
            raw_payload: r.raw_payload || null,
        }));

        const { data: upserted, error: upsertError } = await supabase
            .from('google_reviews')
            .upsert(rows, { onConflict: 'tenant_id,place_id,external_review_id' })
            .select('id, tenant_id, place_id, external_review_id, author_name, rating, comment, review_published_at, is_critical, ingested_at');

        if (upsertError) throw upsertError;

        ingestedCount += upserted?.length || 0;

        if (upserted && upserted.length > 0) {
            const versions = upserted.map((rev: any) => ({
                tenant_id,
                review_id: rev.id,
                content_hash: computeReviewContentHash({
                    place_id: rev.place_id,
                    external_review_id: rev.external_review_id,
                    author_name: rev.author_name,
                    rating: rev.rating,
                    comment: rev.comment,
                    review_published_at: rev.review_published_at,
                }),
                snapshot: rev,
            }));
            await supabase.from('google_review_versions').upsert(versions, { onConflict: 'review_id,content_hash', ignoreDuplicates: true });
        }
    }

    const { data: newCritical, error: criticalError } = await supabase
        .from('google_reviews')
        .select('id, place_id, external_review_id, author_name, rating, comment, review_published_at')
        .eq('tenant_id', tenant_id)
        .eq('is_critical', true)
        .gte('ingested_at', runStartedAt.toISOString())
        .order('ingested_at', { ascending: false });

    if (criticalError) throw criticalError;

    const criticalNew = newCritical || [];
    if (criticalNew.length > 0) {
        const actions = criticalNew.map((r: any) => ({
            tenant_id,
            review_id: r.id,
            action_type: 'ingested_critical',
            payload: { place_id: r.place_id, external_review_id: r.external_review_id },
            created_by: null,
        }));
        await supabase.from('google_review_actions').insert(actions);
    }

    await triggerNewLowRatingAlerts(supabase, tenant_id, runStartedAt);

    return { tenant_id, ingested: ingestedCount, critical_new: criticalNew.length, places: placeIds.length };
}

async function triggerNewLowRatingAlerts(supabase: any, tenant_id: string, runStartedAt: Date) {
    const { data: settings, error: settingsError } = await supabase
        .from('google_review_alert_settings')
        .select('*')
        .eq('tenant_id', tenant_id)
        .maybeSingle();
    if (settingsError) throw settingsError;

    const resolvedSettings = settings || { enabled: true, rating_max: 3, notify_email: null, cooldown_minutes: 60 };
    if (resolvedSettings.enabled === false) return;

    const ratingMax = Number(resolvedSettings.rating_max || 3);

    const { data: newLowRating, error: lowRatingError } = await supabase
        .from('google_reviews')
        .select('id, place_id, author_name, rating, comment, review_published_at')
        .eq('tenant_id', tenant_id)
        .gte('ingested_at', runStartedAt.toISOString())
        .lte('rating', ratingMax)
        .order('ingested_at', { ascending: false });
    if (lowRatingError) throw lowRatingError;

    const reviews = newLowRating || [];
    if (reviews.length === 0) return;

    const recipient = String(resolvedSettings.notify_email || '')
        .split(/[;,]+/)
        .map((s: string) => s.trim())
        .filter(Boolean)[0] || null;
    if (!recipient) return;

    const rows = reviews.map((r: any) => ({
        tenant_id,
        alert_type: 'new_low_rating_review',
        review_id: r.id,
        payload: { rating: r.rating, place_id: r.place_id, author_name: r.author_name },
        send_status: 'pending',
    }));

    await supabase
        .from('google_review_alert_log')
        .upsert(rows, { onConflict: 'tenant_id,alert_type,review_id', ignoreDuplicates: true });

    const reviewIds = reviews.map((r: any) => r.id);
    const { data: pending, error: pendingError } = await supabase
        .from('google_review_alert_log')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('alert_type', 'new_low_rating_review')
        .eq('send_status', 'pending')
        .in('review_id', reviewIds)
        .order('created_at', { ascending: false })
        .limit(500);
    if (pendingError) throw pendingError;

    const pendingRows = (pending as any[]) || [];
    const pendingByReviewId = new Map(pendingRows.map((p: any) => [p.review_id, p]));
    for (const r of reviews as any[]) {
        const log: any = pendingByReviewId.get(r.id);
        if (!log) continue;
        try {
            const subject = `Nova avaliação ${r.rating}★ no Google (≤ ${ratingMax}★)`;
            const when = r.review_published_at ? new Date(r.review_published_at).toLocaleString('pt-BR') : '';
            const text = [
                `Nova avaliação no Google`,
                `Nota: ${r.rating}★`,
                r.author_name ? `Autor: ${r.author_name}` : null,
                r.place_id ? `Unidade: ${r.place_id}` : null,
                when ? `Data: ${when}` : null,
                r.comment ? `Comentário: ${r.comment}` : `Comentário: (sem comentário)`,
                ``,
                `Abra o painel interno para tratar: Alertas • Avaliações do Google`,
            ].filter(Boolean).join('\n');

            const sendResult = await sendEmail({ to: recipient, subject, text });
            const status = sendResult.status === 'sent' ? 'sent' : 'skipped';
            await supabase
                .from('google_review_alert_log')
                .update({ send_status: status, sent_at: new Date().toISOString(), send_error: null })
                .eq('id', (log as any).id);
        } catch (err: any) {
            await supabase
                .from('google_review_alert_log')
                .update({ send_status: 'error', send_error: err?.message || 'Send failed' })
                .eq('id', (log as any).id);
        }
    }
}

async function ingestManual(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);

        const user = await authenticateUser(req);
        if (!user.tenant_id) return errorResponse(res, 'User not associated with a tenant', 403);
        if (!(await requirePermission(res, user, 'google_reviews.manage'))) return;

        const { place_id, reviews } = req.body || {};
        if (!place_id) return errorResponse(res, 'Missing required field: place_id', 400);
        if (!Array.isArray(reviews) || reviews.length === 0) return errorResponse(res, 'Missing required field: reviews[]', 400);

        const supabase = getSupabaseServiceClient();
        const nowIso = new Date().toISOString();

        const rows = reviews
            .map((r: any) => ({
                tenant_id: user.tenant_id,
                place_id,
                external_review_id: String(r.external_review_id || r.id || '').trim(),
                author_name: r.author_name || null,
                rating: Number(r.rating),
                comment: r.comment || null,
                review_published_at: r.review_published_at ? new Date(r.review_published_at).toISOString() : null,
                source: 'scraping',
                last_seen_at: nowIso,
                is_critical: isCriticalRating(Number(r.rating)),
                raw_payload: r.raw_payload || r,
            }))
            .filter((r: any) => r.external_review_id && Number.isFinite(r.rating));

        if (rows.length === 0) return errorResponse(res, 'No valid reviews', 400);

        const { data: upserted, error: upsertError } = await supabase
            .from('google_reviews')
            .upsert(rows, { onConflict: 'tenant_id,place_id,external_review_id' })
            .select('id, tenant_id, place_id, external_review_id, author_name, rating, comment, review_published_at, is_critical');

        if (upsertError) throw upsertError;

        const versions = (upserted || []).map((rev: any) => ({
            tenant_id: user.tenant_id,
            review_id: rev.id,
            content_hash: computeReviewContentHash({
                place_id: rev.place_id,
                external_review_id: rev.external_review_id,
                author_name: rev.author_name,
                rating: rev.rating,
                comment: rev.comment,
                review_published_at: rev.review_published_at,
            }),
            snapshot: rev,
        }));
        await supabase.from('google_review_versions').upsert(versions, { onConflict: 'review_id,content_hash', ignoreDuplicates: true });

        return successResponse(res, { ingested: upserted?.length || 0 });
    } catch (error: any) {
        console.error('ingestManual error:', error);
        return errorFromException(res, error, error.message || 'Failed to ingest manual', 500);
    }
}
