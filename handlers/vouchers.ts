import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../lib/auth.js';
import { getSupabaseServiceClient } from '../lib/supabase.js';

// Helper functions
const successResponse = (res: VercelResponse, data: any) => {
    return res.status(200).json({ success: true, ...data });
};

const errorResponse = (res: VercelResponse, message: string, status: number = 400) => {
    return res.status(status).json({ success: false, error: message });
};

// Generate unique voucher code
const generateVoucherCode = (): string => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 11).toUpperCase();
    return `VOUCHER-${timestamp}-${randomStr}`;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { action } = req.query;

        // Public actions (no auth required)
        if (action === 'generate') {
            return await generateVoucherUsage(req, res, null);
        }

        // Protected actions (auth required)
        const user = await authenticateUser(req);

        if (!user.tenant_id) {
            return errorResponse(res, 'User not associated with a tenant', 403);
        }

        switch (action) {
            case 'list':
                return await listVouchers(req, res, user);
            case 'create':
                return await createVoucher(req, res, user);
            case 'update':
                return await updateVoucher(req, res, user);
            case 'delete':
                return await deleteVoucher(req, res, user);
            case 'redeem':
                return await redeemVoucher(req, res, user);
            case 'usage-list':
                return await listVoucherUsage(req, res, user);
            default:
                return errorResponse(res, 'Invalid action', 400);
        }
    } catch (error: any) {
        console.error('Vouchers API error:', error);
        return errorResponse(res, error.message || 'Internal server error', 500);
    }
}

// List all vouchers for tenant
async function listVouchers(req: VercelRequest, res: VercelResponse, user: any) {
    const supabase = getSupabaseServiceClient();

    const { data: vouchers, error } = await supabase
        .from('vouchers')
        .select('*, voucher_usage(count)')
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('List vouchers error:', error);
        return errorResponse(res, 'Failed to fetch vouchers', 500);
    }

    return successResponse(res, { vouchers });
}

// Create new voucher
async function createVoucher(req: VercelRequest, res: VercelResponse, user: any) {
    const {
        name,
        description,
        type,
        discount_percentage,
        discount_fixed,
        usage_limit,
        notify_on_limit
    } = req.body;

    // Validation
    if (!name || !type) {
        return errorResponse(res, 'Missing required fields: name, type', 400);
    }

    if (!['discount_percentage', 'discount_fixed', 'gift', 'free_shipping'].includes(type)) {
        return errorResponse(res, 'Invalid voucher type', 400);
    }

    if (type === 'discount_percentage' && (!discount_percentage || discount_percentage < 0 || discount_percentage > 100)) {
        return errorResponse(res, 'Invalid discount percentage (0-100)', 400);
    }

    if (type === 'discount_fixed' && (!discount_fixed || discount_fixed < 0)) {
        return errorResponse(res, 'Invalid discount fixed value', 400);
    }

    const supabase = getSupabaseServiceClient();

    const { data: voucher, error } = await supabase
        .from('vouchers')
        .insert({
            tenant_id: user.tenant_id,
            name,
            description,
            type,
            discount_percentage: type === 'discount_percentage' ? discount_percentage : null,
            discount_fixed: type === 'discount_fixed' ? discount_fixed : null,
            usage_limit,
            notify_on_limit: notify_on_limit || false,
            is_active: true
        })
        .select()
        .single();

    if (error) {
        console.error('Create voucher error:', error);
        return errorResponse(res, 'Failed to create voucher', 500);
    }

    return successResponse(res, { voucher });
}

// Update voucher
async function updateVoucher(req: VercelRequest, res: VercelResponse, user: any) {
    const { id } = req.query;
    const {
        name,
        description,
        type,
        discount_percentage,
        discount_fixed,
        usage_limit,
        notify_on_limit,
        is_active
    } = req.body;

    if (!id) {
        return errorResponse(res, 'Missing voucher ID', 400);
    }

    const supabase = getSupabaseServiceClient();

    // Check if voucher exists and belongs to tenant
    const { data: existing, error: checkError } = await supabase
        .from('vouchers')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', user.tenant_id)
        .single();

    if (checkError || !existing) {
        return errorResponse(res, 'Voucher not found', 404);
    }

    // Cannot change type or discount value if already used
    if (existing.current_usage > 0 && (type || discount_percentage || discount_fixed)) {
        return errorResponse(res, 'Cannot change voucher configuration after usage', 400);
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (usage_limit !== undefined) updateData.usage_limit = usage_limit;
    if (notify_on_limit !== undefined) updateData.notify_on_limit = notify_on_limit;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: voucher, error } = await supabase
        .from('vouchers')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', user.tenant_id)
        .select()
        .single();

    if (error) {
        console.error('Update voucher error:', error);
        return errorResponse(res, 'Failed to update voucher', 500);
    }

    return successResponse(res, { voucher });
}

// Delete voucher
async function deleteVoucher(req: VercelRequest, res: VercelResponse, user: any) {
    const { id } = req.query;

    if (!id) {
        return errorResponse(res, 'Missing voucher ID', 400);
    }

    const supabase = getSupabaseServiceClient();

    // Check if voucher has any usage
    const { data: existing, error: checkError } = await supabase
        .from('vouchers')
        .select('current_usage')
        .eq('id', id)
        .eq('tenant_id', user.tenant_id)
        .single();

    if (checkError || !existing) {
        return errorResponse(res, 'Voucher not found', 404);
    }

    if (existing.current_usage > 0) {
        // Soft delete - just deactivate
        await supabase
            .from('vouchers')
            .update({ is_active: false })
            .eq('id', id)
            .eq('tenant_id', user.tenant_id);

        return successResponse(res, { message: 'Voucher deactivated (has usage history)' });
    }

    // Hard delete - no usage
    const { error } = await supabase
        .from('vouchers')
        .delete()
        .eq('id', id)
        .eq('tenant_id', user.tenant_id);

    if (error) {
        console.error('Delete voucher error:', error);
        return errorResponse(res, 'Failed to delete voucher', 500);
    }

    return successResponse(res, { message: 'Voucher deleted successfully' });
}

