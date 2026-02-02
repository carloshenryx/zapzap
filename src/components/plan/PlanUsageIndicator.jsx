import React from 'react';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function PlanUsageIndicator({ 
  label,
  current,
  max,
  showProgress = true 
}) {
  if (!max) {
    return (
      <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
        <span className="text-sm text-emerald-700">{label}</span>
        <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1">
          <CheckCircle2 className="w-4 h-4" />
          Ilimitado
        </span>
      </div>
    );
  }

  const percentage = Math.round((current / max) * 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className={`p-3 rounded-lg ${
      isAtLimit ? 'bg-red-50' : isNearLimit ? 'bg-orange-50' : 'bg-slate-50'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className={`text-sm font-semibold ${
          isAtLimit ? 'text-red-600' : isNearLimit ? 'text-orange-600' : 'text-slate-600'
        }`}>
          {current} / {max}
        </span>
      </div>
      {showProgress && (
        <>
          <Progress 
            value={Math.min(percentage, 100)} 
            className="h-2 mb-1"
            indicatorClassName={
              isAtLimit ? 'bg-red-600' : isNearLimit ? 'bg-orange-600' : 'bg-emerald-600'
            }
          />
          {isNearLimit && (
            <div className="flex items-center gap-1 mt-2">
              <AlertCircle className="w-3 h-3 text-orange-600" />
              <span className="text-xs text-orange-700">
                {isAtLimit ? 'Limite atingido' : 'Próximo do limite'}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}