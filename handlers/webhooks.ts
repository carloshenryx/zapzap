import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { authenticateUser } from '../lib/auth.js';
import { getSupabaseServiceClient } from '../lib/supabase.js';
import { successResponse, errorResponse } from '../lib/response.js';

type TriggerConfigRow = {
    id: string;
    tenant_id: string;
    name: string | null;
    external_trigger_id: string;
    survey_template_id: string;
    whatsapp_instance_name: string;
    webhook_key: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'DELETE') {
        return errorResponse(res, 'Method not allowed', 405);
    }

    const pathParam = (req.query.path ?? []) as string[] | string;
    const parts = Array.isArray(pathParam)
        ? pathParam
        : pathParam
            ? pathParam.split('/').filter(Boolean)
            : [];
    const subRoute = (parts[1] || '').toString();

    if (subRoute) {
        if (req.method === 'POST' && isTriggerRoute(subRoute)) {
            return await triggerWhatsAppSurvey(req, res);
        }
        if (subRoute === 'whatsapp') {
            return await whatsappReceiver(req, res);
        }
    }

    const action = (req.query.action as string) || '';

    switch (action) {
        case 'list-trigger-configs':
            return await listTriggerConfigs(req, res);
        case 'create-trigger-config':
            return await createTriggerConfig(req, res);
        case 'update-trigger-config':
            return await updateTriggerConfig(req, res);
        case 'delete-trigger-config':
            return await deleteTriggerConfig(req, res);
        case 'trigger-whatsapp-survey':
            return await triggerWhatsAppSurvey(req, res);
        default:
            return errorResponse(res, 'Invalid action', 400);
    }
}

function isTriggerRoute(subRoute: string) {
    const normalized = subRoute.toLowerCase();
    return normalized === 'triggerwhatsappsurvey' || normalized === 'trigger-whatsapp-survey';
}

async function listTriggerConfigs(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);

        if (!user.tenant_id) {
            return errorResponse(res, 'User not associated with a tenant', 403);
        }

        const supabase = getSupabaseServiceClient();
        const { data, error } = await supabase
            .from('whatsapp_trigger_configs')
            .select('*')
            .eq('tenant_id', user.tenant_id)
            .order('created_at', { ascending: false });

        if (error) {
            return errorResponse(res, 'Failed to list webhook configs', 500);
        }

        return successResponse(res, { configs: (data || []) as TriggerConfigRow[] });
    } catch (error: any) {
        return errorResponse(res, error.message || 'Failed to list webhook configs', 500);
    }
}

async function createTriggerConfig(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);

        if (!user.tenant_id) {
            return errorResponse(res, 'User not associated with a tenant', 403);
        }

        const body = parseJsonBody(req);
        const name = (body?.name || '').toString().trim() || null;
        const external_trigger_id = (body?.external_trigger_id || '').toString().trim();
        const survey_template_id = (body?.survey_template_id || '').toString().trim();
        const whatsapp_instance_name = (body?.whatsapp_instance_name || '').toString().trim();

        if (!external_trigger_id || !survey_template_id || !whatsapp_instance_name) {
            return errorResponse(res, 'Missing required fields', 400);
        }

        const webhook_key = generateWebhookKey();

        const supabase = getSupabaseServiceClient();
        const { data, error } = await supabase
            .from('whatsapp_trigger_configs')
            .insert({
                tenant_id: user.tenant_id,
                name,
                external_trigger_id,
                survey_template_id,
                whatsapp_instance_name,
                webhook_key,
                is_active: true,
            })
            .select()
            .single();

        if (error) {
            const isUnique = (error as any)?.code === '23505';
            if (isUnique) {
                return errorResponse(res, 'external_trigger_id já existe para este tenant', 409);
            }
            return errorResponse(res, 'Failed to create webhook config', 500);
        }

        return successResponse(res, { config: data as TriggerConfigRow }, 201);
    } catch (error: any) {
        return errorResponse(res, error.message || 'Failed to create webhook config', 500);
    }
}

