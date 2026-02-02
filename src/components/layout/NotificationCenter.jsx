import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';

export default function NotificationCenter({ user }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await base44.entities.Notification.filter(
        { user_email: user.email },
        '-created_date',
        50
      );
    },
    enabled: !!user?.email,
  });

  const { data: preferences } = useQuery({
    queryKey: ['notification-preferences', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const prefs = await base44.entities.NotificationPreference.filter({
        user_email: user.email
      });
      return prefs[0] || null;
    },
    enabled: !!user?.email,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
      toast.success('Notificação removida');
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => 
        base44.entities.Notification.update(n.id, { is_read: true })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
      toast.success('Todas marcadas como lidas');
    },
  });

  // Real-time notifications with toasts
  useEffect(() => {
    if (!user?.email || !preferences?.show_toasts) return;

    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      if (event.type === 'create' && event.data.user_email === user.email) {
        // Check if user wants this type of notification
        const notifType = event.data.type;
        if (preferences[notifType] !== false) {
          toast(event.data.title, {
            description: event.data.message,
            action: event.data.link ? {
              label: 'Ver',
              onClick: () => window.location.href = event.data.link,
            } : undefined,
          });
          queryClient.invalidateQueries(['notifications']);
        }
      }
    });

    return unsubscribe;
  }, [user?.email, preferences, queryClient]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getNotificationIcon = (type) => {
    const icons = {
      survey_response: '📊',
      voucher_limit: '🎫',
      payment_due: '💳',
      subscription_alert: '⚠️',
      whatsapp_status: '💬',
      system_update: '🔔',
    };
    return icons[type] || '📢';
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative w-9 h-9 rounded-lg hover:bg-[#f7f7f8] flex items-center justify-center">
          <Bell className="w-5 h-5 text-[#6c6c89]" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center bg-red-500 text-white text-xs px-1">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-sm">Notificações</h3>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={unreadCount === 0}
            >
              <Check className="w-4 h-4 mr-1" />
              Marcar todas
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setOpen(false);
                window.location.href = createPageUrl('Profile');
              }}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="h-96">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <Bell className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              Nenhuma notificação
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-slate-50 transition-colors ${
                    !notification.is_read ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="text-2xl">{getNotificationIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm">{notification.title}</h4>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => deleteNotificationMutation.mutate(notification.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{notification.message}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-slate-400">
                          {new Date(notification.created_date).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        {!notification.is_read && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={() => markAsReadMutation.mutate(notification.id)}
                          >
                            Marcar como lida
                          </Button>
                        )}
                        {notification.link && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={() => {
                              window.location.href = notification.link;
                              setOpen(false);
                            }}
                          >
                            Ver detalhes
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}