import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Star, TrendingDown, TrendingUp, ExternalLink, User, Phone, Mail, MessageCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import LiveResponsesPanel from '@/components/dashboard/LiveResponsesPanel';
import { perfMark, perfMeasure } from '@/lib/perf';

const periods = [
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mês' },
];

function formatDateLabel(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

function ratingBadge(rating) {
  if (rating <= 0) return { className: 'bg-red-200 text-red-900', label: 'Muito ruim' };
  if (rating >= 5) return { className: 'bg-green-200 text-green-900', label: 'Excelente' };
  if (rating >= 4) return { className: 'bg-green-100 text-green-800', label: 'Boa' };
  if (rating <= 2) return { className: 'bg-red-100 text-red-800', label: 'Ruim' };
  return { className: 'bg-yellow-100 text-yellow-800', label: 'Neutra' };
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

export default function ExecutiveDashboard({ tenantId, templates = [] }) {
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [selectedTemplate, setSelectedTemplate] = useState('all');
  const [selectedLowRating, setSelectedLowRating] = useState(null);
  const [followupStatus, setFollowupStatus] = useState('open');
  const [followupNote, setFollowupNote] = useState('');
  const queryClient = useQueryClient();
  const measured = useRef(false);

  const activeTemplateId = useMemo(() => {
    const active = (templates || []).filter(t => t?.is_active && t?.id);
    if (active.length === 0) return null;
    const sorted = [...active].sort((a, b) => {
      const da = new Date(a.created_at || a.created_date || 0).getTime();
      const db = new Date(b.created_at || b.created_date || 0).getTime();
      return db - da;
    });
    return sorted[0]?.id || null;
  }, [templates]);

  useEffect(() => {
    if (activeTemplateId && selectedTemplate === 'all') {
      setSelectedTemplate(activeTemplateId);
    }
  }, [activeTemplateId, selectedTemplate]);

  const templateOptions = useMemo(() => {
    const opts = [{ id: 'all', name: 'Todos os modelos' }];
    for (const t of templates) {
      if (t?.id && t?.name) opts.push({ id: t.id, name: t.name });
    }
    return opts;
  }, [templates]);

  const { data, isLoading } = useQuery({
    queryKey: ['survey-executive', tenantId, selectedPeriod, selectedTemplate],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'survey-executive',
        period: selectedPeriod,
        template_id: selectedTemplate,
        bad_threshold: '2',
        good_threshold: '4',
        low_ratings_limit: '30',
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
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!tenantId) return;
    if (measured.current) return;
    if (isLoading) return;
    if (!data) return;
    measured.current = true;
    const endMark = 'dashboard_exec_ready';
    perfMark(endMark);
    let routeStart = null;
    try {
      routeStart = sessionStorage.getItem('last_route_mark');
    } catch (_) {}
    if (routeStart) perfMeasure({ name: 'route_to_dashboard_exec_ready', startMark: routeStart, endMark });
    perfMeasure({ name: 'dashboard_simple_render_to_exec_ready', startMark: 'dashboard_simple_render', endMark });
  }, [tenantId, isLoading, data]);

  const kpis = data?.kpis;
  const trend = data?.trend || [];
  const lowRatings = data?.low_ratings || [];
  const followupMutation = useMutation({
    mutationFn: async ({ responseId, status, note }) => {
      return fetchAPI('/surveys?action=update-followup', {
        method: 'POST',
        body: JSON.stringify({
          response_id: responseId,
          followup_status: status,
          followup_note: note,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-executive', tenantId] });
    },
    onError: (err) => {
      toast.error(err?.message || 'Erro ao salvar tratativa');
    },
  });

  const trendChartData = useMemo(() => {
    return trend.map(d => ({
      date: formatDateLabel(d.date),
      good: d.good,
      neutral: d.neutral,
      bad: d.bad,
      avg: d.avg_rating,
      total: d.total,
    }));
  }, [trend]);

  const headerSubtitle = useMemo(() => {
    if (!data?.range?.start || !data?.range?.end) return '';
    const start = new Date(data.range.start);
    const end = new Date(data.range.end);
    const fmt = (dt) => dt.toLocaleDateString('pt-BR');
    return `${fmt(start)} – ${fmt(end)}`;
  }, [data]);

  return (
    <div className="bg-[#f7f7f8] min-h-screen">
      <div className="p-6">
        <div className="w-full grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-[#e7e7ee] p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-3xl font-bold text-[#121217]">Painel Executivo</h1>
                  <p className="text-sm text-[#6c6c89] mt-2">
                    {headerSubtitle || 'Visão rápida com foco em resultado e tratativa'}
                  </p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <div className="flex bg-[#f2f2f6] rounded-xl p-1">
                    {periods.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPeriod(p.id)}
                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${selectedPeriod === p.id ? 'bg-white shadow text-[#121217]' : 'text-[#6c6c89] hover:text-[#121217]'}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="h-10 rounded-xl border border-[#d1d1db] bg-white px-3 text-sm text-[#121217]"
                  >
                    {templateOptions.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-[#e7e7ee] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#6c6c89]">Avaliação média</p>
                    <div className="flex items-baseline gap-2 mt-2">
                      <p className="text-3xl font-bold text-[#121217]">{kpis ? kpis.avg_rating : '-'}</p>
                      <p className="text-sm text-[#6c6c89]">/ 5</p>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center">
                    <Star className="w-6 h-6 text-yellow-500" />
                  </div>
                </div>
                <p className="text-xs text-[#6c6c89] mt-3">Base: {kpis ? kpis.total_responses : '-'} respostas</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#e7e7ee] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#6c6c89]">Boas (≥4)</p>
                    <p className="text-3xl font-bold text-[#121217] mt-2">{kpis ? kpis.good_count : '-'}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#e7e7ee] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#6c6c89]">Ruins (≤2)</p>
                    <p className="text-3xl font-bold text-[#121217] mt-2">{kpis ? kpis.bad_count : '-'}</p>
                  </div>
                  <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  </div>
                </div>
                <p className="text-xs text-[#6c6c89] mt-3">Identificados: {kpis ? kpis.bad_identified_count : '-'}</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#e7e7ee] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#6c6c89]">Redirecionados Google</p>
                    <p className="text-3xl font-bold text-[#121217] mt-2">{kpis ? kpis.google_redirect_count : '-'}</p>
                  </div>
                  <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <ExternalLink className="w-6 h-6 text-indigo-600" />
                  </div>
                </div>
                <p className="text-xs text-[#6c6c89] mt-3">Baseado em eventos registrados</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#e7e7ee] p-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#121217]">Tendência</h2>
                  <p className="text-sm text-[#6c6c89]">Boas vs neutras vs ruins + média diária</p>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-green-100 text-green-800">Boas</Badge>
                  <Badge className="bg-yellow-100 text-yellow-800">Neutras</Badge>
                  <Badge className="bg-red-100 text-red-800">Ruins</Badge>
                </div>
              </div>

              <div className="h-[260px] mt-4">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center text-sm text-[#6c6c89]">Carregando…</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="bad" stackId="a" fill="#ef4444" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="neutral" stackId="a" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="good" stackId="a" fill="#22c55e" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="h-[200px] mt-6">
                {isLoading ? null : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} domain={[0, 5]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="avg" stroke="#5423e7" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#e7e7ee] p-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#121217]">Clientes que avaliaram ruim</h2>
                  <p className="text-sm text-[#6c6c89]">Prioridade para tratativa</p>
                </div>
                <Badge className="bg-red-50 text-red-800 border border-red-100">≤ 2 estrelas</Badge>
              </div>

              <div className="mt-4 space-y-3">
                {isLoading ? (
                  <div className="text-sm text-[#6c6c89]">Carregando…</div>
                ) : lowRatings.length === 0 ? (
                  <div className="text-sm text-[#6c6c89]">Nenhuma avaliação ruim no período.</div>
                ) : (
                  lowRatings.map(r => {
                    const badge = ratingBadge(r.overall_rating || 0);
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          setSelectedLowRating(r);
                          setFollowupStatus(r.followup_status || 'open');
                          setFollowupNote(r.followup_note || '');
                        }}
                        className="w-full text-left rounded-xl border border-[#e7e7ee] p-4 hover:bg-[#fafafa] transition"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={badge.className}>{badge.label}</Badge>
                              {r.followup_status && (
                                <Badge className="bg-[#f2f2f6] text-[#121217] border border-[#e7e7ee]">
                                  {r.followup_status === 'open' ? 'Aberto' :
                                    r.followup_status === 'in_progress' ? 'Em andamento' :
                                      r.followup_status === 'resolved' ? 'Resolvido' :
                                        r.followup_status === 'ignored' ? 'Ignorado' :
                                          r.followup_status}
                                </Badge>
                              )}
                              <span className="text-sm font-semibold text-[#121217] truncate">
                                {r.customer_name || (r.is_anonymous ? 'Anônimo' : 'Cliente')}
                              </span>
                              <span className="text-xs text-[#6c6c89]">
                                {new Date(r.created_at).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            {r.comment && (
                              <p className="text-sm text-[#121217] mt-2 line-clamp-2">
                                <MessageCircle className="w-4 h-4 inline mr-2 text-[#6c6c89]" />
                                {r.comment}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold text-[#121217]">{r.overall_rating ?? 0}</div>
                            <div className="text-xs text-[#6c6c89]">/5</div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <Dialog open={!!selectedLowRating} onOpenChange={() => setSelectedLowRating(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Detalhe da Avaliação</DialogTitle>
                </DialogHeader>
                {selectedLowRating && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge className={ratingBadge(selectedLowRating.overall_rating || 0).className}>
                        {ratingBadge(selectedLowRating.overall_rating || 0).label}
                      </Badge>
                      <span className="text-sm text-[#6c6c89]">
                        {new Date(selectedLowRating.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-[#e7e7ee] p-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-[#121217]">
                          <User className="w-4 h-4" /> Nome
                        </div>
                        <p className="text-sm text-[#6c6c89] mt-1 break-words">
                          {selectedLowRating.customer_name || (selectedLowRating.is_anonymous ? 'Anônimo' : '-')}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#e7e7ee] p-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-[#121217]">
                          <Phone className="w-4 h-4" /> Telefone
                        </div>
                        <p className="text-sm text-[#6c6c89] mt-1 break-words">
                          {selectedLowRating.customer_phone || '-'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#e7e7ee] p-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-[#121217]">
                          <Mail className="w-4 h-4" /> Email
                        </div>
                        <p className="text-sm text-[#6c6c89] mt-1 break-words">
                          {selectedLowRating.customer_email || '-'}
                        </p>
                      </div>
                    </div>

                    {selectedLowRating.comment && (
                      <div className="rounded-xl border border-[#e7e7ee] p-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-[#121217]">
                          <MessageCircle className="w-4 h-4" /> Comentário
                        </div>
                        <p className="text-sm text-[#121217] mt-2 whitespace-pre-wrap">
                          {selectedLowRating.comment}
                        </p>
                      </div>
                    )}

                    <div className="rounded-xl border border-[#e7e7ee] p-4 space-y-3">
                      <div className="text-sm font-medium text-[#121217]">Tratativa</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <div className="text-xs text-[#6c6c89]">Status</div>
                          <Select
                            value={followupStatus}
                            onValueChange={(v) => setFollowupStatus(v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Aberto</SelectItem>
                              <SelectItem value="in_progress">Em andamento</SelectItem>
                              <SelectItem value="resolved">Resolvido</SelectItem>
                              <SelectItem value="ignored">Ignorado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs text-[#6c6c89]">Observação</div>
                          <Textarea
                            value={followupNote}
                            onChange={(e) => setFollowupNote(e.target.value)}
                            placeholder="Ex.: Já entrou em contato pelo WhatsApp"
                            className="min-h-[90px]"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          disabled={followupMutation.isPending}
                          onClick={async () => {
                            await followupMutation.mutateAsync({
                              responseId: selectedLowRating.id,
                              status: followupStatus,
                              note: followupNote,
                            });
                          }}
                        >
                          Salvar tratativa
                        </Button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {selectedLowRating.customer_phone && (
                        <Button
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => window.open(`https://wa.me/${String(selectedLowRating.customer_phone).replace(/\D/g, '')}`, '_blank')}
                        >
                          WhatsApp
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => setSelectedLowRating(null)}>
                        Fechar
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-6">
            <LiveResponsesPanel tenantId={tenantId} templateId={selectedTemplate} />
          </div>
        </div>
      </div>
    </div>
  );
}
