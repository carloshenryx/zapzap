import type { VercelRequest, VercelResponse } from '@vercel/node';
import analyticsHandler from '../handlers/analytics.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const originHeader = req.headers.origin;
    const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;

    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Webhook-Key');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    return analyticsHandler(req, res);
}

