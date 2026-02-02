import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function TaskPerformanceWidget({ tasks }) {
  const performanceByAgent = React.useMemo(() => {
    const agentStats = {};
    
    tasks.forEach(task => {
      const agent = task.assigned_to || 'Não atribuído';
      if (!agentStats[agent]) {
        agentStats[agent] = { completed: 0, pending: 0, total: 0 };
      }
      
      agentStats[agent].total++;
      if (task.status === 'completed') {
        agentStats[agent].completed++;
      } else if (task.status === 'pending' || task.status === 'in_progress') {
        agentStats[agent].pending++;
      }
    });
    
    return Object.entries(agentStats).map(([agent, stats]) => ({
      agent: agent.split('@')[0],
      completed: stats.completed,
      pending: stats.pending,
      completionRate: Math.round((stats.completed / stats.total) * 100)
    }));
  }, [tasks]);

  const avgCompletionRate = performanceByAgent.length > 0
    ? Math.round(performanceByAgent.reduce((sum, a) => sum + a.completionRate, 0) / performanceByAgent.length)
    : 0;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold">Desempenho de Tarefas por Agente</h3>
        </div>
        <Badge className="bg-green-100 text-green-700">
          <TrendingUp className="w-3 h-3 mr-1" />
          {avgCompletionRate}% média
        </Badge>
      </div>
      
      {performanceByAgent.length > 0 ? (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={performanceByAgent}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="agent" stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
            />
            <Bar dataKey="completed" fill="#10b981" name="Concluídas" />
            <Bar dataKey="pending" fill="#f59e0b" name="Pendentes" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-250 flex items-center justify-center text-gray-500">
          <Clock className="w-8 h-8 mr-2" />
          <p>Nenhuma tarefa registrada ainda</p>
        </div>
      )}
    </Card>
  );
}