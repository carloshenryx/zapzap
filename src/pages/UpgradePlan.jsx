import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, Loader2, Star, X, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { createPageUrl } from '../utils';

export default function UpgradePlan() {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { userProfile } = useAuth();

  // Use AuthContext userProfile
  const user = userProfile;

  const { data: subscription = [] } = useQuery({
    queryKey: ['subscription', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .order('created_date', { ascending: false })
        .limit(1);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.tenant_id,
  });

  const { data: plansFromDB = [] } = useQuery({
    queryKey: ['available-plans-upgrade'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const currentPlan = subscription[0]?.plan_type;

  // Comparação de features
  const featureComparison = [
    { name: 'Usuários', key: 'max_users' },
    { name: 'Pesquisas', key: 'max_surveys' },
    { name: 'Mensagens Mensais', key: 'max_messages' },
    { name: 'WhatsApp', feature: 'whatsapp_integration' },
    { name: 'Totem Digital', feature: 'totem_digital' },
    { name: 'API Webhook', feature: 'webhook_api' },
    { name: 'Relatórios Avançados', feature: 'advanced_reports' },
    { name: 'Suporte Priority', feature: 'priority_support' }
  ];

  const handleUpgrade = async (planName) => {
    if (planName === currentPlan) {
      toast.error('Você já está neste plano');
      return;
    }

    setIsProcessing(true);
    try {
      const selectedPlanData = plansFromDB.find(p => p.name === planName);
      if (!selectedPlanData) {
        toast.error('Plano não encontrado');
        return;
      }

      window.location.href = createPageUrl('Checkout') + `?plan=${planName}&upgrade=true&tenant_id=${user?.tenant_id}`;
    } catch (error) {
      toast.error('Erro ao processar upgrade');
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          <h1 className="text-4xl font-bold text-slate-900 mb-2">Escolha o plano ideal para você</h1>
          <p className="text-xl text-slate-600">
            {currentPlan ? `Seu plano atual: ${currentPlan}` : 'Compare os recursos e benefícios de cada plano'}
          </p>
        </motion.div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {plansFromDB.map((plan, idx) => {
            const isCurrentPlan = plan.name === currentPlan;
            const isUpgrade = plansFromDB.findIndex(p => p.name === currentPlan) < idx;
            const isRecommended = idx === 1; // Plano do meio

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`relative rounded-2xl shadow-lg overflow-hidden transition-all ${isCurrentPlan
                    ? 'ring-2 ring-indigo-600 bg-white transform scale-105'
                    : isRecommended
                      ? 'bg-white hover:shadow-2xl transform scale-105'
                      : 'bg-white hover:shadow-xl'
                  }`}
              >
                {/* Recommended Badge */}
                {isRecommended && !isCurrentPlan && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-2 text-xs font-bold rounded-full shadow-lg flex items-center gap-1">
                    <Star className="w-3 h-3 fill-white" />
                    MAIS POPULAR
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrentPlan && (
                  <div className="absolute top-0 right-0 bg-indigo-600 text-white px-4 py-1 text-sm font-semibold rounded-bl-lg">
                    Plano Atual
                  </div>
                )}

                {/* Plan Content */}
                <div className="p-8 pt-10">
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                  <div className="mb-6">
                    <span className="text-5xl font-bold text-indigo-600">
                      R$ {plan.price}
                    </span>
                    <span className="text-slate-600 ml-2">/mês</span>
                  </div>

                  {/* Limites */}
                  <div className="mb-6 p-4 bg-slate-50 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Usuários</span>
                      <span className="font-semibold text-slate-900">
                        {plan.max_users === 999999 ? 'Ilimitado' : plan.max_users || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Pesquisas</span>
                      <span className="font-semibold text-slate-900">
                        {plan.max_surveys === 999999 ? 'Ilimitadas' : plan.max_surveys || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Mensagens/mês</span>
                      <span className="font-semibold text-slate-900">
                        {plan.max_messages === 999999 ? 'Ilimitadas' : (plan.max_messages || 'N/A')}
                      </span>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-3 mb-8 min-h-[200px]">
                    {plan.features && plan.features.length > 0 ? (
                      plan.features.map((feature, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-slate-700 text-sm">
                            {typeof feature === 'object' ? feature.name : feature}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span className="text-slate-700 text-sm">Acesso completo ao sistema</span>
                      </div>
                    )}
                  </div>

                  {/* Button */}
                  <Button
                    onClick={() => handleUpgrade(plan.name)}
                    disabled={isProcessing || isCurrentPlan}
                    className={`w-full h-12 font-semibold transition-all ${isCurrentPlan
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : isUpgrade || isRecommended
                          ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg'
                          : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                      }`}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : isCurrentPlan ? (
                      'Plano Atual'
                    ) : isUpgrade ? (
                      '⬆️ Fazer Upgrade'
                    ) : (
                      '⬇️ Fazer Downgrade'
                    )}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-lg p-8 mb-8 overflow-x-auto"
        >
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Comparação Detalhada de Recursos</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-4 px-4 text-slate-700 font-semibold">Recursos</th>
                {plansFromDB.map(plan => (
                  <th key={plan.id} className="text-center py-4 px-4">
                    <div className="font-bold text-slate-900">{plan.name}</div>
                    <div className="text-sm text-indigo-600 font-semibold">R$ {plan.price}/mês</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {featureComparison.map((feature, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-4 px-4 text-slate-700 font-medium">{feature.name}</td>
                  {plansFromDB.map(plan => {
                    let value;
                    if (feature.key) {
                      // É um limite (max_users, max_surveys, etc)
                      const val = plan[feature.key];
                      value = val === 999999 ? 'Ilimitado' : (val || '-');
                    } else if (feature.feature) {
                      // É uma feature booleana
                      const hasFeature = plan.features?.some(f =>
                        (typeof f === 'object' && f.name?.toLowerCase().includes(feature.feature)) ||
                        (typeof f === 'string' && f.toLowerCase().includes(feature.feature))
                      );
                      value = hasFeature;
                    }

                    return (
                      <td key={plan.id} className="py-4 px-4 text-center">
                        {typeof value === 'boolean' ? (
                          value ? (
                            <Check className="w-6 h-6 text-green-600 mx-auto" />
                          ) : (
                            <X className="w-6 h-6 text-slate-300 mx-auto" />
                          )
                        ) : (
                          <span className="font-semibold text-slate-900">{value}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 bg-blue-50 border border-blue-200 rounded-2xl p-8"
        >
          <h3 className="text-lg font-semibold text-blue-900 mb-3">ℹ️ Informações importantes</h3>
          <ul className="space-y-2 text-blue-800">
            <li>• Sua mudança de plano entrará em vigência imediatamente após o pagamento</li>
            <li>• A cobrança será feita de forma proporcional ao seu ciclo de faturamento</li>
            <li>• Você pode trocar de plano a qualquer momento</li>
            <li>• Todos os seus dados serão mantidos durante a transição</li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}