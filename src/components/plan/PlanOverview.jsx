import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, MessageCircle, FileText, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { usePlanLimits } from '@/components/hooks/usePlanLimits';

/**
 * Componente para exibir overview do plano atual e seus limites
 * Útil para Dashboard ou páginas de configuração
 */
export default function PlanOverview() {
  const planLimits = usePlanLimits();

  if (!planLimits.plan) {
    return null;
  }

  const features = [
    {
      icon: FileText,
      label: 'Pesquisas',
      current: planLimits.getUsageText('surveys').split('/')[0],
      max: planLimits.plan.max_surveys || '∞',
      color: 'indigo'
    },
    {
      icon: MessageCircle,
      label: 'Mensagens/mês',
      current: planLimits.getUsageText('messages').split('/')[0],
      max: planLimits.plan.max_messages || '∞',
      color: 'green'
    },
    {
      icon: Users,
      label: 'Usuários',
      current: planLimits.getUsageText('users').split('/')[0],
      max: planLimits.plan.max_users || '∞',
      color: 'blue'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-200 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-indigo-900">Plano Atual: {planLimits.plan.name}</h3>
          <p className="text-sm text-indigo-700 mt-1">
            R$ {planLimits.plan.price}/mês • {planLimits.plan.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => window.location.href = createPageUrl('UpgradePlan')}
          className="bg-indigo-600 hover:bg-indigo-700 gap-2"
        >
          <TrendingUp className="w-4 h-4" />
          Fazer Upgrade
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {features.map((feature, idx) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white rounded-lg p-4 border border-indigo-100"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 bg-${feature.color}-100 rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 text-${feature.color}-600`} />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{feature.label}</p>
                  <p className="text-lg font-bold text-slate-900">
                    {feature.current} <span className="text-sm text-slate-500">/ {feature.max}</span>
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Features habilitadas */}
      {planLimits.plan.features && planLimits.plan.features.length > 0 && (
        <div className="mt-6 pt-6 border-t border-indigo-200">
          <h4 className="text-sm font-semibold text-indigo-900 mb-3">Recursos Disponíveis:</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {planLimits.plan.features.filter(f => f.enabled).map((feature, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm text-indigo-700">
                <Zap className="w-3 h-3" />
                <span>{feature.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}