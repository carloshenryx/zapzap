import React from 'react';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { Gift, ArrowRight, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { fetchAPI } from '@/lib/supabase';

export default function VoucherFallbackAnalytics({ userTenantId, templates }) {
  const { data: voucherUsages = [] } = useQuery({
    queryKey: ['voucher-usages', userTenantId],
    queryFn: async () => {
      const result = await fetchAPI('/vouchers?action=usage-list', { method: 'GET' });
      return result.usage || [];
    },
    enabled: !!userTenantId,
  });

  const { data: vouchers = [] } = useQuery({
    queryKey: ['vouchers-analytics', userTenantId],
    queryFn: async () => {
      const result = await fetchAPI('/vouchers?action=list', { method: 'GET' });
      return result.vouchers || [];
    },
    enabled: !!userTenantId,
  });

  // Análise de Templates com Limite e Fallback
  const templatesWithLimits = templates.filter(t => t.usage_limit?.enabled);
  const templatesNearLimit = templatesWithLimits.filter(t => {
    const usage = (t.usage_limit.current_uses || 0) / (t.usage_limit.max_uses || 1);
    return usage >= 0.8; // 80% ou mais
  });

  // Análise de Vouchers
  const totalVouchersIssued = voucherUsages.length;
  const vouchersUsed = voucherUsages.filter(v => v.redeemed).length;
  const voucherRedemptionRate = totalVouchersIssued > 0 
    ? ((vouchersUsed / totalVouchersIssued) * 100).toFixed(1)
    : 0;

  // Top vouchers
  const voucherStats = vouchers.map(voucher => {
    const usages = voucherUsages.filter(vu => vu.voucher_id === voucher.id);
    const redeemed = usages.filter(vu => vu.redeemed).length;
    return {
      ...voucher,
      totalUsages: usages.length,
      redeemed,
      redemptionRate: usages.length > 0 ? (redeemed / usages.length) * 100 : 0
    };
  }).sort((a, b) => b.totalUsages - a.totalUsages).slice(0, 3);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Voucher Analytics */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gift className="w-5 h-5 text-amber-600" />
          <h3 className="text-sm font-semibold text-slate-700">Análise de Vouchers</h3>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{totalVouchersIssued}</p>
              <p className="text-xs text-slate-500">Emitidos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{vouchersUsed}</p>
              <p className="text-xs text-slate-500">Resgatados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-indigo-600">{voucherRedemptionRate}%</p>
              <p className="text-xs text-slate-500">Taxa</p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs font-semibold text-slate-600 mb-3">Top Vouchers</p>
            {voucherStats.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum voucher emitido ainda</p>
            ) : (
              <div className="space-y-2">
                {voucherStats.map(voucher => (
                  <div key={voucher.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{voucher.design?.icon || '🎁'}</span>
                      <div>
                        <p className="text-xs font-medium">{voucher.name}</p>
                        <p className="text-xs text-slate-500">{voucher.totalUsages} emitidos</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-green-600">
                        {voucher.redemptionRate.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Template Fallback Analytics */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <ArrowRight className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-700">Templates com Fallback</h3>
        </div>

        {templatesWithLimits.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum template com limite configurado</p>
        ) : (
          <div className="space-y-4">
            {templatesNearLimit.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-amber-600" />
                  <p className="text-xs font-semibold text-amber-900">
                    {templatesNearLimit.length} template(s) perto do limite
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {templatesWithLimits.map(template => {
                const currentUses = template.usage_limit.current_uses || 0;
                const maxUses = template.usage_limit.max_uses || 1;
                const percentage = (currentUses / maxUses) * 100;
                const fallbackTemplate = templates.find(t => t.id === template.usage_limit.fallback_template_id);

                return (
                  <div key={template.id} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium">{template.name}</p>
                      <span className="text-xs text-slate-500">
                        {currentUses}/{maxUses}
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2 mb-2" />
                    {fallbackTemplate && (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <ArrowRight className="w-3 h-3" />
                        <span>Fallback: {fallbackTemplate.name}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
