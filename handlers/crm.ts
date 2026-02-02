import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../lib/auth.js';
import { getSupabaseAuthedClient, getSupabaseServiceClient, hasSupabaseServiceRoleKey } from '../lib/supabase.js';
import { successResponse, errorResponse } from '../lib/response.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = req.query.action as string;

    switch (action) {
        case 'list-customer-tasks':
            return await listCustomerTasks(req, res);
        case 'create-task':
            return await createTask(req, res);
        case 'update-task':
            return await updateTask(req, res);
        default:
            return errorResponse(res, 'Invalid action', 400);
    }
}

function toISOStringOrNull(value: any) {
    if (!value) return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

async function listCustomerTasks(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);
        if (!user.tenant_id) return errorResponse(res, 'User not associated with a tenant', 403);

        const email = (req.query.email as string) || '';
        const phone = (req.query.phone as string) || '';
        const limit = Math.min(Number(req.query.limit || 200), 1000);

        if (!email && !phone) return errorResponse(res, 'Missing email or phone', 400);

        const supabase = hasSupabaseServiceRoleKey()
            ? getSupabaseServiceClient()
            : getSupabaseAuthedClient(user.access_token);

        let query = supabase
            .from('crm_tasks')
            .select('*')
            .eq('tenant_id', user.tenant_id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (email && phone) {
            query = query.or(`customer_email.eq.${email},customer_phone.eq.${phone}`);
        } else if (email) {
            query = query.eq('customer_email', email);
        } else {
            query = query.eq('customer_phone', phone);
        }

        const { data, error } = await query;
        if (error) throw error;

        return successResponse(res, { tasks: data || [] });
    } catch (error: any) {
        console.error('listCustomerTasks error:', error);
        const message = error?.message || 'Failed to list customer tasks';
        const status = typeof message === 'string' && message.startsWith('Unauthorized:') ? 401 : 500;
        return errorResponse(res, message, status);
    }
}

async function createTask(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);

        const user = await authenticateUser(req);
        if (!user.tenant_id) return errorResponse(res, 'User not associated with a tenant', 403);

        const {
            customer_email,
            customer_phone,
            customer_name,
            title,
            description,
            task_type,
            priority,
            status,
            due_date,
        } = req.body || {};

        if (!title) return errorResponse(res, 'Missing required field: title', 400);
        if (!customer_email && !customer_phone) return errorResponse(res, 'Missing customer_email or customer_phone', 400);

        const dueDateIso = toISOStringOrNull(due_date);
        if (due_date && !dueDateIso) return errorResponse(res, 'Invalid due_date', 400);

        const supabase = hasSupabaseServiceRoleKey()
            ? getSupabaseServiceClient()
            : getSupabaseAuthedClient(user.access_token);

        const dataToInsert: any = {
            tenant_id: user.tenant_id,
            customer_email: customer_email || null,
            customer_phone: customer_phone || null,
            customer_name: customer_name || null,
            title,
            description: description || null,
            task_type: task_type || 'follow_up',
            priority: priority || 'medium',
            status: status || 'pending',
            due_date: dueDateIso,
            assigned_to: user.email || null,
            created_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('crm_tasks')
            .insert(dataToInsert)
            .select()
            .single();

        if (error) throw error;

        return successResponse(res, { task: data });
    } catch (error: any) {
        console.error('createTask error:', error);
        const message = error?.message || 'Failed to create task';
        const status = typeof message === 'string' && message.startsWith('Unauthorized:') ? 401 : 500;
        return errorResponse(res, message, status);
    }
}

async function updateTask(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);

        const user = await authenticateUser(req);
        if (!user.tenant_id) return errorResponse(res, 'User not associated with a tenant', 403);

        const { task_id, updates } = req.body || {};
        if (!task_id) return errorResponse(res, 'Missing required field: task_id', 400);
        if (!updates || typeof updates !== 'object') return errorResponse(res, 'Missing required field: updates', 400);

        const allowedKeys = new Set(['title', 'description', 'task_type', 'priority', 'status', 'due_date', 'completed_date']);
        const cleaned: any = {};
        for (const [k, v] of Object.entries(updates)) {
            if (!allowedKeys.has(k)) continue;
            if (k === 'due_date' || k === 'completed_date') {
                const iso = toISOStringOrNull(v);
                if (v && !iso) return errorResponse(res, `Invalid ${k}`, 400);
                cleaned[k] = iso;
            } else {
                cleaned[k] = v;
            }
        }

        if (Object.keys(cleaned).length === 0) return errorResponse(res, 'No valid updates provided', 400);

        const supabase = hasSupabaseServiceRoleKey()
            ? getSupabaseServiceClient()
            : getSupabaseAuthedClient(user.access_token);

        const { data, error } = await supabase
            .from('crm_tasks')
            .update(cleaned)
            .eq('tenant_id', user.tenant_id)
            .eq('id', task_id)
            .select()
            .single();

        if (error) throw error;

        return successResponse(res, { task: data });
    } catch (error: any) {
        console.error('updateTask error:', error);
        const message = error?.message || 'Failed to update task';
        const status = typeof message === 'string' && message.startsWith('Unauthorized:') ? 401 : 500;
        return errorResponse(res, message, status);
    }
}
