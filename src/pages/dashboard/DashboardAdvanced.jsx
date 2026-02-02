import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion } from 'framer-motion';
import {
  Star,
  MessageCircle,
  TrendingUp,
  CheckCircle2,
  Download,
  Send,
  ChevronRight,
  Sliders
} from 'lucide-react';
import { getUnifiedScore10, getUnifiedScore5 } from '@/lib/ratingUtils';
import SentimentAnalysis from '@/components/dashboard/SentimentAnalysis';
import KeywordExtraction from '@/components/dashboard/KeywordExtraction';
import QuestionBreakdown from '@/components/dashboard/QuestionBreakdown';
import MetricAlerts from '@/components/dashboard/MetricAlerts';
import AdvancedFilters from '@/components/dashboard/AdvancedFilters';
import CompletionRate from '@/components/dashboard/CompletionRate';
import QuestionDistribution from '@/components/dashboard/QuestionDistribution';
import NPSCSATTrend from '@/components/dashboard/NPSCSATTrend';
import VoucherFallbackAnalytics from '@/components/dashboard/VoucherFallbackAnalytics';
import PlanOverview from '@/components/plan/PlanOverview';
import DraggableCard from '@/components/dashboard/DraggableCard';
import PeriodFilter from '@/components/dashboard/PeriodFilter';
import ExportDialog from '@/components/dashboard/ExportDialog';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { perfMark, perfMeasure } from '@/lib/perf';

