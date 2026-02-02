import type { VercelRequest, VercelResponse } from '@vercel/node';
import { successResponse, errorResponse } from '../lib/response.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return errorResponse(res, 'Method not allowed', 405);
    }

    return successResponse(res, { ok: true, now: new Date().toISOString() });
}

