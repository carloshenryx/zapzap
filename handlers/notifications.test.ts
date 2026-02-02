import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/auth.js', () => {
  return {
    authenticateUser: vi.fn(),
  };
});

let from: any = () => {
  throw new Error('from not initialized');
};

vi.mock('../lib/supabase.js', () => {
  return {
    hasSupabaseServiceRoleKey: vi.fn(() => true),
    getSupabaseServiceClient: vi.fn(() => ({ from: (...args: any[]) => from(...args) })),
    getSupabaseAuthedClient: vi.fn(() => ({ from: (...args: any[]) => from(...args) })),
  };
});

function createRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.setHeader = vi.fn(() => res);
  res.end = vi.fn(() => res);
  return res;
}

describe('handlers/notifications', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('bloqueia list para não super admin', async () => {
    const auth = await import('../lib/auth.js');
    vi.mocked(auth.authenticateUser).mockResolvedValue({
      id: 'u1',
      email: 'u1@test.com',
      access_token: 'token',
      is_super_admin: false,
    });

    from = vi.fn();

    const mod = await import('./notifications');
    const handler = mod.default;

    const req: any = {
      method: 'GET',
      query: { action: 'list' },
      headers: { authorization: 'Bearer token' },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('active retorna videos/notices filtrando por período', async () => {
    const auth = await import('../lib/auth.js');
    vi.mocked(auth.authenticateUser).mockResolvedValue({
      id: 'u1',
      email: 'u1@test.com',
      access_token: 'token',
      is_super_admin: false,
    });

    const now = Date.now();
    const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const tomorrow = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    const past = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    let orderCalls = 0;
    const notificationsChain: any = {
      select: vi.fn(() => notificationsChain),
      eq: vi.fn(() => notificationsChain),
      order: vi.fn(() => {
        orderCalls++;
        if (orderCalls < 2) return notificationsChain;
        return Promise.resolve({
          data: [
            { id: 'n1', title: 'Vídeo', youtube_url: 'https://www.youtube.com/watch?v=abc', start_date: yesterday, end_date: tomorrow, active: true, priority: 10, type: 'youtube' },
            { id: 'n2', title: 'Aviso expirado', youtube_url: null, start_date: past, end_date: past, active: true, priority: 5, type: 'maintenance' },
            { id: 'n3', title: 'Aviso ativo', youtube_url: null, start_date: yesterday, end_date: tomorrow, active: true, priority: 1, type: 'informative' },
          ],
          error: null,
        });
      }),
    };

    const prefsChain: any = {
      select: vi.fn(() => prefsChain),
      eq: vi.fn(() => prefsChain),
      maybeSingle: vi.fn(async () => ({
        data: { user_id: 'u1', last_seen_date: null, dismissed_until_date: null },
        error: null,
      })),
    };

    from = vi.fn((table: string) => {
      if (table === 'system_notifications') return notificationsChain;
      if (table === 'user_system_notification_preferences') return prefsChain;
      return notificationsChain;
    });

    const mod = await import('./notifications');
    const handler = mod.default;

    const req: any = {
      method: 'GET',
      query: { action: 'active' },
      headers: { authorization: 'Bearer token' },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.videos.length).toBe(1);
    expect(payload.notices.length).toBe(1);
  });
});
