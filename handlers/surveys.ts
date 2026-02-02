import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { authenticateUser } from '../lib/auth.js';
import { getSupabaseAuthedClient, getSupabaseServiceClient, hasSupabaseServiceRoleKey } from '../lib/supabase.js';
import { successResponse, errorResponse } from '../lib/response.js';

function getSupabaseClientForUser(user: any) {
    if (hasSupabaseServiceRoleKey()) return getSupabaseServiceClient();
    return getSupabaseAuthedClient(user.access_token);
}

function isMissingColumnError(error: any) {
    const code = String(error?.code || '');
    const message = String(error?.message || '');
    const details = String(error?.details || '');
    return (
        code === '42703' ||
        code === 'PGRST204' ||
        message.toLowerCase().includes('does not exist') ||
        message.toLowerCase().includes('schema cache') ||
        message.toLowerCase().includes('could not find') ||
        details.toLowerCase().includes('does not exist') ||
        details.toLowerCase().includes('schema cache') ||
        details.toLowerCase().includes('could not find')
    );
}

function getMissingColumnName(error: any) {
    const message = String(error?.message || '');
    const details = String(error?.details || '');
    const combined = `${message}\n${details}`;

    const m1 = combined.match(/column\s+"([^"]+)"/i);
    if (m1?.[1]) return m1[1];

    const m2 = combined.match(/'([^']+)'\s+column/i);
    if (m2?.[1]) return m2[1];

    const m3 = combined.match(/Could not find the '([^']+)' column/i);
    if (m3?.[1]) return m3[1];

    return null;
}

function isPermissionOrRlsError(error: any) {
    const code = String(error?.code || '');
    const message = String(error?.message || '');
    const details = String(error?.details || '');
    const combined = `${code}\n${message}\n${details}`.toLowerCase();
    return (
        code === '42501' ||
        combined.includes('permission denied') ||
        combined.includes('insufficient privilege') ||
        combined.includes('row-level security') ||
        combined.includes('violates row-level security') ||
        combined.includes('rls')
    );
}

function formatSupabaseError(error: any) {
    const message = String(error?.message || error?.toString?.() || 'Erro no banco');
    const code = error?.code ? String(error.code) : null;
    const details = error?.details ? String(error.details) : null;
    const hint = error?.hint ? String(error.hint) : null;

    const parts = [message];
    if (code) parts.push(`code=${code}`);
    if (details) parts.push(`details=${details}`);
    if (hint) parts.push(`hint=${hint}`);
    return parts.join(' | ');
}

async function insertSurveyTemplateWithFallback(supabase: any, insertData: any) {
    let current = { ...insertData };
    let lastError: any = null;

    for (let attempt = 0; attempt < 12; attempt++) {
        const { data: template, error } = await supabase
            .from('survey_templates')
            .insert(current)
            .select()
            .single();

        if (!error) return { template, error: null };
        lastError = error;
        if (!isMissingColumnError(error)) return { template: null, error };

        const missing = getMissingColumnName(error);
        const before = JSON.stringify(Object.keys(current).sort());

        if (missing === 'is_active' && Object.prototype.hasOwnProperty.call(current, 'is_active')) {
            current.active = current.is_active;
            delete current.is_active;
        } else if (missing === 'active' && Object.prototype.hasOwnProperty.call(current, 'active')) {
            current.is_active = current.active;
            delete current.active;
        } else if (missing && Object.prototype.hasOwnProperty.call(current, missing)) {
            delete current[missing];
        } else {
            const fallbackDropOrder = [
                'allow_attachments',
                'send_via_whatsapp_conversation',
                'completion_period',
                'google_redirect',
                'usage_limit',
                'voucher_config',
                'design',
                'created_by',
            ];
            for (const k of fallbackDropOrder) {
                if (Object.prototype.hasOwnProperty.call(current, k)) {
                    delete current[k];
                    break;
                }
            }
        }

        const after = JSON.stringify(Object.keys(current).sort());
        if (before === after) return { template: null, error };
    }

    return { template: null, error: lastError || new Error('Failed to insert survey template') };
}

async function updateSurveyTemplateWithFallback(supabase: any, tenantId: string, templateId: string, updateData: any) {
    let current = { ...updateData };
    let lastError: any = null;

    for (let attempt = 0; attempt < 12; attempt++) {
        const { data: template, error } = await supabase
            .from('survey_templates')
            .update(current)
            .eq('id', templateId)
            .eq('tenant_id', tenantId)
            .select()
            .single();

        if (!error) return { template, error: null };
        lastError = error;
        if (!isMissingColumnError(error)) return { template: null, error };

        const missing = getMissingColumnName(error);
        const before = JSON.stringify(Object.keys(current).sort());

        if (missing === 'is_active' && Object.prototype.hasOwnProperty.call(current, 'is_active')) {
            current.active = current.is_active;
            delete current.is_active;
        } else if (missing === 'active' && Object.prototype.hasOwnProperty.call(current, 'active')) {
            current.is_active = current.active;
            delete current.active;
        } else if (missing && Object.prototype.hasOwnProperty.call(current, missing)) {
            delete current[missing];
        } else {
            const fallbackDropOrder = [
                'allow_attachments',
                'send_via_whatsapp_conversation',
                'completion_period',
                'google_redirect',
                'usage_limit',
                'voucher_config',
                'design',
            ];
            for (const k of fallbackDropOrder) {
                if (Object.prototype.hasOwnProperty.call(current, k)) {
                    delete current[k];
                    break;
                }
            }
        }

        const after = JSON.stringify(Object.keys(current).sort());
        if (before === after) return { template: null, error };
    }

    return { template: null, error: lastError || new Error('Failed to update survey template') };
}

