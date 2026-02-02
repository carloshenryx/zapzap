import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../lib/auth.js';
import { getSupabaseServiceClient } from '../lib/supabase.js';
import { successResponse, errorResponse, errorFromException } from '../lib/response.js';
import { requirePermission } from '../lib/authorize.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = req.query.action as string;

    switch (action) {
        case 'validate-limits':
            return await validateLimits(req, res);
        case 'check-feature':
        case 'list':
            return successResponse(res, { message: 'Plans API - Not fully implemented yet' });
        default:
            return errorResponse(res, 'Invalid action', 400);
    }
}

async function validateLimits(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);

        if (!user.tenant_id) {
            return errorResponse(res, 'User not associated with a tenant', 403);
        }
        if (!(await requirePermission(res, user, 'consumption.view'))) return;

        const { resource_type } = req.body || {};

        if (!resource_type) {
            return errorResponse(res, 'Missing required field: resource_type', 400);
        }

        const supabase = getSupabaseServiceClient();

        // Get tenant's subscription/plan
        const { data: subscription } = await supabase
            .from('subscriptions')
            .select('*, plans(*)')
            .eq('tenant_id', user.tenant_id)
            .eq('status', 'active')
            .single();

        // If no active subscription, use free tier limits
        const planLimits = subscription?.plans || {
            max_surveys_month: 50,
            max_messages_month: 100,
            max_team_members: 1
        };

        // Get current month consumption
        const period = new Date().toISOString().slice(0, 7); // YYYY-MM
        const { data: consumption } = await supabase
            .from('consumption')
            .select('*')
            .eq('tenant_id', user.tenant_id)
            .eq('period', period)
            .single();

        // Check limits based on resource type
        let can_create = true;
        let current_usage = 0;
        let limit = 0;

        switch (resource_type) {
            case 'surveys':
            case 'messages':
                current_usage = consumption?.messages_sent || 0;
                limit = planLimits.max_messages_month || 100;
                can_create = current_usage < limit;
                break;
            case 'survey_templates':
                current_usage = consumption?.surveys_created || 0;
                limit = planLimits.max_surveys_month || 50;
                can_create = current_usage < limit;
                break;
            default:
                can_create = true; // Allow by default for unknown types
        }

        return successResponse(res, {
            can_create,
            current_usage,
            limit,
            remaining: Math.max(0, limit - current_usage),
            plan_name: subscription?.plans?.name || 'Free',
            reset_date: `${period}-01` // First day of next month
        });

    } catch (error: any) {
        console.error('Validate limits error:', error);
        if (error?.statusCode) {
            return errorFromException(res, error, error.message || 'Failed to validate limits', Number(error.statusCode) || 500);
        }

        // If error, allow operation (fail-open for better UX)
        return successResponse(res, {
            can_create: true,
            current_usage: 0,
            limit: 999999,
            remaining: 999999,
            plan_name: 'Unknown',
            note: 'Limits check failed, allowing operation'
        });
    }
}
