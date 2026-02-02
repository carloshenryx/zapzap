import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import ExecutiveDashboard from '@/components/dashboard/ExecutiveDashboard';
import { perfMark, perfMeasure } from '@/lib/perf';

const DashboardAdvanced = React.lazy(() => import('./dashboard/DashboardAdvanced'));

export default function Dashboard() {
  const [dashboardMode, setDashboardMode] = useState('simple');
  const { userProfile, isLoadingAuth } = useAuth();
  const measured = useRef({ simpleRender: false, templatesReady: false });

  const { data: templatesLight = [], isSuccess: templatesLightReady } = useQuery({
    queryKey: ['survey-templates-light', userProfile?.tenant_id],
    queryFn: async () => {
      if (!userProfile?.tenant_id) return [];
      const { data } = await supabase
        .from('survey_templates')
        .select('id, name, is_active, created_at')
        .eq('tenant_id', userProfile.tenant_id);
      return data || [];
    },
    enabled: !!userProfile?.tenant_id,
  });

  useEffect(() => {
    if (dashboardMode !== 'simple') return;
    if (measured.current.simpleRender) return;
    measured.current.simpleRender = true;
    const endMark = 'dashboard_simple_render';
    perfMark(endMark);
    let startMark = null;
    try {
      startMark = sessionStorage.getItem('last_route_mark');
    } catch (_) { }
    if (startMark) perfMeasure({ name: 'route_to_dashboard_simple_render', startMark, endMark });
  }, [dashboardMode]);

  useEffect(() => {
    if (dashboardMode !== 'simple') return;
    if (!templatesLightReady) return;
    if (measured.current.templatesReady) return;
    measured.current.templatesReady = true;
    const endMark = 'dashboard_simple_templates_ready';
    perfMark(endMark);
    let startMark = null;
    try {
      startMark = sessionStorage.getItem('last_route_mark');
    } catch (_) { }
    if (startMark) perfMeasure({ name: 'route_to_dashboard_simple_templates_ready', startMark, endMark });
  }, [dashboardMode, templatesLightReady]);

  const Loading = (
    <div className="min-h-screen bg-[#f7f7f8] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-[#5423e7] animate-spin" />
    </div>
  );

  if (isLoadingAuth) return Loading;

  if (dashboardMode === 'simple') {
    return (
      <div className="bg-[#f7f7f8] min-h-screen">
        <div className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-[#121217]">Dashboard de Pesquisas</h1>
              <p className="text-sm text-[#6c6c89] mt-2">Visão simples + tratativa + ao vivo</p>
            </div>
            <div className="flex gap-2">
              <Button variant="default" onClick={() => setDashboardMode('simple')}>Simples</Button>
              <Button variant="outline" onClick={() => setDashboardMode('advanced')}>Avançado</Button>
            </div>
          </div>

          <ExecutiveDashboard tenantId={userProfile?.tenant_id} templates={templatesLight} />
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={Loading}>
      <DashboardAdvanced
        onSwitchToSimple={() => setDashboardMode('simple')}
        onSwitchToAdvanced={() => setDashboardMode('advanced')}
      />
    </Suspense>
  );
}
