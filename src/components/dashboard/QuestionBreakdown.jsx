import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function QuestionBreakdown({ responses = [], templates = [] }) {
  const [expandedQuestion, setExpandedQuestion] = useState(null);

  const questionStats = useMemo(() => {
    if (responses.length === 0) return [];

    // Pegar perguntas do template ativo
    const activeTemplate = templates.find(t => t.is_active);
    if (!activeTemplate || !activeTemplate.questions) return [];

    return activeTemplate.questions.map((question, qIdx) => {
      const questionId = question.id;
      
      // Buscar respostas para esta pergunta
      const questionResponses = responses
        .filter(r => r.custom_answers && r.custom_answers[questionId])
        .map(r => r.custom_answers[questionId]);

      let stats = {
        question: question.question,
        type: question.type,
        totalResponses: questionResponses.length,
        responses: questionResponses
      };

      // Calcular estatísticas por tipo de pergunta
      if (question.type === 'stars' || question.type === 'rating') {
        const numericResponses = questionResponses.filter(r => typeof r === 'number');
        const avg = numericResponses.length > 0
          ? (numericResponses.reduce((sum, r) => sum + r, 0) / numericResponses.length).toFixed(1)
          : 0;
        
        const distribution = {};
        const maxRating = question.type === 'stars' ? 5 : 10;
        for (let i = 1; i <= maxRating; i++) {
          distribution[i] = numericResponses.filter(r => r === i).length;
        }

        stats.avg = avg;
        stats.distribution = distribution;
        stats.chartData = Object.entries(distribution).map(([rating, count]) => ({
          rating: `${rating}⭐`,
          count
        }));
      } else if (question.type === 'boolean') {
        const yesCount = questionResponses.filter(r => r === true || r === 'Sim').length;
        const noCount = questionResponses.filter(r => r === false || r === 'Não').length;
        
        stats.chartData = [
          { option: 'Sim', count: yesCount },
          { option: 'Não', count: noCount }
        ];
      } else if (question.type === 'text') {
        stats.textResponses = questionResponses.slice(0, 5);
      }

      return stats;
    });
  }, [responses, templates]);

  if (questionStats.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Análise por Pergunta</h3>
        <div className="text-center py-8 text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nenhuma resposta disponível para análise</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-gray-200 p-6"
    >
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-gray-900">Análise por Pergunta</h3>
      </div>

      <div className="space-y-4">
        {questionStats.map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="border border-gray-200 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => setExpandedQuestion(expandedQuestion === idx ? null : idx)}
              className="w-full p-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 text-left">
                <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-bold">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{stat.question}</p>
                  <p className="text-xs text-gray-500">
                    {stat.totalResponses} resposta{stat.totalResponses !== 1 ? 's' : ''}
                    {stat.avg && ` • Média: ${stat.avg}⭐`}
                  </p>
                </div>
              </div>
              {expandedQuestion === idx ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            <AnimatePresence>
              {expandedQuestion === idx && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 bg-white">
                    {(stat.type === 'stars' || stat.type === 'rating') && stat.chartData && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-4">
                          Distribuição de Avaliações
                        </p>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={stat.chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="rating" stroke="#6b7280" fontSize={12} />
                            <YAxis stroke="#6b7280" fontSize={12} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                            />
                            <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {stat.type === 'boolean' && stat.chartData && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-4">Distribuição de Respostas</p>
                        <div className="grid grid-cols-2 gap-4">
                          {stat.chartData.map((item, i) => (
                            <div key={i} className="text-center p-4 bg-gray-50 rounded-lg">
                              <p className="text-2xl font-bold text-gray-900">{item.count}</p>
                              <p className="text-sm text-gray-600">{item.option}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {stat.type === 'text' && stat.textResponses && stat.textResponses.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-3">
                          Respostas Recentes
                        </p>
                        <div className="space-y-2">
                          {stat.textResponses.map((response, i) => (
                            <div key={i} className="p-3 bg-gray-50 rounded-lg">
                              <p className="text-sm text-gray-700">"{response}"</p>
                            </div>
                          ))}
                        </div>
                        {stat.totalResponses > 5 && (
                          <p className="text-xs text-gray-500 mt-2 text-center">
                            Mostrando 5 de {stat.totalResponses} respostas
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}