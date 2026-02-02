import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import FaceRating from '@/components/survey/FaceRating';

export default function SurveyPreview({ formData, primaryColor = '#5423e7' }) {
  const renderQuestionPreview = (question, index) => {
    switch (question.type) {
      case 'stars':
        return (
          <div key={index} className="space-y-3">
            <p className="text-sm font-medium text-gray-900">{question.question}</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-8 h-8 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
          </div>
        );
      
      case 'faces':
        return (
          <div key={index} className="space-y-3">
            <p className="text-sm font-medium text-gray-900">{question.question}</p>
            <FaceRating value={3} onChange={() => {}} readonly />
          </div>
        );
      
      case 'boolean':
        return (
          <div key={index} className="space-y-3">
            <p className="text-sm font-medium text-gray-900">{question.question}</p>
            <div className="flex gap-3">
              <button className="flex-1 px-4 py-3 bg-gray-100 rounded-lg text-sm font-medium">
                Sim
              </button>
              <button className="flex-1 px-4 py-3 bg-gray-100 rounded-lg text-sm font-medium">
                Não
              </button>
            </div>
          </div>
        );
      
      case 'rating':
        return (
          <div key={index} className="space-y-3">
            <p className="text-sm font-medium text-gray-900">{question.question}</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <button
                  key={num}
                  className="w-10 h-10 bg-gray-100 rounded-lg text-sm font-medium"
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        );
      
      case 'text':
        return (
          <div key={index} className="space-y-3">
            <p className="text-sm font-medium text-gray-900">{question.question}</p>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
              rows={3}
              placeholder="Digite sua resposta..."
              disabled
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  const backgroundStyle = formData.design?.background_image_url
    ? {
        backgroundImage: `url(${formData.design.background_image_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    : {};

  return (
    <div className="h-full flex flex-col">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
        <h3 className="text-lg font-semibold text-gray-900">Preview em Tempo Real</h3>
        <p className="text-sm text-gray-500">Veja como sua pesquisa aparecerá para os clientes</p>
      </div>
      
      <div 
        className="flex-1 overflow-y-auto p-6"
        style={backgroundStyle}
      >
        <div className="max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
            style={{ fontFamily: formData.design?.font_family || 'Inter' }}
          >
            {/* Header */}
            <div 
              className="px-6 py-8 text-white text-center"
              style={{ backgroundColor: primaryColor }}
            >
              {formData.design?.logo_url && (
                <img
                  src={formData.design.logo_url}
                  alt="Logo"
                  className="w-20 h-20 mx-auto mb-4 rounded-full bg-white p-2"
                />
              )}
              <h2 className="text-2xl font-bold">{formData.name || 'Pesquisa de Satisfação'}</h2>
              <p className="text-sm mt-2 opacity-90">Sua opinião é muito importante!</p>
            </div>

            {/* Questions */}
            <div className="p-6 space-y-6">
              {formData.questions && formData.questions.length > 0 ? (
                formData.questions.map((question, index) => (
                  <motion.div
                    key={question.id || index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="pb-6 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-start gap-2 mb-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-semibold" style={{ color: primaryColor }}>
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        {renderQuestionPreview(question, index)}
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-sm">Adicione perguntas para visualizar o preview</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button
                className="w-full py-3 rounded-lg font-medium text-white transition-all"
                style={{ backgroundColor: primaryColor }}
                disabled
              >
                Enviar Respostas
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}