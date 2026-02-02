import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, Upload, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import {
  applyKioskCssFallback,
  exitFullscreen,
  isInFullscreen,
  normalizeFullscreenErrorMessage,
  onFullscreenChange,
  requestFullscreen,
  tryLockOrientation,
  unlockOrientation,
} from '@/lib/kioskMode';

const TotemDisplay = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
const [uploadingImage, setUploadingImage] = useState(false);
const [localOpacity, setLocalOpacity] = useState(null);
const [opacityTimeout, setOpacityTimeout] = useState(null);
const [kioskFallbackActive, setKioskFallbackActive] = useState(false);
const [kioskActive, setKioskActive] = useState(false);
const [showKioskExit, setShowKioskExit] = useState(false);
const longPressTimeoutRef = useRef(null);
const hideExitTimeoutRef = useRef(null);
const queryClient = useQueryClient();

const { userProfile } = useAuth();

useEffect(() => {
  const syncFromFullscreen = () => {
    const fs = isInFullscreen();
    if (fs) {
      setKioskActive(true);
      if (kioskFallbackActive) {
        setKioskFallbackActive(false);
        applyKioskCssFallback(false);
      }
      return;
    }
    if (!kioskFallbackActive) {
      setKioskActive(false);
      setShowKioskExit(false);
    }
  };

  syncFromFullscreen();
  const unsubscribe = onFullscreenChange(syncFromFullscreen);
  return () => {
    unsubscribe();
  };
}, [kioskFallbackActive]);

