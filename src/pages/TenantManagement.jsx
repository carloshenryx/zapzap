import React, { useState } from 'react';
import { fetchAPI } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { Plus, Building2, Mail, Phone, Loader2, CheckCircle2, XCircle, Pause, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function TenantManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTenants, setSelectedTenants] = useState(new Set());
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    contact_email: '',
    contact_phone: '',
    plan_type: 'basic'
  });

  const queryClient = useQueryClient();

  const { data: contextData, isLoading: loadingContext, error: contextError } = useQuery({
    queryKey: ['tenant-context'],
    queryFn: async () => {
      return await fetchAPI('/auth?action=context');
    },
  });

  const createTenantMutation = useMutation({
    mutationFn: async (data) => {
      return await fetchAPI('/tenants?action=create', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-context'] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Tenant criado com sucesso!');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao criar tenant');
    }
  });

  const deleteTenantMutation = useMutation({
    mutationFn: async (tenantId) => {
      return await fetchAPI('/tenants?action=manage-status', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: tenantId,
          action: 'delete'
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-context'] });
      toast.success('Tenant deletado com sucesso!');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao deletar tenant');
    }
  });

  const suspendTenantMutation = useMutation({
    mutationFn: async (tenantId) => {
      return await fetchAPI('/tenants?action=manage-status', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: tenantId,
          action: 'suspend'
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-context'] });
      toast.success('Tenant inativado com sucesso!');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao inativar tenant');
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (tenantIds) => {
      const promises = tenantIds.map(id =>
        fetchAPI('/tenants?action=manage-status', {
          method: 'POST',
          body: JSON.stringify({
            tenant_id: id,
            action: 'delete'
          })
        })
      );
      await Promise.all(promises);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-context'] });
      setSelectedTenants(new Set());
      toast.success('Tenants deletados com sucesso!');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao deletar tenants em massa');
    }
  });

  const bulkSuspendMutation = useMutation({
    mutationFn: async (tenantIds) => {
      const promises = tenantIds.map(id =>
        fetchAPI('/tenants?action=manage-status', {
          method: 'POST',
          body: JSON.stringify({
            tenant_id: id,
            action: 'suspend'
          })
        })
      );
      await Promise.all(promises);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-context'] });
      setSelectedTenants(new Set());
      toast.success('Tenants inativados com sucesso!');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao inativar tenants em massa');
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      company_name: '',
      contact_email: '',
      contact_phone: '',
      plan_type: 'basic'
    });
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.contact_email) {
      toast.error('Nome e email são obrigatórios');
      return;
    }
    createTenantMutation.mutate(formData);
  };

  const toggleTenantSelection = (tenantId) => {
    const newSelected = new Set(selectedTenants);
    if (newSelected.has(tenantId)) {
      newSelected.delete(tenantId);
    } else {
      newSelected.add(tenantId);
    }
    setSelectedTenants(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedTenants.size === contextData?.tenants?.length) {
      setSelectedTenants(new Set());
    } else {
      const allIds = new Set(contextData?.tenants?.map(t => t.id) || []);
      setSelectedTenants(allIds);
    }
  };

  if (loadingContext) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (contextError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 shadow-lg text-center max-w-md">
          <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Erro ao carregar</h2>
          <p className="text-slate-500">
            Não foi possível carregar o gerenciamento de tenants. Tente novamente.
          </p>
          <div className="mt-6 flex justify-center">
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['tenant-context'] })}>
              Recarregar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!contextData?.is_super_admin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 shadow-lg text-center max-w-md">
          <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Acesso Negado</h2>
          <p className="text-slate-500">
            Você não tem permissão para acessar o gerenciamento de tenants.
            Apenas super administradores podem gerenciar tenants.
          </p>
        </div>
      </div>
    );
  }

  const statusConfig = {
    active: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Ativo' },
    suspended: { icon: Pause, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Suspenso' },
    canceled: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Cancelado' }
  };

  return (
    <div className="bg-[#f7f7f8] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#121217]">Gerenciamento de Tenants</h1>
            <p className="text-sm text-[#6c6c89] mt-1">Gerencie todos os clientes do sistema</p>
          </div>
          <div className="flex gap-2">
            {selectedTenants.size > 0 && (
              <>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50">
                      <Pause className="w-4 h-4 mr-2" />
                      Inativar ({selectedTenants.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Inativar Tenants?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Você está prestes a inativar {selectedTenants.size} tenant(s). Esta ação pode ser revertida.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex gap-4">
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => bulkSuspendMutation.mutate(Array.from(selectedTenants))}
                        disabled={bulkSuspendMutation.isPending}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        Confirmar
                      </AlertDialogAction>
                    </div>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Deletar ({selectedTenants.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Deletar Tenants Permanentemente?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Você está prestes a deletar {selectedTenants.size} tenant(s) permanentemente. Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex gap-4">
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => bulkDeleteMutation.mutate(Array.from(selectedTenants))}
                        disabled={bulkDeleteMutation.isPending}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Deletar
                      </AlertDialogAction>
                    </div>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Tenant
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Criar Novo Tenant</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nome do Tenant *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Cliente ABC"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome da Empresa</Label>
                    <Input
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder="Ex: ABC Ltda"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email de Contato *</Label>
                    <Input
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                      placeholder="contato@empresa.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Plano</Label>
                    <Input
                      value={formData.plan_type}
                      onChange={(e) => setFormData({ ...formData, plan_type: e.target.value })}
                      placeholder="basic, pro, enterprise"
                    />
                  </div>
                  <Button
                    onClick={handleSubmit}
                    disabled={createTenantMutation.isPending}
                    className="w-full"
                  >
                    {createTenantMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      'Criar Tenant'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tenants Grid */}
        <div className="grid gap-4">
          {/* Select All Row */}
          {contextData?.tenants?.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-4 flex items-center gap-3">
              <Checkbox
                checked={selectedTenants.size === contextData?.tenants?.length}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm text-slate-600 font-medium">
                Selecionar todos ({contextData?.tenants?.length})
              </span>
            </div>
          )}

          {contextData?.tenants?.map((tenant, idx) => {
            const status = statusConfig[tenant.status] || statusConfig.active;
            const StatusIcon = status.icon;
            const isSelected = selectedTenants.has(tenant.id);

            return (
              <motion.div
                key={tenant.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={cn("bg-white rounded-xl p-5 border transition-all flex items-start gap-4",
                  isSelected ? "border-[#5423e7] bg-[#e8f5fc]" : "border-[#d1d1db]"
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleTenantSelection(tenant.id)}
                  className="mt-1"
                />
                <div className="flex items-start justify-between flex-1">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#5423e7] flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#121217]">{tenant.name}</h3>
                      {tenant.company_name && (
                        <p className="text-xs text-[#6c6c89]">{tenant.company_name}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-[#6c6c89]">
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {tenant.contact_email}
                        </div>
                        {tenant.contact_phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {tenant.contact_phone}
                          </div>
                        )}
                      </div>
                      <div className="mt-2">
                        <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                          Plano: {tenant.plan_type}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full', status.bg)}>
                      <StatusIcon className={cn('w-4 h-4', status.color)} />
                      <span className={cn('text-sm font-medium', status.color)}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {tenant.status === 'active' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50">
                              <Pause className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Inativar Tenant?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja inativar {tenant.name}?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="flex gap-4">
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => suspendTenantMutation.mutate(tenant.id)}
                                disabled={suspendTenantMutation.isPending}
                                className="bg-amber-600 hover:bg-amber-700"
                              >
                                Inativar
                              </AlertDialogAction>
                            </div>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Deletar Tenant?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja deletar permanentemente {tenant.name}? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="flex gap-4">
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteTenantMutation.mutate(tenant.id)}
                              disabled={deleteTenantMutation.isPending}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Deletar
                            </AlertDialogAction>
                          </div>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {contextData?.tenants?.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-[#d1d1db]">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-[#6c6c89]" />
              <p className="text-sm text-[#6c6c89]">Nenhum tenant criado ainda</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
