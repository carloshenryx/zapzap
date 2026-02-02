import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#5423e7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function QuestionDistribution({ responses, templates }) {
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [chartType, setChartType] = useState('bar');

  const activeTemplate = templates.find(t => t.is_active);
  
  if (!activeTemplate || !activeTemplate.questions.length) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Distribuição de Respostas</h3>
        <p className="text-sm text-slate-500">Nenhuma pergunta disponível</p>
      </Card>
    );
  }

  const question = selectedQuestion 
    ? activeTemplate.questions.find(q => q.id === selectedQuestion)
    : activeTemplate.questions[0];

  if (!question) return null;

  // Agregar respostas para a pergunta selecionada
  const answerCounts = {};
  responses.forEach(response => {
    const answer = response.custom_answers?.[question.id];
    if (answer !== undefined && answer !== null && answer !== '') {
      const key = String(answer);
      answerCounts[key] = (answerCounts[key] || 0) + 1;
    }
  });

  const chartData = Object.entries(answerCounts).map(([answer, count]) => ({
    name: answer.length > 20 ? answer.substring(0, 20) + '...' : answer,
    value: count,
    fullName: answer
  })).sort((a, b) => b.value - a.value);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Distribuição de Respostas</h3>
        <div className="flex gap-2">
          <Select value={chartType} onValueChange={setChartType}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bar">Barras</SelectItem>
              <SelectItem value="pie">Pizza</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Select 
        value={selectedQuestion || activeTemplate.questions[0]?.id} 
        onValueChange={setSelectedQuestion}
      >
        <SelectTrigger className="mb-4">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {activeTemplate.questions.map((q, idx) => (
            <SelectItem key={q.id} value={q.id}>
              Pergunta {idx + 1}: {q.question.substring(0, 50)}...
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {chartData.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">Nenhuma resposta para esta pergunta</p>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={chartData}>
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#5423e7" />
              </BarChart>
            ) : (
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 pt-4 border-t">
        <p className="text-xs text-slate-500">
          Total de respostas: <span className="font-semibold">{chartData.reduce((sum, d) => sum + d.value, 0)}</span>
        </p>
      </div>
    </Card>
  );
}