import React, { useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/supabase';
import { Navigate } from 'react-router-dom';
import SystemBrandingManager from '@/components/master/SystemBrandingManager';
import SystemNotificationsManager from '@/components/master/SystemNotificationsManager';
import {
  Building2,
  Users,
  MessageSquare,
  TrendingUp,
  Search,
  Crown,
  Activity,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Shield,
  ShieldOff,
  KeyRound,
  Link2,
  Trash2,
  Bell
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function MasterDashboard() {
  const { userProfile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('tenants');
  const [usersSearchTerm, setUsersSearchTerm] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [selectedUserForTenant, setSelectedUserForTenant] = useState(null);
  const [selectedTenantIdForUser, setSelectedTenantIdForUser] = useState('none');

  const queryClient = useQueryClient();

  // Fetch system overview
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['system-overview'],
    queryFn: async () => {
      return await fetchAPI('/analytics?action=system-overview');
    },
    enabled: !!userProfile?.is_super_admin,
    retry: false,
  });

  // Fetch all tenants
  const { data: tenantsData, isLoading: tenantsLoading, error: tenantsError } = useQuery({
    queryKey: ['all-tenants'],
    queryFn: async () => {
      return await fetchAPI('/tenants?action=list-all');
    },
    enabled: !!userProfile?.is_super_admin,
    retry: false,
  });

  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ['admin-users', usersPage],
    queryFn: async () => {
      return await fetchAPI(`/admin?action=list-users&page=${usersPage}&per_page=100`);
    },
    enabled: !!userProfile?.is_super_admin && activeTab === 'users',
    retry: false,
  });

  const { data: tenantUsersData, isLoading: tenantUsersLoading, error: tenantUsersError } = useQuery({
    queryKey: ['tenant-users', selectedTenant?.id],
    queryFn: async () => {
      return await fetchAPI(`/admin?action=list-tenant-users&tenant_id=${selectedTenant?.id}`);
    },
    enabled: !!userProfile?.is_super_admin && !!selectedTenant?.id,
    retry: false,
  });

  const setUserPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }) => {
      return await fetchAPI('/admin?action=set-user-password', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, password }),
      });
    },
    onSuccess: () => {
      toast.success('Senha alterada com sucesso');
      setSelectedUserForPassword(null);
      setNewPassword('');
    },
    onError: (err) => toast.error(err.message || 'Erro ao alterar senha'),
  });

  const setUserBanMutation = useMutation({
    mutationFn: async ({ userId, banned }) => {
      return await fetchAPI('/admin?action=set-user-ban', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, banned }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Usuário atualizado');
    },
    onError: (err) => toast.error(err.message || 'Erro ao atualizar usuário'),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async ({ userId }) => {
      return await fetchAPI('/admin?action=delete-user', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Usuário excluído');
    },
    onError: (err) => toast.error(err.message || 'Erro ao excluir usuário'),
  });

  const assignUserTenantMutation = useMutation({
    mutationFn: async ({ userId, tenantId }) => {
      return await fetchAPI('/admin?action=assign-user-tenant', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, tenant_id: tenantId === 'none' ? null : tenantId }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      await queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
      toast.success('Vínculo atualizado');
      setSelectedUserForTenant(null);
      setSelectedTenantIdForUser('none');
    },
    onError: (err) => toast.error(err.message || 'Erro ao vincular tenant'),
  });

  const updateTenantMutation = useMutation({
    mutationFn: async ({ tenantId, updates }) => {
      return await fetchAPI('/tenants?action=update', {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenantId, ...(updates || {}) }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['all-tenants'] });
      toast.success('Tenant atualizado');
    },
    onError: (err) => toast.error(err.message || 'Erro ao atualizar tenant'),
  });

  const tenants = tenantsData?.tenants || [];

  // Filter tenants by search
  const filteredTenants = tenants.filter(tenant =>
    tenant.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.contact_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const users = usersData?.users || [];
  const filteredUsers = useMemo(() => {
    const q = usersSearchTerm.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      String(u.email || '').toLowerCase().includes(q) ||
      String(u.full_name || '').toLowerCase().includes(q) ||
      String(u.tenant_name || '').toLowerCase().includes(q)
    );
  }, [users, usersSearchTerm]);

  if (!userProfile?.is_super_admin) {
    return <Navigate to="/Dashboard" replace />;
  }

  const MetricCard = ({ icon: Icon, label, value, sublabel, color = 'blue' }) => (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className={`text-3xl font-bold mt-2 text-${color}-600`}>
            {value?.toLocaleString() || 0}
          </p>
          {sublabel && (
            <p className="text-xs text-gray-500 mt-1">{sublabel}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-${color}-100`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Crown className="w-8 h-8 text-yellow-600" />
              <h1 className="text-3xl font-bold text-gray-900">MasterDashboard</h1>
            </div>
            <p className="text-gray-600 mt-1">Painel de administração geral do sistema</p>
          </div>
          <Badge variant="secondary" className="px-4 py-2">
            <Crown className="w-4 h-4 mr-2" />
            Super Admin
          </Badge>
        </div>

        <SystemBrandingManager />

        {/* System Overview */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Visão Geral do Sistema
          </h2>

          {overviewLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Card key={i} className="p-6 animate-pulse">
                  <div className="h-20 bg-gray-200 rounded"></div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                icon={Building2}
                label="Total de Tenants"
                value={overview?.total_tenants}
                sublabel={`${overview?.active_subscriptions} com plano ativo`}
                color="blue"
              />
              <MetricCard
                icon={Users}
                label="Total de Usuários"
                value={overview?.total_users}
                sublabel="Em todos os tenants"
                color="green"
              />
              <MetricCard
                icon={MessageSquare}
                label="Mensagens (mês atual)"
                value={overview?.current_month?.messages_sent}
                sublabel={`${overview?.current_month?.surveys_created || 0} pesquisas criadas`}
                color="purple"
              />
              <MetricCard
                icon={TrendingUp}
                label="Respostas Totais"
                value={overview?.total_responses_ever}
                sublabel={`${overview?.current_month?.responses_received || 0} este mês`}
                color="orange"
              />
            </div>
          )}
        </div>

        {/* Tenants Table */}
        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-600" />
                Administração do Sistema
              </h2>
              <TabsList>
                <TabsTrigger value="tenants" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Tenants
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Usuários
                </TabsTrigger>
                <TabsTrigger value="notifications" className="flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Notificações
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="tenants">
              <div className="mb-4 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tenant
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Usuários
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Mensagens (mês)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Respostas (mês)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Plano
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Assinatura
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Criado em
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {tenantsLoading ? (
                        <tr>
                          <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                            Carregando tenants...
                          </td>
                        </tr>
                      ) : tenantsError ? (
                        <tr>
                          <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                            Erro ao carregar tenants: {tenantsError.message}
                          </td>
                        </tr>
                      ) : filteredTenants.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                            Nenhum tenant encontrado
                          </td>
                        </tr>
                      ) : (
                        filteredTenants.map((tenant) => (
                          <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="font-medium text-gray-900">{tenant.name}</div>
                                <div className="text-sm text-gray-500">{tenant.contact_email}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <Users className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-900">{tenant.user_count}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {tenant.consumption?.messages_sent || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {tenant.consumption?.responses_received || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {tenant.status === 'active' ? (
                                <Badge variant="success" className="flex items-center gap-1 w-fit">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Ativo
                                </Badge>
                              ) : tenant.status === 'suspended' ? (
                                <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                  <Shield className="w-3 h-3" />
                                  Suspenso
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                  <XCircle className="w-3 h-3" />
                                  Cancelado
                                </Badge>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge variant="secondary" className="w-fit">
                                {tenant.plan_type || '-'}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {tenant.subscription_status === 'active' ? (
                                <Badge variant="success" className="flex items-center gap-1 w-fit">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Ativa
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                  <XCircle className="w-3 h-3" />
                                  Inativa
                                </Badge>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {tenant.created_at ? new Date(tenant.created_at).toLocaleDateString('pt-BR') : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <Button variant="outline" size="sm" onClick={() => setSelectedTenant(tenant)}>
                                Gerenciar
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="mt-4 text-sm text-gray-600">
                Mostrando {filteredTenants.length} de {tenants.length} tenants
              </div>
            </TabsContent>

            <TabsContent value="users">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="Buscar por nome, email ou tenant..."
                    value={usersSearchTerm}
                    onChange={(e) => setUsersSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setUsersPage((p) => Math.max(1, p - 1))} disabled={usersPage <= 1}>
                    Página anterior
                  </Button>
                  <div className="text-sm text-gray-600">Página {usersPage}</div>
                  <Button variant="outline" onClick={() => setUsersPage((p) => p + 1)}>
                    Próxima página
                  </Button>
                </div>
              </div>

              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Usuário
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tenant
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {usersLoading ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                            Carregando usuários...
                          </td>
                        </tr>
                      ) : usersError ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                            Erro ao carregar usuários: {usersError.message}
                          </td>
                        </tr>
                      ) : filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                            Nenhum usuário encontrado
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => {
                          const isBanned = !!u.banned_until && new Date(u.banned_until).getTime() > Date.now();
                          return (
                            <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-medium text-gray-900">{u.full_name || '-'}</div>
                                <div className="text-sm text-gray-500">{u.email || u.id}</div>
                                {u.is_super_admin && (
                                  <div className="mt-1">
                                    <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                      <Crown className="w-3 h-3 text-yellow-600" />
                                      Super Admin
                                    </Badge>
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm text-gray-900">{u.tenant_name || '-'}</div>
                                <div className="text-xs text-gray-500">{u.tenant_id || ''}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {isBanned ? (
                                  <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                    <Shield className="w-3 h-3" />
                                    Bloqueado
                                  </Badge>
                                ) : (
                                  <Badge variant="success" className="flex items-center gap-1 w-fit">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Ativo
                                  </Badge>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedUserForPassword(u);
                                        setNewPassword('');
                                      }}
                                    >
                                      <KeyRound className="w-4 h-4" />
                                      Alterar senha
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setUserBanMutation.mutate({ userId: u.id, banned: !isBanned })}
                                      disabled={setUserBanMutation.isPending}
                                    >
                                      {isBanned ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                                      {isBanned ? 'Desbloquear' : 'Bloquear'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedUserForTenant(u);
                                        setSelectedTenantIdForUser(u.tenant_id || 'none');
                                      }}
                                    >
                                      <Link2 className="w-4 h-4" />
                                      Vincular tenant
                                    </DropdownMenuItem>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                          <Trash2 className="w-4 h-4" />
                                          Excluir usuário
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Esta ação é permanente e remove o usuário do Auth e do banco.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <div className="flex gap-4">
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction
                                            className="bg-red-600 hover:bg-red-700"
                                            onClick={() => deleteUserMutation.mutate({ userId: u.id })}
                                            disabled={deleteUserMutation.isPending}
                                          >
                                            Excluir
                                          </AlertDialogAction>
                                        </div>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
              <div className="mt-4 text-sm text-gray-600">
                Mostrando {filteredUsers.length} usuário(s) nesta página
              </div>
            </TabsContent>

            <TabsContent value="notifications">
              <SystemNotificationsManager />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={!!selectedTenant} onOpenChange={(open) => !open && setSelectedTenant(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Tenant</DialogTitle>
          </DialogHeader>
          {selectedTenant && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="text-sm text-gray-600">Plano</div>
                  <div className="mt-1 font-semibold text-gray-900">{selectedTenant.plan_type || '-'}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-gray-600">Mensagens (mês)</div>
                  <div className="mt-1 font-semibold text-gray-900">{selectedTenant.consumption?.messages_sent || 0}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    Webhook: {selectedTenant.consumption?.messages_sent_webhook || 0} • Manual: {selectedTenant.consumption?.messages_sent_manual || 0} • API: {selectedTenant.consumption?.messages_sent_api || 0}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-gray-600">Respostas (mês)</div>
                  <div className="mt-1 font-semibold text-gray-900">{selectedTenant.consumption?.responses_received || 0}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    Webhook: {selectedTenant.consumption?.responses_received_webhook || 0} • Manual: {selectedTenant.consumption?.responses_received_manual || 0} • API: {selectedTenant.consumption?.responses_received_api || 0}
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={selectedTenant.status || 'active'}
                    onValueChange={(v) => {
                      setSelectedTenant((t) => ({ ...t, status: v }));
                      updateTenantMutation.mutate({ tenantId: selectedTenant.id, updates: { status: v } });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                      <SelectItem value="canceled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select
                    value={selectedTenant.plan_type || 'basic'}
                    onValueChange={(v) => {
                      setSelectedTenant((t) => ({ ...t, plan_type: v }));
                      updateTenantMutation.mutate({ tenantId: selectedTenant.id, updates: { plan_type: v } });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">basic</SelectItem>
                      <SelectItem value="pro">pro</SelectItem>
                      <SelectItem value="enterprise">enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tenant ID</Label>
                  <Input value={selectedTenant.id} readOnly />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-gray-900">Usuários do tenant</div>
                  <div className="text-sm text-gray-600">{tenantUsersData?.users?.length || 0} usuário(s)</div>
                </div>

                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {tenantUsersLoading ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-3 text-center text-gray-500">Carregando...</td>
                          </tr>
                        ) : tenantUsersError ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-3 text-center text-gray-500">
                              Erro ao carregar usuários: {tenantUsersError.message}
                            </td>
                          </tr>
                        ) : (tenantUsersData?.users || []).length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-3 text-center text-gray-500">Nenhum usuário vinculado</td>
                          </tr>
                        ) : (
                          (tenantUsersData?.users || []).map((u) => (
                            <tr key={u.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">{u.full_name || '-'}</div>
                                <div className="text-sm text-gray-500">{u.email || u.id}</div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{u.role || '-'}</td>
                              <td className="px-4 py-3 text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedUserForPassword({ id: u.id, email: u.email, full_name: u.full_name });
                                        setNewPassword('');
                                      }}
                                    >
                                      <KeyRound className="w-4 h-4" />
                                      Alterar senha
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setUserBanMutation.mutate({ userId: u.id, banned: true })}
                                      disabled={setUserBanMutation.isPending}
                                    >
                                      <Shield className="w-4 h-4" />
                                      Bloquear
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setUserBanMutation.mutate({ userId: u.id, banned: false })}
                                      disabled={setUserBanMutation.isPending}
                                    >
                                      <ShieldOff className="w-4 h-4" />
                                      Desbloquear
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => assignUserTenantMutation.mutate({ userId: u.id, tenantId: 'none' })}
                                      disabled={assignUserTenantMutation.isPending}
                                    >
                                      <Link2 className="w-4 h-4" />
                                      Desvincular do tenant
                                    </DropdownMenuItem>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                          <Trash2 className="w-4 h-4" />
                                          Excluir usuário
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Esta ação é permanente e remove o usuário do Auth e do banco.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <div className="flex gap-4">
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction
                                            className="bg-red-600 hover:bg-red-700"
                                            onClick={() => deleteUserMutation.mutate({ userId: u.id })}
                                            disabled={deleteUserMutation.isPending}
                                          >
                                            Excluir
                                          </AlertDialogAction>
                                        </div>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedUserForPassword} onOpenChange={(open) => !open && setSelectedUserForPassword(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              {selectedUserForPassword?.full_name || selectedUserForPassword?.email || selectedUserForPassword?.id}
            </div>
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <Button
              onClick={() => setUserPasswordMutation.mutate({ userId: selectedUserForPassword.id, password: newPassword })}
              disabled={setUserPasswordMutation.isPending || !newPassword}
            >
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedUserForTenant} onOpenChange={(open) => !open && setSelectedUserForTenant(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              {selectedUserForTenant?.full_name || selectedUserForTenant?.email || selectedUserForTenant?.id}
            </div>
            <div className="space-y-2">
              <Label>Tenant</Label>
              <Select value={selectedTenantIdForUser} onValueChange={setSelectedTenantIdForUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um tenant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem tenant</SelectItem>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => assignUserTenantMutation.mutate({ userId: selectedUserForTenant.id, tenantId: selectedTenantIdForUser })}
              disabled={assignUserTenantMutation.isPending}
            >
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
