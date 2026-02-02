import React from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, User, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function RecentSends({ messages = [] }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-white rounded-xl border border-[#d1d1db] p-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <Clock className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-[#121217]">Envios Recentes</h3>
      </div>
      
      <div className="space-y-3">
        {messages.slice(0, 5).map((message, idx) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + idx * 0.1 }}
            className="flex items-start justify-between p-3 bg-[#f7f7f8] rounded-lg hover:bg-[#e8e8ec] transition-colors"
          >
            <div className="flex items-start gap-3 flex-1">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                message.status === 'sent' ? 'bg-green-50' :
                message.status === 'failed' ? 'bg-red-50' :
                'bg-yellow-50'
              }`}>
                {message.status === 'sent' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : message.status === 'failed' ? (
                  <XCircle className="w-5 h-5 text-red-600" />
                ) : (
                  <Clock className="w-5 h-5 text-yellow-600" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <p className="text-sm font-medium text-[#121217] truncate">
                    {message.customer_name || 'Cliente'}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#6c6c89]">
                  <Phone className="w-3 h-3 flex-shrink-0" />
                  <span>{message.phone_number}</span>
                </div>
                <p className="text-xs text-[#6c6c89] mt-1">
                  {format(new Date(message.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>

            <span className={`text-xs px-2 py-1 rounded font-medium flex-shrink-0 ${
              message.status === 'sent' ? 'bg-green-100 text-green-700' :
              message.status === 'failed' ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {message.status === 'sent' ? 'Enviado' :
               message.status === 'failed' ? 'Falhou' :
               'Pendente'}
            </span>
          </motion.div>
        ))}
      </div>

      {messages.length > 5 && (
        <p className="text-xs text-center text-[#6c6c89] mt-4">
          Mostrando os 5 envios mais recentes de {messages.length} total
        </p>
      )}
    </motion.div>
  );
}