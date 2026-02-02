import React from 'react';
import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { getUnifiedScore5, isFiniteNumber } from '@/lib/ratingUtils';

export default function NPSHistoryWidget({ responses }) {
  const npsHistory = React.useMemo(() => {
    const monthlyData = {};
    
    responses.forEach(response => {
      const score5 = getUnifiedScore5(response);
      if (!isFiniteNumber(score5) || score5 <= 0) return;

      const rawDate = response.created_at || response.created_date;
      if (!rawDate) return;
      const date = new Date(rawDate);
      if (Number.isNaN(date.getTime())) return;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { promoters: 0, detractors: 0, total: 0 };
      }
      
      monthlyData[monthKey].total++;
      if (score5 >= 4) monthlyData[monthKey].promoters++;
      if (score5 < 3) monthlyData[monthKey].detractors++;
    });
    
    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        nps: Math.round(((data.promoters - data.detractors) / data.total) * 100),
        responses: data.total
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);
  }, [responses]);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Histórico de NPS</h3>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={npsHistory}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
          <YAxis stroke="#6b7280" fontSize={12} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
            formatter={(value, name) => [value, name === 'nps' ? 'NPS Score' : 'Respostas']}
          />
          <Line type="monotone" dataKey="nps" stroke="#3b82f6" strokeWidth={2} name="NPS" />
          <Line type="monotone" dataKey="responses" stroke="#10b981" strokeWidth={2} name="Respostas" />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
