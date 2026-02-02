import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, DollarSign, TrendingUp, Lock, Unlock, Search, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function TenantFinancials() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const queryClient = useQueryClient();

  const { data: tenants = [] } = useQuery({
    queryKey: ['all-tenants'],
    queryFn: () => base44.asServiceRole.entities.Tenant.list('-created_date'),
  });

  const { data: financialData } = useQuery({
    queryKey: ['tenant-financial', selectedTenant?.id],
    queryFn: async () => {
      if (!selectedTenant) return null;
      
      const [subscriptions, invoices, payments, consumption] = await Promise.all([
        base44.asServiceRole.entities.Subscription.filter({ tenant_id: selectedTenant.id }),
        base44.asServiceRole.entities.Invoice.filter({ tenant_id: selectedTenant.id }, '-created_date'),
        base44.asServiceRole.entities.Payment.filter({ customer_email: selectedTenant.contact_email }, '-created_date'),
        base44.asServiceRole.entities.Consumption.filter({ tenant_id: selectedTenant.id }, '-created_date', 1)
      ]);

      return { subscriptions, invoices, payments, consumption: consumption[0] };
    },
    enabled: !!selectedTenant,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ tenantId, newStatus }) => 
      base44.asServiceRole.entities.Tenant.update(tenantId, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-financial'] });
      toast.success('Status do tenant atualizado!');
    },
  });

  const filteredTenants = tenants.filter(t => 
    t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.contact_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleBlockTenant = (tenant) => {
    const newStatus = tenant.status === 'suspended' ? 'active' : 'suspended';
    toggleStatusMutation.mutate({ tenantId: tenant.id, newStatus });
  };

  const totalRevenue = financialData?.payments
    ?.filter(p => p.status === 'succeeded')
    ?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

  const pendingInvoices = financialData?.invoices?.filter(i => i.status === 'pending').length || 0;
  const overdueInvoices = financialData?.invoices?.filter(i => i.status === 'overdue').length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Financeiro dos Tenants</h2>
        <p className="text-slate-500">Visualize dados financeiros e gerencie o acesso dos tenants</p>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar tenant por nome, empresa ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Lista de Tenants */}
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-700">Tenants</h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredTenants.map((tenant) => (
              <motion.div
                key={tenant.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedTenant(tenant)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedTenant?.id === tenant.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:border-indigo-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-800">{tenant.company_name || tenant.name}</h4>
                    <p className="text-xs text-slate-500">{tenant.contact_email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {tenant.status === 'active' ? (
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full">Ativo</span>
                      ) : tenant.status === 'suspended' ? (
                        <span className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-full">Bloqueado</span>
                      ) : (
                        <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs rounded-full">{tenant.status}</span>
                      )}
                      {tenant.plan_type && (
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">{tenant.plan_type}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBlockTenant(tenant);
                    }}
                    className={tenant.status === 'suspended' ? 'text-emerald-600' : 'text-red-600'}
                  >
                    {tenant.status === 'suspended' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Detalhes Financeiros */}
        <div className="space-y-4">
          {selectedTenant ? (
            <>
              <div className="bg-white p-4 rounded-lg border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4">
                  Dados Financeiros - {selectedTenant.company_name || selectedTenant.name}
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-emerald-50 rounded-lg">
                    <DollarSign className="w-6 h-6 text-emerald-600 mb-2" />
                    <p className="text-2xl font-bold text-emerald-700">R$ {totalRevenue.toFixed(2)}</p>
                    <p className="text-xs text-emerald-600">Receita Total</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-blue-600 mb-2" />
                    <p className="text-2xl font-bold text-blue-700">{financialData?.payments?.length || 0}</p>
                    <p className="text-xs text-blue-600">Transações</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-amber-600 mb-2" />
                    <p className="text-2xl font-bold text-amber-700">{pendingInvoices}</p>
                    <p className="text-xs text-amber-600">Faturas Pendentes</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-red-600 mb-2" />
                    <p className="text-2xl font-bold text-red-700">{overdueInvoices}</p>
                    <p className="text-xs text-red-600">Faturas Vencidas</p>
                  </div>
                </div>

                {/* Assinatura Atual */}
                {financialData?.subscriptions && financialData.subscriptions.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-slate-700 mb-2">Assinatura Ativa</h4>
                    {financialData.subscriptions.map((sub) => (
                      <div key={sub.id} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{sub.plan_type}</p>
                            <p className="text-xs text-slate-500">
                              Início: {format(new Date(sub.start_date), 'dd/MM/yyyy')}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            sub.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {sub.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Consumo */}
                {financialData?.consumption && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-slate-700 mb-2">Consumo</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-slate-500">Mensagens</p>
                        <p className="font-semibold">{financialData.consumption.messages_sent || 0}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-slate-500">Pesquisas</p>
                        <p className="font-semibold">{financialData.consumption.surveys_created || 0}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-slate-500">Respostas</p>
                        <p className="font-semibold">{financialData.consumption.responses_received || 0}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-slate-500">IA</p>
                        <p className="font-semibold">{financialData.consumption.ai_requests || 0}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Últimos Pagamentos */}
                {financialData?.payments && financialData.payments.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-2">Últimas Transações</h4>
                    <div className="space-y-2">
                      {financialData.payments.slice(0, 5).map((payment) => (
                        <div key={payment.id} className="flex justify-between items-center p-2 bg-slate-50 rounded text-sm">
                          <div>
                            <p className="font-medium">R$ {payment.amount?.toFixed(2)}</p>
                            <p className="text-xs text-slate-500">{payment.plan_type}</p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            payment.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' :
                            payment.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                            'bg-red-50 text-red-700'
                          }`}>
                            {payment.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white p-12 rounded-lg border border-slate-200 text-center">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Selecione um tenant para ver os dados financeiros</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}