async function insertSurveyResponseWithFallback(supabase: any, insertData: any) {
    let current = { ...insertData };
    let lastError: any = null;
    const droppedColumns = new Set<string>();

    for (let attempt = 0; attempt < 12; attempt++) {
        const { data: response, error } = await supabase
            .from('survey_responses')
            .insert(current)
            .select()
            .single();

        if (!error) return { response, error: null, droppedColumns: Array.from(droppedColumns) };
        lastError = error;
        if (!isMissingColumnError(error)) return { response: null, error, droppedColumns: Array.from(droppedColumns) };

        const missing = getMissingColumnName(error);
        const before = JSON.stringify(Object.keys(current).sort());

        if (missing && Object.prototype.hasOwnProperty.call(current, missing)) {
            delete current[missing];
            droppedColumns.add(missing);
        } else {
            const fallbackDropOrder = [
                'attachments_token',
                'customer_cpf',
                'would_recommend',
                'custom_answers',
                'source',
                'template_id',
            ];
            for (const k of fallbackDropOrder) {
                if (Object.prototype.hasOwnProperty.call(current, k)) {
                    delete current[k];
                    droppedColumns.add(k);
                    break;
                }
            }
        }

        const after = JSON.stringify(Object.keys(current).sort());
        if (before === after) return { response: null, error, droppedColumns: Array.from(droppedColumns) };
    }

    return { response: null, error: lastError || new Error('Failed to insert survey response'), droppedColumns: Array.from(droppedColumns) };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = req.query.action as string;

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'DELETE') {
        return errorResponse(res, 'Method not allowed', 405);
    }

    switch (action) {
        case 'create-template':
            return await createTemplate(req, res);
        case 'list-templates':
            return await listTemplates(req, res);
        case 'update-template':
            return await updateTemplate(req, res);
        case 'delete-template':
            return await deleteTemplate(req, res);
        case 'trigger':
            return await triggerSurvey(req, res);
        case 'create-response':
            return await createSurveyResponse(req, res);
        case 'create-attachment-uploads':
            return await createAttachmentUploads(req, res);
        case 'confirm-attachment-uploads':
            return await confirmAttachmentUploads(req, res);
        case 'list-attachments':
            return await listAttachments(req, res);
        case 'update-template-usage':
            return await updateTemplateUsage(req, res);
        case 'update-followup':
            return await updateSurveyFollowup(req, res);
        default:
            return errorResponse(res, 'Invalid action', 400);
    }
}

async function updateSurveyFollowup(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);

        if (!user.tenant_id) {
            return errorResponse(res, 'User not associated with a tenant', 403);
        }

        const { response_id, followup_status, followup_note } = req.body || {};

        if (!response_id) {
            return errorResponse(res, 'response_id is required', 400);
        }

        const allowed = ['open', 'in_progress', 'resolved', 'ignored'];
        if (followup_status && !allowed.includes(followup_status)) {
            return errorResponse(res, 'Invalid followup_status', 400);
        }

        const supabase = getSupabaseClientForUser(user);
        const updateData: any = {
            followup_status: followup_status || 'open',
            followup_note: followup_note || null,
            followup_updated_at: new Date().toISOString(),
            followup_updated_by: user.id,
        };

        const { data, error } = await supabase
            .from('survey_responses')
            .update(updateData)
            .eq('id', response_id)
            .eq('tenant_id', user.tenant_id)
            .select()
            .single();

        if (error) {
            console.error('Update followup error:', error);
            if (error.code === '42703' || String(error.message || '').toLowerCase().includes('does not exist')) {
                return errorResponse(res, 'Colunas de tratativa não instaladas no banco. Execute o SQL de dashboard_followup_google.sql', 400);
            }
            return errorResponse(res, error.message || 'Failed to update followup', 500);
        }

        return successResponse(res, { response: data });
    } catch (error: any) {
        console.error('Update followup error:', error);
        return errorResponse(res, error.message || 'Failed to update followup', 500);
    }
}

