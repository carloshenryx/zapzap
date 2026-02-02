import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { usePlanLimits } from '@/components/hooks/usePlanLimits';

/**
 * Banner global para exibir alertas de limites de plano
 * Deve ser incluído no Layout para aparecer em todas as páginas
 */
export default function PlanLimitsBanner() {
  const planLimits = usePlanLimits();
  const [dismissed, setDismissed] = React.useState(false);

  if (!planLimits.plan || dismissed) return null;

  // Verificar se algum limite está próximo ou atingido
  const surveysPercent = planLimits.getUsagePercent('surveys');
  const messagesPercent = planLimits.getUsagePercent('messages');
  const usersPercent = planLimits.getUsagePercent('users');

  const isNearLimit = surveysPercent >= 80 || messagesPercent >= 80 || usersPercent >= 80;
  const isAtLimit = planLimits.isLimitReached('surveys') || 
                     planLimits.isLimitReached('messages') || 
                     planLimits.isLimitReached('users');

  if (!isNearLimit && !isAtLimit) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${
        isAtLimit ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'
      } border-b-2 px-6 py-3`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className={`w-5 h-5 ${isAtLimit ? 'text-red-600' : 'text-orange-600'}`} />
          <div className="text-sm">
            <span className={`font-semibold ${isAtLimit ? 'text-red-900' : 'text-orange-900'}`}>
              {isAtLimit ? '🚨 Limite Atingido: ' : '⚠️ Próximo do Limite: '}
            </span>
            <span className={isAtLimit ? 'text-red-800' : 'text-orange-800'}>
              {planLimits.isLimitReached('surveys') && `Pesquisas (${planLimits.getUsageText('surveys')})`}
              {planLimits.isLimitReached('messages') && `Mensagens (${planLimits.getUsageText('messages')})`}
              {!isAtLimit && surveysPercent >= 80 && `Pesquisas em ${surveysPercent}%`}
              {!isAtLimit && messagesPercent >= 80 && `Mensagens em ${messagesPercent}%`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => window.location.href = createPageUrl('UpgradePlan')}
            className={`gap-2 ${
              isAtLimit ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Fazer Upgrade
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDismissed(true)}
            className="text-slate-600"
          >
            Dispensar
          </Button>
        </div>
      </div>
    </motion.div>
  );
}