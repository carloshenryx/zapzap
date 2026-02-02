import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '../utils';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  ListTodo,
  Zap,
  Search,
  MessageCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Star,
  LayoutList,
  LayoutGrid,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import WidgetSelector from '@/components/crm/WidgetSelector';
import NPSHistoryWidget from '@/components/crm/NPSHistoryWidget';
import TaskPerformanceWidget from '@/components/crm/TaskPerformanceWidget';
import KanbanView from '@/components/crm/KanbanView';
import { getUnifiedScore5, isFiniteNumber } from '@/lib/ratingUtils';

export default function CRM() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);
  const [activeWidgets, setActiveWidgets] = useState(['nps_history', 'task_performance', 'customer_stats', 'recent_interactions']);
  const [detractorFilters, setDetractorFilters] = useState({
    name: '',
    scoreMin: '',
    scoreMax: '',
    startDate: '',
    endDate: '',
  });

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  // Use AuthContext userProfile
  const user = userProfile;

  const { data: responses = [] } = useQuery({
    queryKey: ['survey-responses', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      const { data, error } = await supabase
        .from('survey_responses')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.tenant_id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['crm-tasks', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      const { data, error } = await supabase
        .from('crm_tasks')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.tenant_id,
  });

  const { data: segments = [] } = useQuery({
    queryKey: ['customer-segments', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      const { data, error } = await supabase
        .from('customer_segments')
        .select('*')
        .eq('tenant_id', user.tenant_id);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.tenant_id,
  });

  const { data: automations = [] } = useQuery({
    queryKey: ['crm-automations', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      const { data, error } = await supabase
        .from('crm_automations')
        .select('*')
        .eq('tenant_id', user.tenant_id);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.tenant_id,
  });

  const { data: dashboardConfig } = useQuery({
    queryKey: ['crm-dashboard-config', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data, error } = await supabase
        .from('crm_dashboard_configs')
        .select('*')
        .eq('user_email', user.email)
        .maybeSingle();

      if (error) throw error;
      return data || null;
    },
    enabled: !!user?.email,
  });

  React.useEffect(() => {
    if (dashboardConfig) {
      if (dashboardConfig.view_mode) setViewMode(dashboardConfig.view_mode);
      if (dashboardConfig.active_widgets) setActiveWidgets(dashboardConfig.active_widgets);
    }
  }, [dashboardConfig]);

  const saveDashboardConfigMutation = useMutation({
    mutationFn: async (updates) => {
      if (!user?.email || !user?.tenant_id) return;

      const payload = {
        tenant_id: user.tenant_id,
        user_email: user.email,
        ...updates
      };

      if (dashboardConfig?.id) {
        const { data, error } = await supabase
          .from('crm_dashboard_configs')
          .update(updates)
          .eq('id', dashboardConfig.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('crm_dashboard_configs')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-dashboard-config'] });
    }
  });

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    saveDashboardConfigMutation.mutate({ view_mode: mode });
  };

  const isDetractor = (customer) => customer.avgRating < 3 && customer.avgRating > 0;
  const isPromoter = (customer) => customer.avgRating >= 4;
  const isPassive = (customer) => customer.avgRating === 3;

  const clearDetractorFilters = () => {
    setDetractorFilters({ name: '', scoreMin: '', scoreMax: '', startDate: '', endDate: '' });
  };

  const handleToggleWidget = (widgetId) => {
    const newWidgets = activeWidgets.includes(widgetId)
      ? activeWidgets.filter(w => w !== widgetId)
      : [...activeWidgets, widgetId];

    setActiveWidgets(newWidgets);
    saveDashboardConfigMutation.mutate({ active_widgets: newWidgets });
  };

  // Agrupa clientes únicos das respostas
  const customers = React.useMemo(() => {
    const customerMap = new Map();

    responses.forEach(response => {
      const email = response.customer_email || response.customer_phone || 'anonimo';
      if (!customerMap.has(email)) {
        customerMap.set(email, {
          email,
          name: response.customer_name || 'Anônimo',
          phone: response.customer_phone,
          responses: [],
          lastInteraction: response.created_at || response.created_date || null,
          lastResponseId: response.id || null,
          avgRating: 0,
          totalResponses: 0
        });
      }

      const customer = customerMap.get(email);
      customer.responses.push(response);
      customer.totalResponses++;

      const created = response.created_at || response.created_date;
      if (created) {
        const nextTime = new Date(created).getTime();
        const prevTime = customer.lastInteraction ? new Date(customer.lastInteraction).getTime() : 0;
        if (nextTime >= prevTime) {
          customer.lastInteraction = created;
          customer.lastResponseId = response.id || customer.lastResponseId;
          customer.name = response.customer_name || customer.name;
          customer.phone = response.customer_phone || customer.phone;
        }
      }
    });

    // Calcula média de avaliação
    customerMap.forEach((customer) => {
      const scores = customer.responses
        .map(r => getUnifiedScore5(r))
        .filter(s => isFiniteNumber(s) && s > 0);

      const ratingsSum = scores.reduce((sum, s) => sum + s, 0);
      customer.avgRating = scores.length > 0 ? ratingsSum / scores.length : 0;
    });

    return Array.from(customerMap.values());
  }, [responses]);

  const searchedCustomers = React.useMemo(() => {
    if (!searchTerm) return customers;
    const term = searchTerm.toLowerCase();
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(term) ||
      (c.email || '').toLowerCase().includes(term)
    );
  }, [customers, searchTerm]);

  const customersForView = React.useMemo(() => {
    let list = searchedCustomers;

    if (selectedSegment === 'promoters') {
      list = list.filter(isPromoter);
    } else if (selectedSegment === 'passives') {
      list = list.filter(isPassive);
    } else if (selectedSegment === 'detractors') {
      list = list.filter(isDetractor);

      const term = (detractorFilters.name || '').trim().toLowerCase();
      if (term) {
        list = list.filter(c =>
          (c.name || '').toLowerCase().includes(term) ||
          (c.email || '').toLowerCase().includes(term)
        );
      }

      const scoreMin = detractorFilters.scoreMin === '' ? null : Number(detractorFilters.scoreMin);
      const scoreMax = detractorFilters.scoreMax === '' ? null : Number(detractorFilters.scoreMax);
      if (isFiniteNumber(scoreMin)) list = list.filter(c => c.avgRating >= scoreMin);
      if (isFiniteNumber(scoreMax)) list = list.filter(c => c.avgRating <= scoreMax);

      const start = detractorFilters.startDate ? new Date(detractorFilters.startDate).getTime() : null;
      const end = detractorFilters.endDate ? new Date(detractorFilters.endDate).getTime() : null;
      if (start || end) {
        list = list.filter(c => {
          const t = c.lastInteraction ? new Date(c.lastInteraction).getTime() : 0;
          if (start && t < start) return false;
          if (end) {
            const endInclusive = end + 24 * 60 * 60 * 1000 - 1;
            if (t > endInclusive) return false;
          }
          return true;
        });
      }
    }

    if (selectedSegment === 'all') {
      list = [...list].sort((a, b) => {
        const ad = isDetractor(a) ? 1 : 0;
        const bd = isDetractor(b) ? 1 : 0;
        if (ad !== bd) return bd - ad;
        const ta = a.lastInteraction ? new Date(a.lastInteraction).getTime() : 0;
        const tb = b.lastInteraction ? new Date(b.lastInteraction).getTime() : 0;
        return tb - ta;
      });
    } else if (selectedSegment === 'detractors') {
      list = [...list].sort((a, b) => {
        if (a.avgRating !== b.avgRating) return a.avgRating - b.avgRating;
        const ta = a.lastInteraction ? new Date(a.lastInteraction).getTime() : 0;
        const tb = b.lastInteraction ? new Date(b.lastInteraction).getTime() : 0;
        return tb - ta;
      });
    }

    return list;
  }, [searchedCustomers, selectedSegment, detractorFilters]);

  // Estatísticas
  const stats = {
    totalCustomers: customers.length,
    promoters: customers.filter(isPromoter).length,
    detractors: customers.filter(isDetractor).length,
    pendingTasks: tasks.filter(t => t.status === 'pending').length,
    activeAutomations: automations.filter(a => a.is_active).length
  };

  const getNPSIcon = (rating) => {
    if (rating >= 4) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (rating === 3) return <Minus className="w-4 h-4 text-yellow-600" />;
    if (rating > 0) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const handleCustomerClick = (customer) => {
    navigate(createPageUrl('CustomerDetail') + '?email=' + encodeURIComponent(customer.email));
  };

  const handleDetractorsClick = () => {
    setViewMode('list');
    setSelectedSegment((prev) => (prev === 'detractors' ? 'all' : 'detractors'));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header com estatísticas */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            onClick={() => handleViewModeChange('list')}
            size="sm"
          >
            <LayoutList className="w-4 h-4 mr-2" />
            Lista
          </Button>
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
            onClick={() => handleViewModeChange('kanban')}
            size="sm"
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Kanban
          </Button>
          <Button
            variant={selectedSegment === 'detractors' ? 'destructive' : 'outline'}
            onClick={handleDetractorsClick}
            size="sm"
            className="ml-2"
          >
            <TrendingDown className="w-4 h-4 mr-2" />
            Detratores ({stats.detractors})
          </Button>
        </div>
        <Button variant="outline" onClick={() => setShowWidgetSelector(true)} size="sm">
          <Settings className="w-4 h-4 mr-2" />
          Personalizar Widgets
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Clientes</p>
              <p className="text-2xl font-bold">{stats.totalCustomers}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Promotores</p>
              <p className="text-2xl font-bold">{stats.promoters}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Detratores</p>
              <p className="text-2xl font-bold">{stats.detractors}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <ListTodo className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Tarefas Pendentes</p>
              <p className="text-2xl font-bold">{stats.pendingTasks}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Automações Ativas</p>
              <p className="text-2xl font-bold">{stats.activeAutomations}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Widgets Personalizáveis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeWidgets.includes('nps_history') && (
          <NPSHistoryWidget responses={responses} />
        )}
        {activeWidgets.includes('task_performance') && (
          <TaskPerformanceWidget tasks={tasks} />
        )}
      </div>

      {/* Tabs de navegação */}
      <Tabs defaultValue="customers" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="customers">
            <Users className="w-4 h-4 mr-2" />
            Clientes
            {stats.detractors > 0 && (
              <Badge className="ml-2 bg-red-600 text-white">{stats.detractors}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <ListTodo className="w-4 h-4 mr-2" />
            Tarefas
          </TabsTrigger>
          <TabsTrigger value="segments">
            <UserCheck className="w-4 h-4 mr-2" />
            Segmentos
          </TabsTrigger>
          <TabsTrigger value="automations">
            <Zap className="w-4 h-4 mr-2" />
            Automações
          </TabsTrigger>
        </TabsList>

        {/* Tab de Clientes */}
        <TabsContent value="customers" className="space-y-4">
          {viewMode === 'list' && (
            <>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar cliente por nome ou email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <select
                  value={selectedSegment}
                  onChange={(e) => setSelectedSegment(e.target.value)}
                  className="px-4 py-2 border rounded-lg"
                >
                  <option value="all">Todos</option>
                  <option value="promoters">Promotores</option>
                  <option value="passives">Neutros</option>
                  <option value="detractors">Detratores</option>
                </select>
              </div>

              {selectedSegment === 'detractors' && (
                <Card className="p-4 border-red-200 bg-red-50/30">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-600" />
                      <p className="font-semibold text-red-900">Filtros avançados (detratores)</p>
                      <Badge className="bg-red-100 text-red-800">{customersForView.length}</Badge>
                    </div>
                    <Button variant="outline" size="sm" onClick={clearDetractorFilters}>
                      Limpar
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <Input
                      placeholder="Nome ou email"
                      value={detractorFilters.name}
                      onChange={(e) => setDetractorFilters((prev) => ({ ...prev, name: e.target.value }))}
                    />
                    <Input
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      placeholder="Nota mín."
                      value={detractorFilters.scoreMin}
                      onChange={(e) => setDetractorFilters((prev) => ({ ...prev, scoreMin: e.target.value }))}
                    />
                    <Input
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      placeholder="Nota máx."
                      value={detractorFilters.scoreMax}
                      onChange={(e) => setDetractorFilters((prev) => ({ ...prev, scoreMax: e.target.value }))}
                    />
                    <Input
                      type="date"
                      value={detractorFilters.startDate}
                      onChange={(e) => setDetractorFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                    />
                    <Input
                      type="date"
                      value={detractorFilters.endDate}
                      onChange={(e) => setDetractorFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </Card>
              )}

              {selectedSegment === 'all' && stats.detractors > 0 && (
                <Card className="p-4 border-red-200 bg-red-50/30">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-red-600" />
                      <p className="font-semibold text-red-900">Atenção urgente: detratores</p>
                      <Badge className="bg-red-100 text-red-800">{stats.detractors}</Badge>
                    </div>
                    <Button size="sm" variant="destructive" onClick={handleDetractorsClick}>
                      Ver detratores
                    </Button>
                  </div>
                </Card>
              )}

              <div className="grid gap-3">
                {customersForView.map((customer) => {
                  const customerIsDetractor = isDetractor(customer);
                  return (
                  <Link
                    key={customer.email}
                    to={createPageUrl('CustomerDetail') + '?email=' + encodeURIComponent(customer.email)}
                  >
                    <Card
                      className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${
                        customerIsDetractor ? 'border-2 border-red-200 bg-red-50/20' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                              customerIsDetractor
                                ? 'bg-gradient-to-br from-red-500 to-red-600'
                                : 'bg-gradient-to-br from-blue-500 to-purple-600'
                            }`}
                          >
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                              {customerIsDetractor && <Badge className="bg-red-600 text-white text-xs">Detrator</Badge>}
                              {getNPSIcon(customer.avgRating)}
                            </div>
                            <p className="text-sm text-gray-600">{customer.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Respostas</p>
                            <p className="text-lg font-bold">{customer.totalResponses}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Avaliação</p>
                            <div className="flex items-center gap-1">
                              <Star
                                className={`w-4 h-4 ${
                                  customerIsDetractor ? 'text-red-500 fill-red-500' : 'text-yellow-500 fill-yellow-500'
                                }`}
                              />
                              <p className={`text-lg font-bold ${customerIsDetractor ? 'text-red-600' : ''}`}>
                                {customer.avgRating.toFixed(1)}
                              </p>
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Última Interação</p>
                            <p className="text-sm font-medium">
                              {customer.lastInteraction ? new Date(customer.lastInteraction).toLocaleDateString('pt-BR') : '-'}
                            </p>
                          </div>
                          {customer.phone && (
                            <Button size="sm" variant="outline">
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>
                      </div>
                    </Card>
                  </Link>
                )})}
              </div>
            </>
          )}

          {viewMode === 'kanban' && (
            <KanbanView
              customers={customersForView}
              onCustomerClick={handleCustomerClick}
            />
          )}
        </TabsContent>

        {/* Tab de Tarefas */}
        <TabsContent value="tasks">
          <Link to={createPageUrl('CRMTasks')}>
            <Button className="mb-4">
              <ListTodo className="w-4 h-4 mr-2" />
              Gerenciar Tarefas
            </Button>
          </Link>
          <p className="text-gray-600">Visualize e gerencie todas as tarefas de acompanhamento.</p>
        </TabsContent>

        {/* Tab de Segmentos */}
        <TabsContent value="segments">
          <Link to={createPageUrl('CRMSegments')}>
            <Button className="mb-4">
              <UserCheck className="w-4 h-4 mr-2" />
              Gerenciar Segmentos
            </Button>
          </Link>
          <p className="text-gray-600">Crie e gerencie segmentos de clientes para campanhas direcionadas.</p>
        </TabsContent>

        {/* Tab de Automações */}
        <TabsContent value="automations">
          <Link to={createPageUrl('CRMAutomations')}>
            <Button className="mb-4">
              <Zap className="w-4 h-4 mr-2" />
              Gerenciar Automações
            </Button>
          </Link>
          <p className="text-gray-600">Configure automações para envio de pesquisas e criação de tarefas.</p>
        </TabsContent>
      </Tabs>

      {/* Widget Selector Modal */}
      <WidgetSelector
        open={showWidgetSelector}
        onOpenChange={setShowWidgetSelector}
        activeWidgets={activeWidgets}
        onToggleWidget={handleToggleWidget}
      />
    </div>
  );
}