useEffect(() => {
  return () => {
    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    if (hideExitTimeoutRef.current) clearTimeout(hideExitTimeoutRef.current);
    applyKioskCssFallback(false);
    unlockOrientation();
  };
}, []);

  const { data: queryData } = useQuery({
    queryKey: ['totem-settings', userProfile?.tenant_id],
    queryFn: async () => {
      if (!userProfile?.tenant_id) return null;

      // 1. Fetch Totem Settings with Fallback
      let totemSettings = null;
      try {
        const { data, error } = await supabase
          .from('totemsettings')
          .select('id, background_type, background_video_url, background_image_url, background_opacity')
          .eq('tenant_id', userProfile.tenant_id)
          .maybeSingle();

        if (error && error.code === '42P01') {
           // Fallback table name
           const { data: data2 } = await supabase
            .from('totem_settings')
            .select('id, background_type, background_video_url, background_image_url, background_opacity')
            .eq('tenant_id', userProfile.tenant_id)
            .maybeSingle();
            totemSettings = data2;
        } else {
           totemSettings = data;
        }
      } catch (e) {
        console.error('Error fetching totem settings:', e);
      }

      // 2. Fetch System Config
      const { data: systemConfig, error: systemConfigError } = await supabase
        .from('system_config')
        .select('system_logo_url, system_website')
        .limit(1)
        .maybeSingle();

      if (systemConfigError) {
        console.error('Error fetching system config:', systemConfigError);
      }

      // 3. Fetch Tenant Info
      const { data: tenant } = await supabase
        .from('tenants')
        .select('logo_url, show_logo_in_survey, company_name')
        .eq('id', userProfile.tenant_id)
        .single();

      // 4. Fetch Active Template
      console.log('🔍 Buscando template ativo para tenant:', userProfile.tenant_id);
      
      const { data: templates, error: templatesError } = await supabase
        .from('survey_templates')
        .select('id, design, usage_limit, is_active') // Adicionado is_active explicitamente
        .eq('tenant_id', userProfile.tenant_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (templatesError) {
        console.error('❌ Error fetching active template:', templatesError);
        return null;
      }

      console.log('✅ Templates encontrados:', templates);

      const template = templates?.[0] || null;

      // Check usage limit
      if (template?.usage_limit?.enabled) {
        const currentUses = template.usage_limit.current_uses || 0;
        const maxUses = template.usage_limit.max_uses || 0;

        if (currentUses >= maxUses) {
          console.warn('⚠️ Template usage limit reached');
          return { totemSettings, systemConfig, tenant, activeTemplate: null };
        }
      }

      return { totemSettings, systemConfig, tenant, activeTemplate: template };
    },
    enabled: !!userProfile?.tenant_id,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  const settings = queryData?.totemSettings;
  const systemConfig = queryData?.systemConfig;
  const tenant = queryData?.tenant;
  const activeTemplate = queryData?.activeTemplate;

// Debounce opacity changes
const handleOpacityChange = (value) => {
  setLocalOpacity(value);
  if (opacityTimeout) clearTimeout(opacityTimeout);
  const newTimeout = setTimeout(async () => {
    try {
      await updateSettingsMutation.mutateAsync({ background_opacity: value });
      setLocalOpacity(null);
    } catch (error) {
      console.error('Erro ao atualizar opacidade:', error);
    }
  }, 500);
  setOpacityTimeout(newTimeout);
};

const updateSettingsMutation = useMutation({
  mutationFn: async (data) => {
    if (!userProfile?.tenant_id) throw new Error('Tenant ID não encontrado');

    if (settings?.id) {
      // Update existing
      const { data: updated, error } = await supabase
        .from('totem_settings')
        .update(data)
        .eq('id', settings.id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    } else {
      // Create new
      const { data: created, error } = await supabase
        .from('totem_settings')
        .insert({ ...data, tenant_id: userProfile.tenant_id })
        .select()
        .single();

      if (error) throw error;
      return created;
    }
  },
  onSuccess: (data) => {
    queryClient.setQueryData(['totem-settings', userProfile?.tenant_id], data);
    toast.success('Configurações atualizadas!');
  },
});

if (!userProfile?.tenant_id) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
      <div className="text-center text-white">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
        <p className="text-xl">Carregando...</p>
      </div>
    </div>
  );
}

const handleFileUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!userProfile?.tenant_id) {
    toast.error('Erro de autenticação. Recarregue a página.');
    return;
  }

  const isVideo = file.type.startsWith('video/');
  setUploadingImage(true);

  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `totem-${userProfile.tenant_id}-${Date.now()}.${fileExt}`;
    const filePath = `totem-backgrounds/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('public-assets')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('public-assets')
      .getPublicUrl(filePath);

    const updateData = isVideo
      ? { background_video_url: publicUrl, background_type: 'video' }
      : { background_image_url: publicUrl, background_type: 'image' };

    await updateSettingsMutation.mutateAsync(updateData);

    toast.success(`${isVideo ? 'Vídeo' : 'Imagem'} enviado com sucesso!`);
    setIsSettingsOpen(false);
  } catch (error) {
    console.error('Upload error:', error);
    toast.error('Erro ao fazer upload: ' + (error.message || 'Erro desconhecido'));
  } finally {
    setUploadingImage(false);
  }
};

const surveyUrl = activeTemplate && userProfile?.tenant_id
  ? `${window.location.origin}/Survey?tenant_id=${userProfile.tenant_id}&template_id=${activeTemplate.id}&from_qrcode=true`
  : 'https://base44.app';

const clickTotemUrl = activeTemplate && userProfile?.tenant_id
  ? `${window.location.origin}/Survey?tenant_id=${userProfile.tenant_id}&template_id=${activeTemplate.id}&from_clicktotem=true`
  : 'https://base44.app';

const opacity = (localOpacity !== null ? localOpacity : (settings?.background_opacity || 100)) / 100;
const backgroundStyle = settings?.background_type === 'video' && settings?.background_video_url
  ? {
    position: 'relative',
    background: '#000',
  }
  : settings?.background_image_url
    ? {
      backgroundImage: `url(${settings.background_image_url})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
    : {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    };

const enterKioskMode = async () => {
  try {
    await requestFullscreen(document.documentElement, { navigationUI: 'hide' });
    setKioskActive(true);
    if (kioskFallbackActive) {
      setKioskFallbackActive(false);
      applyKioskCssFallback(false);
    }
    toast.success('Modo quiosque ativado. Toque e segure para sair.');
    try {
      await tryLockOrientation('landscape');
    } catch {}
  } catch (error) {
    const message = normalizeFullscreenErrorMessage(error);
    applyKioskCssFallback(true);
    setKioskFallbackActive(true);
    setKioskActive(true);
    toast.error(message);
    toast('Simulação ativada. Toque e segure para sair.');
  }
};

const exitKioskMode = async () => {
  setShowKioskExit(false);
  setKioskActive(false);
  setKioskFallbackActive(false);
  applyKioskCssFallback(false);
  await unlockOrientation();
  try {
    await exitFullscreen();
  } catch {}
};

const showExitControls = () => {
  setShowKioskExit(true);
  if (hideExitTimeoutRef.current) clearTimeout(hideExitTimeoutRef.current);
  hideExitTimeoutRef.current = setTimeout(() => setShowKioskExit(false), 8000);
};

const cancelLongPress = () => {
  if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
  longPressTimeoutRef.current = null;
};

const handlePointerDown = (e) => {
  if (!kioskActive) return;
  if (e.pointerType !== 'touch') return;
  cancelLongPress();
  longPressTimeoutRef.current = setTimeout(() => {
    showExitControls();
    longPressTimeoutRef.current = null;
  }, 1600);
};

const handlePointerUp = () => cancelLongPress();

return (
  <div
    className="relative w-full h-screen flex items-center justify-center"
    style={backgroundStyle}
    onPointerDown={handlePointerDown}
    onPointerUp={handlePointerUp}
    onPointerCancel={handlePointerUp}
  >
    {/* Background Image Overlay */}
    {settings?.background_type === 'image' && settings?.background_image_url && (
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          backgroundImage: `url(${settings.background_image_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: (localOpacity !== null ? localOpacity : (settings?.background_opacity || 100)) / 100,
          zIndex: 0,
        }}
      />
    )}

    {/* Background Video */}
    {settings?.background_type === 'video' && settings?.background_video_url && (
      <video
        autoPlay
        loop
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity, zIndex: 0 }}
      >
        <source src={settings.background_video_url} type="video/mp4" />
      </video>
    )}

    <Button
      size="icon"
      className="absolute top-4 left-4 bg-white/20 backdrop-blur-lg hover:bg-white/30"
      onClick={() => {
        if (!kioskActive) {
          enterKioskMode();
          return;
        }
        showExitControls();
        toast('Toque e segure na tela para sair do modo quiosque.');
      }}
    >
      {kioskActive ? (
        <Minimize2 className="w-5 h-5 text-white" />
      ) : (
        <Maximize2 className="w-5 h-5 text-white" />
      )}
    </Button>

    {/* Settings Button */}
    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="absolute top-4 right-4 bg-white/20 backdrop-blur-lg hover:bg-white/30"
        >
          <Settings className="w-5 h-5 text-white" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurações do Totem</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium mb-2">Imagem ou Vídeo de Fundo</label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
                id="background-upload"
              />
              <Button
                onClick={() => document.getElementById('background-upload').click()}
                disabled={uploadingImage}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploadingImage ? 'Enviando...' : 'Upload (Imagem/Vídeo)'}
              </Button>
            </div>
            {(settings?.background_image_url || settings?.background_video_url) && (
              <p className="text-xs text-slate-500 mt-2">
                {settings.background_type === 'video' ? 'Vídeo' : 'Imagem'} atual carregado
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Opacidade: {localOpacity !== null ? localOpacity : (settings?.background_opacity || 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={localOpacity !== null ? localOpacity : (settings?.background_opacity || 100)}
              onChange={(e) => handleOpacityChange(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
          {!activeTemplate && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800">
                ⚠️ Nenhum modelo de pesquisa está ativo. Ative um modelo no painel administrativo.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Main Content Container */}
    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center px-6 max-w-6xl mx-auto">
      {/* Left Side - QR Code */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0, x: -50 }}
        animate={{ scale: 1, opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="flex justify-center"
      >
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 shadow-2xl">
          {/* Logo do Cliente */}
          {tenant?.logo_url && tenant?.show_logo_in_survey && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex justify-center mb-6"
            >
              <img
                src={tenant.logo_url}
                alt={tenant.company_name || 'Logo'}
                className="h-16 w-auto object-contain"
                loading="lazy"
                decoding="async"
              />
            </motion.div>
          )}

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="bg-white p-6 rounded-2xl shadow-lg"
          >
            <QRCodeSVG
              value={surveyUrl}
              size={280}
              level="H"
              includeMargin={true}
              fgColor={activeTemplate?.design?.primary_color || '#000000'}
              {...(activeTemplate?.design?.logo_url && {
                imageSettings: {
                  src: activeTemplate.design.logo_url,
                  height: 50,
                  width: 50,
                  excavate: true,
                }
              })}
            />
          </motion.div>
          <p className="text-center text-slate-600 mt-4 text-sm font-medium">
            Escaneie com seu celular
          </p>
        </div>
      </motion.div>

      {/* Right Side - Message and Button */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-center lg:text-left"
      >
        <div className="space-y-6">
          <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 shadow-xl border border-white/20">
            <h1 className="text-5xl lg:text-6xl font-bold text-white mb-4" style={{ textShadow: '0 4px 12px rgba(0, 0, 0, 0.8), 0 2px 6px rgba(0, 0, 0, 0.6)' }}>
              Sua Opinião Importa!
            </h1>
            <p className="text-xl text-white/95 leading-relaxed" style={{ textShadow: '0 2px 8px rgba(0, 0, 0, 0.7), 0 1px 4px rgba(0, 0, 0, 0.5)' }}>
              Responda nossa pesquisa rápida de satisfação e nos ajude a melhorar ainda mais.
              Sua opinião é fundamental para nós! 💜
            </p>
          </div>

          {activeTemplate && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.location.href = clickTotemUrl}
              className="inline-flex items-center justify-center bg-white hover:bg-slate-50 text-indigo-600 font-bold text-lg px-8 py-4 rounded-2xl shadow-lg transition-all duration-300"
            >
              <span className="text-2xl mr-3">👆</span>
              Clique Aqui para Responder
            </motion.button>
          )}

          {!activeTemplate && (
            <div className="p-4 bg-red-50/90 border-2 border-red-300 rounded-xl">
              <p className="text-red-900 font-bold text-lg mb-2">
                🚫 Pesquisa Indisponível
              </p>
              <p className="text-red-800 text-sm">
                Esta pesquisa atingiu o limite máximo de respostas permitidas. Entre em contato com a administração.
              </p>
            </div>
          )}

          <p className="text-white/70 text-sm">
            Leva menos de 2 minutos ⏱️
          </p>
        </div>
      </motion.div>
    </div>

    {/* System Branding - Discrete Footer */}
    {systemConfig && (systemConfig.system_logo_url || systemConfig.system_website) && (
      <div className="absolute bottom-4 right-4 z-20 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-3">
        {systemConfig.system_logo_url && (
          <img
            src={systemConfig.system_logo_url}
            alt="Sistema"
            className="h-5 w-auto object-contain opacity-70"
            loading="lazy"
            decoding="async"
          />
        )}
        {systemConfig.system_website && (
          <span className="text-xs text-white/70 font-medium">
            {systemConfig.system_website}
          </span>
        )}
      </div>
    )}

    {kioskActive && showKioskExit && (
      <div className="absolute bottom-4 left-4 z-30 flex gap-2">
        <Button
          className="bg-white/90 hover:bg-white text-slate-900"
          onClick={exitKioskMode}
        >
          Sair do modo quiosque
        </Button>
      </div>
    )}
  </div>
);
}

export default TotemDisplay;
