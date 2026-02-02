import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

export default function PlanLimitAlert({ 
  title = 'Limite Atingido',
  message,
  featureName,
  currentUsage,
  maxLimit,
  showUpgrade = true 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-bold text-orange-900 mb-2">{title}</h4>
          <p className="text-sm text-orange-800 mb-3">
            {message || `Você atingiu o limite de ${featureName} do seu plano (${currentUsage}/${maxLimit}).`}
          </p>
          {showUpgrade && (
            <Button
              size="sm"
              onClick={() => window.location.href = createPageUrl('UpgradePlan')}
              className="bg-orange-600 hover:bg-orange-700 gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              Fazer Upgrade do Plano
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}