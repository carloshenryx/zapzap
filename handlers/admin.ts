import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUser } from '../lib/auth.js';
import { getSupabaseAuthedClient, getSupabaseServiceClient, hasSupabaseServiceRoleKey } from '../lib/supabase.js';
import { errorResponse, successResponse } from '../lib/response.js';

function parseBody(req: VercelRequest) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function requireServiceRole(res: VercelResponse) {
  if (!hasSupabaseServiceRoleKey()) {
    errorResponse(res, 'Admin operation requires SUPABASE_SERVICE_ROLE_KEY', 501);
    return null;
  }
  return getSupabaseServiceClient();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string;

  switch (action) {
    case 'list-users':
      return await listUsers(req, res);
    case 'set-user-password':
      return await setUserPassword(req, res);
    case 'set-user-ban':
      return await setUserBan(req, res);
    case 'delete-user':
      return await deleteUser(req, res);
    case 'assign-user-tenant':
      return await assignUserTenant(req, res);
    case 'set-super-admin':
      return await setSuperAdmin(req, res);
    case 'list-tenant-users':
      return await listTenantUsers(req, res);
    default:
      return errorResponse(res, 'Invalid action', 400);
  }
}

async function listUsers(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await authenticateUser(req);
    if (!user.is_super_admin) return errorResponse(res, 'Forbidden: Super admin access required', 403);
    if (req.method !== 'GET') return errorResponse(res, 'Method not allowed', 405);

    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const perPage = Math.min(200, Math.max(1, Number(req.query.per_page || 50) || 50));

    const supabase = requireServiceRole(res);
    if (!supabase) return;

    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ page, perPage });
    if (usersError) return errorResponse(res, usersError.message || 'Failed to list users', 500);

    const authUsers = usersData?.users || [];
    const ids = authUsers.map((u: any) => u.id).filter(Boolean);

    let profiles: any[] = [];
    if (ids.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .in('id', ids);
      if (profilesError) {
        console.error('List user_profiles error:', profilesError);
      } else {
        profiles = profilesData || [];
      }
    }

    const profileById = new Map<string, any>();
    profiles.forEach((p: any) => profileById.set(p.id, p));

    const tenantIds = Array.from(new Set(profiles.map((p: any) => p.tenant_id).filter(Boolean)));
    let tenants: any[] = [];
    if (tenantIds.length > 0) {
      const { data: tenantsData, error: tenantsError } = await supabase.from('tenants').select('id, name').in('id', tenantIds);
      if (tenantsError) {
        console.error('List tenants for users error:', tenantsError);
      } else {
        tenants = tenantsData || [];
      }
    }
    const tenantNameById = new Map<string, string>();
    tenants.forEach((t: any) => tenantNameById.set(t.id, t.name));

    const users = authUsers.map((u: any) => {
      const p = profileById.get(u.id) || {};
      const emailFromProfile = p.email || p.user_email || null;
      return {
        id: u.id,
        email: u.email || emailFromProfile,
        created_at: u.created_at || null,
        last_sign_in_at: u.last_sign_in_at || null,
        banned_until: u.banned_until || null,
        tenant_id: p.tenant_id || null,
        tenant_name: p.tenant_id ? tenantNameById.get(p.tenant_id) || null : null,
        full_name: p.full_name || null,
        role: p.role || null,
        is_super_admin: !!(p.is_super_admin || u.app_metadata?.is_super_admin),
      };
    });

    const total = usersData && typeof usersData === 'object' && 'total' in usersData ? (usersData as any).total : null;
    return successResponse(res, { users, page, per_page: perPage, total });
  } catch (error: any) {
    console.error('List users error:', error);
    const status = String(error.message || '').toLowerCase().includes('unauthorized') ? 401 : 500;
    return errorResponse(res, error.message || 'Failed to list users', status);
  }
}

async function setUserPassword(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await authenticateUser(req);
    if (!user.is_super_admin) return errorResponse(res, 'Forbidden: Super admin access required', 403);
    if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);

    const body = parseBody(req);
    const user_id = String(body.user_id || '').trim();
    const password = String(body.password || '').trim();
    if (!user_id) return errorResponse(res, 'Missing required field: user_id', 400);
    if (!password || password.length < 8) return errorResponse(res, 'Password must be at least 8 characters', 400);

    const supabase = requireServiceRole(res);
    if (!supabase) return;

    const { error } = await supabase.auth.admin.updateUserById(user_id, { password });
    if (error) return errorResponse(res, error.message || 'Failed to update password', 500);

    return successResponse(res, { ok: true });
  } catch (error: any) {
    console.error('Set user password error:', error);
    const status = String(error.message || '').toLowerCase().includes('unauthorized') ? 401 : 500;
    return errorResponse(res, error.message || 'Failed to update password', status);
  }
}