async function createTemplate(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);

        if (!user.tenant_id) {
            return errorResponse(res, 'User not associated with a tenant', 403);
        }

        const {
            name,
            description,
            questions,
            is_active,
            send_via_whatsapp,
            send_via_whatsapp_conversation,
            send_via_email,
            send_via_sms,
            allow_anonymous,
            allow_attachments,
            completion_period,
            google_redirect,
            usage_limit,
            voucher_config,
            design,
        } = req.body;

        if (!name) {
            return errorResponse(res, 'Template name is required', 400);
        }

        const supabase = getSupabaseClientForUser(user);
        const insertData: any = {
            tenant_id: user.tenant_id,
            name,
            description,
            questions: questions || [],
            is_active: !!is_active,
            send_via_whatsapp: !!send_via_whatsapp,
            send_via_whatsapp_conversation: !!send_via_whatsapp_conversation,
            send_via_email: !!send_via_email,
            send_via_sms: !!send_via_sms,
            allow_anonymous: !!allow_anonymous,
            allow_attachments: !!allow_attachments,
            completion_period: completion_period || null,
            google_redirect: google_redirect || null,
            usage_limit: usage_limit || null,
            voucher_config: voucher_config || null,
            design: design || null,
            created_by: user.id,
        };

        const { template, error } = await insertSurveyTemplateWithFallback(supabase, insertData);

        if (error) {
            console.error('Create template error:', error);
            const statusCode = isPermissionOrRlsError(error) ? 403 : isMissingColumnError(error) ? 400 : 500;
            return errorResponse(res, formatSupabaseError(error), statusCode);
        }

        const period = new Date().toISOString().slice(0, 7);
        const { data: existingConsumption } = await supabase
            .from('consumption')
            .select('*')
            .eq('tenant_id', user.tenant_id)
            .eq('period', period)
            .maybeSingle();

        if (existingConsumption) {
            const { error: updateConsumptionError } = await supabase
                .from('consumption')
                .update({
                    surveys_created: (((existingConsumption as any).surveys_created) || 0) + 1,
                })
                .eq('tenant_id', user.tenant_id)
                .eq('period', period);
            if (updateConsumptionError && (updateConsumptionError as any)?.code !== '42703') {
                console.error('Update consumption error:', updateConsumptionError);
            }
        } else {
            const { error: insertConsumptionError } = await supabase
                .from('consumption')
                .insert({
                    tenant_id: user.tenant_id,
                    period,
                    surveys_created: 1,
                });
            if (insertConsumptionError && (insertConsumptionError as any)?.code === '42703') {
                await supabase
                    .from('consumption')
                    .insert({
                        tenant_id: user.tenant_id,
                        period,
                    });
            }
        }

        return successResponse(res, { template });
    } catch (error: any) {
        console.error('Create template error:', error);
        const statusCode = isPermissionOrRlsError(error) ? 403 : isMissingColumnError(error) ? 400 : 500;
        return errorResponse(res, formatSupabaseError(error), statusCode);
    }
}

async function listTemplates(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);

        if (!user.tenant_id) {
            return errorResponse(res, 'User not associated with a tenant', 403);
        }

        const supabase = getSupabaseClientForUser(user);

        const { data: templates, error } = await supabase
            .from('survey_templates')
            .select('*')
            .eq('tenant_id', user.tenant_id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('List templates error:', error);
            return errorResponse(res, 'Failed to list templates', 500);
        }

        return successResponse(res, { templates: templates || [] });
    } catch (error: any) {
        console.error('List templates error:', error);
        return errorResponse(res, error.message || 'Failed to list templates', 500);
    }
}

async function updateTemplate(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);

        if (!user.tenant_id) {
            return errorResponse(res, 'User not associated with a tenant', 403);
        }

        const {
            id,
            name,
            description,
            questions,
            is_active,
            send_via_whatsapp,
            send_via_whatsapp_conversation,
            send_via_email,
            send_via_sms,
            allow_anonymous,
            allow_attachments,
            completion_period,
            google_redirect,
            usage_limit,
            voucher_config,
            design,
        } = req.body;

        if (!id) {
            return errorResponse(res, 'Template ID is required', 400);
        }

        const supabase = getSupabaseClientForUser(user);
        const updateData: any = {
            name,
            description,
            questions,
            ...(typeof is_active === 'boolean' ? { is_active } : {}),
            ...(typeof send_via_whatsapp === 'boolean' ? { send_via_whatsapp } : {}),
            ...(typeof send_via_whatsapp_conversation === 'boolean' ? { send_via_whatsapp_conversation } : {}),
            ...(typeof send_via_email === 'boolean' ? { send_via_email } : {}),
            ...(typeof send_via_sms === 'boolean' ? { send_via_sms } : {}),
            ...(typeof allow_anonymous === 'boolean' ? { allow_anonymous } : {}),
            ...(typeof allow_attachments === 'boolean' ? { allow_attachments } : {}),
            ...(completion_period !== undefined ? { completion_period } : {}),
            ...(google_redirect !== undefined ? { google_redirect } : {}),
            ...(usage_limit !== undefined ? { usage_limit } : {}),
            ...(voucher_config !== undefined ? { voucher_config } : {}),
            ...(design !== undefined ? { design } : {}),
            updated_at: new Date().toISOString(),
        };

        const { template, error } = await updateSurveyTemplateWithFallback(supabase, user.tenant_id, id, updateData);

        if (error) {
            console.error('Update template error:', error);
            const statusCode = isPermissionOrRlsError(error) ? 403 : isMissingColumnError(error) ? 400 : 500;
            return errorResponse(res, formatSupabaseError(error), statusCode);
        }

        return successResponse(res, { template });
    } catch (error: any) {
        console.error('Update template error:', error);
        const statusCode = isPermissionOrRlsError(error) ? 403 : isMissingColumnError(error) ? 400 : 500;
        return errorResponse(res, formatSupabaseError(error), statusCode);
    }
}