async function updateTriggerConfig(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);

        if (!user.tenant_id) {
            return errorResponse(res, 'User not associated with a tenant', 403);
        }

        const body = parseJsonBody(req);
        const id = (body?.id || '').toString().trim();

        if (!id) {
            return errorResponse(res, 'id is required', 400);
        }

        const updateData: any = {};

        if (typeof body?.name === 'string') updateData.name = body.name.trim() || null;
        if (typeof body?.survey_template_id === 'string') updateData.survey_template_id = body.survey_template_id.trim();
        if (typeof body?.whatsapp_instance_name === 'string') updateData.whatsapp_instance_name = body.whatsapp_instance_name.trim();
        if (typeof body?.is_active === 'boolean') updateData.is_active = body.is_active;
        if (body?.regenerate_key === true) updateData.webhook_key = generateWebhookKey();

        updateData.updated_at = new Date().toISOString();

        const supabase = getSupabaseServiceClient();
        const { data, error } = await supabase
            .from('whatsapp_trigger_configs')
            .update(updateData)
            .eq('id', id)
            .eq('tenant_id', user.tenant_id)
            .select()
            .single();

        if (error) {
            return errorResponse(res, 'Failed to update webhook config', 500);
        }

        return successResponse(res, { config: data as TriggerConfigRow });
    } catch (error: any) {
        return errorResponse(res, error.message || 'Failed to update webhook config', 500);
    }
}

async function deleteTriggerConfig(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);

        if (!user.tenant_id) {
            return errorResponse(res, 'User not associated with a tenant', 403);
        }

        const body = parseJsonBody(req);
        const id = (body?.id || '').toString().trim();

        if (!id) {
            return errorResponse(res, 'id is required', 400);
        }

        const supabase = getSupabaseServiceClient();
        const { error } = await supabase
            .from('whatsapp_trigger_configs')
            .delete()
            .eq('id', id)
            .eq('tenant_id', user.tenant_id);

        if (error) {
            return errorResponse(res, 'Failed to delete webhook config', 500);
        }

        return successResponse(res, { message: 'Webhook deleted successfully' });
    } catch (error: any) {
        return errorResponse(res, error.message || 'Failed to delete webhook config', 500);
    }
}

