import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Save, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SystemBrandingManager() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [localData, setLocalData] = useState({
    system_logo_url: '',
    system_website: 'www.avaliazap.com.br'
  });

  const { data: config, isLoading } = useQuery({
    queryKey: ['system-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_config')
        .select('id, system_logo_url, system_website')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data || null;
    },
  });

  React.useEffect(() => {
    if (config) {
      setLocalData({
        system_logo_url: config.system_logo_url || '',
        system_website: config.system_website || 'www.avaliazap.com.br'
      });
    }
  }, [config]);

  const updateConfigMutation = useMutation({
    mutationFn: async (data) => {
      if (config?.id) {
        const { data: updated, error } = await supabase
          .from('system_config')
          .update(data)
          .eq('id', config.id)
          .select('id, system_logo_url, system_website')
          .single();
        if (error) throw error;
        return updated;
      }

      const { data: created, error } = await supabase
        .from('system_config')
        .insert(data)
        .select('id, system_logo_url, system_website')
        .single();
      if (error) throw error;
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['system-config']);
      toast.success('Configurações do sistema atualizadas!');
    },
    onError: (error) => {
      toast.error(error?.message || 'Erro ao salvar configurações do sistema');
    },
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const safeExt = fileExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const fileName = `system-logo-${Date.now()}.${safeExt}`;
      const filePath = `system-branding/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public-assets')
        .upload(filePath, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public-assets')
        .getPublicUrl(filePath);

      setLocalData(prev => ({ ...prev, system_logo_url: publicUrl }));
      toast.success('Logo enviada com sucesso!');
    } catch (error) {
      toast.error(error?.message || 'Erro ao fazer upload da logo');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    await updateConfigMutation.mutateAsync(localData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#d1d1db] p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
          <Eye className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[#121217]">Branding do Sistema</h3>
          <p className="text-xs text-[#6c6c89]">Logo e site exibidos no TotemDisplay</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Logo Upload */}
        <div>
          <Label className="text-sm font-medium text-[#121217] mb-2 block">
            Logo do Sistema
          </Label>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
              id="system-logo-upload"
            />
            <Button
              onClick={() => document.getElementById('system-logo-upload').click()}
              disabled={uploading}
              variant="outline"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Enviando...' : 'Upload Logo'}
            </Button>
            {localData.system_logo_url && (
              <div className="flex items-center gap-2">
                <img 
                  src={localData.system_logo_url} 
                  alt="Logo do sistema" 
                  className="h-10 w-auto object-contain rounded"
                />
                <span className="text-xs text-green-600">✓ Logo carregada</span>
              </div>
            )}
          </div>
          <p className="text-xs text-[#6c6c89] mt-2">
            Esta logo será exibida de forma discreta no TotemDisplay
          </p>
        </div>

        {/* Website */}
        <div>
          <Label htmlFor="system-website" className="text-sm font-medium text-[#121217] mb-2 block">
            Website do Sistema
          </Label>
          <Input
            id="system-website"
            value={localData.system_website}
            onChange={(e) => setLocalData(prev => ({ ...prev, system_website: e.target.value }))}
            placeholder="www.avaliazap.com.br"
            className="max-w-md"
          />
          <p className="text-xs text-[#6c6c89] mt-2">
            URL exibida no rodapé do TotemDisplay
          </p>
        </div>

        {/* Preview */}
        {localData.system_logo_url && (
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs font-medium text-slate-700 mb-3">Preview do TotemDisplay:</p>
            <div className="bg-white rounded-lg p-3 border border-slate-200 flex items-center justify-between">
              <img 
                src={localData.system_logo_url} 
                alt="Preview" 
                className="h-6 w-auto object-contain opacity-60"
              />
              <span className="text-xs text-slate-500">{localData.system_website}</span>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t border-slate-200">
          <Button 
            onClick={handleSave}
            disabled={updateConfigMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateConfigMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </div>
    </div>
  );
}
