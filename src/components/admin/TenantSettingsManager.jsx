import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Save, Building2, Bell, Palette, Users, Upload, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

export default function TenantSettingsManager() {
  const queryClient = useQueryClient();

  const { userProfile, isLoadingAuth } = useAuth();

  React.useEffect(() => {
    console.log('🔍 TenantSettings Debug:', {
      hasUserProfile: !!userProfile,
      tenant_id: userProfile?.tenant_id,
      isLoadingAuth
    });
  }, [userProfile, isLoadingAuth]);

  const { data: tenant, isLoading: isTenantLoading } = useQuery({
    queryKey: ['tenant-settings', userProfile?.tenant_id],
    queryFn: async () => {
      if (!userProfile?.tenant_id) return null;
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', userProfile.tenant_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userProfile?.tenant_id,
  });

  const { data: totemSettings } = useQuery({
    queryKey: ['totem-settings', userProfile?.tenant_id],
    queryFn: async () => {
      if (!userProfile?.tenant_id) return null;
      // Tentar buscar da tabela (pode ser com ou sem underscore dependendo da versão do DB)
      // Vamos tentar o padrão 'totemsettings' primeiro já que o outro deu 404
      const { data, error } = await supabase
        .from('totemsettings') 
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .maybeSingle();

      if (error) {
        // Se der erro, tenta com underscore como fallback (ou vice-versa)
        if (error.code === '42P01') { // undefined_table
           const { data: data2, error: error2 } = await supabase
            .from('totem_settings')
            .select('*')
            .eq('tenant_id', userProfile.tenant_id)
            .maybeSingle();
            if (error2) throw error2;
            return data2;
        }
        throw error;
      }
      return data;
    },
    enabled: !!userProfile?.tenant_id,
  });

  const { data: activeTemplate } = useQuery({
    queryKey: ['active-template', userProfile?.tenant_id],
    queryFn: async () => {
      if (!userProfile?.tenant_id) return null;

      const { data: templates, error } = await supabase
        .from('survey_templates')
        .select('id, design, usage_limit, is_active')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      const template = templates?.[0] || null;

      if (template?.usage_limit?.enabled) {
        const currentUses = template.usage_limit.current_uses || 0;
        const maxUses = template.usage_limit.max_uses || 0;

        if (currentUses >= maxUses) return null;
      }

      return template;
    },
    enabled: !!userProfile?.tenant_id,
  });

  const [qrLogoSrc, setQrLogoSrc] = useState(null);
  const qrCanvasRef = React.useRef(null);

  React.useEffect(() => {
    const url = activeTemplate?.design?.logo_url;
    if (!url) {
      setQrLogoSrc(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha ao baixar logo');
        const blob = await response.blob();

        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Falha ao ler logo'));
          reader.readAsDataURL(blob);
        });

        if (!cancelled) setQrLogoSrc(dataUrl);
      } catch (e) {
        if (!cancelled) setQrLogoSrc(url);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTemplate?.design?.logo_url]);

  const surveyUrl = activeTemplate && userProfile?.tenant_id
    ? `${window.location.origin}/Survey?tenant_id=${userProfile.tenant_id}&template_id=${activeTemplate.id}&from_qrcode=true`
    : null;

  const downloadQrCode = async (format) => {
    if (!surveyUrl) {
      toast.error('Nenhum modelo ativo para gerar o QRCode.');
      return;
    }

    const canvas = qrCanvasRef.current;
    if (!canvas) {
      toast.error('Não foi possível gerar o QRCode para download.');
      return;
    }

    try {
      const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const dataUrl = canvas.toDataURL(mimeType, format === 'jpg' ? 0.92 : undefined);

      const link = document.createElement('a');
      const safeTenant = (tenant?.company_display_name || tenant?.company_name || userProfile?.tenant_id || 'tenant')
        .toString()
        .trim()
        .replace(/[^\w\-]+/g, '-')
        .replace(/\-+/g, '-')
        .replace(/^\-|\-$/g, '');
      link.download = `qrcode-${safeTenant}-${activeTemplate.id}.${format}`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      toast.error('Falha ao exportar o QRCode. Verifique a logo do modelo.');
    }
  };

  const [formData, setFormData] = useState({
    company_name: '',
    company_display_name: '',
    contact_email: '',
    contact_phone: '',
    logo_url: '',
    show_logo_in_survey: false,
    google_review_link: '',
  });

  const [totemData, setTotemData] = useState({
    background_type: 'image',
    background_image_url: '',
    background_video_url: '',
    background_opacity: 100,
  });

  const [notificationSettings, setNotificationSettings] = useState({
    email_notifications: true,
    whatsapp_notifications: true,
    sms_notifications: false,
  });

  React.useEffect(() => {
    if (tenant && tenant.id) {
      setFormData({
        company_name: tenant.company_name || '',
        company_display_name: tenant.company_display_name || '',
        contact_email: tenant.contact_email || '',
        contact_phone: tenant.contact_phone || '',
        logo_url: tenant.logo_url || '',
        show_logo_in_survey: tenant.show_logo_in_survey || false,
        google_review_link: tenant.google_review_link || '',
      });
    }
  }, [tenant]);

  React.useEffect(() => {
    if (totemSettings) {
      setTotemData({
        background_type: totemSettings.background_type || 'image',
        background_image_url: totemSettings.background_image_url || '',
        background_video_url: totemSettings.background_video_url || '',
        background_opacity: totemSettings.background_opacity || 100,
      });
    }
  }, [totemSettings]);

  const updateTenantMutation = useMutation({
    mutationFn: async (data) => {
      if (!tenant?.id) throw new Error('ID do tenant não encontrado');

      // Sanitizar dados - Whitelist approach
      const allowedFields = [
        'company_name',
        'company_display_name',
        'contact_email',
        'contact_phone',
        'logo_url',
        'show_logo_in_survey',
        'google_review_link'
      ];

      const updateData = {};
      allowedFields.forEach(key => {
        if (data[key] !== undefined && data[key] !== null) {
          updateData[key] = data[key];
        }
      });

      console.log('📤 Updating tenant with:', updateData);

      const { data: result, error } = await supabase
        .from('tenants')
        .update(updateData)
        .eq('id', tenant.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      toast.success('Configurações atualizadas com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      queryClient.invalidateQueries({ queryKey: ['current-tenant'] });
    },
    onError: (error) => {
      console.error('Erro ao salvar tenant:', error);
      toast.error('Erro ao atualizar: ' + (error?.message || 'tente novamente'));
    },
  });

  const updateTotemMutation = useMutation({
    mutationFn: async (data) => {
      // Garantir tenant_id
      const payload = {
        ...data,
        tenant_id: userProfile.tenant_id
      };

      // Tentar upsert na tabela sem underscore primeiro
      let { data: result, error } = await supabase
        .from('totemsettings')
        .upsert(payload, { onConflict: 'tenant_id' })
        .select()
        .single();

      if (error && error.code === '42P01') {
         // Fallback para tabela com underscore
         const res = await supabase
          .from('totem_settings')
          .upsert(payload, { onConflict: 'tenant_id' })
          .select()
          .single();
          result = res.data;
          error = res.error;
      }

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['totem-settings'] });
      toast.success('Configurações do totem atualizadas!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar configurações do totem: ' + error.message);
    },
  });

  const handleSaveGeneral = () => {
    // Validar se tenant existe
    if (!tenant?.id) {
      toast.error('Tenant não carregado. Recarregue a página.');
      return;
    }

    // Validar campos obrigatórios
    const missingFields = [];
    if (!formData.company_name?.trim()) missingFields.push('Nome da Empresa');
    if (!formData.contact_email?.trim()) missingFields.push('Email de Contato');

    if (missingFields.length > 0) {
      toast.error(`Preencha: ${missingFields.join(', ')}`);
      return;
    }

    // Verificar se há mudanças
    const hasChanges =
      formData.company_name !== tenant.company_name ||
      formData.company_display_name !== tenant.company_display_name ||
      formData.contact_email !== tenant.contact_email ||
      formData.contact_phone !== tenant.contact_phone ||
      formData.logo_url !== tenant.logo_url ||
      formData.show_logo_in_survey !== tenant.show_logo_in_survey ||
      formData.google_review_link !== tenant.google_review_link;

    if (!hasChanges) {
      toast.info('Nenhuma alteração detectada');
      return;
    }

    updateTenantMutation.mutate(formData);
  };

  const handleSaveTotem = () => {
    updateTotemMutation.mutate(totemData);
  };

  const handleUploadFile = async (file, type) => {
    try {
      const fileName = `${type}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
      const { data, error } = await supabase.storage
        .from('public-assets')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('public-assets')
        .getPublicUrl(fileName);

      if (type === 'totem-image') {
        setTotemData({ ...totemData, background_image_url: publicUrl, background_type: 'image' });
      } else if (type === 'totem-video') {
        setTotemData({ ...totemData, background_video_url: publicUrl, background_type: 'video' });
      } else if (type === 'logo') {
        setFormData({ ...formData, logo_url: publicUrl });
      }

      toast.success('Arquivo enviado com sucesso!');
    } catch (error) {
      console.error('File upload error:', error);
      toast.error('Erro ao enviar arquivo: ' + error.message);
    }
  };

  if (isLoadingAuth || isTenantLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-500">Carregando configurações...</div>
      </div>
    );
  }

  // Show error if no userProfile after loading
  if (!userProfile) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-red-500">
          ⚠️ Erro: Perfil de usuário não carregado. Por favor, faça logout e login novamente.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Informações Gerais */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Informações Gerais</h3>
            <p className="text-sm text-gray-500">Dados principais do seu negócio</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="company_name">Nome da Empresa</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Ex: Minha Empresa LTDA"
              />
            </div>
            <div>
              <Label htmlFor="company_display_name">Nome de Exibição</Label>
              <Input
                id="company_display_name"
                value={formData.company_display_name}
                onChange={(e) => setFormData({ ...formData, company_display_name: e.target.value })}
                placeholder="Ex: Minha Empresa"
              />
              <p className="text-xs text-gray-500 mt-1">Usado em mensagens de WhatsApp</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contact_email">Email de Contato</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="contato@empresa.com"
              />
            </div>
            <div>
              <Label htmlFor="contact_phone">Telefone de Contato</Label>
              <Input
                id="contact_phone"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="google_review_link">Link do Google Meu Negócio</Label>
            <Input
              id="google_review_link"
              value={formData.google_review_link}
              onChange={(e) => setFormData({ ...formData, google_review_link: e.target.value })}
              placeholder="https://g.page/r/..."
            />
            <p className="text-xs text-gray-500">
              Cole o link de avaliação do Google Meu Negócio. Clientes satisfeitos serão redirecionados automaticamente para avaliar sua empresa.
            </p>
          </div>

          {/* Logo da Empresa */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Logo da Empresa
            </h4>
            <div className="space-y-4">
              <div>
                <Label htmlFor="logo">Arquivo da Logo</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="logo"
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="URL da logo"
                    readOnly
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e) => handleUploadFile(e.target.files[0], 'logo');
                      input.click();
                    }}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Selecionar
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Formatos aceitos: PNG, JPG, SVG (tamanho recomendado: 200x80px)</p>
              </div>

              {formData.logo_url && (
                <div className="flex items-center gap-4 p-3 bg-white rounded-lg border border-gray-200">
                  <img
                    src={formData.logo_url}
                    alt="Logo Preview"
                    className="h-16 w-auto object-contain"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">Preview da Logo</p>
                    <p className="text-xs text-gray-500">Assim será exibida nas pesquisas</p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                <div>
                  <p className="font-medium text-gray-800">Exibir logo nas pesquisas</p>
                  <p className="text-xs text-gray-500">Ativa a exibição da logo no topo das pesquisas</p>
                </div>
                <Switch
                  checked={formData.show_logo_in_survey}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, show_logo_in_survey: checked })
                  }
                />
              </div>

              {formData.show_logo_in_survey && !formData.logo_url && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ A opção está ativada mas nenhuma logo foi enviada. Faça upload da logo para ela aparecer nas pesquisas.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4">

            <Button
              onClick={handleSaveGeneral}
              disabled={updateTenantMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateTenantMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Configurações do Totem */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Palette className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Configurações do Totem</h3>
            <p className="text-sm text-gray-500">Personalize a aparência do totem</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Tipo de Fundo</Label>
            <div className="flex gap-4 mt-2">
              <Button
                variant={totemData.background_type === 'image' ? 'default' : 'outline'}
                onClick={() => setTotemData({ ...totemData, background_type: 'image' })}
              >
                Imagem
              </Button>
              <Button
                variant={totemData.background_type === 'video' ? 'default' : 'outline'}
                onClick={() => setTotemData({ ...totemData, background_type: 'video' })}
              >
                Vídeo
              </Button>
            </div>
          </div>

          {totemData.background_type === 'image' && (
            <div>
              <Label htmlFor="bg-image">Imagem de Fundo</Label>
              <div className="flex gap-2">
                <Input
                  id="bg-image"
                  value={totemData.background_image_url}
                  onChange={(e) => setTotemData({ ...totemData, background_image_url: e.target.value })}
                  placeholder="URL da imagem"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => handleUploadFile(e.target.files[0], 'totem-image');
                    input.click();
                  }}
                >
                  <Upload className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {totemData.background_type === 'video' && (
            <div>
              <Label htmlFor="bg-video">Vídeo de Fundo</Label>
              <div className="flex gap-2">
                <Input
                  id="bg-video"
                  value={totemData.background_video_url}
                  onChange={(e) => setTotemData({ ...totemData, background_video_url: e.target.value })}
                  placeholder="URL do vídeo"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'video/*';
                    input.onchange = (e) => handleUploadFile(e.target.files[0], 'totem-video');
                    input.click();
                  }}
                >
                  <Upload className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="opacity">Opacidade do Fundo ({totemData.background_opacity}%)</Label>
            <input
              id="opacity"
              type="range"
              min="0"
              max="100"
              value={totemData.background_opacity}
              onChange={(e) => setTotemData({ ...totemData, background_opacity: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-gray-800">Download do QRCode</p>
                <p className="text-sm text-gray-500">O mesmo QRCode exibido no Totem</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => downloadQrCode('png')}
                  disabled={!surveyUrl}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar PNG
                </Button>
                <Button
                  variant="outline"
                  onClick={() => downloadQrCode('jpg')}
                  disabled={!surveyUrl}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar JPG
                </Button>
              </div>
            </div>

            {!surveyUrl ? (
              <div className="mt-3 text-sm text-amber-700">
                Nenhum modelo de pesquisa está ativo (ou o limite de uso foi atingido).
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-center">
                <div className="bg-white p-4 rounded-xl shadow-sm">
                  <QRCodeCanvas
                    ref={qrCanvasRef}
                    value={surveyUrl}
                    size={280}
                    level="H"
                    includeMargin={true}
                    fgColor={activeTemplate?.design?.primary_color || '#000000'}
                    {...(activeTemplate?.design?.logo_url && {
                      imageSettings: {
                        src: qrLogoSrc || activeTemplate.design.logo_url,
                        height: 50,
                        width: 50,
                        excavate: true,
                      }
                    })}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSaveTotem}
              disabled={updateTotemMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateTotemMutation.isPending ? 'Salvando...' : 'Salvar Configurações do Totem'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Notificações */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Notificações</h3>
            <p className="text-sm text-gray-500">Configure como deseja receber alertas</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-800">Notificações por Email</p>
              <p className="text-sm text-gray-500">Receba alertas por email</p>
            </div>
            <Switch
              checked={notificationSettings.email_notifications}
              onCheckedChange={(checked) =>
                setNotificationSettings({ ...notificationSettings, email_notifications: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-800">Notificações por WhatsApp</p>
              <p className="text-sm text-gray-500">Receba alertas via WhatsApp</p>
            </div>
            <Switch
              checked={notificationSettings.whatsapp_notifications}
              onCheckedChange={(checked) =>
                setNotificationSettings({ ...notificationSettings, whatsapp_notifications: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-800">Notificações por SMS</p>
              <p className="text-sm text-gray-500">Receba alertas via SMS</p>
            </div>
            <Switch
              checked={notificationSettings.sms_notifications}
              onCheckedChange={(checked) =>
                setNotificationSettings({ ...notificationSettings, sms_notifications: checked })
              }
            />
          </div>
        </div>
      </Card>

      {/* Informações do Plano */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Informações da Conta</h3>
            <p className="text-sm text-gray-500">Detalhes do seu plano e status</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">Plano Atual</span>
            <span className="font-semibold text-gray-800">{tenant?.plan_type || 'Não definido'}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">Status</span>
            <span className={`font-semibold ${tenant?.status === 'active' ? 'text-green-600' :
              tenant?.status === 'suspended' ? 'text-orange-600' :
                'text-red-600'
              }`}>
              {tenant?.status === 'active' ? 'Ativo' :
                tenant?.status === 'suspended' ? 'Suspenso' :
                  'Cancelado'}
            </span>
          </div>
          {tenant?.trial_start_date && (
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Data de Início do Teste</span>
              <span className="font-semibold text-gray-800">
                {new Date(tenant.trial_start_date).toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