// Generate voucher code for customer
async function generateVoucherUsage(req: VercelRequest, res: VercelResponse, user: any) {
    try {
        let body: any = req.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch {
                body = {};
            }
        }
        body = body && typeof body === 'object' ? body : {};
        const {
            voucher_id,
            customer_email,
            customer_name,
            customer_phone,
            survey_response_id
        } = body;

        console.log('🎟️ Generating voucher for:', { voucher_id, survey_response_id });

        if (!voucher_id) {
            return errorResponse(res, 'Missing voucher_id', 400);
        }

        const supabase = getSupabaseServiceClient();

        // Get voucher
        const { data: voucher, error: voucherError } = await supabase
            .from('vouchers')
            .select('*')
            .eq('id', voucher_id)
            .eq('is_active', true)
            .single();

        if (voucherError) {
            console.error('❌ Error fetching voucher:', voucherError);
            return errorResponse(res, 'Voucher fetch error: ' + voucherError.message, 500);
        }

        if (!voucher) {
            return errorResponse(res, 'Voucher not found or inactive', 404);
        }

        // Check usage limit
        if (voucher.usage_limit && voucher.current_usage >= voucher.usage_limit) {
            if (voucher.notify_on_limit) {
                console.log('Voucher limit reached:', voucher.id);
            }
            return errorResponse(res, 'Voucher usage limit reached', 403);
        }

        // Generate unique code
        const code = generateVoucherCode();
        const expirationDays = typeof voucher.expiration_days === 'number' ? voucher.expiration_days : null;
        const expirationDate = expirationDays && expirationDays > 0
            ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            : null;

        // Prepare insert payload
        const insertPayload = {
            tenant_id: voucher.tenant_id,
            voucher_id,
            survey_response_id: survey_response_id || null, // Ensure null if undefined
            customer_email: customer_email || null,
            customer_name: customer_name || null,
            customer_phone: customer_phone || null,
            generated_code: code,
            redeemed: false,
            expiration_date: expirationDate || null
        };

        console.log('📝 Inserting usage:', insertPayload);

        // Create voucher usage
        const { data: voucherUsage, error: usageError } = await supabase
            .from('voucher_usage')
            .insert(insertPayload)
            .select()
            .single();

        if (usageError) {
            console.error('❌ Create voucher usage error:', usageError);
            // Return detailed error for debugging
            return errorResponse(res, 'DB Insert Error: ' + usageError.message + ' | Details: ' + usageError.details, 500);
        }

        // Increment voucher usage count
        await supabase
            .from('vouchers')
            .update({ current_usage: voucher.current_usage + 1 })
            .eq('id', voucher_id);

        return successResponse(res, {
            voucher_usage: {
                ...voucherUsage,
                generated_code: voucherUsage?.generated_code,
                expiration_date: voucherUsage?.expiration_date
            },
            voucher: {
                ...voucher,
                current_usage: voucher.current_usage + 1
            }
        });
    } catch (e: any) {
        console.error('🔥 CRITICAL ERROR in generateVoucherUsage:', e);
        return errorResponse(res, 'Critical Handler Error: ' + e.message, 500);
    }
}

// Redeem voucher
async function redeemVoucher(req: VercelRequest, res: VercelResponse, user: any) {
    const { code } = req.body;

    if (!code) {
        return errorResponse(res, 'Missing voucher code', 400);
    }

    const supabase = getSupabaseServiceClient();

    // Find voucher usage
    const { data: voucherUsage, error: findError } = await supabase
        .from('voucher_usage')
        .select('*, vouchers(*)')
        .eq('generated_code', code)
        .eq('tenant_id', user.tenant_id)
        .single();

    if (findError || !voucherUsage) {
        return errorResponse(res, 'Invalid voucher code', 404);
    }

    if (voucherUsage.redeemed) {
        return errorResponse(res, 'Voucher already redeemed', 400);
    }

    // Mark as redeemed
    const { data: updated, error: redeemError } = await supabase
        .from('voucher_usage')
        .update({
            redeemed: true,
            redeemed_at: new Date().toISOString(),
            redeemed_by: user.email
        })
        .eq('id', voucherUsage.id)
        .select()
        .single();

    if (redeemError) {
        console.error('Redeem voucher error:', redeemError);
        return errorResponse(res, 'Failed to redeem voucher', 500);
    }

    return successResponse(res, {
        voucher_usage: updated,
        voucher: voucherUsage.vouchers
    });
}

// List voucher usage
async function listVoucherUsage(req: VercelRequest, res: VercelResponse, user: any) {
    const { voucher_id, redeemed } = req.query;

    const supabase = getSupabaseServiceClient();

    let query = supabase
        .from('voucher_usage')
        .select('*, vouchers(name, type, discount_percentage, discount_fixed)')
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: false });

    if (voucher_id) {
        query = query.eq('voucher_id', voucher_id);
    }

    if (redeemed !== undefined) {
        query = query.eq('redeemed', redeemed === 'true');
    }

    const { data: usage, error } = await query;

    if (error) {
        console.error('List voucher usage error:', error);
        return errorResponse(res, 'Failed to fetch voucher usage', 500);
    }

    return successResponse(res, { usage });
}
