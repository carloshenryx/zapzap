import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../lib/auth.js';
import { getSupabaseClient } from '../lib/supabase.js';
import { successResponse, errorResponse } from '../lib/response.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = req.query.action as string;

    if (req.method !== 'POST') {
        return errorResponse(res, 'Method not allowed', 405);
    }

    switch (action) {
        case 'increment':
        case 'stats':
            return successResponse(res, { message: 'Consumption API - Not fully implemented yet' });
        default:
            return errorResponse(res, 'Invalid action', 400);
    }
}
