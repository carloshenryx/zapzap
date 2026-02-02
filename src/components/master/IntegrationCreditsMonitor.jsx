import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  MessageSquare,
  Brain,
  GitBranch,
  Phone,
  TrendingUp,
  Loader2,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function IntegrationCreditsMonitor() {
  const [viewMode, setViewMode] = useState('breakdown'); // breakdown, trend, projection

  const { data: stats, isLoading } = useQuery({
    queryKey: ['integration-credits-stats'],
    queryFn: async () => {
      const consumption = await base44.entities.Consumption.list('-created_date', 1000);
      
      // Separate current and past data
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const current = consumption.find(c => c.period === currentMonth) || {
        ai_requests: 0,
        api_calls: 0,
        webhook_calls: 0,
        messages_sent: 0,
      };

      // Calculate total from all periods
      const totalStats = consumption.reduce((acc, curr) => ({
        ai_requests: acc.ai_requests + (curr.ai_requests || 0),
        api_calls: acc.api_calls + (curr.api_calls || 0),
        webhook_calls: acc.webhook_calls + (curr.webhook_calls || 0),
        messages_sent: acc.messages_sent + (curr.messages_sent || 0),
      }), {
        ai_requests: 0,
        api_calls: 0,
        webhook_calls: 0,
        messages_sent: 0,
      });

      // Calculate average monthly for projection
      const monthCount = Math.max(consumption.length, 1);
      const avgMonthly = {
        ai_requests: Math.round(totalStats.ai_requests / monthCount),
        api_calls: Math.round(totalStats.api_calls / monthCount),
        webhook_calls: Math.round(totalStats.webhook_calls / monthCount),
        messages_sent: Math.round(totalStats.messages_sent / monthCount),
      };

      // Generate trend data for chart
      const trendData = consumption.slice(-12).map(c => ({
        period: c.period,
        ai: c.ai_requests || 0,
        api: c.api_calls || 0,
        webhook: c.webhook_calls || 0,
        messages: c.messages_sent || 0,
        credits: (c.ai_requests || 0) * 1 + (c.api_calls || 0) * 0.5 + (c.webhook_calls || 0) * 0.25 + (c.messages_sent || 0) * 0.1
      }));

      // Generate projection for next 3 months
      const projectionData = [];
      for (let i = 1; i <= 3; i++) {
        const futureDate = new Date(now);
        futureDate.setMonth(futureDate.getMonth() + i);
        const period = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`;
        projectionData.push({
          period,
          ai: avgMonthly.ai_requests,
          api: avgMonthly.api_calls,
          webhook: avgMonthly.webhook_calls,
          messages: avgMonthly.messages_sent,
          credits: avgMonthly.ai_requests * 1 + avgMonthly.api_calls * 0.5 + avgMonthly.webhook_calls * 0.25 + avgMonthly.messages_sent * 0.1,
          isProjection: true
        });
      }

      return {
        current,
        total: totalStats,
        avgMonthly,
        trendData,
        projectionData,
        allData: [...trendData, ...projectionData]
      };
    },
  });

  const creditBreakdown = [
    {
      name: 'Requisições de IA',
      value: stats?.total?.ai_requests || 0,
      currentValue: stats?.current?.ai_requests || 0,
      avgValue: stats?.avgMonthly?.ai_requests || 0,
      creditsPerUnit: 1,
      icon: Brain,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700'
    },
    {
      name: 'Chamadas de API',
      value: stats?.total?.api_calls || 0,
      currentValue: stats?.current?.api_calls || 0,
      avgValue: stats?.avgMonthly?.api_calls || 0,
      creditsPerUnit: 0.5,
      icon: GitBranch,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700'
    },
    {
      name: 'Chamadas de Webhook',
      value: stats?.total?.webhook_calls || 0,
      currentValue: stats?.current?.webhook_calls || 0,
      avgValue: stats?.avgMonthly?.webhook_calls || 0,
      creditsPerUnit: 0.25,
      icon: Phone,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700'
    },
    {
      name: 'Mensagens WhatsApp',
      value: stats?.total?.messages_sent || 0,
      currentValue: stats?.current?.messages_sent || 0,
      avgValue: stats?.avgMonthly?.messages_sent || 0,
      creditsPerUnit: 0.1,
      icon: MessageSquare,
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-700'
    }
  ];

  const totalCreditsUsed = creditBreakdown.reduce((acc, item) => {
    return acc + (item.value * item.creditsPerUnit);
  }, 0);

  const avgMonthlyCredits = creditBreakdown.reduce((acc, item) => {
    return acc + (item.avgValue * item.creditsPerUnit);
  }, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3"
      >
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-1">Monitoramento de Integration Credits</p>
          <p className="text-xs">Acompanhe o consumo histórico e projeções futuras de créditos por tipo de integração.</p>
        </div>
      </motion.div>

      {/* View Mode Tabs */}
      <div className="flex gap-2 border-b border-[#d1d1db]">
        {[
          { id: 'breakdown', label: 'Consumo Atual', icon: MessageSquare },
          { id: 'trend', label: 'Histórico (12 meses)', icon: Calendar },
          { id: 'projection', label: 'Projeção (3 meses)', icon: TrendingUp }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-all flex items-center gap-2',
              viewMode === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-[#6c6c89] hover:text-[#121217]'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Total Credits Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg"
        >
          <p className="text-indigo-100 text-sm mb-2">Total Consumido</p>
          <p className="text-4xl font-bold">{totalCreditsUsed.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</p>
          <p className="text-indigo-100 text-xs mt-1">Desde o início</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-6 text-white shadow-lg"
        >
          <p className="text-orange-100 text-sm mb-2">Média Mensal</p>
          <p className="text-4xl font-bold">{avgMonthlyCredits.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</p>
          <p className="text-orange-100 text-xs mt-1">Créditos/mês</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-6 text-white shadow-lg"
        >
          <p className="text-emerald-100 text-sm mb-2">Projeção 3 Meses</p>
          <p className="text-4xl font-bold">{(avgMonthlyCredits * 3).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</p>
          <p className="text-emerald-100 text-xs mt-1">Estimado</p>
        </motion.div>
      </div>

      {/* Breakdown Grid - Current Month */}
      {viewMode === 'breakdown' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {creditBreakdown.map((item, idx) => {
            const Icon = item.icon;
            const creditsUsed = item.currentValue * item.creditsPerUnit;

            return (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white rounded-xl p-6 border border-[#d1d1db]"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', item.bgColor)}>
                    <Icon className={cn('w-5 h-5', item.textColor)} />
                  </div>
                </div>

                <p className="text-xs text-[#6c6c89] mb-1">{item.name}</p>
                <p className="text-2xl font-bold text-[#121217] mb-3">
                  {item.currentValue.toLocaleString('pt-BR')}
                </p>

                <div className="space-y-2 text-xs mb-3">
                  <div className="flex justify-between">
                    <span className="text-[#6c6c89]">Créditos (mês):</span>
                    <span className="font-semibold text-[#121217]">{creditsUsed.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6c6c89]">Total histórico:</span>
                    <span className="font-semibold text-[#121217]">{item.value.toLocaleString('pt-BR')}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((creditsUsed / (avgMonthlyCredits || 1)) * 100, 100)}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={cn('h-full bg-gradient-to-r', item.color)}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Trend Chart */}
      {viewMode === 'trend' && stats?.trendData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 border border-[#d1d1db]"
        >
          <h3 className="font-semibold text-[#121217] mb-4">Consumo Histórico (12 Meses)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" style={{ fontSize: '12px' }} />
              <YAxis style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #d1d1db', borderRadius: '8px' }}
                formatter={(value) => value.toFixed(2)}
              />
              <Legend />
              <Line type="monotone" dataKey="credits" stroke="#5423e7" strokeWidth={2} name="Créditos Total" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Projection Chart */}
      {viewMode === 'projection' && stats?.allData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 border border-[#d1d1db]"
        >
          <h3 className="font-semibold text-[#121217] mb-4">Projeção de Consumo (12 Meses + 3 Meses Futuros)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.allData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" style={{ fontSize: '12px' }} />
              <YAxis style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #d1d1db', borderRadius: '8px' }}
                formatter={(value) => value.toFixed(2)}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="credits" 
                stroke="#5423e7" 
                strokeWidth={2} 
                name="Créditos (Estimado/Realizado)"
                strokeDasharray={(point) => point.isProjection ? '5 5' : '0'}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-[#6c6c89] mt-4">
            <strong>Legenda:</strong> Linha sólida = dados históricos | Linha tracejada = projeção futura (baseada na média mensal)
          </p>
        </motion.div>
      )}

      {/* Detailed Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-xl p-6 border border-[#d1d1db] space-y-4"
      >
        <h3 className="text-lg font-semibold text-[#121217]">Detalhes de Consumo</h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Brain className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-[#121217]">Requisições de IA (Análises, Sugestões)</span>
            </div>
            <span className="text-sm font-semibold text-[#121217]">
              {(stats?.ai_requests || 0).toLocaleString('pt-BR')} usos → {((stats?.ai_requests || 0) * 1).toFixed(2)} créditos
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <GitBranch className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-[#121217]">Chamadas de API (Integrações)</span>
            </div>
            <span className="text-sm font-semibold text-[#121217]">
              {(stats?.api_calls || 0).toLocaleString('pt-BR')} chamadas → {((stats?.api_calls || 0) * 0.5).toFixed(2)} créditos
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-green-600" />
              <span className="text-sm text-[#121217]">Chamadas de Webhook (Disparadores)</span>
            </div>
            <span className="text-sm font-semibold text-[#121217]">
              {(stats?.webhook_calls || 0).toLocaleString('pt-BR')} webhooks → {((stats?.webhook_calls || 0) * 0.25).toFixed(2)} créditos
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span className="text-sm text-[#121217]">Mensagens WhatsApp (Pesquisas)</span>
            </div>
            <span className="text-sm font-semibold text-[#121217]">
              {(stats?.messages_sent || 0).toLocaleString('pt-BR')} mensagens → {((stats?.messages_sent || 0) * 0.1).toFixed(2)} créditos
            </span>
          </div>
        </div>
      </motion.div>

      {/* Info Box */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-slate-50 rounded-xl p-6 border border-[#d1d1db]"
      >
        <h4 className="font-semibold text-[#121217] mb-3">Como Funcionam os Integration Credits</h4>
        <ul className="space-y-2 text-sm text-[#6c6c89]">
          <li className="flex gap-2">
            <span className="text-indigo-600">→</span>
            <span><strong>IA:</strong> 1 crédito por requisição de análise, sugestões ou processamento de linguagem natural</span>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-600">→</span>
            <span><strong>APIs:</strong> 0.5 crédito por chamada de API externa (Stripe, ASAAS, etc)</span>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-600">→</span>
            <span><strong>Webhooks:</strong> 0.25 crédito por disparo de webhook (gatilhos automáticos)</span>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-600">→</span>
            <span><strong>WhatsApp:</strong> 0.1 crédito por mensagem enviada via WhatsApp</span>
          </li>
        </ul>
      </motion.div>
    </div>
  );
}