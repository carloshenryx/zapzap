import { errorResponse } from './response.js';

function hasManageRole(user: any) {
  const role = String(user?.role || '').toLowerCase();
  return role === 'admin' || role === 'owner' || role === 'manager';
}

export async function requirePermission(res: any, user: any, permission: string) {
  if (!user) {
    errorResponse(res, 'Unauthorized', 401);
    return false;
  }

  if (user.is_super_admin) return true;

  const normalized = String(permission || '').toLowerCase();

  if (normalized.endsWith('.view')) return true;
  if (normalized.endsWith('.manage')) {
    const allowed = hasManageRole(user);
    if (!allowed) errorResponse(res, 'Forbidden', 403);
    return allowed;
  }

  return true;
}