async function deleteTemplate(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);

        if (!user.tenant_id) {
            return errorResponse(res, 'User not associated with a tenant', 403);
        }

        const { id } = req.body;

        if (!id) {
            return errorResponse(res, 'Template ID is required', 400);
        }

        const supabase = getSupabaseClientForUser(user);

        const { error } = await supabase
            .from('survey_templates')
            .delete()
            .eq('id', id)
            .eq('tenant_id', user.tenant_id);

        if (error) {
            console.error('Delete template error:', error);
            return errorResponse(res, 'Failed to delete template', 500);
        }

        return successResponse(res, { message: 'Template deleted successfully' });
    } catch (error: any) {
        console.error('Delete template error:', error);
        return errorResponse(res, error.message || 'Failed to delete template', 500);
    }
}

async function triggerSurvey(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);

        if (!user.tenant_id) {
            return errorResponse(res, 'User not associated with a tenant', 403);
        }

        const { instanceName, phoneNumber, customerName, surveyTemplateId } = req.body;
        const usageSourceHeader = (req.headers['x-usage-source'] || req.headers['X-Usage-Source']) as string | undefined;
        const usageSourceBody = (req.body as any)?.usage_source;
        const usageSource = String(usageSourceBody || usageSourceHeader || 'manual').toLowerCase() === 'api' ? 'api' : 'manual';

        if (!instanceName || !phoneNumber || !surveyTemplateId) {
            return errorResponse(res, 'Missing required fields: instanceName, phoneNumber, surveyTemplateId', 400);
        }

        const supabase = getSupabaseClientForUser(user);

        // Get WhatsApp instance configuration
        const { data: instance, error: instanceError } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .eq('instance_name', instanceName)
            .eq('tenant_id', user.tenant_id)
            .eq('status', 'connected')
            .single();

        if (instanceError || !instance) {
            return errorResponse(res, 'WhatsApp instance not found or not connected', 404);
        }

        // Get survey template
        const { data: template, error: templateError } = await supabase
            .from('survey_templates')
            .select('*')
            .eq('id', surveyTemplateId)
            .eq('tenant_id', user.tenant_id)
            .single();

        if (templateError || !template) {
            return errorResponse(res, 'Survey template not found', 404);
        }

        // Build survey link with source parameter
        const appUrl = process.env.VITE_APP_URL || 'https://avaliazapsystem.vercel.app';
        const sourceParam = usageSource === 'api' ? 'api_whatsapp' : 'manual_whatsapp';
        const surveyLink = `${appUrl}/Survey?tenant_id=${encodeURIComponent(user.tenant_id)}&template_id=${encodeURIComponent(
            surveyTemplateId
        )}&source=${encodeURIComponent(sourceParam)}`;

        // Format phone number with country code (DDI)
        let formattedPhone = phoneNumber.replace(/\D/g, '');

        // Add Brazilian DDI (55) if missing and number looks Brazilian (starts with DDD)
        if (formattedPhone.length === 11 && !formattedPhone.startsWith('55')) {
            formattedPhone = '55' + formattedPhone;
        }
        // If still doesn't have DDI and is 10 or 11 digits, assume Brazilian
        if (formattedPhone.length <= 11 && !formattedPhone.startsWith('55')) {
            formattedPhone = '55' + formattedPhone;
        }

        console.log('Phone formatting:', {
            original: phoneNumber,
            cleaned: phoneNumber.replace(/\D/g, ''),
            formatted: formattedPhone
        });

        // Build WhatsApp message
        const message = `Olá ${customerName || 'cliente'}! 👋\n\nGostaríamos muito de saber sua opinião sobre nosso atendimento.\n\nPor favor, clique no link abaixo para responder nossa pesquisa rápida:\n\n${surveyLink}\n\nSua opinião é muito importante para nós! 💜`;

        // Send via Evolution API
        const evolutionUrl = instance.server_url || process.env.EVOLUTION_API_URL;
        const evolutionApiKey = instance.api_key || process.env.EVOLUTION_API_KEY;

        if (!evolutionUrl || !evolutionApiKey) {
            console.error('Evolution API credentials missing:', {
                hasInstanceUrl: !!instance.server_url,
                hasInstanceApiKey: !!instance.api_key,
                hasEnvUrl: !!process.env.EVOLUTION_API_URL,
                hasEnvApiKey: !!process.env.EVOLUTION_API_KEY
            });
            return errorResponse(res, 'Evolution API credentials not configured', 500);
        }

        console.log('Sending WhatsApp message:', {
            url: `${evolutionUrl}/message/sendText/${instanceName}`,
            instanceName,
            phoneNumber: formattedPhone,
            hasMessage: !!message
        });

        const response = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionApiKey
            },
            body: JSON.stringify({
                number: formattedPhone,
                text: message
            })
        });

        const responseText = await response.text();
        console.log('Evolution API response:', {
            status: response.status,
            statusText: response.statusText,
            body: responseText
        });

        if (!response.ok) {
            let errorData;
            try {
                errorData = JSON.parse(responseText);
            } catch {
                errorData = { message: responseText };
            }
            console.error('Evolution API error:', errorData);
            return errorResponse(res, `Evolution API error: ${errorData.message || response.statusText}`, 500);
        }

        const period = new Date().toISOString().slice(0, 7); // YYYY-MM

        const { data: existing } = await supabase
            .from('consumption')
            .select('*')
            .eq('tenant_id', user.tenant_id)
            .eq('period', period)
            .maybeSingle();

        if (existing) {
            const next: any = {
                messages_sent: (((existing as any).messages_sent) || 0) + 1,
            };
            if (usageSource === 'api') next.messages_sent_api = (((existing as any).messages_sent_api) || 0) + 1;
            else next.messages_sent_manual = (((existing as any).messages_sent_manual) || 0) + 1;

            const { error: updateError } = await supabase
                .from('consumption')
                .update(next)
                .eq('tenant_id', user.tenant_id)
                .eq('period', period);

            if (updateError && (updateError as any)?.code === '42703') {
                await supabase
                    .from('consumption')
                    .update({ messages_sent: (((existing as any).messages_sent) || 0) + 1 })
                    .eq('tenant_id', user.tenant_id)
                    .eq('period', period);
            }
        } else {
            const insert: any = {
                tenant_id: user.tenant_id,
                period,
                messages_sent: 1,
            };
            if (usageSource === 'api') insert.messages_sent_api = 1;
            else insert.messages_sent_manual = 1;

            const { error: insertError } = await supabase.from('consumption').insert(insert);
            if (insertError && (insertError as any)?.code === '42703') {
                await supabase
                    .from('consumption')
                    .insert({
                        tenant_id: user.tenant_id,
                        period,
                        messages_sent: 1
                    });
            }
        }

        return successResponse(res, {
            success: true,
            message: 'Survey sent successfully',
            surveyLink
        });

    } catch (error: any) {
        console.error('Trigger survey error:', error);
        return errorResponse(res, error.message || 'Failed to trigger survey', 500);
    }
}

