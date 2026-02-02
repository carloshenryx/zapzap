import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Send, Phone, Mail, User, Calendar, MessageCircle, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { getScoreLabel5, getUnifiedScore5 } from '@/lib/ratingUtils';

export default function ResponseDetailsModal({ response, onClose, whatsappConversations }) {
  if (!response) return null;

  const conversation = whatsappConversations?.find(c => 
    c.phone_number === response.customer_phone && 
    c.status === 'completed'
  );

  const sentimentConfig = {
    positive: { color: 'bg-green-100 text-green-700', label: '😊 Positivo', icon: CheckCircle2 },
    negative: { color: 'bg-red-100 text-red-700', label: '😟 Negativo', icon: XCircle },
    neutral: { color: 'bg-gray-100 text-gray-700', label: '😐 Neutro', icon: MessageCircle }
  };

  const sentiment = response.sentiment ? sentimentConfig[response.sentiment] : null;
  const SentimentIcon = sentiment?.icon;
  const created = response.created_at || response.created_date;

  return (
    <Dialog open={!!response} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-[#5423e7]" />
            Detalhes da Resposta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Customer Info Card */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-5 border-2 border-indigo-100">
            <div className="flex items-start justify-between mb-4">
              <h4 className="font-semibold text-[#121217] flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                Dados do Cliente
              </h4>
              <Badge variant="outline" className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {created ? format(new Date(created), 'dd/MM/yyyy HH:mm') : '-'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-indigo-600 font-medium">Nome</p>
                <p className="font-semibold text-[#121217]">{response.customer_name || 'Anônimo'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-indigo-600 font-medium">Email</p>
                <p className="text-sm text-[#121217]">{response.customer_email || '-'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-indigo-600 font-medium">Telefone</p>
                <p className="text-sm text-[#121217]">{response.customer_phone || '-'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-indigo-600 font-medium">CPF</p>
                <p className="text-sm text-[#121217]">{response.customer_cpf || '-'}</p>
              </div>
            </div>
            
            {/* Source Badge */}
            {response.source && (
              <div className="mt-4 pt-4 border-t border-indigo-200">
                <Badge className="bg-indigo-600 text-white">
                  Origem: {
                    response.source === 'manual_whatsapp' ? '📱 WhatsApp Manual' :
                    response.source === 'webhook' ? '🔗 Webhook' :
                    response.source === 'totem' ? '🖥️ Totem' :
                    response.source === 'qrcode' ? '📲 QR Code' :
                    response.source === 'clicktotem' ? '👆 Click Totem' :
                    response.source
                  }
                </Badge>
              </div>
            )}
          </div>

          {/* Ratings Card */}
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-5 border-2 border-yellow-100">
            <h4 className="font-semibold text-[#121217] mb-4 flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-600" />
              Avaliações
            </h4>
            <div className="space-y-3">
              {getUnifiedScore5(response) !== null && (
                <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                  <span className="text-sm text-[#6c6c89] font-medium">Avaliação Geral</span>
                  {(() => {
                    const score5 = getUnifiedScore5(response);
                    const label = getScoreLabel5(score5);
                    const filled = Math.floor(score5 || 0);
                    const displayScore = score5 === null ? '-' : (Number.isInteger(score5) ? String(score5) : score5.toFixed(1));
                    return (
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-5 h-5 ${i < filled ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`}
                            />
                          ))}
                        </div>
                        <Badge className={label.className}>
                          {displayScore}/5 • {label.label}
                        </Badge>
                      </div>
                    );
                  })()}
                </div>
              )}
              {response.service_rating > 0 && (
                <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                  <span className="text-sm text-[#6c6c89] font-medium">Atendimento</span>
                  <span className="font-bold text-lg">{response.service_rating}/5</span>
                </div>
              )}
              {response.quality_rating > 0 && (
                <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                  <span className="text-sm text-[#6c6c89] font-medium">Qualidade</span>
                  <span className="font-bold text-lg">{response.quality_rating}/5</span>
                </div>
              )}
              {response.would_recommend && (
                <div className="flex items-center gap-2 p-3 bg-green-100 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Recomendaria para outros</span>
                </div>
              )}
            </div>
          </div>

          {/* Comment Card with Sentiment */}
          {response.comment && (
            <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-5 border-2 border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-[#121217] flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-slate-600" />
                  Comentário
                </h4>
                {sentiment && (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${sentiment.color}`}>
                    <SentimentIcon className="w-4 h-4" />
                    <span className="text-xs font-medium">{sentiment.label}</span>
                    {response.sentiment_confidence && (
                      <span className="text-xs opacity-70">({response.sentiment_confidence}%)</span>
                    )}
                  </div>
                )}
              </div>
              <p className="p-4 bg-white rounded-lg text-sm text-[#121217] leading-relaxed shadow-sm italic">
                "{response.comment}"
              </p>
            </div>
          )}

          {/* WhatsApp Conversation Answers */}
          {conversation?.answers?.length > 0 && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border-2 border-green-100">
              <h4 className="font-semibold text-[#121217] mb-4 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-green-600" />
                Respostas da Conversa WhatsApp
              </h4>
              <div className="space-y-3">
                {conversation.answers.map((answer, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-lg shadow-sm">
                    <p className="text-xs font-semibold text-green-700 mb-1">{answer.question_text}</p>
                    <p className="text-sm text-[#121217]">{answer.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t-2 border-slate-200">
            {response.customer_phone && (
              <>
                <Button 
                  className="flex-1 bg-green-600 hover:bg-green-700 gap-2 shadow-md" 
                  onClick={() => window.open(`https://wa.me/${response.customer_phone.replace(/\D/g, '')}`)}
                >
                  <Send className="w-4 h-4" />
                  WhatsApp
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 gap-2" 
                  onClick={() => window.location.href = `tel:${response.customer_phone}`}
                >
                  <Phone className="w-4 h-4" />
                  Ligar
                </Button>
              </>
            )}
            {response.customer_email && (
              <Button 
                variant="outline" 
                className="flex-1 gap-2" 
                onClick={() => window.location.href = `mailto:${response.customer_email}`}
              >
                <Mail className="w-4 h-4" />
                Email
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
