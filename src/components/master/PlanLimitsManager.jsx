import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { Save, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function PlanLimitsManager() {
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['all-plans'],
    queryFn: async () => {
      const data = await base44.entities.Plan.list();
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Plan.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-plans'] });
      setEditingPlanId(null);
      toast.success('Limites do plano atualizados com sucesso!');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao atualizar plano');
    },
  });

  const handleEditStart = (plan) => {
    setEditingPlanId(plan.id);
    setFormData({
      max_messages: plan.max_messages || 0,
      max_surveys: plan.max_surveys || 0,
      max_users: plan.max_users || 0,
    });
  };

  const handleSave = () => {
    if (editingPlanId) {
      updateMutation.mutate({ id: editingPlanId, data: formData });
    }
  };

  const handleCancel = () => {
    setEditingPlanId(null);
    setFormData({});
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-1">Ajuste de Limites do Plano</p>
          <p className="text-xs">Atualize os limites de mensagens, pesquisas e usuários. As alterações refletem imediatamente no dashboard de consumo dos tenants.</p>
        </div>
      </div>

      <div className="grid gap-4">
        {plans.map((plan) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl p-6 border border-[#d1d1db]"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[#121217]">{plan.name}</h3>
                <p className="text-sm text-slate-500">
                  R$ {plan.price?.toLocaleString('pt-BR')} / {plan.billing_cycle === 'annual' ? 'ano' : 'mês'}
                </p>
              </div>
              {editingPlanId !== plan.id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditStart(plan)}
                >
                  Editar Limites
                </Button>
              )}
            </div>

            {editingPlanId === plan.id ? (
              <div className="space-y-4 bg-slate-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Limite de Mensagens</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.max_messages || 0}
                      onChange={(e) =>
                        setFormData({ ...formData, max_messages: parseInt(e.target.value) || 0 })
                      }
                      placeholder="Ex: 1000"
                    />
                    <p className="text-xs text-slate-500">Mensagens WhatsApp por mês</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Limite de Pesquisas</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.max_surveys || 0}
                      onChange={(e) =>
                        setFormData({ ...formData, max_surveys: parseInt(e.target.value) || 0 })
                      }
                      placeholder="Ex: 50"
                    />
                    <p className="text-xs text-slate-500">Modelos de pesquisa permitidos</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Limite de Usuários</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.max_users || 0}
                      onChange={(e) =>
                        setFormData({ ...formData, max_users: parseInt(e.target.value) || 0 })
                      }
                      placeholder="Ex: 5"
                    />
                    <p className="text-xs text-slate-500">Usuários simultâneos</p>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={updateMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Salvar Alterações
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Limite de Mensagens</p>
                  <p className="text-xl font-semibold text-[#121217]">
                    {plan.max_messages?.toLocaleString('pt-BR') || '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">por mês</p>
                </div>

                <div className="p-3 bg-emerald-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Limite de Pesquisas</p>
                  <p className="text-xl font-semibold text-[#121217]">
                    {plan.max_surveys?.toLocaleString('pt-BR') || '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">modelos</p>
                </div>

                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Limite de Usuários</p>
                  <p className="text-xl font-semibold text-[#121217]">
                    {plan.max_users?.toLocaleString('pt-BR') || '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">simultâneos</p>
                </div>
              </div>
            )}
          </motion.div>
        ))}

        {plans.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-[#d1d1db]">
            <p className="text-sm text-[#6c6c89]">Nenhum plano encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}