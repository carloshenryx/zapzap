import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { createPageUrl } from '@/utils';

function cycleLabel(billingCycle) {
  const v = String(billingCycle || '').toLowerCase();
  if (v === 'annual') return 'Cobrança anual';
  if (v === 'quarterly') return 'Cobrança trimestral';
  if (v === 'monthly') return 'Cobrança mensal';
  return 'Cobrança';
}

function cyclePriceSuffix(billingCycle) {
  const v = String(billingCycle || '').toLowerCase();
  if (v === 'annual') return '/ano';
  if (v === 'quarterly') return '/tri';
  if (v === 'monthly') return '/mês';
  return '';
}

export default function TrialExpiredUpgradeModal({ open, tenantId, expiresAt, reason, onOpenChange }) {
  const navigate = useNavigate();

  const { data: plansFromDB = [], isLoading } = useQuery({
    queryKey: ['upgrade-plans-modal'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60 * 1000,
  });

  const plans = useMemo(() => {
    return (plansFromDB || [])
      .filter((p) => Number(p?.price || 0) > 0)
      .map((p) => ({
        name: p.name,
        price: p.price,
        billing_cycle: p.billing_cycle,
        features: (p.features || []).map((f) => (typeof f === 'string' ? f : f?.name)).filter(Boolean),
      }));
  }, [plansFromDB]);

  const handleSelect = (planName) => {
    const flag = reason === 'subscription_expired' ? 'subscription_expired' : 'trial_expired';
    const url =
      createPageUrl('Checkout') +
      `?${flag}=true&tenant_id=${encodeURIComponent(tenantId || '')}&plan=${encodeURIComponent(planName)}`;
    navigate(url);
  };

  const title = reason === 'subscription_expired' ? 'Sua assinatura expirou' : 'Seu Teste Grátis terminou';
  const descriptionPrefix =
    reason === 'subscription_expired' ? 'Sua assinatura expirou' : 'O período de avaliação expirou';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription className="text-slate-600">
            {expiresAt
              ? `${descriptionPrefix} em ${new Date(expiresAt).toLocaleDateString('pt-BR')}.`
              : `${descriptionPrefix}.`}{' '}
            Escolha um plano para continuar usando o sistema sem perder seus dados.
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-4">
          {isLoading && (
            <div className="sm:col-span-2 text-sm text-slate-600">Carregando planos...</div>
          )}
          {!isLoading && plans.length === 0 && (
            <div className="sm:col-span-2 text-sm text-slate-600">Nenhum plano disponível no momento.</div>
          )}
          {plans.map((plan) => (
            <div key={plan.name} className="border rounded-xl p-5 bg-white">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-lg font-semibold text-slate-900">{plan.name}</div>
                  <div className="text-sm text-slate-600">{cycleLabel(plan.billing_cycle)}</div>
                </div>
                <div className="text-xl font-bold text-emerald-700">
                  R$ {plan.price}
                  {cyclePriceSuffix(plan.billing_cycle)}
                </div>
              </div>
              {plan.features?.length > 0 && (
                <ul className="text-sm text-slate-700 space-y-1 mb-4">
                  {plan.features.slice(0, 5).map((f, idx) => (
                    <li key={idx}>{f}</li>
                  ))}
                </ul>
              )}
              <Button className="w-full" onClick={() => handleSelect(plan.name)} disabled={!tenantId}>
                Escolher {plan.name}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
