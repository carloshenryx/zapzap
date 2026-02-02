import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, BarChart3, MessageCircle, Settings, QrCode, Building2, Users, Home, ShoppingCart, Activity, Crown, FileText, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import UserMenu from '@/components/layout/UserMenu';
import NotificationCenter from '@/components/layout/NotificationCenter';
import { Toaster } from 'sonner';
import PlanLimitsBanner from '@/components/PlanLimitsBanner';
import PostLoginContentModal from '@/components/notifications/PostLoginContentModal';
import TrialExpiredUpgradeModal from '@/components/plan/TrialExpiredUpgradeModal';

export default function Layout({ children, currentPageName }) {
  const navigate = useNavigate();
  const [sidebarExpanded, setSidebarExpanded] = React.useState(false);
  const { user, userProfile, isLoadingAuth, isAuthenticated } = useAuth();
  const isLoading = isLoadingAuth;
  const [expiredState, setExpiredState] = React.useState({ open: false, tenantId: null, expiresAt: null, reason: null });

  const navItems = [
    { name: 'LandingPage', label: 'Home', icon: Home, public: true, hideFromMenu: true },
    { name: 'FreeTrialSignup', label: 'Teste Grátis', icon: ShoppingCart, public: true, hideFromMenu: true },
    { name: 'Checkout', label: 'Checkout', icon: ShoppingCart, public: true, hideFromMenu: true },
    { name: 'Survey', label: 'Pesquisa', icon: ClipboardList, public: true, hideFromMenu: true },
    { name: 'TotemDisplay', label: 'Totem', icon: QrCode, requiresAuth: true },
    { name: 'PreLogin', label: 'Entrar', icon: Users, public: true, hideFromMenu: true },
    { name: 'Login', label: 'Login', icon: Users, public: true, hideFromMenu: true },
    { name: 'LoginNew', label: 'Login', icon: Users, public: true, hideFromMenu: true },
    { name: 'Signup', label: 'Cadastro', icon: Users, public: true, hideFromMenu: true },
    { name: 'ForgotPassword', label: 'Recuperar Senha', icon: Users, public: true, hideFromMenu: true },
    { name: 'Onboarding', label: 'Onboarding', icon: Users, requiresAuth: true, hideFromMenu: true },
    { name: 'Profile', label: 'Perfil', icon: Users, requiresAuth: true, hideFromMenu: true },
    { name: 'Dashboard', label: 'Dashboard', icon: BarChart3, requiresAuth: true },
    { name: 'SendSurvey', label: 'Enviar Pesquisa', icon: MessageCircle, requiresAuth: true },
    { name: 'Customers', label: 'Clientes', icon: Users, requiresAuth: true },
    { name: 'CRM', label: 'CRM', icon: LayoutGrid, requiresAuth: true },
    { name: 'CustomerDetail', label: 'Cliente', icon: Users, requiresAuth: true, hideFromMenu: true },
    { name: 'CRMTasks', label: 'Tarefas (CRM)', icon: FileText, requiresAuth: true, hideFromMenu: true },
    { name: 'CRMSegments', label: 'Segmentos (CRM)', icon: FileText, requiresAuth: true, hideFromMenu: true },
    { name: 'CRMAutomations', label: 'Automações (CRM)', icon: FileText, requiresAuth: true, hideFromMenu: true },
    { name: 'Reports', label: 'Relatórios', icon: FileText, requiresAuth: true },
    { name: 'WhatsAppManager', label: 'WhatsApp', icon: MessageCircle, requiresAuth: true },
    { name: 'UpgradePlan', label: 'Plano', icon: ShoppingCart, requiresAuth: true, hideFromMenu: true },
    { name: 'Admin', label: 'Admin', icon: Settings, requiresAuth: true },
    { name: 'AdminPanel', label: 'Admin', icon: Settings, requiresAuth: true, hideFromMenu: true },
    { name: 'MasterDashboard', label: 'Master', icon: Crown, superAdminOnly: true },
    { name: 'TenantManagement', label: 'Tenants', icon: Building2, superAdminOnly: true }
  ];

  const { data: tenant } = useQuery({
    queryKey: ['current-tenant', userProfile?.tenant_id],
    queryFn: async () => {
      if (!userProfile?.tenant_id) return null;
      const { data } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', userProfile.tenant_id)
        .single();
      return data;
    },
    enabled: !!userProfile?.tenant_id,
  });

  const { data: accessContext } = useQuery({
    queryKey: ['auth-access-context', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;
      const res = await fetch('/api/auth?action=context', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) return null;
      return await res.json().catch(() => null);
    },
    enabled: !!user && !isLoading,
    staleTime: 30 * 1000,
    retry: false,
  });

  const { data: systemConfig } = useQuery({
    queryKey: ['system-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_config')
        .select('system_logo_url, system_website')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },
    staleTime: 60000,
  });

  // Redirect to onboarding if authenticated but no tenant_id
  // DISABLED: Signup now creates tenant automatically (all-in-one flow)
  // Onboarding page kept for future use (adding team members)
  useEffect(() => {
    // Skip - onboarding redirect disabled
    return;

    /* ORIGINAL CODE - DISABLED
    // Skip check if loading - CRITICAL: wait for profile to load
    if (isLoadingAuth) return;

    // Skip check on public pages
    const publicPages = ['/login', '/signup', '/onboarding', '/survey', '/forgot-password'];
    if (publicPages.some(page => window.location.pathname.toLowerCase().includes(page.toLowerCase()))) {
      return;
    }

    // If authenticated but no tenant_id, redirect to onboarding
    // ONLY after loading is complete to avoid race condition
    if (isAuthenticated && user && !userProfile?.tenant_id) {
      console.log('User without tenant_id detected, redirecting to onboarding');
      navigate('/onboarding');
    }
    */
  }, [user, userProfile, isLoadingAuth, isAuthenticated, navigate]);

  useEffect(() => {
    if (isLoading) return;

    const currentItem = navItems.find(item => item.name === currentPageName);
    const isPublicPage = currentItem?.public;
    const access = accessContext?.access || null;
    const isBlockedByPlan = !!(access?.blocked && (access?.reason === 'trial_expired' || access?.reason === 'subscription_expired'));

    // REMOVED: Onboarding redirect (signup handles tenant creation now)

    // Se usuário está autenticado e em página pública, redirecionar para Dashboard
    if (user && isPublicPage && (userProfile?.tenant_id || userProfile?.is_super_admin) && !isBlockedByPlan && currentPageName !== 'TotemDisplay' && currentPageName !== 'Survey') {
      navigate(createPageUrl('Dashboard'), { replace: true });
      return;
    }

    // Se página requer autenticação e usuário não está logado, redirecionar para login
    if (!isPublicPage && !user && !isLoading) {
      navigate('/Login');
      return;
    }

    if (!user || userProfile?.is_super_admin || currentPageName === 'Checkout') {
      if (expiredState.open) setExpiredState({ open: false, tenantId: null, expiresAt: null, reason: null });
      return;
    }

    if (!isBlockedByPlan) {
      if (expiredState.open) setExpiredState({ open: false, tenantId: null, expiresAt: null, reason: null });
      return;
    }

    const nextTenantId = accessContext?.tenant?.id || accessContext?.tenant_id || userProfile?.tenant_id || tenant?.id || null;
    const nextExpiresAt = access?.expires_at || accessContext?.trial?.expires_at || accessContext?.subscription?.expires_at || null;
    const nextReason = access?.reason || null;

    if (!expiredState.open || expiredState.tenantId !== nextTenantId || expiredState.expiresAt !== nextExpiresAt || expiredState.reason !== nextReason) {
      setExpiredState({ open: true, tenantId: nextTenantId, expiresAt: nextExpiresAt, reason: nextReason });
    }
  }, [user, userProfile, isLoading, currentPageName, tenant, accessContext, expiredState]);

  const visibleNavItems = navItems.filter(item => {
    if (item.hideFromMenu) return false;
    if (item.superAdminOnly && !userProfile?.is_super_admin) return false;
    if (item.public) return true;
    return isAuthenticated;
  });

  const pagesWithoutMenu = ['TotemDisplay', 'PreLogin', 'LandingPage', 'FreeTrialSignup', 'Checkout', 'Survey', 'Login', 'LoginNew', 'Signup', 'ForgotPassword', 'Onboarding'];
  if (pagesWithoutMenu.includes(currentPageName)) {
    return (
      <div className="w-full min-h-screen">
        {children}
        <TrialExpiredUpgradeModal
          open={expiredState.open && currentPageName !== 'Checkout'}
          tenantId={expiredState.tenantId}
          expiresAt={expiredState.expiresAt}
          reason={expiredState.reason}
          onOpenChange={() => {}}
        />
      </div>
    );
  }

  const currentNavItem = navItems.find(i => i.name === currentPageName);
  const CurrentIcon = currentNavItem?.icon || Activity;
  const currentLabel = currentNavItem?.label || currentPageName || 'Dashboard';
  const descriptionByPage = {
    Dashboard: 'Visão geral das métricas',
    MasterDashboard: 'Painel administrativo',
    TenantManagement: 'Gerenciar tenants',
    WhatsAppManager: 'Gerenciar instâncias',
    SendSurvey: 'Enviar pesquisas aos clientes',
    Customers: 'Visualizar e gerenciar clientes',
    CRM: 'Visão geral dos clientes e tratativas',
    CustomerDetail: 'Histórico e tratativas do cliente',
    CRMTasks: 'Tarefas e acompanhamentos',
    CRMSegments: 'Segmentação de clientes',
    CRMAutomations: 'Automações e regras',
    Reports: 'Relatórios e insights',
    Admin: 'Configurações e modelos',
    UpgradePlan: 'Planos e faturamento',
    TotemDisplay: 'Modo Totem',
  };
  const currentDescription = descriptionByPage[currentPageName] || 'Visão geral';
  const subtitle = tenant?.name ? `${tenant.name} • ${currentDescription}` : currentDescription;

  return (
    <div className="flex h-screen bg-[#f7f7f8] overflow-hidden flex-col">
      <PlanLimitsBanner />
      <PostLoginContentModal />
      <TrialExpiredUpgradeModal
        open={expiredState.open && currentPageName !== 'Checkout'}
        tenantId={expiredState.tenantId}
        expiresAt={expiredState.expiresAt}
        reason={expiredState.reason}
        onOpenChange={() => {}}
      />

      <div className="flex flex-1 overflow-hidden">
        <div
          className={cn(
            "bg-white border-r border-[#d1d1db] flex flex-col py-4 gap-2 transition-all duration-300",
            sidebarExpanded ? "w-56" : "w-16"
          )}
          onMouseEnter={() => setSidebarExpanded(true)}
          onMouseLeave={() => setSidebarExpanded(false)}
        >
          <div className={cn(
            "flex items-center gap-3 px-3 mb-2 transition-all",
            sidebarExpanded ? "justify-start" : "justify-center"
          )}>
            {systemConfig?.system_logo_url ? (
              <img
                src={systemConfig.system_logo_url}
                alt="Sistema"
                className="w-10 h-10 rounded-lg object-contain bg-white flex-shrink-0"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-10 h-10 bg-[#5423e7] rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                A
              </div>
            )}
            {sidebarExpanded && (
              <span className="text-sm font-semibold text-[#121217] whitespace-nowrap">
                {systemConfig?.system_website || 'AvaliaZap'}
              </span>
            )}
          </div>

          {visibleNavItems.filter(item => !item.public || item.requiresAuth).map((item) => {
            const isActive = currentPageName === item.name;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={createPageUrl(item.name)}
                className={cn(
                  "flex items-center gap-3 mx-2 px-2 py-2.5 rounded-lg transition-all",
                  isActive
                    ? "bg-[#5423e7] text-white"
                    : "text-[#6c6c89] hover:bg-[#f7f7f8]",
                  sidebarExpanded ? "justify-start" : "justify-center"
                )}
                title={item.label}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarExpanded && (
                  <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-white border-b border-[#d1d1db] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#5423e7] rounded-lg flex items-center justify-center">
                {React.createElement(CurrentIcon, { className: "w-5 h-5 text-white" })}
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[#121217]">
                  {currentLabel}
                </h1>
                <p className="text-xs text-[#6c6c89]">
                  {subtitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.location.href = createPageUrl('UpgradePlan')}
                className="px-4 py-2 text-sm bg-[#121217] text-white rounded-lg hover:bg-[#121217]/90"
              >
                Upgrade agora
              </button>
              <div className="flex items-center gap-2">
                <button className="w-9 h-9 rounded-lg hover:bg-[#f7f7f8] flex items-center justify-center text-lg">📞</button>
                <button className="w-9 h-9 rounded-lg hover:bg-[#f7f7f8] flex items-center justify-center text-lg">📧</button>
                <NotificationCenter user={user} />
                <button className="w-9 h-9 rounded-lg hover:bg-[#f7f7f8] flex items-center justify-center text-lg">⚙️</button>
              </div>
              <UserMenu />
            </div>
          </div>

          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>

        <button className="fixed bottom-6 right-6 w-auto h-12 bg-[#ffc233] rounded-full shadow-lg flex items-center justify-center px-4 text-white hover:bg-[#ffc233]/90 gap-2">
          <span className="text-lg">💬</span>
          <span className="text-xs font-medium">Suporte</span>
        </button>

        <Toaster position="top-right" />
      </div>
    </div>
  );
}