async function setUserBan(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await authenticateUser(req);
    if (!user.is_super_admin) return errorResponse(res, 'Forbidden: Super admin access required', 403);
    if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);

    const body = parseBody(req);
    const user_id = String(body.user_id || '').trim();
    const banned = !!body.banned;
    if (!user_id) return errorResponse(res, 'Missing required field: user_id', 400);

    const supabase = requireServiceRole(res);
    if (!supabase) return;

    const ban_duration = banned ? '876000h' : 'none';
    const { error } = await supabase.auth.admin.updateUserById(user_id, { ban_duration } as any);
    if (error) return errorResponse(res, error.message || 'Failed to update user ban', 500);

    return successResponse(res, { ok: true, banned });
  } catch (error: any) {
    console.error('Set user ban error:', error);
    const status = String(error.message || '').toLowerCase().includes('unauthorized') ? 401 : 500;
    return errorResponse(res, error.message || 'Failed to update user ban', status);
  }
}

async function deleteUser(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await authenticateUser(req);
    if (!user.is_super_admin) return errorResponse(res, 'Forbidden: Super admin access required', 403);
    if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);

    const body = parseBody(req);
    const user_id = String(body.user_id || '').trim();
    if (!user_id) return errorResponse(res, 'Missing required field: user_id', 400);

    const supabase = requireServiceRole(res);
    if (!supabase) return;

    const { error: profileDeleteError } = await supabase.from('user_profiles').delete().eq('id', user_id);
    if (profileDeleteError) {
      console.error('Delete user_profiles error:', profileDeleteError);
    }

    const { error } = await supabase.auth.admin.deleteUser(user_id);
    if (error) return errorResponse(res, error.message || 'Failed to delete user', 500);

    return successResponse(res, { ok: true });
  } catch (error: any) {
    console.error('Delete user error:', error);
    const status = String(error.message || '').toLowerCase().includes('unauthorized') ? 401 : 500;
    return errorResponse(res, error.message || 'Failed to delete user', status);
  }
}

async function assignUserTenant(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await authenticateUser(req);
    if (!user.is_super_admin) return errorResponse(res, 'Forbidden: Super admin access required', 403);
    if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);

    const body = parseBody(req);
    const user_id = String(body.user_id || '').trim();
    const tenant_id = body.tenant_id ? String(body.tenant_id).trim() : null;
    const role = body.role ? String(body.role).trim() : null;
    if (!user_id) return errorResponse(res, 'Missing required field: user_id', 400);

    const admin = requireServiceRole(res);
    if (!admin) return;

    const { data: existingProfile, error: existingProfileError } = await admin
      .from('user_profiles')
      .select('*')
      .eq('id', user_id)
      .maybeSingle();

    if (existingProfileError) {
      console.error('Load user_profiles error:', existingProfileError);
    }

    let profile: any = null;
    if (existingProfile) {
      const updates: any = { tenant_id };
      if (role) updates.role = role;
      const { data: updated, error: updateError } = await admin
        .from('user_profiles')
        .update(updates)
        .eq('id', user_id)
        .select()
        .single();
      if (updateError) return errorResponse(res, updateError.message || 'Failed to update user profile', 500);
      profile = updated;
    } else {
      const { data: authUserData, error: authUserError } = await admin.auth.admin.getUserById(user_id);
      if (authUserError || !authUserData?.user) {
        return errorResponse(res, authUserError?.message || 'User not found in auth', 404);
      }

      const email = authUserData.user.email;
      if (!email) {
        return errorResponse(res, 'Cannot create user profile: missing auth email', 500);
      }

      const insert: any = { id: user_id, email, tenant_id };
      if (role) insert.role = role;

      const { data: inserted, error: insertError } = await admin
        .from('user_profiles')
        .insert(insert)
        .select()
        .single();
      if (insertError) return errorResponse(res, insertError.message || 'Failed to create user profile', 500);
      profile = inserted;
    }

    {
      const { data: existing, error: existingError } = await admin.auth.admin.getUserById(user_id);
      if (existingError) {
        console.error('Get auth user error:', existingError);
      } else {
        const meta = existing?.user?.app_metadata || {};
        const nextMeta: any = { ...meta };
        if (tenant_id) nextMeta.tenant_id = tenant_id;
        else delete nextMeta.tenant_id;
        const { error: updateMetaError } = await admin.auth.admin.updateUserById(user_id, { app_metadata: nextMeta });
        if (updateMetaError) console.error('Update app_metadata error:', updateMetaError);
      }
    }

    return successResponse(res, { profile });
  } catch (error: any) {
    console.error('Assign user tenant error:', error);
    const status = String(error.message || '').toLowerCase().includes('unauthorized') ? 401 : 500;
    return errorResponse(res, error.message || 'Failed to assign tenant', status);
  }
}