// CREATE SURVEY RESPONSE
async function createSurveyResponse(req: VercelRequest, res: VercelResponse) {
    try {
        console.log('📥 create-response called');

        // Parse body if it's a string
        let body = req.body;
        if (typeof req.body === 'string') {
            body = JSON.parse(req.body);
        }

        console.log('Body received:', JSON.stringify(body, null, 2));

        // No authentication required - public survey submissions
        const {
            tenant_id,
            template_id,
            customer_name,
            customer_email,
            customer_phone,
            customer_cpf,
            is_anonymous,
            overall_rating,
            would_recommend,
            comment,
            custom_answers,
            source
        } = body;

        // Validation
        if (!tenant_id) {
            console.error('❌ Missing tenant_id');
            return errorResponse(res, 'tenant_id is required', 400);
        }

        // CRITICAL: Validate tenant_id format to prevent injection
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenant_id)) {
            console.error('❌ Invalid tenant_id format:', tenant_id);
            return errorResponse(res, 'Invalid tenant_id format', 400);
        }

        const supabase = getSupabaseServiceClient();

        const attachmentsToken = crypto.randomBytes(24).toString('base64url');
        const dataToInsert = {
            tenant_id,
            template_id: template_id || null,
            customer_name: customer_name || null,
            customer_email: customer_email || null,
            customer_phone: customer_phone || null,
            customer_cpf: customer_cpf || null,
            is_anonymous: is_anonymous || false,
            overall_rating: overall_rating !== undefined && overall_rating !== null && overall_rating !== '' ? Number(overall_rating) : null,
            would_recommend: would_recommend !== undefined ? would_recommend : true,
            comment: comment || null,
            custom_answers: custom_answers || {},
            source: source || 'manual',
            attachments_token: attachmentsToken,
            created_at: new Date().toISOString()
        };

        console.log('Data to insert:', JSON.stringify(dataToInsert, null, 2));

        const { response, error, droppedColumns } = await insertSurveyResponseWithFallback(supabase, dataToInsert);

        if (error) {
            console.error('❌ Supabase error:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('Error details:', error.details);
            throw error;
        }

        console.log('✅ Survey response created:', response.id);
        if (droppedColumns.includes('attachments_token') && response && typeof response === 'object') {
            (response as any).attachments_token = null;
        }

        const period = new Date().toISOString().slice(0, 7);
        const normalizedSource = String(source || '').toLowerCase();
        const responseCategory = normalizedSource.startsWith('webhook')
            ? 'webhook'
            : normalizedSource.startsWith('api')
                ? 'api'
                : 'manual';

        const { data: existingConsumption } = await supabase
            .from('consumption')
            .select('*')
            .eq('tenant_id', tenant_id)
            .eq('period', period)
            .maybeSingle();

        if (existingConsumption) {
            const next: any = {
                responses_received: (((existingConsumption as any).responses_received) || 0) + 1,
            };
            if (responseCategory === 'webhook') next.responses_received_webhook = (((existingConsumption as any).responses_received_webhook) || 0) + 1;
            else if (responseCategory === 'api') next.responses_received_api = (((existingConsumption as any).responses_received_api) || 0) + 1;
            else next.responses_received_manual = (((existingConsumption as any).responses_received_manual) || 0) + 1;

            const { error: updateConsumptionError } = await supabase
                .from('consumption')
                .update(next)
                .eq('tenant_id', tenant_id)
                .eq('period', period);

            if (updateConsumptionError && (updateConsumptionError as any)?.code === '42703') {
                await supabase
                    .from('consumption')
                    .update({ responses_received: (((existingConsumption as any).responses_received) || 0) + 1 })
                    .eq('tenant_id', tenant_id)
                    .eq('period', period);
            }
        } else {
            const insert: any = {
                tenant_id,
                period,
                responses_received: 1,
            };
            if (responseCategory === 'webhook') insert.responses_received_webhook = 1;
            else if (responseCategory === 'api') insert.responses_received_api = 1;
            else insert.responses_received_manual = 1;

            const { error: insertConsumptionError } = await supabase
                .from('consumption')
                .insert(insert);

            if (insertConsumptionError && (insertConsumptionError as any)?.code === '42703') {
                await supabase
                    .from('consumption')
                    .insert({
                        tenant_id,
                        period,
                        responses_received: 1,
                    });
            }
        }

        return successResponse(res, {
            success: true,
            response
        });

    } catch (error: any) {
        console.error('❌ Create survey response error:', error);
        console.error('Error stack:', error.stack);
        return errorResponse(res, error.message || 'Failed to create survey response', 500);
    }
}

