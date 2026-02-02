import { describe, it, expect, vi } from 'vitest';

function createRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.setHeader = vi.fn(() => res);
  res.end = vi.fn(() => res);
  return res;
}

describe('handlers/vouchers generate', () => {
  it('retorna 400 quando voucher_id está ausente', async () => {
    const { default: handler } = await import('./vouchers');
    const req: any = {
      method: 'POST',
      query: { action: 'generate' },
      body: {},
      headers: {},
    };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('aceita body como string JSON e gera voucher', async () => {
    vi.resetModules();
    vi.doMock('../lib/supabase.js', () => {
      const voucherRow = {
        id: 'v1',
        tenant_id: 't1',
        is_active: true,
        usage_limit: null,
        notify_on_limit: false,
        current_usage: 0,
        expiration_days: 1,
      };

      const voucherUsageRow = {
        id: 'u1',
        generated_code: 'VOUCHER-TEST-ABC',
        expiration_date: '2026-01-01',
      };

      const vouchersChain: any = {
        select: vi.fn(() => vouchersChain),
        eq: vi.fn(() => vouchersChain),
        single: vi.fn(async () => ({ data: voucherRow, error: null })),
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: null, error: null })),
        })),
      };

      const usageChain: any = {
        insert: vi.fn(() => usageChain),
        select: vi.fn(() => usageChain),
        single: vi.fn(async () => ({ data: voucherUsageRow, error: null })),
      };

      const supabase = {
        from: vi.fn((table: string) => {
          if (table === 'vouchers') return vouchersChain;
          if (table === 'voucher_usage') return usageChain;
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: null })) })) })) };
        }),
      };

      return {
        getSupabaseServiceClient: vi.fn(() => supabase),
      };
    });

    const { default: handler } = await import('./vouchers');
    const req: any = {
      method: 'POST',
      query: { action: 'generate' },
      body: JSON.stringify({ voucher_id: 'v1', survey_response_id: 'r1' }),
      headers: {},
    };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      voucher_usage: expect.objectContaining({ generated_code: expect.any(String) }),
    }));
  });
});
