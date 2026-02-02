import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Package, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function PlanManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    billing_cycle: 'monthly',
    max_users: 5,
    max_surveys: 10,
    max_messages: 1000,
    is_active: true,
    features: []
  });
  const [newFeature, setNewFeature] = useState('');

  const queryClient = useQueryClient();

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['all-plans'],
    queryFn: async () => {
      try {
        return await base44.asServiceRole.entities.Plan.list('-created_date');
      } catch (error) {
        console.error('Erro ao buscar planos:', error);
        toast.error('Erro ao carregar planos');
        return [];
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      console.log('Tentando criar plano com dados:', data);
      const result = await base44.asServiceRole.entities.Plan.create(data);
      console.log('Plano criado:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('Sucesso ao criar plano:', data);
      queryClient.invalidateQueries({ queryKey: ['all-plans'] });
      queryClient.invalidateQueries({ queryKey: ['available-plans'] });
      queryClient.invalidateQueries({ queryKey: ['available-plans-checkout'] });
      toast.success('Plano criado com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Erro ao criar plano:', error);
      toast.error(`Erro ao criar plano: ${error.message || 'Verifique o console'}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      try {
        return await base44.asServiceRole.entities.Plan.update(id, data);
      } catch (error) {
        console.error('Erro ao atualizar plano:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-plans'] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Plano atualizado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro completo:', error);
      toast.error(`Erro ao atualizar plano: ${error.message || 'Erro desconhecido'}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.asServiceRole.entities.Plan.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-plans'] });
      toast.success('Plano excluído com sucesso!');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      price: 0,
      billing_cycle: 'monthly',
      max_users: 5,
      max_surveys: 10,
      max_messages: 1000,
      is_active: true,
      features: []
    });
    setEditingPlan(null);
    setNewFeature('');
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setFormData(plan);
    setIsDialogOpen(true);
  };

  const handleAddFeature = () => {
    if (!newFeature.trim()) return;
    setFormData({
      ...formData,
      features: [...(formData.features || []), { name: newFeature, enabled: true }]
    });
    setNewFeature('');
  };

  const handleRemoveFeature = (index) => {
    setFormData({
      ...formData,
      features: formData.features.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    console.log('handleSubmit chamado', formData);
    
    if (!formData.name?.trim()) {
      toast.error('Preencha o nome do plano');
      return;
    }
    
    if (!formData.price || formData.price <= 0) {
      toast.error('Preencha um preço válido');
      return;
    }

    const planData = {
      name: formData.name.trim(),
      price: parseFloat(formData.price) || 0,
      billing_cycle: formData.billing_cycle || 'monthly',
      max_users: parseInt(formData.max_users) || 5,
      max_surveys: parseInt(formData.max_surveys) || 10,
      max_messages: parseInt(formData.max_messages) || 1000,
      is_active: Boolean(formData.is_active),
      features: (formData.features || []).map(f => ({
        name: f.name,
        enabled: f.enabled !== undefined ? f.enabled : true
      }))
    };

    console.log('Dados do plano a serem enviados:', planData);

    try {
      if (editingPlan) {
        await updateMutation.mutateAsync({ id: editingPlan.id, data: planData });
      } else {
        await createMutation.mutateAsync(planData);
      }
    } catch (error) {
      console.error('Erro no submit:', error);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gerenciamento de Planos</h2>
          <p className="text-slate-500">Configure os planos disponíveis para os tenants</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-gradient-to-r from-indigo-600 to-blue-600">
              <Plus className="w-4 h-4 mr-2" />
              Novo Plano
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Plano</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Basic, Plus, Pro"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ciclo de Cobrança</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.billing_cycle}
                    onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}
                  >
                    <option value="monthly">Mensal</option>
                    <option value="quarterly">Trimestral (90 dias)</option>
                    <option value="annual">Anual (12 meses)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Preço Base (R$ / mês)</Label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                  placeholder="97.00"
                />
                {formData.billing_cycle === 'annual' && (
                  <p className="text-sm text-slate-500">
                    Valor total anual: <strong>R$ {(formData.price * 12).toFixed(2)}</strong>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Máx. Usuários</Label>
                  <Input
                    type="number"
                    value={formData.max_users}
                    onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Máx. Pesquisas</Label>
                  <Input
                    type="number"
                    value={formData.max_surveys}
                    onChange={(e) => setFormData({ ...formData, max_surveys: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Máx. Mensagens</Label>
                  <Input
                    type="number"
                    value={formData.max_messages}
                    onChange={(e) => setFormData({ ...formData, max_messages: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <Label>Plano Ativo</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(val) => setFormData({ ...formData, is_active: val })}
                />
              </div>

              <div className="space-y-2">
                <Label>Funcionalidades</Label>
                {(formData.features || []).map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-white border rounded">
                    <span className="flex-1 text-sm">{feature.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveFeature(idx)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder="Nova funcionalidade..."
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                  />
                  <Button onClick={handleAddFeature} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Button 
                onClick={handleSubmit} 
                className="w-full"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {editingPlan ? 'Atualizando...' : 'Criando...'}
                  </>
                ) : (
                  editingPlan ? 'Atualizar Plano' : 'Criar Plano'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {plans.map((plan, idx) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white rounded-xl p-6 border border-slate-200"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-bold text-slate-800">{plan.name}</h3>
                  {plan.is_active ? (
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full">Ativo</span>
                  ) : (
                    <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs rounded-full">Inativo</span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-bold text-indigo-600">R$ {plan.price}</span>
                  <span className="text-slate-500">/ mês</span>
                  {plan.billing_cycle === 'annual' && (
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full">
                      Plano Anual: R$ {(plan.price * 12).toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-slate-500">Usuários</p>
                    <p className="font-semibold">{plan.max_users}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Pesquisas</p>
                    <p className="font-semibold">{plan.max_surveys}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Mensagens</p>
                    <p className="font-semibold">{plan.max_messages}</p>
                  </div>
                </div>
                {plan.features && plan.features.length > 0 && (
                  <div className="space-y-1">
                    {plan.features.slice(0, 3).map((feature, i) => (
                      <p key={i} className="text-xs text-slate-600">✓ {feature.name}</p>
                    ))}
                    {plan.features.length > 3 && (
                      <p className="text-xs text-slate-400">+{plan.features.length - 3} mais</p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleEdit(plan)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteMutation.mutate(plan.id)}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>
          </motion.div>
        ))}

        {plans.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Nenhum plano cadastrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