async function triggerWhatsAppSurvey(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') {
            return errorResponse(res, 'Method not allowed', 405);
        }

        const body = parseJsonBody(req);
        const tenant_id = (body?.tenant_id || '').toString().trim();
        const customer_phone = (body?.customer_phone || '').toString().trim();
        const customer_name = (body?.customer_name || '').toString().trim();
        const external_trigger_id = (body?.external_trigger_id || '').toString().trim();

        if (!tenant_id || !customer_phone || !external_trigger_id) {
            return errorResponse(res, 'Missing required fields: tenant_id, customer_phone, external_trigger_id', 400);
        }

        const supabase = getSupabaseServiceClient();

        const { data: config, error: configError } = await supabase
            .from('whatsapp_trigger_configs')
            .select('*')
            .eq('tenant_id', tenant_id)
            .eq('external_trigger_id', external_trigger_id)
            .eq('is_active', true)
            .single();

        if (configError || !config) {
            return errorResponse(res, 'Webhook not found or inactive', 404);
        }

        const webhookKeyHeader = (req.headers['x-webhook-key'] || req.headers['X-Webhook-Key']) as string | undefined;
        const webhookKey = typeof webhookKeyHeader === 'string' ? webhookKeyHeader.trim() : '';

        if ((config as any).webhook_key && webhookKey !== (config as any).webhook_key) {
            return errorResponse(res, 'Invalid webhook key', 401);
        }

        const { data: instance, error: instanceError } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .eq('instance_name', (config as any).whatsapp_instance_name)
            .eq('tenant_id', tenant_id)
            .eq('status', 'connected')
            .single();

        if (instanceError || !instance) {
            return errorResponse(res, 'WhatsApp instance not found or not connected', 404);
        }

        const { data: template, error: templateError } = await supabase
            .from('survey_templates')
            .select('*')
            .eq('id', (config as any).survey_template_id)
            .eq('tenant_id', tenant_id)
            .single();

        if (templateError || !template) {
            return errorResponse(res, 'Survey template not found', 404);
        }

        const appUrl = process.env.VITE_APP_URL || `https://${process.env.VERCEL_URL || 'avaliazapsystem.vercel.app'}`;
        const surveyLink = `${appUrl}/Survey?tenant_id=${encodeURIComponent(tenant_id)}&template_id=${encodeURIComponent(
            (config as any).survey_template_id
        )}&source=webhook&trigger_id=${encodeURIComponent(external_trigger_id)}`;

        const formattedPhone = formatPhone(customer_phone);

        const message = `Olá ${customer_name || 'cliente'}! 👋\n\nGostaríamos muito de saber sua opinião sobre nosso atendimento.\n\nPor favor, clique no link abaixo para responder nossa pesquisa rápida:\n\n${surveyLink}\n\nSua opinião é muito importante para nós! 💜`;

        const evolutionUrl = (instance as any).server_url || process.env.EVOLUTION_API_URL;
        const evolutionApiKey = (instance as any).api_key || process.env.EVOLUTION_API_KEY;

        if (!evolutionUrl || !evolutionApiKey) {
            return errorResponse(res, 'Evolution API credentials not configured', 500);
        }

        const response = await fetch(`${evolutionUrl}/message/sendText/${(config as any).whatsapp_instance_name}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionApiKey,
            },
            body: JSON.stringify({
                number: formattedPhone,
                text: message,
            }),
        });

        const responseText = await response.text();

        if (!response.ok) {
            let errorData: any;
            try {
                errorData = JSON.parse(responseText);
            } catch {
                errorData = { message: responseText };
            }
            return errorResponse(res, `Evolution API error: ${errorData.message || response.statusText}`, 500);
        }

        const period = new Date().toISOString().slice(0, 7);
        const { data: existing } = await supabase
            .from('consumption')
            .select('*')
            .eq('tenant_id', tenant_id)
            .eq('period', period)
            .maybeSingle();

        if (existing) {
            const next = {
                messages_sent: (((existing as any).messages_sent) || 0) + 1,
                messages_sent_webhook: (((existing as any).messages_sent_webhook) || 0) + 1,
            };
            const { error: updateError } = await supabase
                .from('consumption')
                .update(next)
                .eq('tenant_id', tenant_id)
                .eq('period', period);
            if (updateError && (updateError as any)?.code === '42703') {
                await supabase
                    .from('consumption')
                    .update({ messages_sent: (((existing as any).messages_sent) || 0) + 1 })
                    .eq('tenant_id', tenant_id)
                    .eq('period', period);
            }
        } else {
            const { error: insertError } = await supabase.from('consumption').insert({
                tenant_id,
                period,
                messages_sent: 1,
                messages_sent_webhook: 1,
            });
            if (insertError && (insertError as any)?.code === '42703') {
                await supabase.from('consumption').insert({
                    tenant_id,
                    period,
                    messages_sent: 1,
                });
            }
        }

        return successResponse(res, {
            message: 'Survey sent successfully',
            surveyLink,
        });
    } catch (error: any) {
        return errorResponse(res, error.message || 'Failed to trigger survey', 500);
    }
}

async function whatsappReceiver(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return errorResponse(res, 'Method not allowed', 405);
    }

    return successResponse(res, { message: 'Webhook received' });
}

function parseJsonBody(req: VercelRequest) {
    const body: any = (req as any).body;
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch {
            return null;
        }
    }
    return body || null;
}

function formatPhone(phone: string) {
    let formatted = (phone || '').replace(/\D/g, '');
    if (formatted.length === 11 && !formatted.startsWith('55')) {
        formatted = '55' + formatted;
    }
    if (formatted.length <= 11 && !formatted.startsWith('55')) {
        formatted = '55' + formatted;
    }
    return formatted;
}

function generateWebhookKey() {
    return crypto.randomBytes(24).toString('base64url');
}
