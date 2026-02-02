import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Info, Wrench, Youtube } from 'lucide-react';

function localDayKey() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function utcDayKey() {
  return new Date().toISOString().slice(0, 10);
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

function getNoticeMeta(type) {
  if (type === 'critical') return { label: 'Crítica', icon: AlertTriangle, badgeVariant: 'destructive' };
  if (type === 'maintenance') return { label: 'Manutenção', icon: Wrench, badgeVariant: 'secondary' };
  return { label: 'Informativa', icon: Info, badgeVariant: 'secondary' };
}

export default function PostLoginContentModal() {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const userId = user?.id || null;
  const [open, setOpen] = useState(false);
  const [dontShowToday, setDontShowToday] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const recordedDayRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['post-login-content', userId],
    queryFn: async () => {
      const res = await fetchAPI('/notifications?action=active');
      return {
        videos: res?.videos || [],
        notices: res?.notices || [],
        preferences: res?.preferences || null,
      };
    },
    enabled: !!userId && isAuthenticated && !isLoadingAuth,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  const recordViewMutation = useMutation({
    mutationFn: async () => {
      return await fetchAPI('/notifications?action=preferences:record-view', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
  });

  const dismissTodayMutation = useMutation({
    mutationFn: async () => {
      return await fetchAPI('/notifications?action=preferences:dismiss-today', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
  });

  const hasContent = (data?.videos?.length || 0) + (data?.notices?.length || 0) > 0;

  const storageKeys = useMemo(() => {
    if (!userId) return null;
    return {
      lastShown: `post_login_modal:last_shown:${userId}`,
      dismissed: `post_login_modal:dismissed:${userId}`,
    };
  }, [userId]);

  const shouldOpen = useMemo(() => {
    if (!userId || !storageKeys) return false;
    if (!hasContent) return false;
    if (isLoadingAuth) return false;

    const todayLocal = localDayKey();
    const todayUtc = utcDayKey();

    let lastShownLocal = null;
    let dismissedLocal = null;
    try {
      lastShownLocal = localStorage.getItem(storageKeys.lastShown);
      dismissedLocal = localStorage.getItem(storageKeys.dismissed);
    } catch {
      lastShownLocal = null;
      dismissedLocal = null;
    }

    const prefs = data?.preferences || null;
    const dismissedByDb = prefs?.dismissed_until_date === todayUtc;
    const alreadyShownByDb = prefs?.last_seen_date === todayUtc;

    if (dismissedLocal === todayLocal) return false;
    if (lastShownLocal === todayLocal) return false;
    if (dismissedByDb) return false;
    if (alreadyShownByDb) return false;

    return true;
  }, [userId, storageKeys, hasContent, isLoadingAuth, data?.preferences]);

  useEffect(() => {
    if (!shouldOpen) return;
    setOpen(true);
  }, [shouldOpen]);

  useEffect(() => {
    if (!open) return;
    if (!userId || !storageKeys) return;
    if (!hasContent) return;
    const todayLocal = localDayKey();
    if (recordedDayRef.current === todayLocal) return;
    try {
      localStorage.setItem(storageKeys.lastShown, todayLocal);
    } catch {}

    recordedDayRef.current = todayLocal;
    void recordViewMutation.mutateAsync().catch(() => {});
  }, [open, userId, storageKeys, hasContent, recordViewMutation]);

  useEffect(() => {
    if (!open) return;
    const firstVideo = data?.videos?.[0];
    if (firstVideo?.youtube_url) {
      const id = extractYouTubeId(firstVideo.youtube_url);
      if (id) setSelectedVideoId(id);
    }
  }, [open, data?.videos]);

  const close = async () => {
    if (dontShowToday && userId && storageKeys) {
      const todayLocal = localDayKey();
      try {
        localStorage.setItem(storageKeys.dismissed, todayLocal);
      } catch {}
      await dismissTodayMutation.mutateAsync().catch(() => {});
    }
    setOpen(false);
  };

  useEffect(() => {
    setDontShowToday(false);
    setSelectedVideoId(null);
    recordedDayRef.current = null;
  }, [userId]);

  if (!userId || !isAuthenticated) return null;
  if (!hasContent || isLoading) return null;

  const videos = data?.videos || [];
  const notices = data?.notices || [];

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) void close();
      else setOpen(true);
    }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Atualizações e avisos</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {notices.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-[#121217]">Avisos</div>
                <ScrollArea className="h-56 pr-2">
                  <div className="space-y-2">
                    {notices.map((n) => {
                      const meta = getNoticeMeta(n.type);
                      const Icon = meta.icon;
                      return (
                        <div key={n.id} className="rounded-lg border p-3 bg-white">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Badge variant={meta.badgeVariant} className="flex items-center gap-1">
                                  <Icon className="w-3 h-3" />
                                  {meta.label}
                                </Badge>
                                <div className="text-sm font-medium text-[#121217] truncate">{n.title}</div>
                              </div>
                              {n.description ? (
                                <div className="text-xs text-[#6c6c89] mt-1 whitespace-pre-wrap">{n.description}</div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            ) : null}

            {videos.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-[#121217] flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-red-600" />
                  Vídeos
                </div>
                <ScrollArea className={notices.length > 0 ? 'h-52 pr-2' : 'h-96 pr-2'}>
                  <div className="space-y-2">
                    {videos.map((v) => {
                      const id = v.youtube_url ? extractYouTubeId(v.youtube_url) : null;
                      const thumbnail = id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
                      const selected = id && selectedVideoId === id;
                      return (
                        <button
                          key={v.id}
                          className={`w-full text-left rounded-lg border p-2 flex gap-3 hover:bg-slate-50 transition-colors ${selected ? 'border-indigo-400 bg-indigo-50/30' : ''}`}
                          onClick={() => {
                            if (id) setSelectedVideoId(id);
                          }}
                        >
                          {thumbnail ? (
                            <img src={thumbnail} alt={v.title || 'Vídeo'} className="w-24 h-14 object-cover rounded" loading="lazy" decoding="async" />
                          ) : (
                            <div className="w-24 h-14 rounded bg-slate-100 flex items-center justify-center text-slate-500 text-xs">
                              YouTube
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-[#121217] truncate">{v.title || 'Vídeo do YouTube'}</div>
                            {v.description ? (
                              <div className="text-xs text-[#6c6c89] line-clamp-2 mt-1">{v.description}</div>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-3 space-y-4">
            {selectedVideoId ? (
              <div className="rounded-xl border overflow-hidden bg-black">
                <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src={`https://www.youtube.com/embed/${selectedVideoId}?autoplay=0&rel=0`}
                    title="YouTube player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border p-6 bg-slate-50 text-sm text-slate-600">
                Selecione um vídeo para assistir.
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-sm text-[#121217]">
                <Checkbox checked={dontShowToday} onCheckedChange={(v) => setDontShowToday(!!v)} />
                Não mostrar novamente hoje
              </label>
              <Button onClick={close} className="bg-indigo-600 hover:bg-indigo-700">
                Entendi
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
