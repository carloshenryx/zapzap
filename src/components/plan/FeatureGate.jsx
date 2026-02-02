import React from 'react';
import { motion } from 'framer-motion';
import { Lock, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

/**
 * Componente que bloqueia features não disponíveis no plano
 * Se a feature não está disponível, mostra um overlay com mensagem de upgrade
 */
export default function FeatureGate({ 
  children, 
  hasAccess, 
  featureName,
  customMessage 
}) {
  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Conteúdo desabilitado */}
      <div className="opacity-40 pointer-events-none blur-sm">
        {children}
      </div>
      
      {/* Overlay de bloqueio */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl"
      >
        <div className="text-center p-6 max-w-sm">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="font-bold text-slate-900 mb-2">
            {featureName} Não Disponível
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            {customMessage || `Esta funcionalidade não está incluída no seu plano atual.`}
          </p>
          <Button
            onClick={() => window.location.href = createPageUrl('UpgradePlan')}
            className="bg-indigo-600 hover:bg-indigo-700 gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Fazer Upgrade
          </Button>
        </div>
      </motion.div>
    </div>
  );
}