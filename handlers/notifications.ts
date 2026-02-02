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

function normalizeType(raw: any) {
    const t = String(raw || '').trim().toLowerCase();
    if (!t) return null;
    if (t === 'informativa' || t === 'informativo' || t === 'info' || t === 'informative') return 'informative';
    if (t === 'critica' || t === 'crítica' || t === 'critical') return 'critical';
    if (t === 'manutencao' || t === 'manutenção' || t === 'maintenance') return 'maintenance';
    if (t === 'youtube' || t === 'video' || t === 'vídeo') return 'youtube';
    return null;
}

function parseOptionalDate(raw: any) {
    if (raw === null || raw === undefined || raw === '') return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
}

function isMissingColumnError(err: any, column?: string) {
    const msg = String(err?.message || err?.error_description || '');
    const combined = `${String(err?.code || '')} ${msg}`.toLowerCase();
    if (combined.includes('schema cache') || combined.includes('does not exist')) {
        if (!column) return true;
        const col = String(column).toLowerCase();
        return combined.includes(`'${col}'`) || combined.includes(`.${col}`) || combined.includes(` ${col} `);
    }
    return false;
}

function normalizeNotificationRow(row: any) {
    return {
        ...row,
        active: row?.active === undefined ? true : !!row.active,
        priority: Number.isFinite(Number(row?.priority)) ? Number(row.priority) : 0,
    };
}

async function sleep(ms: number) {
    await new Promise((r) => setTimeout(r, ms));
}

