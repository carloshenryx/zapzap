import { describe, it, expect } from 'vitest';
import { groupResponsesByCustomer, buildUnifiedTimeline } from './crmUtils';

describe('groupResponsesByCustomer', () => {
  it('agrupa respostas por email/telefone e mantém responses no grupo', () => {
    const responses = [
      { id: 1, customer_email: 'a@a.com', customer_name: 'A' },
      { id: 2, customer_email: 'a@a.com', customer_name: 'A' },
      { id: 3, customer_phone: '+5511999999999', customer_name: 'B' },
    ];

    const customers = groupResponsesByCustomer(responses);
    expect(customers).toHaveLength(2);

    const a = customers.find(c => c.email === 'a@a.com');
    expect(a.responses).toHaveLength(2);

    const b = customers.find(c => c.phone === '+5511999999999');
    expect(b.responses).toHaveLength(1);
  });
});

describe('buildUnifiedTimeline', () => {
  it('mescla itens e ordena por data desc', () => {
    const timeline = buildUnifiedTimeline({
      responses: [{ id: 'r1', created_at: '2026-01-01T10:00:00.000Z' }],
      tasks: [{ id: 't1', created_at: '2026-01-02T10:00:00.000Z', task_type: 'follow_up' }],
      customerNotes: [{ id: 'n1', created_at: '2026-01-03T10:00:00.000Z', content: 'x' }],
    });

    expect(timeline[0].id).toBe('n1');
    expect(timeline[0].type).toBe('customer_note');
    expect(timeline[1].id).toBe('t1');
    expect(timeline[2].id).toBe('r1');
  });
});

