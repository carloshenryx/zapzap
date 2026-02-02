import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function WebhookMessagesMonitor() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedTenant, setSelectedTenant] = useState('all');

  // Fetch all tenants
  const { data: tenants = [] } = useQuery({
    queryKey: ['all-tenants-monitor'],
    queryFn: async () => {
      const result = await base44.asServiceRole.entities.Tenant.list('-created_date', 100);
      return result;
    },
  });

  // Fetch WhatsApp messages
  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ['whatsapp-messages-monitor', selectedTenant],
    queryFn: async () => {
      if (selectedTenant === 'all') {
        return base44.asServiceRole.entities.WhatsAppMessage.list('-created_date', 500);
      }
      return base44.asServiceRole.entities.WhatsAppMessage.filter(
        { tenant_id: selectedTenant },
        '-created_date',
        500
      );
    },
  });

  // Fetch trigger configs
  const { data: triggers = [] } = useQuery({
    queryKey: ['trigger-configs-monitor'],
    queryFn: async () => {
      return base44.asServiceRole.entities.WhatsAppTriggerConfig.list('-created_date', 100);
    },
  });

  // Filter and search
  const filteredMessages = messages.filter(msg => {
    const matchesSearch = !searchTerm || 
      msg.phone_number?.includes(searchTerm) ||
      msg.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.message_text?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || msg.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status) => {
    switch(status) {
      case 'sent':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <MessageCircle className="w-4 h-4 text-slate-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'sent':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const stats = {
    total: messages.length,
    sent: messages.filter(m => m.status === 'sent').length,
    pending: messages.filter(m => m.status === 'pending').length,
    failed: messages.filter(m => m.status === 'failed').length
  };

  if (loadingMessages) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-[#d1d1db] p-4"
        >
          <p className="text-xs text-[#6c6c89] mb-1">Total de Mensagens</p>
          <p className="text-2xl font-bold text-[#121217]">{stats.total}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl border border-[#d1d1db] p-4"
        >
          <p className="text-xs text-[#6c6c89] mb-1">Enviadas</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.sent}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl border border-[#d1d1db] p-4"
        >
          <p className="text-xs text-[#6c6c89] mb-1">Pendentes</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl border border-[#d1d1db] p-4"
        >
          <p className="text-xs text-[#6c6c89] mb-1">Falhadas</p>
          <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#d1d1db] p-4 space-y-4">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-64">
            <label className="text-xs text-[#6c6c89] font-medium mb-2 block">Buscar por telefone ou cliente</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#6c6c89]" />
              <Input
                placeholder="Digite telefone ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="w-48">
            <label className="text-xs text-[#6c6c89] font-medium mb-2 block">Tenant</label>
            <Select value={selectedTenant} onValueChange={setSelectedTenant}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tenants</SelectItem>
                {tenants.map(tenant => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.company_name || tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-48">
            <label className="text-xs text-[#6c6c89] font-medium mb-2 block">Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="sent">Enviadas</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="failed">Falhadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="bg-white rounded-xl border border-[#d1d1db] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#f7f7f8] border-b border-[#d1d1db]">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[#6c6c89]">Data/Hora</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[#6c6c89]">Cliente</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[#6c6c89]">Telefone</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[#6c6c89]">Mensagem</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[#6c6c89]">Instância</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[#6c6c89]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d1d1db]">
              {filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-[#6c6c89]">
                    Nenhuma mensagem encontrada
                  </td>
                </tr>
              ) : (
                filteredMessages.slice(0, 100).map((msg, idx) => {
                  const tenantName = tenants.find(t => t.id === msg.tenant_id)?.company_name || msg.tenant_id;
                  return (
                    <motion.tr
                      key={msg.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      className="hover:bg-[#f7f7f8] transition-colors"
                    >
                      <td className="px-6 py-3 text-xs text-[#6c6c89]">
                        {new Date(msg.created_date).toLocaleDateString('pt-BR')} {new Date(msg.created_date).toLocaleTimeString('pt-BR')}
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-[#121217]">
                        <div>
                          <p>{msg.customer_name || 'Sem nome'}</p>
                          <p className="text-xs text-[#6c6c89]">{tenantName}</p>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-[#121217]">
                        {msg.phone_number}
                      </td>
                      <td className="px-6 py-3 text-sm text-[#6c6c89] max-w-xs truncate">
                        {msg.message_text || msg.survey_link}
                      </td>
                      <td className="px-6 py-3 text-xs text-[#6c6c89]">
                        {msg.instance_name}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(msg.status)}`}>
                          {getStatusIcon(msg.status)}
                          {msg.status === 'sent' && 'Enviada'}
                          {msg.status === 'pending' && 'Pendente'}
                          {msg.status === 'failed' && 'Falhou'}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredMessages.length > 100 && (
          <div className="px-6 py-3 bg-[#f7f7f8] text-xs text-[#6c6c89] border-t border-[#d1d1db]">
            Mostrando 100 de {filteredMessages.length} mensagens
          </div>
        )}
      </div>

      {/* Trigger Configs Summary */}
      {triggers.length > 0 && (
        <div className="bg-white rounded-xl border border-[#d1d1db] p-6">
          <h3 className="text-lg font-semibold text-[#121217] mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Configurações de Webhook Ativas
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {triggers.filter(t => t.is_active).map(trigger => {
              const tenant = tenants.find(t => t.id === trigger.tenant_id);
              return (
                <motion.div
                  key={trigger.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-[#d1d1db] rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-[#121217]">{trigger.name}</p>
                      <p className="text-xs text-[#6c6c89]">{tenant?.company_name}</p>
                    </div>
                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  </div>
                  
                  <div className="space-y-2 text-xs text-[#6c6c89]">
                    <p><strong>ID Externo:</strong> {trigger.external_trigger_id}</p>
                    <p><strong>Instância:</strong> {trigger.whatsapp_instance_name}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}