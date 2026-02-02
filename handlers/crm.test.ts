import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/auth.js', () => {
  return {
    authenticateUser: vi.fn().mockResolvedValue({
      tenant_id: '00000000-0000-0000-0000-000000000000',
      access_token: 'token',
      email: 'user@example.com',
    }),
  };
});

function buildSupabaseUpdateResult(result: any) {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

vi.mock('../lib/supabase.js', () => {
  const chain = buildSupabaseUpdateResult({ data: { id: 'task1', status: 'completed' }, error: null });
  return {
    hasSupabaseServiceRoleKey: vi.fn(() => true),
    getSupabaseServiceClient: vi.fn(() => ({
      from: vi.fn(() => chain),
    })),
    getSupabaseAuthedClient: vi.fn(() => ({
      from: vi.fn(() => chain),
    })),
  };
});

import handler from './crm';

function createRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.setHeader = vi.fn(() => res);
  res.end = vi.fn(() => res);
  return res;
}

describe('handlers/crm update-task', () => {
  it('atualiza tarefa e retorna success', async () => {
    const req: any = {
      method: 'POST',
      query: { action: 'update-task' },
      body: { task_id: 'task1', updates: { status: 'completed' } },
      headers: {},
    };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('retorna 405 quando method não é POST', async () => {
    const req: any = {
      method: 'GET',
      query: { action: 'update-task' },
      headers: {},
    };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });
});

