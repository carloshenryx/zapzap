import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Hook para verificar limites do plano do tenant
 * Retorna informações sobre limites e uso atual
 */
export function usePlanLimits() {
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: tenant } = useQuery({
    queryKey: ['tenant', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return null;
      const tenants = await base44.entities.Tenant.filter({ id: user.tenant_id });
      return tenants[0] || null;
    },
    enabled: !!user?.tenant_id,
  });

  const { data: plan } = useQuery({
    queryKey: ['plan', tenant?.plan_type],
    queryFn: async () => {
      if (!tenant?.plan_type) return null;
      const plans = await base44.entities.Plan.filter({ name: tenant.plan_type });
      return plans[0] || null;
    },
    enabled: !!tenant?.plan_type,
  });

  const { data: consumption = [] } = useQuery({
    queryKey: ['consumption', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const data = await base44.entities.Consumption.filter({ 
        tenant_id: user.tenant_id,
        period 
      });
      return data;
    },
    enabled: !!user?.tenant_id,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['survey-templates-count', user?.tenant_id],
    queryFn: () => user?.tenant_id
      ? base44.entities.SurveyTemplate.filter({ tenant_id: user.tenant_id })
      : Promise.resolve([]),
    enabled: !!user?.tenant_id,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-count', user?.tenant_id],
    queryFn: () => user?.tenant_id
      ? base44.entities.User.filter({ tenant_id: user.tenant_id })
      : Promise.resolve([]),
    enabled: !!user?.tenant_id && user?.role === 'admin',
  });

  const currentConsumption = consumption[0] || {
    messages_sent: 0,
    surveys_created: 0,
    responses_received: 0,
    ai_requests: 0
  };

  // Verifica se uma feature está habilitada no plano
  const hasFeature = (featureName) => {
    if (!plan) return true; // Se não tem plano definido, libera tudo
    if (!plan.features) return true;
    
    const feature = plan.features.find(f => f.name === featureName);
    return feature ? feature.enabled : true;
  };

  // Verifica se atingiu limite de uma feature
  const isLimitReached = (featureName) => {
    if (!plan) return false;
    
    switch (featureName) {
      case 'surveys':
        return plan.max_surveys && templates.length >= plan.max_surveys;
      case 'messages':
        return plan.max_messages && currentConsumption.messages_sent >= plan.max_messages;
      case 'users':
        return plan.max_users && users.length >= plan.max_users;
      default:
        return false;
    }
  };

  // Retorna porcentagem de uso de um limite
  const getUsagePercent = (featureName) => {
    if (!plan) return 0;
    
    switch (featureName) {
      case 'surveys':
        if (!plan.max_surveys) return 0;
        return Math.round((templates.length / plan.max_surveys) * 100);
      case 'messages':
        if (!plan.max_messages) return 0;
        return Math.round((currentConsumption.messages_sent / plan.max_messages) * 100);
      case 'users':
        if (!plan.max_users) return 0;
        return Math.round((users.length / plan.max_users) * 100);
      default:
        return 0;
    }
  };

  // Retorna texto descritivo do uso
  const getUsageText = (featureName) => {
    if (!plan) return '';
    
    switch (featureName) {
      case 'surveys':
        if (!plan.max_surveys) return 'Ilimitado';
        return `${templates.length} / ${plan.max_surveys}`;
      case 'messages':
        if (!plan.max_messages) return 'Ilimitado';
        return `${currentConsumption.messages_sent} / ${plan.max_messages}`;
      case 'users':
        if (!plan.max_users) return 'Ilimitado';
        return `${users.length} / ${plan.max_users}`;
      default:
        return '';
    }
  };

  return {
    plan,
    tenant,
    consumption: currentConsumption,
    hasFeature,
    isLimitReached,
    getUsagePercent,
    getUsageText,
    isLoading: !plan && !!tenant?.plan_type,
  };
}