type AttachmentUploadRequestFile = {
    name: string;
    mime_type: string;
    size_bytes: number;
};

type ConfirmedUpload = {
    path: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
};

const ATTACHMENTS_BUCKET = 'survey-attachments';
const MAX_ATTACHMENTS_PER_RESPONSE = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024;

async function createAttachmentUploads(req: VercelRequest, res: VercelResponse) {
    try {
        let body = req.body;
        if (typeof req.body === 'string') {
            body = JSON.parse(req.body);
        }

        const { tenant_id, response_id, attachments_token, files } = body || {};

        if (!tenant_id || !response_id || !attachments_token) {
            return errorResponse(res, 'tenant_id, response_id and attachments_token are required', 400);
        }

        if (!Array.isArray(files) || files.length === 0) {
            return errorResponse(res, 'files are required', 400);
        }

        if (files.length > MAX_ATTACHMENTS_PER_RESPONSE) {
            return errorResponse(res, `Máximo de ${MAX_ATTACHMENTS_PER_RESPONSE} anexos por resposta`, 400);
        }

        if (!isUuid(tenant_id) || !isUuid(response_id)) {
            return errorResponse(res, 'Invalid tenant_id/response_id', 400);
        }

        const supabase = getSupabaseServiceClient();

        const { data: response, error: responseError } = await supabase
            .from('survey_responses')
            .select('id, tenant_id, template_id, source, attachments_token')
            .eq('id', response_id)
            .eq('tenant_id', tenant_id)
            .single();

        if (responseError && isMissingColumnError(responseError) && getMissingColumnName(responseError) === 'attachments_token') {
            return errorResponse(res, 'Anexos indisponíveis: migração do banco não aplicada', 501);
        }

        if (responseError || !response) {
            return errorResponse(res, 'Resposta não encontrada', 404);
        }

        if (String((response as any).attachments_token || '') !== String(attachments_token)) {
            return errorResponse(res, 'Token inválido', 403);
        }

        if (String((response as any).source || '').toLowerCase() === 'clicktotem') {
            return errorResponse(res, 'Anexos não disponíveis no canal Click no Totem', 400);
        }

        const templateId = (response as any).template_id as string | null;
        if (!templateId) {
            return errorResponse(res, 'Template não encontrado para esta resposta', 400);
        }

        const { data: template, error: templateError } = await supabase
            .from('survey_templates')
            .select('id, tenant_id, allow_attachments')
            .eq('id', templateId)
            .eq('tenant_id', tenant_id)
            .single();

        if (templateError || !template) {
            return errorResponse(res, 'Template não encontrado', 404);
        }

        if (!(template as any).allow_attachments) {
            return errorResponse(res, 'Anexos desativados neste modelo de pesquisa', 400);
        }

        const validatedFiles: AttachmentUploadRequestFile[] = (files as any[]).map((f) => ({
            name: String(f?.name || ''),
            mime_type: String(f?.mime_type || ''),
            size_bytes: Number(f?.size_bytes || 0),
        }));

        for (const f of validatedFiles) {
            if (!f.name || !f.mime_type || !Number.isFinite(f.size_bytes) || f.size_bytes <= 0) {
                return errorResponse(res, 'Arquivo inválido', 400);
            }
            if (!isAllowedAttachmentMimeType(f.mime_type)) {
                return errorResponse(res, 'Tipo de arquivo não suportado', 400);
            }
            if (f.size_bytes > MAX_ATTACHMENT_SIZE_BYTES) {
                return errorResponse(res, 'Arquivo excede o tamanho máximo permitido', 400);
            }
        }

        const uploads = [];
        for (const f of validatedFiles) {
            const safeName = sanitizeFilename(f.name);
            const objectName = `${tenant_id}/responses/${response_id}/${crypto.randomBytes(16).toString('hex')}-${safeName}`;

            const { data: signed, error: signedError } = await supabase
                .storage
                .from(ATTACHMENTS_BUCKET)
                .createSignedUploadUrl(objectName);

            if (signedError || !signed?.token || !signed?.path) {
                console.error('Signed upload error:', signedError);
                return errorResponse(res, 'Falha ao preparar upload', 500);
            }

            uploads.push({
                path: signed.path,
                token: signed.token,
                mime_type: f.mime_type,
                original_name: f.name,
                size_bytes: f.size_bytes,
            });
        }

        return successResponse(res, { uploads });
    } catch (error: any) {
        console.error('Create attachment uploads error:', error);
        return errorResponse(res, error.message || 'Failed to create attachment uploads', 500);
    }
}

