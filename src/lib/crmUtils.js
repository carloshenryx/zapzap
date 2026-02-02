export function groupResponsesByCustomer(responses) {
  const customerMap = new Map();

  for (const response of responses || []) {
    const key = response?.customer_email || response?.customer_phone || 'anonymous';
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        key,
        name: response?.customer_name || 'Cliente Anônimo',
        email: response?.customer_email || null,
        phone: response?.customer_phone || null,
        cpf: response?.customer_cpf || null,
        responses: [],
      });
    }
    customerMap.get(key).responses.push(response);
  }

  return Array.from(customerMap.values());
}

export function buildUnifiedTimeline({
  responses = [],
  tasks = [],
  whatsappMessages = [],
  customerNotes = [],
  movements = [],
  treatments = [],
  voucherUsages = [],
} = {}) {
  const items = [
    ...responses.map(r => ({ ...r, type: 'survey_response', date: r.created_at || r.created_date })),
    ...tasks.map(t => ({ ...t, type: t.task_type === 'internal_note' ? 'internal_note' : 'task', date: t.created_at || t.created_date })),
    ...whatsappMessages.map(m => ({ ...m, type: 'whatsapp_message', date: m.created_at || m.created_date })),
    ...customerNotes.map(n => ({ ...n, type: 'customer_note', date: n.created_at })),
    ...movements.map(m => ({ ...m, type: 'movement', date: m.created_at })),
    ...treatments.map(t => ({ ...t, type: 'treatment', date: t.created_at || t.started_at })),
    ...voucherUsages.map(v => ({ ...v, type: 'voucher', date: v.created_at })),
  ].filter(i => !!i.date);

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

