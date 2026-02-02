import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Smile, Meh, Frown, TrendingUp, TrendingDown, MessageCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// Análise de sentimento simplificada baseada em palavras-chave
const analyzeSentiment = (text) => {
  if (!text) return 'neutral';
  
  const lowerText = text.toLowerCase();
  
  const positiveWords = ['excelente', 'ótimo', 'bom', 'maravilhoso', 'incrível', 'perfeito', 'adorei', 'amei', 'fantástico', 'satisfeito', 'feliz', 'legal', 'top', 'parabéns'];
  const negativeWords = ['ruim', 'péssimo', 'horrível', 'terrível', 'insatisfeito', 'decepção', 'problema', 'demorado', 'lento', 'caro', 'sujo', 'frio', 'mal'];
  
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
};

export default function SentimentAnalysis({ responses = [] }) {
  const sentimentData = useMemo(() => {
    const commentsWithSentiment = responses
      .filter(r => r.comment && r.comment.trim())
      .map(r => ({
        ...r,
        sentiment: analyzeSentiment(r.comment)
      }));

    const positive = commentsWithSentiment.filter(r => r.sentiment === 'positive').length;
    const neutral = commentsWithSentiment.filter(r => r.sentiment === 'neutral').length;
    const negative = commentsWithSentiment.filter(r => r.sentiment === 'negative').length;

    return {
      total: commentsWithSentiment.length,
      positive,
      neutral,
      negative,
      comments: commentsWithSentiment,
      chartData: [
        { name: 'Positivos', value: positive, color: '#10b981' },
        { name: 'Neutros', value: neutral, color: '#f59e0b' },
        { name: 'Negativos', value: negative, color: '#ef4444' }
      ].filter(d => d.value > 0)
    };
  }, [responses]);

  if (sentimentData.total === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Análise de Sentimento</h3>
        <div className="text-center py-8 text-gray-500">
          <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nenhum comentário disponível para análise</p>
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Análise de Sentimento</h3>
        <span className="text-xs text-gray-500">{sentimentData.total} comentários analisados</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chart */}
        <div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={sentimentData.chartData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {sentimentData.chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Stats */}
        <div className="space-y-3">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <Smile className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">Positivos</p>
                <p className="text-xs text-gray-600">
                  {sentimentData.total > 0 ? Math.round((sentimentData.positive / sentimentData.total) * 100) : 0}%
                </p>
              </div>
            </div>
            <span className="text-2xl font-bold text-green-600">{sentimentData.positive}</span>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <Meh className="w-8 h-8 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">Neutros</p>
                <p className="text-xs text-gray-600">
                  {sentimentData.total > 0 ? Math.round((sentimentData.neutral / sentimentData.total) * 100) : 0}%
                </p>
              </div>
            </div>
            <span className="text-2xl font-bold text-yellow-600">{sentimentData.neutral}</span>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <Frown className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">Negativos</p>
                <p className="text-xs text-gray-600">
                  {sentimentData.total > 0 ? Math.round((sentimentData.negative / sentimentData.total) * 100) : 0}%
                </p>
              </div>
            </div>
            <span className="text-2xl font-bold text-red-600">{sentimentData.negative}</span>
          </motion.div>
        </div>
      </div>

      {/* Trend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Índice de Satisfação</span>
          <div className="flex items-center gap-2">
            {sentimentData.positive > sentimentData.negative ? (
              <>
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold text-green-600">Positivo</span>
              </>
            ) : (
              <>
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-600">Atenção</span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}