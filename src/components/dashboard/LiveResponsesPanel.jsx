import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, MessageCircle, Star } from 'lucide-react';
import { getScoreLabel5, getUnifiedScore5 } from '@/lib/ratingUtils';

const periods = [
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: '7 dias' },
  { id: 'month', label: 'Este mês' },
  { id: 'all', label: 'Tudo' },
];

function sourceLabel(source) {
  if (source === 'manual_whatsapp') return '📱 WhatsApp';
  if (source === 'webhook') return '🔗 Webhook';
  if (source === 'totem') return '🖥️ Totem';
  if (source === 'qrcode') return '📲 QR Code';
  if (source === 'clicktotem') return '👆 Click Totem';
  return source || '-';
}

function getLocalPeriodRange(period) {
  const now = new Date();

  if (period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { start, end: now };
  }

  if (period === 'week') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }

  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: now };
  }

  return { start: null, end: null };
}

export default function LiveResponsesPanel({ tenantId, templateId }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('today');

  const { data, isFetching } = useQuery({
    queryKey: ['survey-live-feed', tenantId, templateId, selectedPeriod],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'survey-live-feed',
        limit: '20',
        template_id: templateId || 'all',
        period: selectedPeriod,
      });

      const { start, end } = getLocalPeriodRange(selectedPeriod);
      if (start && end) {
        params.set('period', 'custom');
        params.set('start', start.toISOString());
        params.set('end', end.toISOString());
      }

      const qs = params.toString();
      return fetchAPI(`/analytics?${qs}`, { method: 'GET' });
    },
    enabled: !!tenantId,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  const feed = data?.feed || [];
  const newCount = useMemo(() => feed.length, [feed.length]);
  const periodLabel = useMemo(() => periods.find(p => p.id === selectedPeriod)?.label || 'Hoje', [selectedPeriod]);

  return (
    <div className="bg-white rounded-2xl border border-[#e7e7ee] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#121217]">Ao vivo</h3>
          <p className="text-sm text-[#6c6c89] mt-1">
            {/* Atualiza Automaticamente */}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="h-9 w-[140px] rounded-xl border border-[#e7e7ee] bg-white text-sm">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {periods.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge className="bg-[#f2f2f6] text-[#121217] border border-[#e7e7ee]">
            {newCount} ({periodLabel})
          </Badge>
          <Badge className={isFetching ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
            {isFetching ? 'Atualizando' : 'Online'}
          </Badge>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {feed.length === 0 ? (
          <div className="text-sm text-[#6c6c89]">Sem respostas recentes.</div>
        ) : (
          feed.map(r => (
            (() => {
              const score5 = getUnifiedScore5(r);
              const label = getScoreLabel5(score5);
              const displayScore = score5 === null ? '-' : (Number.isInteger(score5) ? String(score5) : score5.toFixed(1));

              return (
            <button
              key={r.id}
              className="w-full text-left rounded-xl border border-[#e7e7ee] p-4 hover:bg-[#fafafa] transition"
              onClick={() => {
                setSelected(r);
                setOpen(true);
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={label.className}>
                      <Star className="w-3 h-3 mr-1" />
                      {displayScore}
                    </Badge>
                    <Badge className={label.className}>{label.label}</Badge>
                    <span className="text-sm font-semibold text-[#121217] truncate">
                      {r.customer_name || (r.is_anonymous ? 'Anônimo' : 'Cliente')}
                    </span>
                    <span className="text-xs text-[#6c6c89] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {r.created_at ? new Date(r.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </span>
                    <span className="text-xs text-[#6c6c89]">
                      {sourceLabel(r.source)}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="text-sm text-[#121217] mt-2 line-clamp-2">
                      <MessageCircle className="w-4 h-4 inline mr-2 text-[#6c6c89]" />
                      {r.comment}
                    </p>
                  )}
                </div>
              </div>
            </button>
              );
            })()
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Resposta recente</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {(() => {
                  const score5 = getUnifiedScore5(selected);
                  const label = getScoreLabel5(score5);
                  const displayScore = score5 === null ? '-' : (Number.isInteger(score5) ? String(score5) : score5.toFixed(1));
                  return (
                    <>
                      <Badge className={label.className}>
                        {displayScore} / 5
                      </Badge>
                      <Badge className={label.className}>{label.label}</Badge>
                    </>
                  );
                })()}
                <span className="text-sm text-[#6c6c89]">
                  {selected.created_at ? new Date(selected.created_at).toLocaleString('pt-BR') : ''}
                </span>
              </div>
              {selected.comment && (
                <div className="rounded-xl border border-[#e7e7ee] p-4">
                  <div className="text-sm font-medium text-[#121217]">Comentário</div>
                  <div className="text-sm text-[#121217] mt-2 whitespace-pre-wrap">{selected.comment}</div>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
