import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, User, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function Profile() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({});
  const { userProfile, isLoadingAuth } = useAuth();

  // Use AuthContext userProfile instead of fetching me() again
  const user = userProfile;

  const { data: preferences, isLoading: prefsLoading } = useQuery({
    queryKey: ['notification-preferences', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_email', user.email)
        .maybeSingle(); // Use maybeSingle to avoid 406 if not found

      if (error) throw error;
      return data || null;
    },
    enabled: !!user?.email,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['all-notifications', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_email', user.email)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.email,
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (data) => {
      if (!user?.email) throw new Error('User email not found');

      const payload = {
        ...data,
        user_email: user.email,
        tenant_id: user.tenant_id
      };

      if (preferences?.id) {
        const { data: updated, error } = await supabase
          .from('notification_preferences')
          .update(data) // just update modified fields
          .eq('id', preferences.id)
          .select()
          .single();
        if (error) throw error;
        return updated;
      } else {
        const { data: created, error } = await supabase
          .from('notification_preferences')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return created;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success('Preferências atualizadas!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar preferências: ' + error.message);
    }
  });

  const deleteAllNotificationsMutation = useMutation({
    mutationFn: async () => {
      if (!user?.email) return;

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_email', user.email);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Todas as notificações foram removidas');
    },
    onError: (error) => {
      toast.error('Erro ao limpar notificações: ' + error.message);
    }
  });

  const handlePreferenceChange = (key, value) => {
    // optimistic update could be added here
    updatePreferencesMutation.mutate({ [key]: value });
  };

  const notificationTypes = [
    {
      key: 'survey_response',
      label: 'Respostas de Pesquisa',
      description: 'Notificar quando houver novas respostas nas pesquisas',
      icon: '📊'
    },
    {
      key: 'voucher_limit',
      label: 'Limite de Vouchers',
      description: 'Alertas quando vouchers atingirem o limite',
      icon: '🎫'
    },
    {
      key: 'payment_due',
      label: 'Pagamentos',
      description: 'Lembretes de pagamentos e faturas',
      icon: '💳'
    },
    {
      key: 'subscription_alert',
      label: 'Alertas de Assinatura',
      description: 'Avisos sobre status da assinatura',
      icon: '⚠️'
    },
    {
      key: 'whatsapp_status',
      label: 'Status WhatsApp',
      description: 'Atualizações sobre conexão WhatsApp',
      icon: '💬'
    },
    {
      key: 'system_update',
      label: 'Atualizações do Sistema',
      description: 'Novidades e melhorias da plataforma',
      icon: '🔔'
    }
  ];

  if (isLoadingAuth || prefsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#121217]">Perfil do Usuário</h1>
        <p className="text-sm text-[#6c6c89]">Gerencie suas informações e preferências</p>
      </div>

      <Tabs defaultValue="notifications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="account">
            <User className="w-4 h-4 mr-2" />
            Conta
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preferências de Notificação</CardTitle>
              <CardDescription>
                Escolha quais tipos de notificação você deseja receber
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {notificationTypes.map((type) => (
                <div key={type.key} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{type.icon}</span>
                    <div>
                      <Label className="text-sm font-medium">{type.label}</Label>
                      <p className="text-xs text-slate-500">{type.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={preferences?.[type.key] ?? true}
                    onCheckedChange={(checked) => handlePreferenceChange(type.key, checked)}
                  />
                </div>
              ))}

              <div className="flex items-center justify-between py-3 pt-6 border-t">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🔔</span>
                  <div>
                    <Label className="text-sm font-medium">Toasts em Tempo Real</Label>
                    <p className="text-xs text-slate-500">
                      Exibir notificações popup quando eventos acontecerem
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences?.show_toasts ?? true}
                  onCheckedChange={(checked) => handlePreferenceChange('show_toasts', checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Histórico de Notificações</CardTitle>
                  <CardDescription>
                    {notifications.length} notificação(ões) no total
                  </CardDescription>
                </div>
                {notifications.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteAllNotificationsMutation.mutate()}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Limpar Todas
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Nenhuma notificação ainda
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg border ${!notification.is_read ? 'bg-blue-50 border-blue-200' : 'bg-slate-50'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{notification.title}</h4>
                          <p className="text-xs text-slate-600 mt-1">{notification.message}</p>
                          <span className="text-xs text-slate-400 mt-2 block">
                            {new Date(notification.created_date).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        {!notification.is_read && (
                          <Badge variant="secondary" className="text-xs">Nova</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Informações da Conta</CardTitle>
              <CardDescription>Seus dados de acesso</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome Completo</Label>
                <Input value={user?.full_name || ''} disabled className="mt-1" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled className="mt-1" />
              </div>
              <div>
                <Label>Tipo de Conta</Label>
                <Input value={user?.role === 'admin' ? 'Administrador' : 'Usuário'} disabled className="mt-1" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