async function confirmAttachmentUploads(req: VercelRequest, res: VercelResponse) {
    try {
        let body = req.body;
        if (typeof req.body === 'string') {
            body = JSON.parse(req.body);
        }

        const { tenant_id, response_id, attachments_token, uploaded } = body || {};

        if (!tenant_id || !response_id || !attachments_token) {
            return errorResponse(res, 'tenant_id, response_id and attachments_token are required', 400);
        }

        if (!Array.isArray(uploaded) || uploaded.length === 0) {
            return errorResponse(res, 'uploaded are required', 400);
        }

        if (uploaded.length > MAX_ATTACHMENTS_PER_RESPONSE) {
            return errorResponse(res, `Máximo de ${MAX_ATTACHMENTS_PER_RESPONSE} anexos por resposta`, 400);
        }

        if (!isUuid(tenant_id) || !isUuid(response_id)) {
            return errorResponse(res, 'Invalid tenant_id/response_id', 400);
        }

        const supabase = getSupabaseServiceClient();

        const { data: response, error: responseError } = await supabase
            .from('survey_responses')
            .select('id, tenant_id, template_id, source, attachments_token')
            .eq('id', response_id)
            .eq('tenant_id', tenant_id)
            .single();

        if (responseError && isMissingColumnError(responseError) && getMissingColumnName(responseError) === 'attachments_token') {
            return errorResponse(res, 'Anexos indisponíveis: migração do banco não aplicada', 501);
        }

        if (responseError || !response) {
            return errorResponse(res, 'Resposta não encontrada', 404);
        }

        if (String((response as any).attachments_token || '') !== String(attachments_token)) {
            return errorResponse(res, 'Token inválido', 403);
        }

        if (String((response as any).source || '').toLowerCase() === 'clicktotem') {
            return errorResponse(res, 'Anexos não disponíveis no canal Click no Totem', 400);
        }

        const templateId = (response as any).template_id as string | null;
        if (!templateId) {
            return errorResponse(res, 'Template não encontrado para esta resposta', 400);
        }

        const { data: template, error: templateError } = await supabase
            .from('survey_templates')
            .select('id, tenant_id, allow_attachments')
            .eq('id', templateId)
            .eq('tenant_id', tenant_id)
            .single();

        if (templateError || !template) {
            return errorResponse(res, 'Template não encontrado', 404);
        }

        if (!(template as any).allow_attachments) {
            return errorResponse(res, 'Anexos desativados neste modelo de pesquisa', 400);
        }

        const prefix = `${tenant_id}/responses/${response_id}/`;

        const normalized: ConfirmedUpload[] = (uploaded as any[]).map((u) => ({
            path: String(u?.path || ''),
            original_name: String(u?.original_name || ''),
            mime_type: String(u?.mime_type || ''),
            size_bytes: Number(u?.size_bytes || 0),
        }));

        for (const u of normalized) {
            if (!u.path.startsWith(prefix)) {
                return errorResponse(res, 'Caminho inválido', 400);
            }
            if (!u.original_name || !u.mime_type || !Number.isFinite(u.size_bytes) || u.size_bytes <= 0) {
                return errorResponse(res, 'Arquivo inválido', 400);
            }
            if (!isAllowedAttachmentMimeType(u.mime_type)) {
                return errorResponse(res, 'Tipo de arquivo não suportado', 400);
            }
            if (u.size_bytes > MAX_ATTACHMENT_SIZE_BYTES) {
                return errorResponse(res, 'Arquivo excede o tamanho máximo permitido', 400);
            }
        }

        const rows = normalized.map((u) => ({
            tenant_id,
            response_id,
            storage_bucket: ATTACHMENTS_BUCKET,
            storage_path: u.path,
            original_name: u.original_name,
            mime_type: u.mime_type,
            size_bytes: u.size_bytes,
        }));

        const { data: inserted, error: insertError } = await supabase
            .from('survey_response_attachments')
            .insert(rows)
            .select();

        if (insertError) {
            console.error('Insert attachments error:', insertError);
            return errorResponse(res, insertError.message || 'Falha ao salvar anexos', 500);
        }

        return successResponse(res, { attachments: inserted || [] });
    } catch (error: any) {
        console.error('Confirm attachment uploads error:', error);
        return errorResponse(res, error.message || 'Failed to confirm attachment uploads', 500);
    }
}