export default function DashboardAdvanced({ onSwitchToSimple, onSwitchToAdvanced }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('all');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [ratingFilter, setRatingFilter] = useState({ min: 0, max: 5 });
  const [npsSegmentFilter, setNpsSegmentFilter] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [cardOrder, setCardOrder] = useState(['kpis', 'charts', 'source', 'nps', 'plan', 'consumption', 'alerts', 'completion', 'questions', 'sentiment', 'keywords', 'breakdown', 'trend', 'voucher']);
  const [minimizedCards, setMinimizedCards] = useState([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const measured = useRef({ mount: false, responsesReady: false });

  const queryClient = useQueryClient();
  const { user, userProfile } = useAuth();

  useEffect(() => {
    if (measured.current.mount) return;
    measured.current.mount = true;
    const endMark = 'dashboard_advanced_mount';
    perfMark(endMark);
    let startMark = null;
    try {
      startMark = sessionStorage.getItem('last_route_mark');
    } catch (_) {}
    if (startMark) perfMeasure({ name: 'route_to_dashboard_advanced_mount', startMark, endMark });
  }, []);

  const { data: preferences } = useQuery({
    queryKey: ['dashboard-preferences', user?.email],
    queryFn: async () => {
      if (!user?.email || !userProfile?.tenant_id) return null;

      const { data } = await supabase
        .from('dashboard_preferences')
        .select('id, card_order, minimized_cards, period_filter, custom_date_range')
        .eq('user_email', user.email)
        .eq('tenant_id', userProfile.tenant_id)
        .maybeSingle();

      return data;
    },
    enabled: !!user?.email && !!userProfile?.tenant_id,
  });

  useEffect(() => {
    if (preferences) {
      if (preferences.card_order) setCardOrder(preferences.card_order);
      if (preferences.minimized_cards) setMinimizedCards(preferences.minimized_cards);
      if (preferences.period_filter) setSelectedPeriod(preferences.period_filter);
      if (preferences.custom_date_range) setCustomDateRange(preferences.custom_date_range);
    }
  }, [preferences]);

  const savePreferencesMutation = useMutation({
    mutationFn: async (updates) => {
      if (!user?.email || !userProfile?.tenant_id) {
        throw new Error('User or tenant not available');
      }

      if (!updates || typeof updates !== 'object') {
        throw new Error('Invalid updates object');
      }

      if (preferences?.id) {
        const { data, error } = await supabase
          .from('dashboard_preferences')
          .update(updates)
          .eq('id', preferences.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from('dashboard_preferences')
        .insert({
          user_email: user.email,
          tenant_id: userProfile.tenant_id,
          ...updates
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-preferences'] });
    }
  });

  const { data: allResponses = [], isSuccess: allResponsesReady } = useQuery({
    queryKey: ['survey-responses', userProfile?.tenant_id],
    queryFn: async () => {
      if (!userProfile?.tenant_id) return [];
      const { data } = await supabase
        .from('survey_responses')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .order('created_at', { ascending: false })
        .limit(1000);
      return data || [];
    },
    enabled: !!userProfile?.tenant_id,
  });

  useEffect(() => {
    if (!allResponsesReady) return;
    if (measured.current.responsesReady) return;
    measured.current.responsesReady = true;
    const endMark = 'dashboard_advanced_responses_ready';
    perfMark(endMark);
    let startMark = null;
    try {
      startMark = sessionStorage.getItem('last_route_mark');
    } catch (_) {}
    if (startMark) perfMeasure({ name: 'route_to_dashboard_advanced_responses_ready', startMark, endMark });
    perfMeasure({ name: 'dashboard_advanced_mount_to_responses_ready', startMark: 'dashboard_advanced_mount', endMark });
  }, [allResponsesReady]);

  const responses = useMemo(() => {
    if (!allResponses.length) return [];

    const now = new Date();
    let startDate = new Date(0);

    switch (selectedPeriod) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter': {
        const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterStartMonth, 1);
        break;
      }
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'custom':
        if (customDateRange.start) {
          startDate = new Date(customDateRange.start);
        }
        break;
      case 'all':
      default:
        return allResponses;
    }

    let endDate = now;
    if (selectedPeriod === 'custom' && customDateRange.end) {
      endDate = new Date(customDateRange.end);
      endDate.setHours(23, 59, 59, 999);
    }

    return allResponses.filter(r => {
      const raw = r.created_at || r.created_date;
      if (!raw) return false;
      const responseDate = new Date(raw);
      if (!Number.isFinite(responseDate.getTime())) return false;
      return responseDate >= startDate && responseDate <= endDate;
    });
  }, [allResponses, selectedPeriod, customDateRange]);

  const { data: consumption = [] } = useQuery({
    queryKey: ['consumption', userProfile?.tenant_id],
    queryFn: async () => {
      if (!userProfile?.tenant_id) return [];
      const { data } = await supabase
        .from('consumptions')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .order('created_at', { ascending: false })
        .limit(1);
      return data || [];
    },
    enabled: !!userProfile?.tenant_id,
  });

  const { data: subscription = [] } = useQuery({
    queryKey: ['subscription', userProfile?.tenant_id],
    queryFn: async () => {
      if (!userProfile?.tenant_id) return [];
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .order('created_date', { ascending: false })
        .limit(1);
      return data || [];
    },
    enabled: !!userProfile?.tenant_id,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['survey-templates-full', userProfile?.tenant_id],
    queryFn: async () => {
      if (!userProfile?.tenant_id) return [];
      const { data } = await supabase
        .from('survey_templates')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id);
      return data || [];
    },
    enabled: !!userProfile?.tenant_id,
  });

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(cardOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setCardOrder(items);
    savePreferencesMutation.mutate({ card_order: items });
  };

  const handleToggleMinimize = (cardId) => {
    const newMinimized = minimizedCards.includes(cardId)
      ? minimizedCards.filter(id => id !== cardId)
      : [...minimizedCards, cardId];

    setMinimizedCards(newMinimized);
    savePreferencesMutation.mutate({ minimized_cards: newMinimized });
  };

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    savePreferencesMutation.mutate({ period_filter: period });
  };

  const handleCustomDateChange = (range) => {
    setCustomDateRange(range);
    savePreferencesMutation.mutate({ custom_date_range: range });
  };

  function applyAdvancedFilters(items) {
    const isRatingFilterActive = ratingFilter.min !== 0 || ratingFilter.max !== 5;
    return items.filter(response => {
      if (selectedTemplate !== 'all') {
        if (response.template_id !== selectedTemplate) return false;
      }
      if (dateFilter.start) {
        const startDate = new Date(dateFilter.start);
        startDate.setHours(0, 0, 0, 0);
        const rawDate = response.created_at || response.created_date;
        if (!rawDate) return false;
        const responseDate = new Date(rawDate);
        if (!Number.isFinite(responseDate.getTime())) return false;
        if (responseDate < startDate) return false;
      }
      if (dateFilter.end) {
        const endDate = new Date(dateFilter.end);
        endDate.setHours(23, 59, 59, 999);
        const rawDate = response.created_at || response.created_date;
        if (!rawDate) return false;
        const responseDate = new Date(rawDate);
        if (!Number.isFinite(responseDate.getTime())) return false;
        if (responseDate > endDate) return false;
      }
      const score5 = getUnifiedScore5(response);
      if (isRatingFilterActive && score5 === null) return false;
      if (score5 !== null && (score5 < ratingFilter.min || score5 > ratingFilter.max)) return false;
      if (npsSegmentFilter !== 'all') {
        const score10 = getUnifiedScore10(response);
        if (score10 === null) return false;
        if (npsSegmentFilter === 'promoters' && score10 < 9) return false;
        if (npsSegmentFilter === 'passives' && (score10 < 7 || score10 > 8)) return false;
        if (npsSegmentFilter === 'detractors' && score10 > 6) return false;
      }
      return true;
    });
  }

  const filteredResponsesForMetrics = useMemo(() => {
    return applyAdvancedFilters(responses);
  }, [responses, selectedTemplate, dateFilter, ratingFilter, npsSegmentFilter, templates]);

  const {
    totalResponses,
    responsesWithRating,
    avgOverall,
    recommendRate,
    fiveStarCount,
    satisfactionData,
    promoters,
    passives,
    detractors,
    nps,
    detractorsPercent,
    promotersPercent,
    surveyCountBySource
  } = useMemo(() => {
    const total = filteredResponsesForMetrics.length;
    const withRating = filteredResponsesForMetrics.filter(r => getUnifiedScore10(r) !== null);

    const avg = withRating.length > 0
      ? (withRating.reduce((sum, r) => sum + (getUnifiedScore5(r) || 0), 0) / withRating.length).toFixed(1)
      : 0;

    const recommend = total > 0
      ? Math.round((filteredResponsesForMetrics.filter(r => r.would_recommend).length / total) * 100)
      : 0;

    const fiveStar = withRating.filter(r => (getUnifiedScore5(r) || 0) >= 4.5).length;

    const satData = [
      { name: '5 Estrelas', value: withRating.filter(r => (getUnifiedScore5(r) || 0) >= 4.5).length, color: '#10b981' },
      { name: '4 Estrelas', value: withRating.filter(r => {
        const s = getUnifiedScore5(r);
        return s !== null && s >= 3.5 && s < 4.5;
      }).length, color: '#3b82f6' },
      { name: '3 Estrelas', value: withRating.filter(r => {
        const s = getUnifiedScore5(r);
        return s !== null && s >= 2.5 && s < 3.5;
      }).length, color: '#f59e0b' },
      { name: '< 3 Estrelas', value: withRating.filter(r => {
        const s = getUnifiedScore5(r);
        return s !== null && s < 2.5;
      }).length, color: '#ef4444' }
    ].filter(d => d.value > 0);

    const prom = withRating.filter(r => (getUnifiedScore10(r) || 0) >= 9);
    const pass = withRating.filter(r => {
      const s = getUnifiedScore10(r);
      return s !== null && s >= 7 && s <= 8;
    });
    const det = withRating.filter(r => (getUnifiedScore10(r) || 0) <= 6);

    const npsScore = withRating.length > 0 ? Math.round(((prom.length - det.length) / withRating.length) * 100) : 0;
    const detPercent = withRating.length > 0 ? Math.round((det.length / withRating.length) * 100) : 0;
    const promPercent = withRating.length > 0 ? Math.round((prom.length / withRating.length) * 100) : 0;

    const countsBySource = {
      total: total,
      manual_whatsapp: filteredResponsesForMetrics.filter(r => r.source === 'manual_whatsapp').length,
      webhook: filteredResponsesForMetrics.filter(r => r.source === 'webhook').length,
      totem: filteredResponsesForMetrics.filter(r => r.source === 'totem').length,
      qrcode: filteredResponsesForMetrics.filter(r => r.source === 'qrcode').length,
      clicktotem: filteredResponsesForMetrics.filter(r => r.source === 'clicktotem').length
    };

    return {
      totalResponses: total,
      responsesWithRating: withRating,
      avgOverall: avg,
      recommendRate: recommend,
      fiveStarCount: fiveStar,
      satisfactionData: satData,
      promoters: prom,
      passives: pass,
      detractors: det,
      nps: npsScore,
      detractorsPercent: detPercent,
      promotersPercent: promPercent,
      surveyCountBySource: countsBySource
    };
  }, [filteredResponsesForMetrics]);

  const trendData = [
    { date: 'Seg', responses: 8, rating: 4.2 },
    { date: 'Ter', responses: 12, rating: 4.3 },
    { date: 'Qua', responses: 15, rating: 4.4 },
    { date: 'Qui', responses: 10, rating: 4.1 },
    { date: 'Sex', responses: 18, rating: 4.5 },
    { date: 'Sab', responses: 7, rating: 4.3 },
    { date: 'Dom', responses: 5, rating: 4.0 }
  ];

  const consumptionData = consumption[0];
  const subscriptionData = subscription[0];

  const manualWhatsAppResponses = useMemo(() => filteredResponsesForMetrics.filter(r => r.source === 'manual_whatsapp'), [filteredResponsesForMetrics]);
  const webhookResponses = useMemo(() => filteredResponsesForMetrics.filter(r => r.source === 'webhook'), [filteredResponsesForMetrics]);
  const totemResponses = useMemo(() => filteredResponsesForMetrics.filter(r => r.source === 'totem'), [filteredResponsesForMetrics]);
  const qrcodeResponses = useMemo(() => filteredResponsesForMetrics.filter(r => r.source === 'qrcode'), [filteredResponsesForMetrics]);
  const clickTotemResponses = useMemo(() => filteredResponsesForMetrics.filter(r => r.source === 'clicktotem'), [filteredResponsesForMetrics]);

  const resetFilters = () => {
    setSelectedTemplate('all');
    setDateFilter({ start: '', end: '' });
    setRatingFilter({ min: 0, max: 5 });
    setNpsSegmentFilter('all');
  };

  const getTabContent = () => {
    switch (activeTab) {
      case 'low-ratings': return detractors;
      case 'manual-whatsapp': return manualWhatsAppResponses;
      case 'webhook': return webhookResponses;
      case 'totem': return totemResponses;
      case 'qrcode': return qrcodeResponses;
      case 'clicktotem': return clickTotemResponses;
      default: return filteredResponsesForMetrics;
    }
  };

  const tabResponses = getTabContent();

  let filteredTasks = filteredResponsesForMetrics;
  if (selectedCard === 'total') filteredTasks = filteredResponsesForMetrics;
  else if (selectedCard === 'average') filteredTasks = responsesWithRating;
  else if (selectedCard === 'recommend') filteredTasks = filteredResponsesForMetrics.filter(r => r.would_recommend);
  else if (selectedCard === 'fiveStar') filteredTasks = responsesWithRating.filter(r => (getUnifiedScore5(r) || 0) >= 4.5);
  else if (selectedCard === 'source-total') filteredTasks = filteredResponsesForMetrics;
  else if (selectedCard === 'source-whatsapp') filteredTasks = manualWhatsAppResponses;
  else if (selectedCard === 'source-webhook') filteredTasks = webhookResponses;
  else if (selectedCard === 'source-totem') filteredTasks = totemResponses;
  else if (selectedCard === 'source-qrcode') filteredTasks = qrcodeResponses;
  else if (selectedCard === 'source-clicktotem') filteredTasks = clickTotemResponses;
  else if (selectedCard === 'rating-5') filteredTasks = responsesWithRating.filter(r => (getUnifiedScore5(r) || 0) >= 4.5);
  else if (selectedCard === 'rating-4') filteredTasks = responsesWithRating.filter(r => {
    const s = getUnifiedScore5(r);
    return s !== null && s >= 3.5 && s < 4.5;
  });
  else if (selectedCard === 'rating-3') filteredTasks = responsesWithRating.filter(r => {
    const s = getUnifiedScore5(r);
    return s !== null && s >= 2.5 && s < 3.5;
  });
  else if (selectedCard === 'rating-low') filteredTasks = responsesWithRating.filter(r => {
    const s = getUnifiedScore5(r);
    return s !== null && s < 2.5;
  });
  else if (!selectedCard) filteredTasks = tabResponses;

  return (
    <div className="bg-[#f7f7f8] min-h-screen">
      <div className="p-6">
        <div className="w-full space-y-6">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-3xl font-bold text-[#121217]">Dashboard de Pesquisas</h1>
                <p className="text-sm text-[#6c6c89] mt-2">Acompanhe as métricas e respostas de satisfação dos seus clientes</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onSwitchToSimple}>Simples</Button>
                  <Button variant="default" onClick={onSwitchToAdvanced}>Avançado</Button>
                </div>
                <PeriodFilter
                  selectedPeriod={selectedPeriod}
                  onPeriodChange={handlePeriodChange}
                  customDateRange={customDateRange}
                  onCustomDateChange={handleCustomDateChange}
                />
                <Button variant={showAdvancedFilters ? "default" : "outline"} onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className="gap-2">
                  <Sliders className="w-4 h-4" />
                  {showAdvancedFilters ? 'Ocultar Filtros' : 'Filtros Avançados'}
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => setShowExportDialog(true)}>
                  <Download className="w-4 h-4" />
                  Exportar
                </Button>
              </div>
            </div>
          </motion.div>

          <AdvancedFilters
            show={showAdvancedFilters}
            templates={templates}
            selectedTemplate={selectedTemplate}
            setSelectedTemplate={setSelectedTemplate}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            ratingFilter={ratingFilter}
            setRatingFilter={setRatingFilter}
            npsSegmentFilter={npsSegmentFilter}
            setNpsSegmentFilter={setNpsSegmentFilter}
            onReset={resetFilters}
          />

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="dashboard-cards">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-6">
                  {cardOrder.map((cardId, index) => (
                    <Draggable key={cardId} draggableId={cardId} index={index}>
                      {(provided, snapshot) => (
                        <div ref={provided.innerRef} {...provided.draggableProps}>
                          {cardId === 'kpis' && (
                            <DraggableCard id="kpis" title="Indicadores Principais" isMinimized={minimizedCards.includes('kpis')} onToggleMinimize={handleToggleMinimize} dragHandleProps={provided.dragHandleProps} isDragging={snapshot.isDragging}>
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <motion.button whileHover={{ scale: 1.02 }} onClick={() => setSelectedCard('total')} className={`bg-white rounded-xl border-2 p-5 text-left transition-all cursor-pointer ${selectedCard === 'total' ? 'border-blue-600 shadow-lg' : 'border-[#d1d1db] hover:border-blue-400'}`}>
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm text-[#6c6c89]">Total de Respostas</p>
                                      <p className="text-3xl font-bold text-[#121217] mt-2">{totalResponses}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                                      <MessageCircle className="w-6 h-6 text-blue-600" />
                                    </div>
                                  </div>
                                </motion.button>
                                <motion.button whileHover={{ scale: 1.02 }} onClick={() => setSelectedCard('average')} className={`bg-white rounded-xl border-2 p-5 text-left transition-all cursor-pointer ${selectedCard === 'average' ? 'border-yellow-600 shadow-lg' : 'border-[#d1d1db]'}`}>
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm text-[#6c6c89]">Avaliação Média</p>
                                      <div className="flex items-baseline gap-1 mt-2">
                                        <p className="text-3xl font-bold text-[#121217]">{avgOverall}</p>
                                        <p className="text-sm text-[#6c6c89]">/ 5.0</p>
                                      </div>
                                    </div>
                                    <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
                                      <Star className="w-6 h-6 text-yellow-500" />
                                    </div>
                                  </div>
                                </motion.button>
                                <motion.button whileHover={{ scale: 1.02 }} onClick={() => setSelectedCard('recommend')} className={`bg-white rounded-xl border-2 p-5 text-left transition-all cursor-pointer ${selectedCard === 'recommend' ? 'border-emerald-600 shadow-lg' : 'border-[#d1d1db]'}`}>
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm text-[#6c6c89]">Taxa de Recomendação</p>
                                      <p className="text-3xl font-bold text-[#121217] mt-2">{recommendRate}%</p>
                                    </div>
                                    <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center">
                                      <TrendingUp className="w-6 h-6 text-emerald-600" />
                                    </div>
                                  </div>
                                </motion.button>
                                <motion.button whileHover={{ scale: 1.02 }} onClick={() => setSelectedCard('fiveStar')} className={`bg-white rounded-xl border-2 p-5 text-left transition-all cursor-pointer ${selectedCard === 'fiveStar' ? 'border-indigo-600 shadow-lg' : 'border-[#d1d1db]'}`}>
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm text-[#6c6c89]">5 Estrelas</p>
                                      <p className="text-3xl font-bold text-[#121217] mt-2">{fiveStarCount}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center">
                                      <CheckCircle2 className="w-6 h-6 text-indigo-600" />
                                    </div>
                                  </div>
                                </motion.button>
                              </div>
                            </DraggableCard>
                          )}

                          {cardId === 'charts' && (
                            <DraggableCard id="charts" title="Tendências e Distribuição" isMinimized={minimizedCards.includes('charts')} onToggleMinimize={handleToggleMinimize} dragHandleProps={provided.dragHandleProps} isDragging={snapshot.isDragging}>
                              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                <div className="xl:col-span-2">
                                  <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={trendData}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#d1d1db" />
                                      <XAxis dataKey="date" stroke="#6c6c89" />
                                      <YAxis yAxisId="left" stroke="#6c6c89" />
                                      <YAxis yAxisId="right" orientation="right" stroke="#6c6c89" />
                                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #d1d1db', borderRadius: '8px' }} />
                                      <Line yAxisId="left" type="monotone" dataKey="responses" stroke="#5423e7" strokeWidth={2} name="Respostas" />
                                      <Line yAxisId="right" type="monotone" dataKey="rating" stroke="#10b981" strokeWidth={2} name="Avaliação" />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                                <div>
                                  <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                      <Pie data={satisfactionData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} fill="#8884d8" dataKey="value" onClick={(data) => { const ratingMap = { '5 Estrelas': 'rating-5', '4 Estrelas': 'rating-4', '3 Estrelas': 'rating-3', '< 3 Estrelas': 'rating-low' }; setSelectedCard(ratingMap[data.name]); }} style={{ cursor: 'pointer' }}>
                                        {satisfactionData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                      </Pie>
                                      <Tooltip />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            </DraggableCard>
                          )}

                          {cardId === 'source' && (
                            <DraggableCard id="source" title="Pesquisas por Origem" isMinimized={minimizedCards.includes('source')} onToggleMinimize={handleToggleMinimize} dragHandleProps={provided.dragHandleProps} isDragging={snapshot.isDragging}>
                              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                                {[
                                  { key: 'total', label: 'Total', value: surveyCountBySource.total, color: 'blue' },
                                  { key: 'manual_whatsapp', label: 'WhatsApp', value: surveyCountBySource.manual_whatsapp, color: 'green' },
                                  { key: 'webhook', label: 'Webhook', value: surveyCountBySource.webhook, color: 'purple' },
                                  { key: 'totem', label: 'Totem', value: surveyCountBySource.totem, color: 'orange' },
                                  { key: 'qrcode', label: 'QR Code', value: surveyCountBySource.qrcode, color: 'pink' },
                                  { key: 'clicktotem', label: 'Click Totem', value: surveyCountBySource.clicktotem, color: 'indigo' }
                                ].map(item => (
                                  <motion.button key={item.key} whileHover={{ scale: 1.05 }} onClick={() => setSelectedCard(`source-${item.key}`)} className={`text-center p-4 bg-gradient-to-br from-${item.color}-50 to-${item.color}-100 rounded-lg cursor-pointer transition-all ${selectedCard === `source-${item.key}` ? `ring-2 ring-${item.color}-600 shadow-lg` : 'hover:shadow-md'}`}>
                                    <p className={`text-2xl font-bold text-${item.color}-600`}>{item.value}</p>
                                    <p className={`text-xs text-${item.color}-700 mt-1`}>{item.label}</p>
                                  </motion.button>
                                ))}
                              </div>
                            </DraggableCard>
                          )}

                          {cardId === 'nps' && (
                            <DraggableCard id="nps" title="Análise NPS" isMinimized={minimizedCards.includes('nps')} onToggleMinimize={handleToggleMinimize} dragHandleProps={provided.dragHandleProps} isDragging={snapshot.isDragging}>
                              <div className="grid grid-cols-3 gap-4 mb-4">
                                <div className="text-center p-4 bg-green-50 rounded-lg">
                                  <p className="text-2xl font-bold text-green-600">{promoters.length}</p>
                                  <p className="text-xs text-green-700">Promotores</p>
                                </div>
                                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                                  <p className="text-2xl font-bold text-yellow-600">{passives.length}</p>
                                  <p className="text-xs text-yellow-700">Neutros</p>
                                </div>
                                <div className="text-center p-4 bg-red-50 rounded-lg">
                                  <p className="text-2xl font-bold text-red-600">{detractors.length}</p>
                                  <p className="text-xs text-red-700">Detratores</p>
                                </div>
                              </div>
                              <div className="text-center p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg">
                                <p className="text-sm text-[#6c6c89] mb-1">Net Promoter Score</p>
                                <p className={`text-4xl font-bold ${nps >= 50 ? 'text-green-600' : nps >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>{nps}</p>
                              </div>
                            </DraggableCard>
                          )}

                          {cardId === 'plan' && (
                            <DraggableCard id="plan" title="Visão Geral do Plano" isMinimized={minimizedCards.includes('plan')} onToggleMinimize={handleToggleMinimize} dragHandleProps={provided.dragHandleProps} isDragging={snapshot.isDragging}>
                              <PlanOverview />
                            </DraggableCard>
                          )}

                          {cardId === 'consumption' && (
                            <DraggableCard
                              id="consumption"
                              title="Consumo e Assinatura"
                              isMinimized={minimizedCards.includes('consumption')}
                              onToggleMinimize={handleToggleMinimize}
                              dragHandleProps={provided.dragHandleProps}
                              isDragging={snapshot.isDragging}
                            >
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                  <h4 className="text-sm font-semibold text-[#121217]">Consumo do Período</h4>
                                  <div className="space-y-2">
                                    <div className="flex justify-between">
                                      <span className="text-sm text-[#6c6c89]">Mensagens Enviadas</span>
                                      <span className="font-semibold text-[#121217]">{consumptionData?.messages_sent || 0}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-sm text-[#6c6c89]">Pesquisas Criadas</span>
                                      <span className="font-semibold text-[#121217]">{consumptionData?.surveys_created || 0}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-sm text-[#6c6c89]">Respostas Recebidas</span>
                                      <span className="font-semibold text-[#121217]">{consumptionData?.responses_received || 0}</span>
                                    </div>
                                  </div>
                                </div>
                                {subscriptionData ? (
                                  <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-[#121217]">Informações do Plano</h4>
                                    <div className="space-y-2">
                                      <div>
                                        <span className="text-sm text-[#6c6c89]">Tipo de Plano</span>
                                        <p className="font-semibold text-[#121217]">{subscriptionData.plan_type}</p>
                                      </div>
                                      <div>
                                        <span className="text-sm text-[#6c6c89]">Status</span>
                                        <p className="font-semibold text-[#121217]">
                                          <span className={`inline-block px-2 py-1 rounded text-xs ${subscriptionData.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                            {subscriptionData.status}
                                          </span>
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center h-full border-l border-[#d1d1db] pl-6 italic text-[#6c6c89]">
                                    Sem dados de assinatura
                                  </div>
                                )}
                              </div>
                            </DraggableCard>
                          )}

                          {cardId === 'alerts' && (<DraggableCard id="alerts" title="Alertas de Métricas" isMinimized={minimizedCards.includes('alerts')} onToggleMinimize={handleToggleMinimize} dragHandleProps={provided.dragHandleProps} isDragging={snapshot.isDragging}><MetricAlerts nps={nps} avgRating={parseFloat(avgOverall)} detractorsPercent={detractorsPercent} promotersPercent={promotersPercent} /></DraggableCard>)}
                          {cardId === 'completion' && (<DraggableCard id="completion" title="Taxa de Conclusão" isMinimized={minimizedCards.includes('completion')} onToggleMinimize={handleToggleMinimize} dragHandleProps={provided.dragHandleProps} isDragging={snapshot.isDragging}><CompletionRate responses={filteredResponsesForMetrics} templates={templates} /></DraggableCard>)}
                          {cardId === 'questions' && (<DraggableCard id="questions" title="Distribuição por Pergunta" isMinimized={minimizedCards.includes('questions')} onToggleMinimize={handleToggleMinimize} dragHandleProps={provided.dragHandleProps} isDragging={snapshot.isDragging}><QuestionDistribution responses={filteredResponsesForMetrics} templates={templates} /></DraggableCard>)}
                          {cardId === 'sentiment' && (<DraggableCard id="sentiment" title="Análise de Sentimento" isMinimized={minimizedCards.includes('sentiment')} onToggleMinimize={handleToggleMinimize} dragHandleProps={provided.dragHandleProps} isDragging={snapshot.isDragging}><SentimentAnalysis responses={filteredResponsesForMetrics} /></DraggableCard>)}
                          {cardId === 'keywords' && (<DraggableCard id="keywords" title="Palavras-Chave" isMinimized={minimizedCards.includes('keywords')} onToggleMinimize={handleToggleMinimize} dragHandleProps={provided.dragHandleProps} isDragging={snapshot.isDragging}><KeywordExtraction responses={filteredResponsesForMetrics} /></DraggableCard>)}
                          {cardId === 'breakdown' && (<DraggableCard id="breakdown" title="Análise por Pergunta" isMinimized={minimizedCards.includes('breakdown')} onToggleMinimize={handleToggleMinimize} dragHandleProps={provided.dragHandleProps} isDragging={snapshot.isDragging}><QuestionBreakdown responses={filteredResponsesForMetrics} templates={templates} /></DraggableCard>)}
                          {cardId === 'trend' && (<DraggableCard id="trend" title="NPS/CSAT ao Longo do Tempo" isMinimized={minimizedCards.includes('trend')} onToggleMinimize={handleToggleMinimize} dragHandleProps={provided.dragHandleProps} isDragging={snapshot.isDragging}><NPSCSATTrend responses={filteredResponsesForMetrics} /></DraggableCard>)}
                          {cardId === 'voucher' && (<DraggableCard id="voucher" title="Vouchers e Fallback" isMinimized={minimizedCards.includes('voucher')} onToggleMinimize={handleToggleMinimize} dragHandleProps={provided.dragHandleProps} isDragging={snapshot.isDragging}><VoucherFallbackAnalytics userTenantId={userProfile?.tenant_id} templates={templates} /></DraggableCard>)}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <div className="border-b border-[#d1d1db]">
            <div className="flex gap-4 overflow-x-auto pb-2">
              {[
                { id: 'overview', label: 'Visão Geral', count: filteredResponsesForMetrics.length },
                { id: 'low-ratings', label: 'Avaliações Baixas', count: detractors.length }
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${activeTab === tab.id ? 'border-[#5423e7] text-[#5423e7]' : 'border-transparent text-[#6c6c89] hover:text-[#121217]'}`}>
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#d1d1db] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[#121217]">
                  {selectedCard === 'total' && 'Todas as Respostas'}
                  {selectedCard === 'average' && 'Respostas com Avaliação'}
                  {!selectedCard && activeTab === 'overview' && 'Todas as Respostas'}
                  {!selectedCard && activeTab === 'low-ratings' && 'Avaliações Baixas'}
                </h3>
                <p className="text-sm text-[#6c6c89]">Mostrando {Math.min(filteredTasks.length, 50)} de {filteredTasks.length} respostas</p>
              </div>
              <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="px-3 py-2 border border-[#d1d1db] rounded-lg text-sm w-48" />
            </div>
            <div className="space-y-3">
              {filteredTasks.filter(r => {
                const term = searchTerm.toLowerCase();
                return !term || r.customer_name?.toLowerCase().includes(term) || r.customer_email?.toLowerCase().includes(term);
              }).slice(0, 50).map((response) => (
                <motion.button key={response.id} onClick={() => setSelectedResponse(response)} className="w-full flex items-center justify-between p-4 bg-[#f7f7f8] rounded-lg hover:bg-[#e8e8ec] transition-all text-left">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#121217]">{response.customer_name || 'Anônimo'}</p>
                    <p className="text-xs text-[#6c6c89]">{new Date(response.created_at || response.created_date).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {getUnifiedScore5(response) !== null && (
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-4 h-4 ${i < Math.floor(getUnifiedScore5(response) || 0) ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`} />)}
                      </div>
                    )}
                    <ChevronRight className="w-5 h-5 text-[#6c6c89]" />
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {selectedResponse && (
            <Dialog open={!!selectedResponse} onOpenChange={() => setSelectedResponse(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Detalhes da Resposta</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><p className="text-xs text-[#6c6c89]">Nome</p><p className="font-medium text-[#121217]">{selectedResponse.customer_name || 'Anônimo'}</p></div>
                    <div><p className="text-xs text-[#6c6c89]">Email</p><p className="font-medium text-[#121217]">{selectedResponse.customer_email || '-'}</p></div>
                  </div>
                  {selectedResponse.comment && <div><h4 className="font-semibold text-[#121217]">Comentário</h4><p className="p-3 bg-[#f7f7f8] rounded text-sm">{selectedResponse.comment}</p></div>}
                  <div className="flex gap-2 pt-4 border-t">
                    {selectedResponse.customer_phone && <Button className="flex-1 bg-green-600" onClick={() => window.open(`https://wa.me/${selectedResponse.customer_phone.replace(/\\D/g, '')}`)}><Send className="w-4 h-4 mr-2" />WhatsApp</Button>}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <ExportDialog
            open={showExportDialog}
            onOpenChange={setShowExportDialog}
            responses={filteredTasks}
            templates={templates}
          />
        </div>
      </div>
    </div>
  );
}
