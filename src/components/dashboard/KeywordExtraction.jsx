import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Tag, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getUnifiedScore5 } from '@/lib/ratingUtils';

const extractKeywords = (comments, sentiment) => {
  const stopWords = ['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'em', 'no', 'na', 'para', 'com', 'por', 'sem', 'sob', 'sobre', 'que', 'foi', 'ser', 'ter', 'mais', 'muito', 'bem', 'está', 'são', 'foi', 'tem', 'mas', 'meu', 'sua', 'seu'];
  
  const wordFrequency = {};
  
  comments.forEach(comment => {
    const words = comment
      .toLowerCase()
      .replace(/[^\wáàâãéèêíïóôõöúçñ\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.includes(w));
    
    words.forEach(word => {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    });
  });
  
  return Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }));
};

export default function KeywordExtraction({ responses = [] }) {
  const keywordData = useMemo(() => {
    // Comentários positivos (rating >= 4)
    const positiveComments = responses
      .filter(r => r.comment && getUnifiedScore5(r) !== null && getUnifiedScore5(r) >= 4)
      .map(r => r.comment);
    
    // Comentários negativos (rating < 3)
    const negativeComments = responses
      .filter(r => r.comment && getUnifiedScore5(r) !== null && getUnifiedScore5(r) < 3)
      .map(r => r.comment);
    
    return {
      positive: extractKeywords(positiveComments, 'positive'),
      negative: extractKeywords(negativeComments, 'negative'),
      totalPositive: positiveComments.length,
      totalNegative: negativeComments.length
    };
  }, [responses]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-gray-200 p-6"
    >
      <div className="flex items-center gap-2 mb-6">
        <Tag className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-gray-900">Palavras-Chave Mais Mencionadas</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Positive Keywords */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <h4 className="font-semibold text-green-900">
              Feedbacks Positivos
            </h4>
            <span className="text-xs text-gray-500">({keywordData.totalPositive} comentários)</span>
          </div>
          
          {keywordData.positive.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Nenhum feedback positivo com comentários
            </p>
          ) : (
            <div className="space-y-2">
              {keywordData.positive.map((kw, idx) => (
                <motion.div
                  key={kw.word}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-200 text-green-800">
                      {idx + 1}
                    </Badge>
                    <span className="text-sm font-medium text-gray-900">{kw.word}</span>
                  </div>
                  <span className="text-sm font-bold text-green-600">{kw.count}x</span>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Negative Keywords */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-4 h-4 text-red-600" />
            <h4 className="font-semibold text-red-900">
              Feedbacks Negativos
            </h4>
            <span className="text-xs text-gray-500">({keywordData.totalNegative} comentários)</span>
          </div>
          
          {keywordData.negative.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Nenhum feedback negativo com comentários
            </p>
          ) : (
            <div className="space-y-2">
              {keywordData.negative.map((kw, idx) => (
                <motion.div
                  key={kw.word}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-red-200 text-red-800">
                      {idx + 1}
                    </Badge>
                    <span className="text-sm font-medium text-gray-900">{kw.word}</span>
                  </div>
                  <span className="text-sm font-bold text-red-600">{kw.count}x</span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Insights */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-900 font-medium mb-2">💡 Insights</p>
          <ul className="text-xs text-blue-800 space-y-1">
            {keywordData.positive.length > 0 && (
              <li>• Destaque em feedbacks positivos: <strong>{keywordData.positive[0].word}</strong> ({keywordData.positive[0].count} menções)</li>
            )}
            {keywordData.negative.length > 0 && (
              <li>• Ponto de atenção: <strong>{keywordData.negative[0].word}</strong> aparece em {keywordData.negative[0].count} feedbacks negativos</li>
            )}
            {keywordData.totalNegative > keywordData.totalPositive && (
              <li className="text-red-700">⚠️ Mais comentários negativos que positivos - ação necessária!</li>
            )}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}
