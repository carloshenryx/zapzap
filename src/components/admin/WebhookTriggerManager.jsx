import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { Plus, Trash2, Edit, Copy, AlertCircle, RefreshCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import { fetchAPI } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import WebhookDocumentation from './WebhookDocumentation';

export default function WebhookTriggerManager({ userPlanType }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [formData, setFormData] = useState({
    external_trigger_id: '',
    survey_template_id: '',
    whatsapp_instance_name: '',
    name: ''
  });

  const queryClient = useQueryClient();
  const { userProfile } = useAuth();

  const allowWebhooks = userPlanType && ['plus', 'pro'].includes(userPlanType.toLowerCase());

  const { data: configs = [] } = useQuery({
    queryKey: ['webhook-configs', userProfile?.tenant_id],
    queryFn: async () => {
      const result = await fetchAPI('/webhooks?action=list-trigger-configs', { method: 'GET' });
      return result.configs || [];
    },
    enabled: !!userProfile?.tenant_id && allowWebhooks,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['survey-templates', userProfile?.tenant_id],
    queryFn: async () => {
      const result = await fetchAPI('/surveys?action=list-templates', { method: 'GET' });
      return result.templates || [];
    },
    enabled: !!userProfile?.tenant_id,
  });

  const { data: instances = [] } = useQuery({
    queryKey: ['whatsapp-instances', userProfile?.tenant_id],
    queryFn: async () => {
      const result = await fetchAPI('/whatsapp?action=list-instances', { method: 'GET' });
      return result.instances || [];
    },
    enabled: !!userProfile?.tenant_id,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const result = await fetchAPI('/webhooks?action=create-trigger-config', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return result.config;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-configs', userProfile?.tenant_id] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Webhook criado com sucesso!');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const result = await fetchAPI('/webhooks?action=update-trigger-config', {
        method: 'POST',
        body: JSON.stringify({ id, ...data }),
      });
      return result.config;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-configs', userProfile?.tenant_id] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Webhook atualizado com sucesso!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return await fetchAPI('/webhooks?action=delete-trigger-config', {
        method: 'POST',
        body: JSON.stringify({ id }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-configs', userProfile?.tenant_id] });
      toast.success('Webhook excluído com sucesso!');
    },
  });

  const regenerateKeyMutation = useMutation({
    mutationFn: async (id) => {
      const result = await fetchAPI('/webhooks?action=update-trigger-config', {
        method: 'POST',
        body: JSON.stringify({ id, regenerate_key: true }),
      });
      return result.config;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-configs', userProfile?.tenant_id] });
      toast.success('Chave regenerada!');
    },
  });

  const resetForm = () => {
    setFormData({
      external_trigger_id: '',
      survey_template_id: '',
      whatsapp_instance_name: '',
      name: ''
    });
    setEditingConfig(null);
  };

  const handleEdit = (config) => {
    setEditingConfig(config);
    setFormData({
      external_trigger_id: config.external_trigger_id,
      survey_template_id: config.survey_template_id,
      whatsapp_instance_name: config.whatsapp_instance_name,
      name: config.name || ''
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.external_trigger_id.trim() || !formData.survey_template_id || !formData.whatsapp_instance_name) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (editingConfig) {
      updateMutation.mutate({ id: editingConfig.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getWebhookUrl = () => {
    return `${window.location.origin}/functions/triggerWhatsAppSurvey`;
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(getWebhookUrl());
    toast.success('URL copiada!');
  };

  if (!allowWebhooks) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <div>
          <p className="font-medium text-amber-900">Webhooks indisponíveis</p>
          <p className="text-sm text-amber-800">Disponível apenas para planos Plus e Pro.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Webhooks de Gatilho</h3>
          <p className="text-sm text-slate-500">Configure gatilhos automáticos para enviar pesquisas</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Novo Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingConfig ? 'Editar' : 'Novo'} Webhook</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome (opcional)</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Pós-venda"
                />
              </div>

              <div className="space-y-2">
                <Label>ID Externo *</Label>
                <Input
                  value={formData.external_trigger_id}
                  onChange={(e) => setFormData({ ...formData, external_trigger_id: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
                  placeholder="ex: post_sale_survey"
                />
                <p className="text-xs text-slate-500">Identificador único usado pelo sistema externo</p>
              </div>

              <div className="space-y-2">
                <Label>Modelo de Pesquisa *</Label>
                <Select value={formData.survey_template_id} onValueChange={(val) => setFormData({ ...formData, survey_template_id: val })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Instância WhatsApp *</Label>
                <Select value={formData.whatsapp_instance_name} onValueChange={(val) => setFormData({ ...formData, whatsapp_instance_name: val })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {instances.map((i) => (
                      <SelectItem key={i.id} value={i.instance_name}>{i.instance_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleSubmit} className="w-full">
                {editingConfig ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {configs.map((config) => (
          <motion.div 
            key={config.id} 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h4 className="text-base font-semibold text-slate-900">
                  {config.name || config.external_trigger_id}
                </h4>
                <p className="text-sm text-slate-500 mt-1">ID: {config.external_trigger_id}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={copyWebhookUrl}
                  title="Copiar URL do webhook"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => regenerateKeyMutation.mutate(config.id)}
                  title="Regenerar chave do webhook"
                >
                  <RefreshCcw className="w-4 h-4" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => handleEdit(config)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => deleteMutation.mutate(config.id)}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-500 text-xs mb-1">Modelo de Pesquisa</p>
                <p className="font-medium">{templates.find(t => t.id === config.survey_template_id)?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Instância WhatsApp</p>
                <p className="font-medium">{config.whatsapp_instance_name}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">URL do Webhook</p>
                <code className="block bg-slate-100 px-3 py-2 rounded text-xs overflow-auto">
                  {getWebhookUrl()}
                </code>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Chave do Webhook (header X-Webhook-Key)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-xs overflow-auto">
                    {config.webhook_key}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(config.webhook_key);
                      toast.success('Chave copiada!');
                    }}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-end">
                <WebhookDocumentation webhookUrl={getWebhookUrl()} externalTriggerId={config.external_trigger_id} webhookKey={config.webhook_key} />
              </div>
            </div>
          </motion.div>
        ))}

        {configs.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <p className="text-slate-500">Nenhum webhook configurado ainda</p>
            <p className="text-xs text-slate-400 mt-1">Clique em "Novo Webhook" para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}
