import React from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ThumbsUp, ThumbsDown, User } from 'lucide-react';
import StarRating from './StarRating';
import { cn } from '@/lib/utils';

export default function ResponseCard({ response, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-blue-200 flex items-center justify-center">
            <User className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">
              {response.customer_name || 'Anônimo'}
            </p>
            <p className="text-sm text-slate-400">
              {format(new Date(response.created_date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className={cn(
          "px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5",
          response.would_recommend 
            ? "bg-emerald-50 text-emerald-700"
            : "bg-rose-50 text-rose-700"
        )}>
          {response.would_recommend ? (
            <>
              <ThumbsUp className="w-4 h-4" />
              Recomenda
            </>
          ) : (
            <>
              <ThumbsDown className="w-4 h-4" />
              Não recomenda
            </>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 bg-slate-50 rounded-xl">
          <p className="text-xs text-slate-500 mb-1">Geral</p>
          <StarRating value={response.overall_rating} readonly size="sm" />
        </div>
        <div className="text-center p-3 bg-slate-50 rounded-xl">
          <p className="text-xs text-slate-500 mb-1">Atendimento</p>
          <StarRating value={response.service_rating} readonly size="sm" />
        </div>
        <div className="text-center p-3 bg-slate-50 rounded-xl">
          <p className="text-xs text-slate-500 mb-1">Qualidade</p>
          <StarRating value={response.quality_rating} readonly size="sm" />
        </div>
      </div>
      
      {response.comment && (
        <div className="mt-4 p-4 bg-slate-50 rounded-xl">
          <p className="text-slate-600 italic">"{response.comment}"</p>
        </div>
      )}
    </motion.div>
  );
}