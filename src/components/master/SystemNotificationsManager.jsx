import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/supabase';
import { toast } from 'sonner';
import { Bell, Plus, Pencil, Trash2, Youtube, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function getTypeMeta(type) {
  if (type === 'critical') return { label: 'Crítica', icon: AlertTriangle, badgeVariant: 'destructive' };
  if (type === 'maintenance') return { label: 'Manutenção', icon: AlertTriangle, badgeVariant: 'secondary' };
  if (type === 'youtube') return { label: 'YouTube', icon: Youtube, badgeVariant: 'secondary' };
  return { label: 'Informativa', icon: Info, badgeVariant: 'secondary' };
}

function extractYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.split('/').filter(Boolean)[0] || null;
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      const embedIndex = parts.indexOf('embed');
      if (embedIndex >= 0 && parts[embedIndex + 1]) return parts[embedIndex + 1];
    }
    return null;
  } catch {
    return null;
  }
}

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function SystemNotificationsManager() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    type: 'informative',
    title: '',
    description: '',
    youtube_url: '',
    active: true,
    start_date: '',
    end_date: '',
    priority: 0,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['system-notifications'],
    queryFn: async () => {
      const res = await fetchAPI('/notifications?action=list');
      return res?.notifications || [];
    },
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      return await fetchAPI('/notifications?action=create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['system-notifications'] });
      toast.success('Notificação criada');
      setDialogOpen(false);
    },
    onError: (err) => toast.error(err.message || 'Erro ao criar notificação'),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      return await fetchAPI('/notifications?action=update', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['system-notifications'] });
      toast.success('Notificação atualizada');
      setDialogOpen(false);
    },
    onError: (err) => toast.error(err.message || 'Erro ao atualizar notificação'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return await fetchAPI('/notifications?action=delete', {
        method: 'POST',
        body: JSON.stringify({ id }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['system-notifications'] });
      toast.success('Notificação removida');
    },
    onError: (err) => toast.error(err.message || 'Erro ao remover notificação'),
  });

  const notifications = Array.isArray(data) ? data : [];

  const filtered = useMemo(() => {
    if (activeTab === 'videos') return notifications.filter((n) => !!n.youtube_url);
    if (activeTab === 'notices') return notifications.filter((n) => !n.youtube_url);
    return notifications;
  }, [notifications, activeTab]);

  const resetForm = () => {
    setEditing(null);
    setForm({
      type: 'informative',
      title: '',
      description: '',
      youtube_url: '',
      active: true,
      start_date: '',
      end_date: '',
      priority: 0,
    });
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (n) => {
    setEditing(n);
    setForm({
      type: n.type || 'informative',
      title: n.title || '',
      description: n.description || '',
      youtube_url: n.youtube_url || '',
      active: !!n.active,
      start_date: toDatetimeLocalValue(n.start_date),
      end_date: toDatetimeLocalValue(n.end_date),
      priority: Number.isFinite(Number(n.priority)) ? Number(n.priority) : 0,
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    const payload = {
      type: form.type,
      title: form.title,
      description: form.description || null,
      youtube_url: form.youtube_url || null,
      active: !!form.active,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      priority: Number.isFinite(Number(form.priority)) ? Number(form.priority) : 0,
    };

    if (!String(payload.title || '').trim()) {
      toast.error('Título é obrigatório');
      return;
    }

    if (editing?.id) {
      await updateMutation.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#d1d1db] p-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
            <Bell className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#121217]">Notificações Pós-Login</h3>
            <p className="text-xs text-[#6c6c89]">Vídeos do YouTube e avisos exibidos após o login</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" />
          Nova notificação
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="videos">Vídeos</TabsTrigger>
            <TabsTrigger value="notices">Avisos</TabsTrigger>
          </TabsList>
          <div className="text-xs text-[#6c6c89]">
            {filtered.length} itens
          </div>
        </div>

        <TabsContent value="all">
          <NotificationsTable
            isLoading={isLoading}
            error={error}
            items={filtered}
            onEdit={openEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
            isDeleting={deleteMutation.isPending}
          />
        </TabsContent>
        <TabsContent value="videos">
          <NotificationsTable
            isLoading={isLoading}
            error={error}
            items={filtered}
            onEdit={openEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
            isDeleting={deleteMutation.isPending}
          />
        </TabsContent>
        <TabsContent value="notices">
          <NotificationsTable
            isLoading={isLoading}
            error={error}
            items={filtered}
            onEdit={openEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
            isDeleting={deleteMutation.isPending}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar notificação' : 'Nova notificação'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.youtube_url ? 'youtube' : form.type}
                onValueChange={(v) => setForm((prev) => ({ ...prev, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informative">Informativa</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                  <SelectItem value="maintenance">Manutenção</SelectItem>
                  <SelectItem value="youtube">Vídeo (YouTube)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm((prev) => ({ ...prev, priority: Number(e.target.value) }))}
                min={0}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Manutenção programada"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Detalhes do aviso ou resumo do vídeo"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Link do YouTube (opcional)</Label>
              <Input
                value={form.youtube_url}
                onChange={(e) => setForm((prev) => ({ ...prev, youtube_url: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              {form.youtube_url ? (
                <YouTubePreview url={form.youtube_url} title={form.title} />
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Início (opcional)</Label>
              <Input
                type="datetime-local"
                value={form.start_date}
                onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Fim (opcional)</Label>
              <Input
                type="datetime-local"
                value={form.end_date}
                onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between md:col-span-2 rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium text-[#121217]">Ativa</div>
                <div className="text-xs text-[#6c6c89]">Controla se o item pode ser exibido</div>
              </div>
              <Switch checked={form.active} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, active: checked }))} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function YouTubePreview({ url, title }) {
  const videoId = extractYouTubeId(url);
  if (!videoId) return (
    <div className="text-xs text-[#6c6c89]">Link inválido ou não suportado para preview</div>
  );
  const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  return (
    <Card className="p-3 bg-slate-50 border border-slate-200">
      <div className="flex items-center gap-3">
        <img src={thumbnail} alt={title || 'Preview do vídeo'} className="w-24 h-14 object-cover rounded" loading="lazy" decoding="async" />
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-800 truncate">{title || 'Vídeo do YouTube'}</div>
          <a className="text-xs text-indigo-600 hover:underline" href={url} target="_blank" rel="noreferrer">
            Abrir no YouTube
          </a>
        </div>
      </div>
    </Card>
  );
}

function NotificationsTable({ isLoading, error, items, onEdit, onDelete, isDeleting }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Período</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridade</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">Carregando...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">Erro ao carregar: {error.message}</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Nenhuma notificação encontrada</td>
              </tr>
            ) : (
              items.map((n) => {
                const meta = getTypeMeta(n.type);
                const Icon = meta.icon;
                const start = n.start_date ? new Date(n.start_date).toLocaleString('pt-BR') : '-';
                const end = n.end_date ? new Date(n.end_date).toLocaleString('pt-BR') : '-';
                return (
                  <tr key={n.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={meta.badgeVariant} className="flex items-center gap-1 w-fit">
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{n.title}</div>
                      {n.youtube_url ? (
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <Youtube className="w-3 h-3" />
                          Vídeo
                        </div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {start} → {end}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {Number.isFinite(Number(n.priority)) ? Number(n.priority) : 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {n.active ? (
                        <Badge variant="success" className="w-fit">Ativa</Badge>
                      ) : (
                        <Badge variant="secondary" className="w-fit">Inativa</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => onEdit(n)}>
                          <Pencil className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={isDeleting}>
                              <Trash2 className="w-4 h-4 mr-1" />
                              Remover
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover notificação?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="flex justify-end gap-2">
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete(n.id)}>Remover</AlertDialogAction>
                            </div>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