const activeCache = new Map<string, { expiresAt: number; payload: any }>();
function getActiveCacheKey() {
    const bucketMs = 60_000;
    const bucket = Math.floor(Date.now() / bucketMs);
    return `active:${bucket}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = req.query.action as string;

    switch (action) {
        case 'list':
            return await listNotifications(req, res);
        case 'create':
            return await createNotification(req, res);
        case 'update':
            return await updateNotification(req, res);
        case 'delete':
            return await deleteNotification(req, res);
        case 'active':
            return await getActiveContent(req, res);
        case 'preferences:get':
            return await getPreferences(req, res);
        case 'preferences:record-view':
            return await recordView(req, res);
        case 'preferences:dismiss-today':
            return await dismissToday(req, res);
        case 'crm':
        case 'low-rating':
        case 'voucher-limit':
            return successResponse(res, { message: 'Notifications API - Legacy stub (unused)' });
        default:
            return errorResponse(res, 'Invalid action', 400);
    }
}

async function listNotifications(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'GET') return errorResponse(res, 'Method not allowed', 405);
        const user = await authenticateUser(req);
        if (!user.is_super_admin) return errorResponse(res, 'Forbidden: Super admin access required', 403);

        const supabase = hasSupabaseServiceRoleKey()
            ? getSupabaseServiceClient()
            : getSupabaseAuthedClient(user.access_token);

        let result = await supabase
            .from('system_notifications')
            .select('*')
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false });

        if (result.error && isMissingColumnError(result.error, 'priority')) {
            result = await supabase
                .from('system_notifications')
                .select('*')
                .order('created_at', { ascending: false });
        }
        if (result.error && isMissingColumnError(result.error, 'created_at')) {
            result = await supabase
                .from('system_notifications')
                .select('*');
        }

        if (result.error && isMissingColumnError(result.error)) {
            await sleep(300);
            result = await supabase.from('system_notifications').select('*');
        }

        if (result.error) {
            console.error('notifications list error:', result.error);
            return errorResponse(res, result.error.message || 'Failed to list notifications', 500);
        }

        const normalized = (result.data || []).map(normalizeNotificationRow);
        return successResponse(res, { notifications: normalized });
    } catch (error: any) {
        console.error('notifications list error:', error);
        const status = String(error.message || '').toLowerCase().includes('unauthorized') ? 401 : 500;
        return errorResponse(res, error.message || 'Failed to list notifications', status);
    }
}

async function createNotification(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);
        const user = await authenticateUser(req);
        if (!user.is_super_admin) return errorResponse(res, 'Forbidden: Super admin access required', 403);

        const body = parseBody(req);
        const title = String(body.title || '').trim();
        const description = body.description === null || body.description === undefined ? null : String(body.description).trim();
        const youtube_url = body.youtube_url ? String(body.youtube_url).trim() : null;
        const type = youtube_url ? 'youtube' : normalizeType(body.type);
        const active = body.active === undefined ? true : !!body.active;
        const start_date = parseOptionalDate(body.start_date);
        const end_date = parseOptionalDate(body.end_date);
        const priority = Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0;

        if (!title) return errorResponse(res, 'Missing required field: title', 400);
        if (!type) return errorResponse(res, 'Invalid field: type', 400);

        const supabase = hasSupabaseServiceRoleKey()
            ? getSupabaseServiceClient()
            : getSupabaseAuthedClient(user.access_token);

        const payloadFull: any = {
            type,
            title,
            description,
            youtube_url,
            active,
            start_date,
            end_date,
            priority,
            updated_at: new Date().toISOString(),
        };

        let result = await supabase.from('system_notifications').insert(payloadFull).select().single();
        if (result.error && isMissingColumnError(result.error)) {
            const payloadLess: any = { type, title, description, youtube_url };
            result = await supabase.from('system_notifications').insert(payloadLess).select().single();
        }
        if (result.error && isMissingColumnError(result.error)) {
            const payloadMin: any = { type, title };
            result = await supabase.from('system_notifications').insert(payloadMin).select().single();
        }

        if (result.error) {
            console.error('notifications create error:', result.error);
            return errorResponse(res, result.error.message || 'Failed to create notification', 500);
        }

        return successResponse(res, { notification: normalizeNotificationRow(result.data) });
    } catch (error: any) {
        console.error('notifications create error:', error);
        const status = String(error.message || '').toLowerCase().includes('unauthorized') ? 401 : 500;
        return errorResponse(res, error.message || 'Failed to create notification', status);
    }
}

async function updateNotification(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST' && req.method !== 'PUT') return errorResponse(res, 'Method not allowed', 405);
        const user = await authenticateUser(req);
        if (!user.is_super_admin) return errorResponse(res, 'Forbidden: Super admin access required', 403);

        const body = parseBody(req);
        const id = String(body.id || '').trim();
        if (!id) return errorResponse(res, 'Missing required field: id', 400);

        const patch: any = {};
        if (body.title !== undefined) patch.title = String(body.title || '').trim();
        if (body.description !== undefined) patch.description = body.description === null ? null : String(body.description || '').trim();
        if (body.youtube_url !== undefined) patch.youtube_url = body.youtube_url ? String(body.youtube_url).trim() : null;
        if (body.active !== undefined) patch.active = !!body.active;
        if (body.start_date !== undefined) patch.start_date = parseOptionalDate(body.start_date);
        if (body.end_date !== undefined) patch.end_date = parseOptionalDate(body.end_date);
        if (body.priority !== undefined) patch.priority = Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0;
        if (body.type !== undefined) {
            const nextType = patch.youtube_url ? 'youtube' : normalizeType(body.type);
            if (!nextType) return errorResponse(res, 'Invalid field: type', 400);
            patch.type = nextType;
        }
        if (patch.youtube_url && !patch.type) patch.type = 'youtube';
        patch.updated_at = new Date().toISOString();

        if (patch.title !== undefined && !patch.title) {
            return errorResponse(res, 'Invalid field: title', 400);
        }

        const supabase = hasSupabaseServiceRoleKey()
            ? getSupabaseServiceClient()
            : getSupabaseAuthedClient(user.access_token);

        let result = await supabase
            .from('system_notifications')
            .update(patch)
            .eq('id', id)
            .select()
            .single();

        if (result.error && isMissingColumnError(result.error)) {
            const fallbackPatch: any = { ...patch };
            delete fallbackPatch.active;
            delete fallbackPatch.priority;
            delete fallbackPatch.start_date;
            delete fallbackPatch.end_date;
            delete fallbackPatch.updated_at;
            result = await supabase
                .from('system_notifications')
                .update(fallbackPatch)
                .eq('id', id)
                .select()
                .single();
        }

        if (result.error) {
            console.error('notifications update error:', result.error);
            return errorResponse(res, result.error.message || 'Failed to update notification', 500);
        }

        return successResponse(res, { notification: normalizeNotificationRow(result.data) });
    } catch (error: any) {
        console.error('notifications update error:', error);
        const status = String(error.message || '').toLowerCase().includes('unauthorized') ? 401 : 500;
        return errorResponse(res, error.message || 'Failed to update notification', status);
    }
}

async function deleteNotification(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST' && req.method !== 'DELETE') return errorResponse(res, 'Method not allowed', 405);
        const user = await authenticateUser(req);
        if (!user.is_super_admin) return errorResponse(res, 'Forbidden: Super admin access required', 403);

        const body = parseBody(req);
        const id = String(body.id || '').trim();
        if (!id) return errorResponse(res, 'Missing required field: id', 400);

        const supabase = hasSupabaseServiceRoleKey()
            ? getSupabaseServiceClient()
            : getSupabaseAuthedClient(user.access_token);

        const { error } = await supabase.from('system_notifications').delete().eq('id', id);
        if (error) {
            console.error('notifications delete error:', error);
            return errorResponse(res, error.message || 'Failed to delete notification', 500);
        }

        return successResponse(res, { id });
    } catch (error: any) {
        console.error('notifications delete error:', error);
        const status = String(error.message || '').toLowerCase().includes('unauthorized') ? 401 : 500;
        return errorResponse(res, error.message || 'Failed to delete notification', status);
    }
}

async function getActiveContent(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'GET') return errorResponse(res, 'Method not allowed', 405);
        const user = await authenticateUser(req);

        res.setHeader('Cache-Control', 'private, max-age=0, s-maxage=60, stale-while-revalidate=30');

        const key = getActiveCacheKey();
        const cached = activeCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            return successResponse(res, cached.payload);
        }

        const supabase = hasSupabaseServiceRoleKey()
            ? getSupabaseServiceClient()
            : getSupabaseAuthedClient(user.access_token);

        let result = await supabase
            .from('system_notifications')
            .select('*')
            .eq('active', true)
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false });

        if (result.error && isMissingColumnError(result.error, 'active')) {
            result = await supabase
                .from('system_notifications')
                .select('*')
                .order('priority', { ascending: false })
                .order('created_at', { ascending: false });
        }
        if (result.error && isMissingColumnError(result.error, 'priority')) {
            result = await supabase
                .from('system_notifications')
                .select('*')
                .order('created_at', { ascending: false });
        }
        if (result.error && isMissingColumnError(result.error, 'created_at')) {
            result = await supabase
                .from('system_notifications')
                .select('*');
        }
        if (result.error && isMissingColumnError(result.error)) {
            await sleep(300);
            result = await supabase.from('system_notifications').select('*');
        }

        if (result.error) {
            console.error('notifications active error:', result.error);
            return errorResponse(res, result.error.message || 'Failed to load active content', 500);
        }

        const { data: prefs, error: prefsError } = await supabase
            .from('user_system_notification_preferences')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        if (prefsError) {
            console.error('notifications prefs error:', prefsError);
        }

        const nowMs = Date.now();
        const normalizedItems = (result.data || []).map(normalizeNotificationRow);
        const activeNow = normalizedItems.filter((n: any) => {
            const activeFlagOk = n.active === undefined ? true : !!n.active;
            const startOk = !n.start_date || new Date(n.start_date).getTime() <= nowMs;
            const endOk = !n.end_date || new Date(n.end_date).getTime() >= nowMs;
            return activeFlagOk && startOk && endOk;
        });

        const videos = activeNow.filter((n: any) => !!n.youtube_url);
        const notices = activeNow.filter((n: any) => !n.youtube_url);

        const payload = { videos, notices, preferences: prefs || null };
        activeCache.set(key, { expiresAt: Date.now() + 60_000, payload });
        return successResponse(res, payload);
    } catch (error: any) {
        console.error('notifications active error:', error);
        const status = String(error.message || '').toLowerCase().includes('unauthorized') ? 401 : 500;
        return errorResponse(res, error.message || 'Failed to load active content', status);
    }
}

async function getPreferences(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'GET') return errorResponse(res, 'Method not allowed', 405);
        const user = await authenticateUser(req);

        const supabase = hasSupabaseServiceRoleKey()
            ? getSupabaseServiceClient()
            : getSupabaseAuthedClient(user.access_token);

        const { data, error } = await supabase
            .from('user_system_notification_preferences')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) {
            console.error('notifications preferences:get error:', error);
            return errorResponse(res, error.message || 'Failed to load preferences', 500);
        }

        return successResponse(res, { preferences: data || null });
    } catch (error: any) {
        console.error('notifications preferences:get error:', error);
        const status = String(error.message || '').toLowerCase().includes('unauthorized') ? 401 : 500;
        return errorResponse(res, error.message || 'Failed to load preferences', status);
    }
}

async function recordView(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);
        const user = await authenticateUser(req);

        const supabase = hasSupabaseServiceRoleKey()
            ? getSupabaseServiceClient()
            : getSupabaseAuthedClient(user.access_token);

        const now = new Date();
        const todayUtc = now.toISOString().slice(0, 10);

        const { data, error } = await supabase
            .from('user_system_notification_preferences')
            .upsert(
                {
                    user_id: user.id,
                    last_shown_at: now.toISOString(),
                    last_seen_date: todayUtc,
                    updated_at: now.toISOString(),
                },
                { onConflict: 'user_id' }
            )
            .select()
            .single();

        if (error) {
            console.error('notifications preferences:record-view error:', error);
            return errorResponse(res, error.message || 'Failed to record view', 500);
        }

        return successResponse(res, { preferences: data });
    } catch (error: any) {
        console.error('notifications preferences:record-view error:', error);
        const status = String(error.message || '').toLowerCase().includes('unauthorized') ? 401 : 500;
        return errorResponse(res, error.message || 'Failed to record view', status);
    }
}

async function dismissToday(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);
        const user = await authenticateUser(req);

        const supabase = hasSupabaseServiceRoleKey()
            ? getSupabaseServiceClient()
            : getSupabaseAuthedClient(user.access_token);

        const now = new Date();
        const todayUtc = now.toISOString().slice(0, 10);

        const { data, error } = await supabase
            .from('user_system_notification_preferences')
            .upsert(
                {
                    user_id: user.id,
                    dismissed_until_date: todayUtc,
                    dismissed_at: now.toISOString(),
                    updated_at: now.toISOString(),
                },
                { onConflict: 'user_id' }
            )
            .select()
            .single();

        if (error) {
            console.error('notifications preferences:dismiss-today error:', error);
            return errorResponse(res, error.message || 'Failed to dismiss today', 500);
        }

        return successResponse(res, { preferences: data });
    } catch (error: any) {
        console.error('notifications preferences:dismiss-today error:', error);
        const status = String(error.message || '').toLowerCase().includes('unauthorized') ? 401 : 500;
        return errorResponse(res, error.message || 'Failed to dismiss today', status);
    }
}
