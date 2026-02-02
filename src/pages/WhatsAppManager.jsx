import React, { useState } from 'react';
import { fetchAPI } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MessageCircle,
  Plus,
  QrCode,
  Trash2,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  LogOut,
  Phone,
  Webhook
} from 'lucide-react';
import { toast } from 'sonner';

export default function WhatsAppManager() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showSendForm, setShowSendForm] = useState(false);
  const [instanceName, setInstanceName] = useState('');
  const [qrCodeModal, setQrCodeModal] = useState(null);
  const [sendData, setSendData] = useState({ phone: '', name: '', instance: '' });

  const queryClient = useQueryClient();
  const { userProfile } = useAuth();

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ['whatsapp-instances', userProfile?.tenant_id],
    queryFn: async () => {
      const response = await fetchAPI('/whatsapp?action=list-instances');
      return response.instances || [];
    },
    enabled: !!userProfile?.tenant_id,
    refetchInterval: qrCodeModal ? false : 30000, // 30s, disabled during QR scan
    refetchOnWindowFocus: false, // CRITICAL: Don't reload on tab switch - prevents data loss
    staleTime: 5 * 60 * 1000, // Data stays fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (renamed from cacheTime in v5)
  });

  const createMutation = useMutation({
    mutationFn: async (name) => {
      return await fetchAPI('/whatsapp?action=create-instance', {
        method: 'POST',
        body: JSON.stringify({ instanceName: name })
      });
    },
    onSuccess: (data) => {
      console.log('QR Code data received:', data);
      toast.success('Instância criada! Escaneie o QR Code');
      // Fix: use data.qr.base64 from API response
      const qrcodeImage = data.qr?.base64 || data.qrcode;
      console.log('QR Code to display:', qrcodeImage?.substring(0, 100));
      setQrCodeModal({ name: instanceName, qrcode: qrcodeImage });
      setShowCreateForm(false);
      setInstanceName('');
      // Force immediate refresh of instances list
      queryClient.invalidateQueries(['whatsapp-instances']);
      queryClient.refetchQueries(['whatsapp-instances']);
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao criar instância');
    }
  });

  const getQRMutation = useMutation({
    mutationFn: async (name) => {
      return await fetchAPI('/whatsapp?action=get-qr', {
        method: 'POST',
        body: JSON.stringify({ instanceName: name })
      });
    },
    onSuccess: (data, name) => {
      setQrCodeModal({ name, qrcode: data.qrcode });
      queryClient.invalidateQueries(['whatsapp-instances']);

      // Verificar status a cada 3 segundos
      const checkInterval = setInterval(async () => {
        try {
          const statusResponse = await fetchAPI('/whatsapp?action=check-status', {
            method: 'POST',
            body: JSON.stringify({ instanceName: name })
          });
          if (statusResponse.status === 'connected') {
            clearInterval(checkInterval);
            setQrCodeModal(null);
            queryClient.invalidateQueries(['whatsapp-instances']);
            toast.success('✅ WhatsApp conectado! Você já pode enviar pesquisas.', {
              duration: 5000
            });
          }
        } catch (error) {
          console.error('Erro ao verificar status:', error);
        }
      }, 3000);

      // Limpar após 2 minutos
      setTimeout(() => clearInterval(checkInterval), 120000);
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: async (name) => {
      return await fetchAPI('/whatsapp?action=disconnect', {
        method: 'POST',
        body: JSON.stringify({ instanceName: name })
      });
    },
    onSuccess: () => {
      toast.success('Instância desconectada');
      queryClient.invalidateQueries(['whatsapp-instances']);
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao desconectar');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (name) => {
      return await fetchAPI('/whatsapp?action=delete', {
        method: 'DELETE',
        body: JSON.stringify({ instanceName: name })
      });
    },
    onSuccess: () => {
      toast.success('Instância removida');
      queryClient.invalidateQueries(['whatsapp-instances']);
    }
  });

  const sendMutation = useMutation({
    mutationFn: async (data) => {
      return await fetchAPI('/surveys?action=trigger', {
        method: 'POST',
        body: JSON.stringify({
          instanceName: data.instance,
          phoneNumber: data.phone,
          customerName: data.name
        })
      });
    },
    onSuccess: () => {
      toast.success('Pesquisa enviada com sucesso!');
      setShowSendForm(false);
      setSendData({ phone: '', name: '', instance: '' });
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao enviar pesquisa');
    }
  });

  const configureWebhookMutation = useMutation({
    mutationFn: async (instanceName) => {
      return await fetchAPI('/whatsapp?action=configure-webhook', {
        method: 'POST',
        body: JSON.stringify({ instanceName })
      });
    },
    onSuccess: (data) => {
      toast.success('Webhook configurado com sucesso!');
      queryClient.invalidateQueries(['whatsapp-instances']);
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao configurar webhook');
    }
  });

  const connectedInstances = instances.filter(i => i.status === 'connected');

  return (
    <div className="bg-[#f7f7f8] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#121217] flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-[#25D366]" />
              WhatsApp Manager
            </h1>
            <p className="text-sm text-[#6c6c89] mt-1">Gerencie instâncias e envie pesquisas</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => queryClient.invalidateQueries(['whatsapp-instances'])}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
            <Button
              onClick={() => setShowCreateForm(true)}
              className="bg-[#25D366] hover:bg-[#25D366]/90 gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Instância
            </Button>
          </div>
        </div>

        {/* Send Survey Section */}
        {connectedInstances.length > 0 && (
          <Card className="mb-6 border-[#d1d1db] bg-white rounded-xl">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-[#121217] flex items-center gap-2">
                <Send className="w-4 h-4 text-[#25D366]" />
                Enviar Pesquisa por WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AnimatePresence>
                {!showSendForm ? (
                  <Button
                    onClick={() => setShowSendForm(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Enviar Nova Pesquisa
                  </Button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Instância</Label>
                        <select
                          value={sendData.instance}
                          onChange={(e) => setSendData({ ...sendData, instance: e.target.value })}
                          className="w-full h-10 rounded-lg border border-slate-200 px-3"
                        >
                          <option value="">Selecione...</option>
                          {connectedInstances.map(inst => (
                            <option key={inst.id} value={inst.instance_name}>
                              {inst.instance_name} ({inst.phone_number})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Nome do Cliente</Label>
                        <Input
                          placeholder="João Silva"
                          value={sendData.name}
                          onChange={(e) => setSendData({ ...sendData, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Número WhatsApp (com DDD)</Label>
                        <Input
                          placeholder="5511999999999"
                          value={sendData.phone}
                          onChange={(e) => setSendData({ ...sendData, phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => sendMutation.mutate(sendData)}
                        disabled={!sendData.phone || !sendData.instance || sendMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {sendMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        <span className="ml-2">Enviar</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowSendForm(false);
                          setSendData({ phone: '', name: '', instance: '' });
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        )}

        {/* Instances Grid */}
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
          </div>
        ) : instances.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {instances.map((instance, idx) => (
              <motion.div
                key={instance.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="bg-white border-[#d1d1db] rounded-xl">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{instance.instance_name}</CardTitle>
                        {instance.phone_number && (
                          <div className="flex items-center gap-1 mt-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <p className="text-sm text-slate-500">{instance.phone_number}</p>
                          </div>
                        )}
                      </div>
                      <Badge
                        className={
                          instance.status === 'connected'
                            ? 'bg-green-100 text-green-700'
                            : instance.status === 'connecting'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-slate-100 text-slate-700'
                        }
                      >
                        {instance.status === 'connected' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {instance.status === 'connecting' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        {instance.status === 'disconnected' && <XCircle className="w-3 h-3 mr-1" />}
                        {instance.status === 'connected' ? 'Conectado' :
                          instance.status === 'connecting' ? 'Conectando' : 'Desconectado'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 flex-wrap">
                      {instance.status !== 'connected' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => getQRMutation.mutate(instance.instance_name)}
                          disabled={getQRMutation.isPending}
                          className="gap-2"
                        >
                          <QrCode className="w-4 h-4" />
                          {instance.status === 'disconnected' ? 'Conectar' : 'QR Code'}
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => configureWebhookMutation.mutate(instance.instance_name)}
                            disabled={configureWebhookMutation.isPending}
                            className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            <Webhook className="w-4 h-4" />
                            {configureWebhookMutation.isPending ? 'Configurando...' : 'Configurar Webhook'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (confirm('Deseja desconectar esta instância?')) {
                                disconnectMutation.mutate(instance.instance_name);
                              }
                            }}
                            disabled={disconnectMutation.isPending}
                            className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50"
                          >
                            <LogOut className="w-4 h-4" />
                            Desconectar
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm('Deseja remover esta instância?')) {
                            deleteMutation.mutate(instance.instance_name);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remover
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center bg-white/80 backdrop-blur">
            <MessageCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500">Nenhuma instância criada ainda</p>
          </Card>
        )}

        {/* Create Form Modal */}
        <AnimatePresence>
          {showCreateForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
              onClick={() => setShowCreateForm(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 max-w-md w-full"
              >
                <h3 className="text-xl font-bold mb-4">Criar Nova Instância</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome da Instância</Label>
                    <Input
                      placeholder="minha-instancia"
                      value={instanceName}
                      onChange={(e) => setInstanceName(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => createMutation.mutate(instanceName)}
                      disabled={!instanceName || createMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {createMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Criar
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* QR Code Modal */}
        <AnimatePresence>
          {qrCodeModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
              onClick={() => setQrCodeModal(null)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 max-w-md w-full text-center"
              >
                <h3 className="text-xl font-bold mb-4">Escaneie o QR Code</h3>
                <p className="text-slate-500 mb-4">
                  Use o WhatsApp para escanear e conectar a instância {qrCodeModal.name}
                </p>
                {qrCodeModal.qrcode ? (
                  <div className="flex flex-col items-center">
                    <img
                      src={qrCodeModal.qrcode}
                      alt="QR Code WhatsApp"
                      className="w-80 h-80 mx-auto mb-4 border-4 border-green-500 rounded-lg shadow-lg"
                      onError={(e) => {
                        console.error('QR Code image failed to load');
                        e.target.style.display = 'none';
                      }}
                    />
                    <p className="text-sm text-slate-400 mb-4">
                      Abra o WhatsApp → Menu → Dispositivos Conectados → Conectar
                    </p>
                  </div>
                ) : (
                  <div className="w-80 h-80 mx-auto mb-4 flex items-center justify-center bg-slate-100 rounded-lg">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                  </div>
                )}
                <Button onClick={() => setQrCodeModal(null)}>Fechar</Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}