async function listAttachments(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);

        if (!user.tenant_id) {
            return errorResponse(res, 'User not associated with a tenant', 403);
        }

        let body = req.body;
        if (typeof req.body === 'string') {
            body = JSON.parse(req.body);
        }

        const { response_ids } = body || {};

        if (!Array.isArray(response_ids) || response_ids.length === 0) {
            return successResponse(res, { attachmentsByResponseId: {} });
        }

        const uniqueIds = Array.from(new Set(response_ids.map((x: any) => String(x || '')).filter(Boolean))).slice(0, 300);
        if (uniqueIds.some((id) => !isUuid(id))) {
            return errorResponse(res, 'Invalid response_ids', 400);
        }

        const supabase = getSupabaseServiceClient();
        const { data: attachments, error } = await supabase
            .from('survey_response_attachments')
            .select('*')
            .eq('tenant_id', user.tenant_id)
            .in('response_id', uniqueIds)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('List attachments error:', error);
            return errorResponse(res, error.message || 'Falha ao listar anexos', 500);
        }

        const withUrls = await Promise.all((attachments || []).map(async (a: any) => {
            const bucket = String(a.storage_bucket || ATTACHMENTS_BUCKET);
            const path = String(a.storage_path || '');
            const { data: signed, error: signedError } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
            return {
                ...a,
                signed_url: signedError ? null : signed?.signedUrl || null,
            };
        }));

        const attachmentsByResponseId: Record<string, any[]> = {};
        for (const a of withUrls) {
            const rid = String((a as any).response_id || '');
            if (!rid) continue;
            if (!attachmentsByResponseId[rid]) attachmentsByResponseId[rid] = [];
            attachmentsByResponseId[rid].push(a);
        }

        return successResponse(res, { attachmentsByResponseId });
    } catch (error: any) {
        console.error('List attachments error:', error);
        return errorResponse(res, error.message || 'Failed to list attachments', 500);
    }
}

function sanitizeFilename(filename: string) {
    const base = (filename || 'file').split('\\').pop()?.split('/').pop() || 'file';
    const normalized = base.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    const cleaned = normalized.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
    const clipped = cleaned.length > 120 ? cleaned.slice(-120) : cleaned;
    return clipped || 'file';
}

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function isAllowedAttachmentMimeType(mimeType: string) {
    const mt = String(mimeType || '').toLowerCase();
    return mt.startsWith('image/') || mt.startsWith('video/') || mt.startsWith('audio/');
}

// UPDATE TEMPLATE USAGE
async function updateTemplateUsage(req: VercelRequest, res: VercelResponse) {
    try {
        // No authentication required - called from public survey page
        const { template_id, increment = 1 } = req.body;

        if (!template_id) {
            return errorResponse(res, 'template_id is required', 400);
        }

        const supabase = getSupabaseServiceClient();

        // Get current template usage
        const { data: template, error: fetchError } = await supabase
            .from('survey_templates')
            .select('usage_limit')
            .eq('id', template_id)
            .single();

        if (fetchError) {
            console.error('Error fetching template:', fetchError);
            throw fetchError;
        }

        if (!template) {
            return errorResponse(res, 'Template not found', 404);
        }

        // Calculate new usage count
        const current_uses = (template.usage_limit?.current_uses || 0) + increment;

        // Update usage limit
        const { data: updated, error: updateError } = await supabase
            .from('survey_templates')
            .update({
                usage_limit: {
                    ...template.usage_limit,
                    current_uses
                }
            })
            .eq('id', template_id)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating template usage:', updateError);
            throw updateError;
        }

        console.log(`✅ Template usage updated: ${template_id} -> ${current_uses} uses`);

        return successResponse(res, {
            success: true,
            template: updated,
            current_uses
        });

    } catch (error: any) {
        console.error('Update template usage error:', error);
        return errorResponse(res, error.message || 'Failed to update template usage', 500);
    }
}
