import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/auth.js', () => {
  return {
    authenticateUser: vi.fn().mockResolvedValue({
      id: 'ab9c8427-5719-4025-8fba-2fa482936912',
      tenant_id: '0232e592-514c-4455-9f58-6c1861645518',
      access_token: 'token',
      email: 'extrrr@hotmail.com',
    }),
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

let templateInserts: any[] = [];
let templateAttempt = 0;
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

describe('handlers/surveys create-template', () => {
  beforeEach(() => {
    templateInserts = [];
    templateAttempt = 0;
    vi.resetModules();
  });

  it('usa created_by=user.id e faz fallback de is_active para active', async () => {
    const templateChain: any = {
      insert: vi.fn((payload: any) => {
        templateInserts.push({ ...payload });
        return templateChain;
      }),
      select: vi.fn(() => templateChain),
      single: vi.fn(async () => {
        templateAttempt++;
        if (templateAttempt === 1) {
          return {
            data: null,
            error: {
              code: 'PGRST204',
              message: "Could not find the 'is_active' column of 'survey_templates' in the schema cache",
              details: null,
            },
          };
        }
        return { data: { id: 't1' }, error: null };
      }),
    };

    const consumptionChain: any = {
      select: vi.fn(() => consumptionChain),
      eq: vi.fn(() => consumptionChain),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      insert: vi.fn(async () => ({ data: null, error: null })),
      update: vi.fn(() => consumptionChain),
    };

    from = vi.fn((table: string) => {
      if (table === 'survey_templates') return templateChain;
      if (table === 'consumption') return consumptionChain;
      return templateChain;
    });

    const mod = await import('./surveys');
    const handler = mod.default;

    const req: any = {
      method: 'POST',
      query: { action: 'create-template' },
      body: { name: 'Teste', is_active: true },
      headers: { authorization: 'Bearer token' },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(templateInserts.length).toBe(2);

    expect(templateInserts[0]).toEqual(expect.objectContaining({ is_active: true, created_by: 'ab9c8427-5719-4025-8fba-2fa482936912' }));
    expect(templateInserts[1]).toEqual(expect.objectContaining({ active: true, created_by: 'ab9c8427-5719-4025-8fba-2fa482936912' }));
    expect(templateInserts[1].is_active).toBeUndefined();
  });
});

describe('handlers/surveys create-response', () => {
  beforeEach(() => {
    templateInserts = [];
    templateAttempt = 0;
    vi.resetModules();
  });

  it('faz fallback quando attachments_token não existe no schema cache', async () => {
    const responseInserts: any[] = [];
    let responseAttempt = 0;

    const surveyResponsesChain: any = {
      insert: vi.fn((payload: any) => {
        responseInserts.push({ ...payload });
        return surveyResponsesChain;
      }),
      select: vi.fn(() => surveyResponsesChain),
      single: vi.fn(async () => {
        responseAttempt++;
        if (responseAttempt === 1) {
          return {
            data: null,
            error: {
              code: 'PGRST204',
              message: "Could not find the 'attachments_token' column of 'survey_responses' in the schema cache",
              details: null,
            },
          };
        }
        return { data: { id: 'r1' }, error: null };
      }),
    };

    const consumptionChain: any = {
      select: vi.fn(() => consumptionChain),
      eq: vi.fn(() => consumptionChain),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      insert: vi.fn(async () => ({ data: null, error: null })),
      update: vi.fn(() => consumptionChain),
    };

    from = vi.fn((table: string) => {
      if (table === 'survey_responses') return surveyResponsesChain;
      if (table === 'consumption') return consumptionChain;
      return surveyResponsesChain;
    });

    const mod = await import('./surveys');
    const handler = mod.default;

    const req: any = {
      method: 'POST',
      query: { action: 'create-response' },
      body: {
        tenant_id: '0232e592-514c-4455-9f58-6c1861645518',
        template_id: null,
        is_anonymous: true,
        overall_rating: 5,
        source: 'qrcode',
      },
      headers: {},
    };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(responseInserts.length).toBe(2);
    expect(responseInserts[0].attachments_token).toBeTypeOf('string');
    expect(responseInserts[1].attachments_token).toBeUndefined();

    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.response.id).toBe('r1');
    expect(payload.response.attachments_token).toBe(null);
  });
});
