import React, { useState } from 'react';
import { supabase, fetchAPI } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  MessageCircle,
  Loader2,
  AlertCircle,
  CheckCircle2,
  User,
  FileText,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import PhoneInput from '@/components/sendsurvey/PhoneInput';
import RecentSends from '@/components/sendsurvey/RecentSends';
import { usePlanLimits } from '@/components/hooks/usePlanLimits';
import PlanLimitAlert from '@/components/plan/PlanLimitAlert';
import PlanUsageIndicator from '@/components/plan/PlanUsageIndicator';

export default function SendSurvey() {
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const planLimits = usePlanLimits();

  const { user, userProfile } = useAuth();

  const { data: templates = [] } = useQuery({
    queryKey: ['survey-templates', userProfile?.tenant_id],
    queryFn: async () => {
      if (!userProfile?.tenant_id) return [];
      const { data } = await supabase
        .from('survey_templates')
        .select('id, name')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('is_active', true)
        .eq('send_via_whatsapp', true)
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!userProfile?.tenant_id,
  });

  const { data: instances = [] } = useQuery({
    queryKey: ['whatsapp-instances', userProfile?.tenant_id],
    queryFn: async () => {
      if (!userProfile?.tenant_id) return [];
      const { data } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_name, phone_number, status')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('status', 'connected');
      return data || [];
    },
    enabled: !!userProfile?.tenant_id,
  });

  const { data: recentMessages = [] } = useQuery({
    queryKey: ['recent-whatsapp-messages', userProfile?.tenant_id],
    queryFn: async () => {
      if (!userProfile?.tenant_id) return [];
      const { data } = await supabase
        .from('whatsapp_messages')
        .select('id, created_at, customer_name, phone_number, status')
        .eq('tenant_id', userProfile.tenant_id)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!userProfile?.tenant_id,
    refetchInterval: 30000, // Optimized: 30s instead of 10s (-240 requests/hour)
  });

  const validateForm = () => {
    if (!customerName.trim()) {
      toast.error('Nome do cliente é obrigatório');
      return false;
    }
    if (!phoneNumber.trim()) {
      toast.error('Celular é obrigatório');
      return false;
    }
    if (!selectedTemplate) {
      toast.error('Selecione um modelo de pesquisa');
      return false;
    }
    if (instances.length === 0) {
      toast.error('Nenhuma instância WhatsApp conectada disponível');
      return false;
    }
    return true;
  };

  const handleSendSurvey = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Validar limites do plano
    if (planLimits.isLimitReached('messages')) {
      toast.error(`Limite mensal de mensagens atingido (${planLimits.getUsageText('messages')}). Faça upgrade do seu plano.`);
      return;
    }

    setIsLoading(true);
    setSuccessMessage('');

    try {
      // Validar no backend também
      const validation = await fetchAPI('/plans?action=validate-limits', {
        method: 'POST',
        body: JSON.stringify({ resource_type: 'surveys' })
      });

      if (!validation.can_create) {
        toast.error('Limite de envios atingido');
        setIsLoading(false);
        return;
      }

      // Get the active connected instance
      const activeInstance = instances.find(i => i.status === 'connected');

      const data = await fetchAPI('/surveys?action=trigger', {
        method: 'POST',
        body: JSON.stringify({
          instanceName: activeInstance.instance_name,
          phoneNumber: phoneNumber.replace(/\D/g, ''),
          customerName: customerName.trim(),
          surveyTemplateId: selectedTemplate
        })
      });

      if (data.success) {
        setSuccessMessage(`Pesquisa enviada com sucesso para ${customerName}!`);
        toast.success('Pesquisa enviada com sucesso!', {
          description: `WhatsApp enviado para ${phoneNumber}`,
          icon: '✅'
        });

        // Reset form
        setCustomerName('');
        setPhoneNumber('');
        setSelectedTemplate('');

        setTimeout(() => {
          setSuccessMessage('');
        }, 5000);
      }
    } catch (error) {
      console.error('Erro ao enviar pesquisa:', error);
      toast.error(error.response?.data?.error || 'Erro ao enviar pesquisa');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#f7f7f8] p-6 min-h-screen">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold text-[#121217]">Enviar Pesquisa</h1>
          <p className="text-sm text-[#6c6c89] mt-1">Envie pesquisas para seus clientes via WhatsApp</p>
        </motion.div>

        {/* Plan Usage */}
        {planLimits.plan && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-[#d1d1db] p-6"
          >
            <h3 className="text-sm font-semibold text-[#121217] mb-4">Uso do Plano - {planLimits.plan.name}</h3>
            <PlanUsageIndicator
              label="Mensagens Mensais"
              current={planLimits.consumption.messages_sent}
              max={planLimits.plan.max_messages}
            />
          </motion.div>
        )}

        {/* Alert - Limite de Mensagens */}
        {planLimits.isLimitReached('messages') && (
          <PlanLimitAlert
            title="Limite de Mensagens Atingido"
            message={`Você atingiu o limite mensal de ${planLimits.plan.max_messages} mensagens. Faça upgrade para enviar mais pesquisas.`}
            featureName="mensagens"
            currentUsage={planLimits.consumption.messages_sent}
            maxLimit={planLimits.plan.max_messages}
          />
        )}

        {/* Alert - No Connected Instances */}
        {instances.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 sm:p-6 mb-6"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-orange-900 text-sm sm:text-base">Nenhuma Instância Conectada</h3>
                <p className="text-xs sm:text-sm text-orange-700 mt-1">
                  Você precisa conectar uma instância WhatsApp antes de enviar pesquisas. Acesse o módulo WhatsApp para conectar.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Alert - No Active Templates */}
        {templates.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 sm:p-6 mb-6"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-blue-900 text-sm sm:text-base">Nenhum Modelo Disponível</h3>
                <p className="text-xs sm:text-sm text-blue-700 mt-1">
                  Crie um modelo de pesquisa e habilite o envio via WhatsApp antes de enviar pesquisas.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Success Message */}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 sm:p-6 mb-6"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-emerald-900 text-sm sm:text-base">Sucesso!</h3>
                <p className="text-xs sm:text-sm text-emerald-700 mt-1">{successMessage}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-[#d1d1db] p-6 sm:p-8"
        >
          <form onSubmit={handleSendSurvey} className="space-y-6">
            {/* Customer Name Field */}
            <div className="space-y-2">
              <Label htmlFor="customerName" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Nome do Cliente
              </Label>
              <Input
                id="customerName"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full"
                disabled={isLoading}
              />
              <p className="text-xs text-[#6c6c89]">Nome do cliente para personalizar a mensagem</p>
            </div>

            {/* Phone Field with validation */}
            <PhoneInput
              value={phoneNumber}
              onChange={setPhoneNumber}
              disabled={isLoading}
            />

            {/* Survey Template Field */}
            <div className="space-y-2">
              <Label htmlFor="template" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Modelo de Pesquisa <span className="text-red-500">*</span>
              </Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate} disabled={isLoading || templates.length === 0}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um modelo de pesquisa" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-[#6c6c89]">Selecione o modelo de pesquisa a ser enviado (obrigatório)</p>
            </div>

            {/* Submit Button */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                type="submit"
                disabled={isLoading || instances.length === 0 || templates.length === 0 || planLimits.isLimitReached('messages')}
                className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-medium py-3 sm:py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Enviar Pesquisa via WhatsApp
                  </>
                )}
              </Button>
            </motion.div>

            {/* Info Box */}
            <div className="bg-[#f7f7f8] rounded-lg p-4">
              <h4 className="text-sm font-semibold text-[#121217] mb-2">ℹ️ Como funciona:</h4>
              <ul className="text-xs text-[#6c6c89] space-y-1">
                <li>✓ A pesquisa será enviada via WhatsApp para o número informado</li>
                <li>✓ O cliente receberá um link para responder a pesquisa</li>
                <li>✓ As respostas serão automaticamente registradas no seu dashboard</li>
                <li>✓ Você pode acompanhar todas as respostas em Tempo Real</li>
              </ul>
            </div>
          </form>
        </motion.div>

        {/* Recent Sends */}
        <RecentSends messages={recentMessages} />

        {/* Connected Instance Info */}
        {instances.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl border border-[#d1d1db] p-6 sm:p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-[#121217]">Instâncias Conectadas</h3>
            </div>
            <div className="space-y-2">
              {instances.map((instance) => (
                <motion.div
                  key={instance.id}
                  whileHover={{ scale: 1.01 }}
                  className="flex items-center justify-between p-3 bg-[#f7f7f8] rounded-lg hover:bg-[#e8e8ec] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-2 h-2 bg-emerald-600 rounded-full"
                    />
                    <div>
                      <p className="text-sm font-medium text-[#121217]">{instance.instance_name}</p>
                      {instance.phone_number && (
                        <p className="text-xs text-[#6c6c89]">{instance.phone_number}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-medium">
                    Conectada
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}