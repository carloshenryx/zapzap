import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search,
  Mail,
  MessageCircle,
  Eye,
  Loader2,
  Calendar,
  Star,
  Download,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import CustomersExportDialog from '@/components/customers/CustomersExportDialog';
import { createPageUrl } from '../utils';
import { getScoreLabel5, getUnifiedScore5 } from '@/lib/ratingUtils';
export default function Customers() {
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [lowScoreThreshold, setLowScoreThreshold] = useState(2);
  const { userProfile } = useAuth();

  // Use AuthContext userProfile
  const user = userProfile;

  // Fetch customers/responses for this tenant only
  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['tenant-customers', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];

      const { data, error } = await supabase
        .from('survey_responses')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.tenant_id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tenant-crm-tasks', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];

      const { data, error } = await supabase
        .from('crm_tasks')
        .select('id, customer_email, customer_phone, status, due_date')
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) return [];
      return data || [];
    },
    enabled: !!user?.tenant_id,
    staleTime: 30_000,
  });

  // Group responses by customer
  const customerMap = responses.reduce((acc, response) => {
    const key = response.customer_email || response.customer_phone || 'anonymous';
    if (!acc[key]) {
      acc[key] = {
        name: response.customer_name || 'Cliente Anônimo',
        email: response.customer_email,
        phone: response.customer_phone,
        cpf: response.customer_cpf,
        responses: [],
      };
    }
    acc[key].responses.push(response);
    return acc;
  }, {});

  const now = Date.now();
  const customers = Object.values(customerMap).map(c => {
    const sorted = [...c.responses].sort((a, b) => new Date(b.created_at || b.created_date || 0).getTime() - new Date(a.created_at || a.created_date || 0).getTime());
    const last = sorted[0];
    const lastScore5 = last ? getUnifiedScore5(last) : null;
    const lastLabel = getScoreLabel5(lastScore5);
    const lowResponses = sorted.filter(r => {
      const s = getUnifiedScore5(r);
      return s !== null && s <= lowScoreThreshold;
    });
    const lowWithComment = lowResponses.filter(r => !!r.comment).length;
    const pendingFollowups = sorted.filter(r => ['open', 'in_progress'].includes(r.followup_status)).length;

    const relatedTasks = tasks.filter(t => (c.email && t.customer_email === c.email) || (c.phone && t.customer_phone === c.phone));
    const openTasks = relatedTasks.filter(t => t.status !== 'completed' && t.status !== 'resolved' && t.status !== 'done');
    const overdueTasks = openTasks.filter(t => t.due_date && new Date(t.due_date).getTime() < now).length;

    return {
      ...c,
      responses: sorted,
      lastScore5,
      lastLabel,
      lowCount: lowResponses.length,
      lowWithComment,
      pendingFollowups,
      overdueTasks,
    };
  });

  const searchedCustomers = customers.filter(customer => {
    const term = searchTerm.toLowerCase();
    return !term ||
      customer.name?.toLowerCase().includes(term) ||
      customer.email?.toLowerCase().includes(term) ||
      customer.phone?.includes(term);
  });

  const lowCustomers = searchedCustomers.filter(c => c.lowCount > 0);
  const visibleCustomers = activeTab === 'low' ? lowCustomers : searchedCustomers;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f7f7f8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5423e7] animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-[#f7f7f8] min-h-screen">
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-between items-start"
          >
            <div>
              <h1 className="text-3xl font-bold text-[#121217]">Clientes</h1>
              <p className="text-sm text-[#6c6c89] mt-2">Gerenciar clientes e visualizar histórico de pesquisas</p>
            </div>
            <Button variant="outline" className="gap-2" onClick={() => setShowExportDialog(true)}>
              <Download className="w-4 h-4" />
              Exportar Clientes
            </Button>
          </motion.div>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c6c89]" />
              <input
                type="text"
                placeholder="Buscar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-[#d1d1db] rounded-lg focus:outline-none focus:border-[#5423e7] bg-white"
              />
            </div>
            <div className="flex items-center gap-2 bg-white border border-[#d1d1db] rounded-lg px-3">
              <span className="text-xs text-[#6c6c89] whitespace-nowrap">Nota baixa ≤</span>
              <input
                type="number"
                min="0"
                max="5"
                step="0.5"
                value={lowScoreThreshold}
                onChange={(e) => setLowScoreThreshold(Number(e.target.value))}
                className="w-16 py-2 outline-none text-sm"
              />
            </div>
          </motion.div>

          {/* Customers List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-[#d1d1db] overflow-hidden"
          >
            <div className="p-6 border-b border-[#d1d1db]">
              <div className="flex items-center gap-2 mb-5">
                <Button
                  variant={activeTab === 'all' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('all')}
                >
                  Todos ({searchedCustomers.length})
                </Button>
                <Button
                  variant={activeTab === 'low' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('low')}
                >
                  Clientes com Nota Baixa ({lowCustomers.length})
                </Button>
              </div>
              <div className="grid grid-cols-5 gap-4 text-sm font-semibold text-[#6c6c89]">
                <div>Nome</div>
                <div>Email</div>
                <div>Telefone</div>
                <div className="text-center">Pesquisas</div>
                <div className="text-center">Ações</div>
              </div>
            </div>

            <div className="divide-y divide-[#d1d1db]">
              {visibleCustomers.length > 0 ? (
                visibleCustomers.map((customer, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-6 grid grid-cols-5 gap-4 items-center hover:bg-[#f7f7f8] transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-[#121217]">{customer.name}</p>
                        {customer.lastScore5 !== null && (
                          <Badge className={customer.lastLabel.className}>
                            <Star className="w-3 h-3 mr-1" />
                            {Number.isInteger(customer.lastScore5) ? customer.lastScore5 : customer.lastScore5.toFixed(1)} • {customer.lastLabel.label}
                          </Badge>
                        )}
                        {(customer.overdueTasks > 0 || customer.pendingFollowups > 0) && (
                          <Badge className="bg-red-50 text-red-800 border border-red-100">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {customer.overdueTasks > 0 ? `${customer.overdueTasks} tarefa(s) vencida(s)` : `${customer.pendingFollowups} tratativa(s) pendente(s)`}
                          </Badge>
                        )}
                      </div>
                      {customer.cpf && <p className="text-xs text-[#6c6c89] mt-1">CPF: {customer.cpf}</p>}
                      {customer.lowCount > 0 && (
                        <p className="text-xs text-[#6c6c89] mt-1">
                          {customer.lowCount} nota(s) baixa(s){customer.lowWithComment > 0 ? ` • ${customer.lowWithComment} com comentário` : ''}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-[#121217]">{customer.email || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-[#121217]">{customer.phone || '-'}</p>
                    </div>
                    <div className="text-center">
                      <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                        {customer.responses.length}
                      </span>
                    </div>
                    <div className="flex justify-center gap-2">
                      {customer.email && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.location.href = `mailto:${customer.email}`}
                          title="Enviar email"
                        >
                          <Mail className="w-4 h-4 text-[#6c6c89]" />
                        </Button>
                      )}
                      {customer.phone && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(`https://wa.me/${customer.phone.replace(/\D/g, '')}`)}
                          title="Enviar WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4 text-green-600" />
                        </Button>
                      )}
                      {(customer.email || customer.phone) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const qs = new URLSearchParams();
                            if (customer.email) qs.set('email', customer.email);
                            if (customer.phone) qs.set('phone', customer.phone);
                            window.location.href = createPageUrl('CustomerDetail') + `?${qs.toString()}`;
                          }}
                          title="Abrir CRM do cliente"
                        >
                          <Star className="w-4 h-4 text-[#121217]" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedCustomer(customer)}
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4 text-[#5423e7]" />
                      </Button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <p className="text-[#6c6c89]">Nenhum cliente encontrado</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes do Cliente e Pesquisas</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="space-y-3">
                <h4 className="font-semibold text-[#121217]">Dados do Cliente</h4>
                <div className="grid grid-cols-2 gap-3 p-3 bg-[#f7f7f8] rounded-lg">
                  <div>
                    <p className="text-xs text-[#6c6c89]">Nome</p>
                    <p className="font-medium text-[#121217]">{selectedCustomer.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6c6c89]">Email</p>
                    <p className="font-medium text-[#121217]">{selectedCustomer.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6c6c89]">Telefone</p>
                    <p className="font-medium text-[#121217]">{selectedCustomer.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6c6c89]">CPF</p>
                    <p className="font-medium text-[#121217]">{selectedCustomer.cpf || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Survey Responses */}
              <div className="space-y-3">
                <h4 className="font-semibold text-[#121217]">Histórico de Pesquisas ({selectedCustomer.responses.length})</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selectedCustomer.responses.map((response, idx) => (
                    <div key={idx} className="p-3 bg-[#f7f7f8] rounded-lg border border-[#d1d1db]">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#6c6c89]" />
                          <span className="text-xs text-[#6c6c89]">
                            {new Date(response.created_at || response.created_date).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        {(() => {
                          const score5 = getUnifiedScore5(response);
                          const label = getScoreLabel5(score5);
                          if (score5 === null) return null;
                          return (
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-4 h-4 ${i < Math.floor(score5) ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`}
                                  />
                                ))}
                              </div>
                              <Badge className={label.className}>
                                {Number.isInteger(score5) ? score5 : score5.toFixed(1)} • {label.label}
                              </Badge>
                            </div>
                          );
                        })()}
                      </div>
                      {response.comment && (
                        <p className="text-sm text-[#121217]">{response.comment}</p>
                      )}
                      {response.would_recommend && (
                        <p className="text-xs text-green-600 mt-2">✓ Recomendaria</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Export Dialog */}
      <CustomersExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        customers={visibleCustomers}
      />
    </div>
  );
}
