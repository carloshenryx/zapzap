import type { VercelRequest, VercelResponse } from '@vercel/node';
import analyticsHandler from '../handlers/analytics.js';
import adminHandler from '../handlers/admin.js';
import authHandler from '../handlers/auth.js';
import clientsHandler from '../handlers/clients.js';
import consumptionHandler from '../handlers/consumption.js';
import crmHandler from '../handlers/crm.js';
import googleReviewsHandler from '../handlers/google-reviews.js';
import healthHandler from '../handlers/health.js';
import notificationsHandler from '../handlers/notifications.js';
import paymentsHandler from '../handlers/payments.js';
import plansHandler from '../handlers/plans.js';
import subscriptionsHandler from '../handlers/subscriptions.js';
import surveysHandler from '../handlers/surveys.js';
import tenantsHandler from '../handlers/tenants.js';
import vouchersHandler from '../handlers/vouchers.js';
import webhooksHandler from '../handlers/webhooks.js';
import whatsappHandler from '../handlers/whatsapp.js';

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

    const pathParam = (req.query.path ?? []) as string[] | string;
    const parts = Array.isArray(pathParam)
        ? pathParam
        : pathParam
            ? pathParam.split('/').filter(Boolean)
            : [];
    const resource = parts[0] || '';

    switch (resource) {
        case 'admin':
            return adminHandler(req, res);
        case 'analytics':
            return analyticsHandler(req, res);
        case 'auth':
            return authHandler(req, res);
        case 'clients':
            return clientsHandler(req, res);
        case 'consumption':
            return consumptionHandler(req, res);
        case 'crm':
            return crmHandler(req, res);
        case 'google-reviews':
            return googleReviewsHandler(req, res);
        case 'health':
            return healthHandler(req, res);
        case 'notifications':
            return notificationsHandler(req, res);
        case 'payments':
            return paymentsHandler(req, res);
        case 'plans':
            return plansHandler(req, res);
        case 'subscriptions':
            return subscriptionsHandler(req, res);
        case 'surveys':
            return surveysHandler(req, res);
        case 'tenants':
            return tenantsHandler(req, res);
        case 'vouchers':
            return vouchersHandler(req, res);
        case 'webhooks':
            return webhooksHandler(req, res);
        case 'whatsapp':
            return whatsappHandler(req, res);
        default:
            res.status(404).json({ success: false, error: 'Not found' });
            return;
    }
}
