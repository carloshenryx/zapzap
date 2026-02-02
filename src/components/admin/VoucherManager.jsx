import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gift, Trash2, Edit, Plus, Copy } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function VoucherManager({ userTenantId }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    internal_description: '',
    type: 'discount_percentage',
    discount_percentage: 10,
    discount_fixed: 0,
    gift_description: '',
    custom_message: '',
    is_active: true,
    expiration_days: 30,
    usage_limit: null,
    notify_on_limit: true,
    design: {
      background_color: '#5423e7',
      icon: '🎁'
    }
  });

  const queryClient = useQueryClient();

  const { data: vouchers = [] } = useQuery({
    queryKey: ['vouchers', userTenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vouchers')
        .select('*')
        .eq('tenant_id', userTenantId);
      if (error) throw error;
      return data;
    },
    enabled: !!userTenantId,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { data: newVoucher, error } = await supabase
        .from('vouchers')
        .insert([{ ...data, tenant_id: userTenantId }])
        .select()
        .single();
      if (error) throw error;
      return newVoucher;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vouchers', userTenantId] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Voucher criado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar voucher: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: updated, error } = await supabase
        .from('vouchers')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vouchers', userTenantId] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Voucher atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar voucher: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('vouchers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vouchers', userTenantId] });
      toast.success('Voucher excluído!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir voucher: ' + error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      internal_description: '',
      type: 'discount_percentage',
      discount_percentage: 10,
      discount_fixed: 0,
      gift_description: '',
      custom_message: '',
      is_active: true,
      expiration_days: 30,
      usage_limit: null,
      notify_on_limit: true,
      design: {
        background_color: '#5423e7',
        icon: '🎁'
      }
    });
    setEditingVoucher(null);
  };

  const handleEdit = (voucher) => {
    setEditingVoucher(voucher);
    setFormData(voucher);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error('Preencha nome e código do voucher');
      return;
    }

    if (editingVoucher) {
      updateMutation.mutate({ id: editingVoucher.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const generateCode = () => {
    const code = 'VOUCHER' + Math.random().toString(36).substr(2, 6).toUpperCase();
    setFormData({ ...formData, code });
  };

  const voucherTypeLabels = {
    discount_percentage: 'Desconto Percentual',
    discount_fixed: 'Desconto Fixo (R$)',
    gift: 'Brinde',
    free_shipping: 'Frete Grátis',
    custom: 'Customizado'
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Vouchers</h3>
          <p className="text-sm text-gray-500">Crie vouchers para recompensar seus clientes</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Voucher
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingVoucher ? 'Editar Voucher' : 'Novo Voucher'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Voucher</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Desconto VIP"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Código</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="CODIGO123"
                    />
                    <Button type="button" variant="outline" onClick={generateCode}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição Interna (uso administrativo)</Label>
                <Textarea
                  value={formData.internal_description}
                  onChange={(e) => setFormData({ ...formData, internal_description: e.target.value })}
                  placeholder="Ex: Voucher para clientes que avaliaram com 5 estrelas no quesito atendimento"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Voucher</Label>
                <Select value={formData.type} onValueChange={(val) => setFormData({ ...formData, type: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(voucherTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.type === 'discount_percentage' && (
                <div className="space-y-2">
                  <Label>Desconto (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.discount_percentage}
                    onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) })}
                  />
                </div>
              )}

              {formData.type === 'discount_fixed' && (
                <div className="space-y-2">
                  <Label>Valor do Desconto (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.discount_fixed}
                    onChange={(e) => setFormData({ ...formData, discount_fixed: parseFloat(e.target.value) })}
                  />
                </div>
              )}

              {formData.type === 'gift' && (
                <div className="space-y-2">
                  <Label>Descrição do Brinde</Label>
                  <Textarea
                    value={formData.gift_description}
                    onChange={(e) => setFormData({ ...formData, gift_description: e.target.value })}
                    placeholder="Ex: Caneca personalizada + Chaveiro"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Mensagem Customizada</Label>
                <Textarea
                  value={formData.custom_message}
                  onChange={(e) => setFormData({ ...formData, custom_message: e.target.value })}
                  placeholder="Mensagem que aparecerá no voucher"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dias para Expiração</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.expiration_days}
                    onChange={(e) => setFormData({ ...formData, expiration_days: parseInt(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Limite de Uso (opcional)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.usage_limit || ''}
                    onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Ilimitado"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Design</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Cor de Fundo</Label>
                    <Input
                      type="color"
                      value={formData.design?.background_color || '#5423e7'}
                      onChange={(e) => setFormData({
                        ...formData,
                        design: { ...formData.design, background_color: e.target.value }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Emoji/Ícone</Label>
                    <Input
                      value={formData.design?.icon || '🎁'}
                      onChange={(e) => setFormData({
                        ...formData,
                        design: { ...formData.design, icon: e.target.value }
                      })}
                      placeholder="🎁"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label>Voucher Ativo</Label>
                    <p className="text-xs text-gray-500">Permite que o voucher seja gerado</p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(val) => setFormData({ ...formData, is_active: val })}
                  />
                </div>

                {formData.usage_limit && (
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div>
                      <Label>Notificar Administradores</Label>
                      <p className="text-xs text-gray-500">Enviar notificação quando atingir o limite de uso</p>
                    </div>
                    <Switch
                      checked={formData.notify_on_limit}
                      onCheckedChange={(val) => setFormData({ ...formData, notify_on_limit: val })}
                    />
                  </div>
                )}
              </div>

              <Button onClick={handleSubmit} className="w-full">
                {editingVoucher ? 'Atualizar Voucher' : 'Criar Voucher'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {vouchers.map((voucher) => (
          <motion.div
            key={voucher.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl p-5 border border-gray-200"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                  style={{ backgroundColor: voucher.design?.background_color }}
                >
                  {voucher.design?.icon || '🎁'}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{voucher.name}</h4>
                  <p className="text-sm text-gray-500 font-mono">Código: {voucher.code}</p>
                  {voucher.internal_description && (
                    <p className="text-xs text-gray-400 mt-1 italic">{voucher.internal_description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{voucherTypeLabels[voucher.type]}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {!voucher.is_active && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Inativo</span>
                    )}
                    {voucher.usage_limit && (
                      <span className={`text-xs px-2 py-1 rounded ${(voucher.current_usage || 0) >= voucher.usage_limit
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                        }`}>
                        {voucher.current_usage || 0}/{voucher.usage_limit} usos
                        {(voucher.current_usage || 0) >= voucher.usage_limit && ' (LIMITE ATINGIDO)'}
                      </span>
                    )}
                    {voucher.notify_on_limit && voucher.usage_limit && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">🔔 Notifica</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(voucher)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(voucher.id)}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>
          </motion.div>
        ))}

        {vouchers.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Gift className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-gray-500">Nenhum voucher criado ainda</p>
          </div>
        )}
      </div>
    </div>
  );
}