async function setSuperAdmin(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await authenticateUser(req);
    if (!user.is_super_admin) return errorResponse(res, 'Forbidden: Super admin access required', 403);
    if (req.method !== 'POST') return errorResponse(res, 'Method not allowed', 405);

    const body = parseBody(req);
    const user_id = String(body.user_id || '').trim();
    const is_super_admin = !!body.is_super_admin;
    if (!user_id) return errorResponse(res, 'Missing required field: user_id', 400);

    const admin = requireServiceRole(res);
    if (!admin) return;

    const { data: existingProfile, error: existingProfileError } = await admin
      .from('user_profiles')
      .select('*')
      .eq('id', user_id)
      .maybeSingle();

    if (existingProfileError) {
      console.error('Load user_profiles error:', existingProfileError);
    }

    let profile: any = null;
    if (existingProfile) {
      const { data: updated, error: updateError } = await admin
        .from('user_profiles')
        .update({ is_super_admin })
        .eq('id', user_id)
        .select()
        .single();
      if (updateError) return errorResponse(res, updateError.message || 'Failed to update super admin', 500);
      profile = updated;
    } else {
      const { data: authUserData, error: authUserError } = await admin.auth.admin.getUserById(user_id);
      if (authUserError || !authUserData?.user) {
        return errorResponse(res, authUserError?.message || 'User not found in auth', 404);
      }

      const email = authUserData.user.email;
      if (!email) {
        return errorResponse(res, 'Cannot create user profile: missing auth email', 500);
      }

      const { data: inserted, error: insertError } = await admin
        .from('user_profiles')
        .insert({ id: user_id, email, is_super_admin })
        .select()
        .single();
      if (insertError) return errorResponse(res, insertError.message || 'Failed to create user profile', 500);
      profile = inserted;
    }

    {
      const { data: existing, error: existingError } = await admin.auth.admin.getUserById(user_id);
      if (existingError) {
        console.error('Get auth user error:', existingError);
      } else {
        const meta = existing?.user?.app_metadata || {};
        const { error: updateMetaError } = await admin.auth.admin.updateUserById(user_id, {
          app_metadata: { ...meta, is_super_admin },
        });
        if (updateMetaError) console.error('Update app_metadata error:', updateMetaError);
      }
    }

    return successResponse(res, { profile });
  } catch (error: any) {
    console.error('Set super admin error:', error);
    const status = String(error.message || '').toLowerCase().includes('unauthorized') ? 401 : 500;
    return errorResponse(res, error.message || 'Failed to update super admin', status);
  }
}

async function listTenantUsers(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await authenticateUser(req);
    if (!user.is_super_admin) return errorResponse(res, 'Forbidden: Super admin access required', 403);
    if (req.method !== 'GET') return errorResponse(res, 'Method not allowed', 405);

    const tenant_id = String(req.query.tenant_id || '').trim();
    if (!tenant_id) return errorResponse(res, 'Missing required field: tenant_id', 400);

    const supabase = hasSupabaseServiceRoleKey()
      ? getSupabaseServiceClient()
      : getSupabaseAuthedClient(user.access_token);

    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('tenant_id', tenant_id);

    if (error) return errorResponse(res, error.message || 'Failed to list tenant users', 500);

    const normalized = (users || []).map((u: any) => ({
      ...u,
      email: u.email || null,
    }));

    return successResponse(res, { users: normalized });
  } catch (error: any) {
    console.error('List tenant users error:', error);
    const status = String(error.message || '').toLowerCase().includes('unauthorized') ? 401 : 500;
    return errorResponse(res, error.message || 'Failed to list tenant users', status);
  }
}
