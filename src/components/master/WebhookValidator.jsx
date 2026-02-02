import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';



export default function WebhookValidator() {
  const [instanceName, setInstanceName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState(null);

  const handleValidate = async () => {
    if (!instanceName || !tenantId) {
      alert('Preencha todos os campos');
      return;
    }

    setIsValidating(true);
    try {
      const { data } = await base44.functions.invoke('validateWebhookReceiver', {
        instance_name: instanceName,
        tenant_id: tenantId
      });
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-[#d1d1db] p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Zap className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#121217]">Validar Webhook</h3>
            <p className="text-xs text-[#6c6c89]">Verificar se o webhook está recebendo mensagens da Evolution API</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[#121217] mb-2 block">
              Nome da Instância WhatsApp
            </label>
            <input
              type="text"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              placeholder="Ex: avaliazap"
              className="w-full px-3 py-2 border border-[#d1d1db] rounded-lg focus:outline-none focus:border-[#5423e7]"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#121217] mb-2 block">
              ID do Tenant
            </label>
            <input
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="Ex: 69634d6504883afb776200f2"
              className="w-full px-3 py-2 border border-[#d1d1db] rounded-lg focus:outline-none focus:border-[#5423e7]"
            />
          </div>

          <Button
            onClick={handleValidate}
            disabled={isValidating}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {isValidating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Validando...
              </>
            ) : (
              <>
                <Activity className="w-4 h-4 mr-2" />
                Validar Webhook
              </>
            )}
          </Button>
        </div>
      </motion.div>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl border-2 p-6 ${
            result.success
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-start gap-4">
            {result.success ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
            )}

            <div className="flex-1">
              <h4 className={`text-lg font-semibold mb-3 ${
                result.success ? 'text-emerald-900' : 'text-red-900'
              }`}>
                {result.success ? 'Webhook Validado com Sucesso' : 'Erro na Validação'}
              </h4>

              {result.webhook_url && (
                <div className="mb-4 p-3 bg-white rounded-lg">
                  <p className="text-xs text-[#6c6c89] font-medium mb-1">URL do Webhook:</p>
                  <code className="text-xs text-[#121217] break-all font-mono">
                    {result.webhook_url}
                  </code>
                </div>
              )}

              {result.validation && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center p-2 bg-white rounded">
                    <span className="text-[#6c6c89]">Mensagens Recebidas:</span>
                    <span className={`font-semibold ${
                      result.validation.messages_received
                        ? 'text-emerald-600'
                        : 'text-red-600'
                    }`}>
                      {result.validation.recent_messages_count} mensagens
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-2 bg-white rounded">
                    <span className="text-[#6c6c89]">Conversas Rastreadas:</span>
                    <span className={`font-semibold ${
                      result.validation.conversations_tracked
                        ? 'text-emerald-600'
                        : 'text-orange-600'
                    }`}>
                      {result.validation.recent_conversations_count} conversas
                    </span>
                  </div>

                  {result.validation.last_message && (
                    <div className="p-2 bg-white rounded mt-3">
                      <p className="text-xs text-[#6c6c89] font-medium mb-2">Última Mensagem:</p>
                      <div className="space-y-1 text-xs">
                        <p><strong>De:</strong> {result.validation.last_message.from}</p>
                        <p><strong>Status:</strong> {result.validation.last_message.status}</p>
                        <p><strong>Hora:</strong> {new Date(result.validation.last_message.timestamp).toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                  )}

                  {result.validation.last_conversation && (
                    <div className="p-2 bg-white rounded mt-3">
                      <p className="text-xs text-[#6c6c89] font-medium mb-2">Última Conversa:</p>
                      <div className="space-y-1 text-xs">
                        <p><strong>Telefone:</strong> {result.validation.last_conversation.phone}</p>
                        <p><strong>Status:</strong> {result.validation.last_conversation.status}</p>
                        <p><strong>Perguntas Respondidas:</strong> {result.validation.last_conversation.questions_answered}</p>
                        <p><strong>Hora:</strong> {new Date(result.validation.last_conversation.timestamp).toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {result.recommendation && (
                <div className={`mt-4 p-3 rounded-lg ${
                  result.success
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-orange-100 text-orange-700'
                }`}>
                  <p className="text-xs font-medium">💡 {result.recommendation}</p>
                </div>
              )}

              {result.error && (
                <p className="text-sm text-red-700 mt-2">{result.error}</p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}