import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Download,
  FileText,
  Calendar,
  TrendingUp,
  Star,
  MessageCircle,
  Loader2
} from 'lucide-react';
import {
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, subDays, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Reports() {
  const [dateRange, setDateRange] = useState('last30days');
  const [isGenerating, setIsGenerating] = useState(false);
  const { userProfile } = useAuth();

  // Use AuthContext userProfile
  const user = userProfile;

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['survey-responses', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      const { data, error } = await supabase
        .from('survey_responses')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.tenant_id,
  });

  const { data: subscription = [] } = useQuery({
    queryKey: ['subscription', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .order('created_date', { ascending: false })
        .limit(1);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.tenant_id,
  });

  // Filtrar respostas por data
  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return new Date(now.setHours(0, 0, 0, 0));
      case 'last7days':
        return subDays(now, 7);
      case 'last30days':
        return subDays(now, 30);
      case 'thisMonth':
        return startOfMonth(now);
      case 'lastMonth':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return startOfMonth(lastMonth);
      default:
        return subDays(now, 30);
    }
  };

  const filteredResponses = responses.filter(r => {
    const responseDate = new Date(r.created_at || r.created_date);
    return responseDate >= getDateFilter();
  });

  // Preparar dados para gráficos
  const responsesWithRating = filteredResponses.filter(r => r.overall_rating && r.overall_rating > 0);

  // Tendência ao longo do tempo
  const dailyData = {};
  filteredResponses.forEach(r => {
    const date = format(new Date(r.created_at || r.created_date), 'dd/MM');
    if (!dailyData[date]) {
      dailyData[date] = { date, count: 0, totalRating: 0, ratingCount: 0 };
    }
    dailyData[date].count++;
    if (r.overall_rating) {
      dailyData[date].totalRating += r.overall_rating;
      dailyData[date].ratingCount++;
    }
  });

  const trendData = Object.values(dailyData)
    .map(d => ({
      date: d.date,
      responses: d.count,
      avgRating: d.ratingCount > 0 ? (d.totalRating / d.ratingCount).toFixed(1) : 0
    }))
    .slice(-14);

  // Distribuição por fonte
  const sourceData = [
    { name: 'WhatsApp Manual', value: filteredResponses.filter(r => r.source === 'manual_whatsapp').length, color: '#10b981' },
    { name: 'Webhook', value: filteredResponses.filter(r => r.source === 'webhook').length, color: '#8b5cf6' },
    { name: 'Totem', value: filteredResponses.filter(r => r.source === 'totem').length, color: '#f59e0b' },
    { name: 'QR Code', value: filteredResponses.filter(r => r.source === 'qrcode').length, color: '#ec4899' }
  ].filter(d => d.value > 0);

  // Distribuição de avaliações
  const ratingData = [
    { rating: '5 ⭐', count: responsesWithRating.filter(r => r.overall_rating === 5).length },
    { rating: '4 ⭐', count: responsesWithRating.filter(r => r.overall_rating === 4).length },
    { rating: '3 ⭐', count: responsesWithRating.filter(r => r.overall_rating === 3).length },
    { rating: '2 ⭐', count: responsesWithRating.filter(r => r.overall_rating === 2).length },
    { rating: '1 ⭐', count: responsesWithRating.filter(r => r.overall_rating === 1).length }
  ];

  // Estatísticas
  const stats = {
    totalResponses: filteredResponses.length,
    avgRating: responsesWithRating.length > 0
      ? (responsesWithRating.reduce((sum, r) => sum + r.overall_rating, 0) / responsesWithRating.length).toFixed(1)
      : 0,
    recommendRate: filteredResponses.length > 0
      ? Math.round((filteredResponses.filter(r => r.would_recommend).length / filteredResponses.length) * 100)
      : 0,
    fiveStars: responsesWithRating.filter(r => r.overall_rating === 5).length
  };

  // Exportar CSV
  const exportToCSV = () => {
    setIsGenerating(true);

    const headers = ['Data', 'Cliente', 'Email', 'Telefone', 'Avaliação', 'Recomenda', 'Fonte', 'Comentário'];
    const rows = filteredResponses.map(r => [
      format(new Date(r.created_at || r.created_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      r.customer_name || 'Anônimo',
      r.customer_email || '-',
      r.customer_phone || '-',
      r.overall_rating || '-',
      r.would_recommend ? 'Sim' : 'Não',
      r.source || '-',
      r.comment ? r.comment.replace(/\n/g, ' ') : '-'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_${format(new Date(), 'dd-MM-yyyy')}.csv`;
    link.click();

    setIsGenerating(false);
  };

  // Exportar PDF (simplificado - usando jsPDF)
  const exportToPDF = async () => {
    setIsGenerating(true);

    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();

      // Título
      doc.setFontSize(20);
      doc.text('Relatório de Pesquisas', 20, 20);

      // Período
      doc.setFontSize(10);
      doc.text(`Período: ${format(getDateFilter(), 'dd/MM/yyyy', { locale: ptBR })} - ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}`, 20, 30);

      // Estatísticas
      doc.setFontSize(14);
      doc.text('Estatísticas Gerais', 20, 45);
      doc.setFontSize(10);
      doc.text(`Total de Respostas: ${stats.totalResponses}`, 30, 55);
      doc.text(`Avaliação Média: ${stats.avgRating} / 5.0`, 30, 62);
      doc.text(`Taxa de Recomendação: ${stats.recommendRate}%`, 30, 69);
      doc.text(`5 Estrelas: ${stats.fiveStars}`, 30, 76);

      // Distribuição por Fonte
      doc.setFontSize(14);
      doc.text('Distribuição por Fonte', 20, 90);
      doc.setFontSize(10);
      let yPos = 100;
      sourceData.forEach(s => {
        doc.text(`${s.name}: ${s.value} (${Math.round(s.value / stats.totalResponses * 100)}%)`, 30, yPos);
        yPos += 7;
      });

      // Respostas Recentes (últimas 20)
      doc.addPage();
      doc.setFontSize(14);
      doc.text('Respostas Recentes', 20, 20);
      doc.setFontSize(8);
      yPos = 30;

      filteredResponses.slice(0, 20).forEach((r, idx) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(`${idx + 1}. ${r.customer_name || 'Anônimo'} - ${r.overall_rating || '-'}⭐ - ${format(new Date(r.created_at || r.created_date), 'dd/MM/yyyy')}`, 20, yPos);
        yPos += 7;
        if (r.comment) {
          const comment = r.comment.substring(0, 100);
          doc.text(`   "${comment}${r.comment.length > 100 ? '...' : ''}"`, 25, yPos);
          yPos += 7;
        }
      });

      doc.save(`relatorio_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
    }

    setIsGenerating(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f7f7f8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5423e7] animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-[#f7f7f8] min-h-screen">
      <div className="p-6">
        <div className="w-full space-y-6">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-[#121217]">Relatórios Avançados</h1>
              <p className="text-sm text-[#6c6c89] mt-2">Análise detalhada de desempenho e tendências</p>
            </div>
            <div className="flex gap-2">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-48">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="last7days">Últimos 7 dias</SelectItem>
                  <SelectItem value="last30days">Últimos 30 dias</SelectItem>
                  <SelectItem value="thisMonth">Este mês</SelectItem>
                  <SelectItem value="lastMonth">Mês passado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* KPI Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-4"
          >
            <div className="bg-white rounded-xl border border-[#d1d1db] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#6c6c89]">Total de Respostas</p>
                  <p className="text-3xl font-bold text-[#121217] mt-2">{stats.totalResponses}</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#d1d1db] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#6c6c89]">Avaliação Média</p>
                  <p className="text-3xl font-bold text-[#121217] mt-2">{stats.avgRating}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
                  <Star className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#d1d1db] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#6c6c89]">Taxa de Recomendação</p>
                  <p className="text-3xl font-bold text-[#121217] mt-2">{stats.recommendRate}%</p>
                </div>
                <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#d1d1db] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#6c6c89]">5 Estrelas</p>
                  <p className="text-3xl font-bold text-[#121217] mt-2">{stats.fiveStars}</p>
                </div>
                <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <Star className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Export Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl border border-[#d1d1db] p-6"
          >
            <h3 className="text-lg font-semibold text-[#121217] mb-4">Exportar Relatório</h3>
            <div className="flex gap-3">
              <Button onClick={exportToCSV} disabled={isGenerating} className="gap-2">
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Exportar CSV
              </Button>
              <Button onClick={exportToPDF} disabled={isGenerating} variant="outline" className="gap-2">
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Exportar PDF
              </Button>
            </div>
            <p className="text-xs text-[#6c6c89] mt-3">
              Baixe os dados do período selecionado em formato CSV ou PDF para análise offline
            </p>
          </motion.div>

          {/* Tendência ao Longo do Tempo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl border border-[#d1d1db] p-6"
          >
            <h3 className="text-lg font-semibold text-[#121217] mb-4">Tendência de Respostas e Avaliação</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorResponses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5423e7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#5423e7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#d1d1db" />
                <XAxis dataKey="date" stroke="#6c6c89" />
                <YAxis yAxisId="left" stroke="#6c6c89" />
                <YAxis yAxisId="right" orientation="right" stroke="#6c6c89" domain={[0, 5]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #d1d1db', borderRadius: '8px' }}
                />
                <Area yAxisId="left" type="monotone" dataKey="responses" stroke="#5423e7" fillOpacity={1} fill="url(#colorResponses)" name="Respostas" />
                <Line yAxisId="right" type="monotone" dataKey="avgRating" stroke="#10b981" strokeWidth={2} name="Avaliação Média" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Análise por Fonte e Distribuição de Avaliações */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Distribuição por Fonte */}
            <div className="bg-white rounded-xl border border-[#d1d1db] p-6">
              <h3 className="text-lg font-semibold text-[#121217] mb-4">Análise por Fonte de Pesquisa</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {sourceData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-sm text-slate-700">{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Distribuição de Avaliações */}
            <div className="bg-white rounded-xl border border-[#d1d1db] p-6">
              <h3 className="text-lg font-semibold text-[#121217] mb-4">Distribuição de Avaliações</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ratingData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#d1d1db" />
                  <XAxis type="number" stroke="#6c6c89" />
                  <YAxis dataKey="rating" type="category" stroke="#6c6c89" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #d1d1db', borderRadius: '8px' }}
                  />
                  <Bar dataKey="count" fill="#5423e7" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Informações do Plano */}
          {subscription[0] && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-xl border border-[#d1d1db] p-6"
            >
              <h3 className="text-lg font-semibold text-[#121217] mb-4">Desempenho do Plano</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-[#6c6c89]">Plano Atual</p>
                  <p className="text-xl font-bold text-[#121217] mt-1">{subscription[0].plan_type}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-[#6c6c89]">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-1 ${subscription[0].status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                    {subscription[0].status}
                  </span>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-[#6c6c89]">Respostas no Período</p>
                  <p className="text-xl font-bold text-[#121217] mt-1">{stats.totalResponses}</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
