import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Webhook, Copy, CheckCircle2, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function WebhookMonitor() {
  const [webhookUrl, setWebhookUrl] = useState('');

  React.useEffect(() => {
    const origin = window.location.origin;
    setWebhookUrl(`${origin}/api/handleAsaasWebhook`);
  }, []);

  const { data: webhookLogs = [], isLoading, refetch } = useQuery({
    queryKey: ['webhook-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // Optimized: 30s instead of 10s
  });

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL copiada!');
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      PENDING: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
      CONFIRMED: { label: 'Confirmado', color: 'bg-blue-100 text-blue-800' },
      RECEIVED: { label: 'Recebido', color: 'bg-green-100 text-green-800' },
      OVERDUE: { label: 'Vencido', color: 'bg-red-100 text-red-800' },
      REFUNDED: { label: 'Reembolsado', color: 'bg-gray-100 text-gray-800' },
    };

    const config = statusConfig[status] || { label: status, color: 'bg-slate-100 text-slate-800' };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getEventIcon = (eventType) => {
    if (eventType?.includes('RECEIVED') || eventType?.includes('CONFIRMED')) {
      return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    } else if (eventType?.includes('OVERDUE') || eventType?.includes('DELETED')) {
      return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
    return <Clock className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="w-5 h-5" />
            Configuração do Webhook ASAAS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-slate-600 mb-3">
              Configure esta URL no painel do ASAAS para receber notificações automáticas de pagamentos:
            </p>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button onClick={copyWebhookUrl} variant="outline">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>📍 Onde configurar:</strong>
              <br />
              Painel ASAAS → Configurações → Webhooks → Adicionar URL
              <br />
              <strong>Eventos recomendados:</strong> PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Logs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Últimos Webhooks Recebidos
            <Badge variant="outline">{webhookLogs.length}</Badge>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {webhookLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Webhook className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum webhook recebido ainda</p>
              <p className="text-sm">Configure o webhook no ASAAS para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {webhookLogs.map((log, index) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {getEventIcon(log.event_type)}
                      <div>
                        <p className="font-semibold text-slate-800">{log.event_type}</p>
                        <p className="text-sm text-slate-500">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(log.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-100">
                    <div>
                      <p className="text-xs text-slate-500">Payment ID</p>
                      <p className="text-sm font-mono text-slate-800">{log.payment_id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Email</p>
                      <p className="text-sm text-slate-800">{log.customer_email}</p>
                    </div>
                    {log.value > 0 && (
                      <div>
                        <p className="text-xs text-slate-500">Valor</p>
                        <p className="text-sm font-semibold text-slate-800">
                          R$ {log.value.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
