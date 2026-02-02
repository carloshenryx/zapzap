import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, startOfWeek, startOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getUnifiedScore10, getUnifiedScore5 } from '@/lib/ratingUtils';

export default function NPSCSATTrend({ responses }) {
  const [period, setPeriod] = useState('week');

  // Agrupar respostas por período
  const groupByPeriod = (responses, periodType) => {
    const groups = {};
    
    responses.forEach(response => {
      const created = response.created_at || response.created_date;
      if (!created) return;
      
      let key;
      const date = parseISO(created);
      let sortKey;
      
      if (periodType === 'day') {
        key = format(date, 'dd/MM', { locale: ptBR });
        sortKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      } else if (periodType === 'week') {
        const w = startOfWeek(date);
        key = format(w, 'dd/MM', { locale: ptBR });
        sortKey = w.getTime();
      } else {
        const m = startOfMonth(date);
        key = format(m, 'MMM/yy', { locale: ptBR });
        sortKey = m.getTime();
      }
      
      if (!groups[key]) {
        groups[key] = { responses: [], score10: [], score5: [], sortKey };
      }
      
      groups[key].responses.push(response);
      
      const s10 = getUnifiedScore10(response);
      const s5 = getUnifiedScore5(response);
      if (s10 !== null) groups[key].score10.push(s10);
      if (s5 !== null) groups[key].score5.push(s5);
    });

    return Object.entries(groups).map(([period, data]) => {
      // Calcular NPS
      const promoters = data.score10.filter(s => s >= 9).length;
      const detractors = data.score10.filter(s => s <= 6).length;
      const nps = data.score10.length > 0 
        ? ((promoters - detractors) / data.score10.length) * 100 
        : 0;

      const csat = data.score5.length > 0
        ? (data.score5.filter(s => s >= 4).length / data.score5.length) * 100
        : 0;

      return {
        period,
        sortKey: data.sortKey,
        nps: parseFloat(nps.toFixed(1)),
        csat: parseFloat(csat.toFixed(1)),
        total: data.responses.length
      };
    }).sort((a, b) => a.sortKey - b.sortKey);
  };

  const chartData = groupByPeriod(responses, period);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Evolução NPS/CSAT</h3>
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList>
            <TabsTrigger value="day">Diário</TabsTrigger>
            <TabsTrigger value="week">Semanal</TabsTrigger>
            <TabsTrigger value="month">Mensal</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">Dados insuficientes para análise</p>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis domain={[-100, 100]} />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="nps" 
                stroke="#5423e7" 
                strokeWidth={2}
                name="NPS"
                dot={{ fill: '#5423e7', r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="csat" 
                stroke="#10b981" 
                strokeWidth={2}
                name="CSAT (%)"
                dot={{ fill: '#10b981', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-500 mb-1">NPS Atual</p>
          <p className="text-2xl font-bold text-indigo-600">
            {chartData.length > 0 ? chartData[chartData.length - 1].nps : 0}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">CSAT Atual</p>
          <p className="text-2xl font-bold text-green-600">
            {chartData.length > 0 ? chartData[chartData.length - 1].csat.toFixed(1) + '%' : '0%'}
          </p>
        </div>
      </div>
    </Card>
  );
}
