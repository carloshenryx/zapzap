import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../lib/auth.js';
import { getSupabaseServiceClient } from '../lib/supabase.js';
import { successResponse, errorResponse, errorFromException } from '../lib/response.js';
import { requirePermission } from '../lib/authorize.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = req.query.action as string;

    if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'DELETE') {
        return errorResponse(res, 'Method not allowed', 405);
    }

    switch (action) {
        case 'list-instances':
            return await listInstances(req, res);
        case 'create-instance':
            return await createInstance(req, res);
        case 'delete':
            return await deleteInstance(req, res);
        case 'check-status':
            return await checkStatus(req, res);
        case 'get-qr':
        case 'disconnect':
        case 'configure-webhook':
            return successResponse(res, { message: 'WhatsApp API - Not fully implemented yet' });
        default:
            return errorResponse(res, 'Invalid action', 400);
    }
}

async function createInstance(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);

        if (!user.tenant_id) {
            return errorResponse(res, 'User not associated with a tenant', 403);
        }
        if (!(await requirePermission(res, user, 'integrations.whatsapp.manage'))) return;

        const { instanceName, webhookUrl } = req.body;

        if (!instanceName) {
            return errorResponse(res, 'Instance name is required', 400);
        }

        const supabase = getSupabaseServiceClient();

        // Create instance in Evolution API
        const evolutionUrl = process.env.EVOLUTION_API_URL;
        const evolutionKey = process.env.EVOLUTION_API_KEY;

        if (!evolutionUrl || !evolutionKey) {
            return errorResponse(res, 'Evolution API not configured', 500);
        }

        // Create instance in Evolution API with correct payload
        const evolutionResponse = await fetch(`${evolutionUrl}/instance/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionKey,
            },
            body: JSON.stringify({
                instanceName: instanceName,
                qrcode: true,
                integration: "WHATSAPP-BAILEYS",
                webhookUrl: webhookUrl || `https://${process.env.VERCEL_URL || 'localhost'}/api/webhooks/whatsapp`,
                webhookByEvents: false,
                webhookBase64: false,
                rejectCall: false,
                msgCall: "",
                groupsIgnore: true,
                alwaysOnline: false,
                readMessages: false,
                readStatus: false,
                syncFullHistory: false
            }),
        });

        if (!evolutionResponse.ok) {
            const error = await evolutionResponse.text();
            console.error('Evolution API error:', error);
            return errorResponse(res, 'Failed to create instance in Evolution API', 500);
        }

        const evolutionData = await evolutionResponse.json();

        // Save instance to database (using only existing columns)
        const { data: instance, error: dbError } = await supabase
            .from('whatsapp_instances')
            .insert({
                tenant_id: user.tenant_id,
                instance_name: instanceName,
                status: 'disconnected',
                qr_code: evolutionData.qrcode?.code || null,
            })
            .select()
            .single();

        if (dbError) {
            console.error('Database error:', dbError);
            return errorResponse(res, 'Failed to save instance', 500);
        }

        return successResponse(res, {
            instance,
            qr: evolutionData.qrcode,
        });
    } catch (error: any) {
        console.error('Create instance error:', error);
        return errorFromException(res, error, error.message || 'Failed to create instance', 500);
    }
}


async function listInstances(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);

        if (!user.tenant_id) {
            return errorResponse(res, 'User not associated with a tenant', 403);
        }
        if (!(await requirePermission(res, user, 'integrations.whatsapp.view'))) return;

        const supabase = getSupabaseServiceClient();

        // Get all WhatsApp instances for this tenant
        const { data: instances, error } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .eq('tenant_id', user.tenant_id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching instances:', error);
            return errorResponse(res, 'Failed to fetch instances', 500);
        }

        return successResponse(res, { instances: instances || [] });
    } catch (error: any) {
        console.error('List instances error:', error);
        return errorFromException(res, error, error.message || 'Failed to list instances', 500);
    }
}

async function deleteInstance(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);

        if (!user.tenant_id) {
            return errorResponse(res, 'User not associated with a tenant', 403);
        }
        if (!(await requirePermission(res, user, 'integrations.whatsapp.manage'))) return;

        const { instanceName } = req.body;

        if (!instanceName) {
            return errorResponse(res, 'Instance name is required', 400);
        }

        const supabase = getSupabaseServiceClient();
        const evolutionUrl = process.env.EVOLUTION_API_URL;
        const evolutionKey = process.env.EVOLUTION_API_KEY;

        // Try to delete from Evolution API (but don't fail if it doesn't exist)
        if (evolutionUrl && evolutionKey) {
            try {
                const evolutionResponse = await fetch(`${evolutionUrl}/instance/delete/${instanceName}`, {
                    method: 'DELETE',
                    headers: {
                        'apikey': evolutionKey,
                    },
                });

                if (!evolutionResponse.ok) {
                    const errorText = await evolutionResponse.text();
                    console.warn('Evolution API delete warning:', errorText);
                    // Continue anyway - instance might not exist there
                }
            } catch (evolutionError: any) {
                console.warn('Evolution API delete error (ignoring):', evolutionError.message);
                // Continue - we'll delete from our database anyway
            }
        }

        // Always delete from database (whether Evolution API succeeded or not)
        const { error: dbError } = await supabase
            .from('whatsapp_instances')
            .delete()
            .eq('tenant_id', user.tenant_id)
            .eq('instance_name', instanceName);

        if (dbError) {
            console.error('Database delete error:', dbError);
            return errorResponse(res, 'Failed to delete instance from database', 500);
        }

        return successResponse(res, {
            message: 'Instance deleted successfully'
        });
    } catch (error: any) {
        console.error('Delete instance error:', error);
        return errorFromException(res, error, error.message || 'Failed to delete instance', 500);
    }
}

async function checkStatus(req: VercelRequest, res: VercelResponse) {
    try {
        const user = await authenticateUser(req);

        if (!user.tenant_id) {
            return errorResponse(res, 'User not associated with a tenant', 403);
        }
        if (!(await requirePermission(res, user, 'integrations.whatsapp.view'))) return;

        const { instanceName } = req.body;

        if (!instanceName) {
            return errorResponse(res, 'Instance name is required', 400);
        }

        const supabase = getSupabaseServiceClient();
        const evolutionUrl = process.env.EVOLUTION_API_URL;
        const evolutionKey = process.env.EVOLUTION_API_KEY;

        if (!evolutionUrl || !evolutionKey) {
            return errorResponse(res, 'Evolution API not configured', 500);
        }

        // Get status from Evolution API
        const evolutionResponse = await fetch(`${evolutionUrl}/instance/connectionState/${instanceName}`, {
            method: 'GET',
            headers: {
                'apikey': evolutionKey,
            },
        });

        if (!evolutionResponse.ok) {
            const error = await evolutionResponse.text();
            console.error('Evolution API status error:', error);
            return errorResponse(res, 'Failed to check instance status', 500);
        }

        const statusData = await evolutionResponse.json();
        const state = statusData.instance?.state || 'close';

        // Map Evolution API state to our status
        const status = state === 'open' ? 'connected' : 'disconnected';

        // Update status in database
        const { error: dbError } = await supabase
            .from('whatsapp_instances')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('tenant_id', user.tenant_id)
            .eq('instance_name', instanceName);

        if (dbError) {
            console.error('Database update error:', dbError);
        }

        return successResponse(res, {
            instanceName,
            status,
            evolutionState: state
        });
    } catch (error: any) {
        console.error('Check status error:', error);
        return errorFromException(res, error, error.message || 'Failed to check status', 500);
    }
}
