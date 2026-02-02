import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '../utils';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Users, 
  UserCheck, 
  ListTodo, 
  Zap, 
  Filter,
  Search,
  Phone,
  Mail,
  MessageCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Calendar,
  Star,
  LayoutList,
  LayoutGrid,
  Settings,
  ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import WidgetSelector from '@/components/crm/WidgetSelector';
import NPSHistoryWidget from '@/components/crm/NPSHistoryWidget';
import TaskPerformanceWidget from '@/components/crm/TaskPerformanceWidget';
import KanbanView from '@/components/crm/KanbanView';

export default function CRM() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);
  const [activeWidgets, setActiveWidgets] = useState(['nps_history', 'task_performance', 'customer_stats', 'recent_interactions']);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['survey-responses', user?.tenant_id],
    queryFn: () => user?.tenant_id
      ? base44.entities.SurveyResponse.filter({ tenant_id: user.tenant_id }, '-created_date', 500)
      : Promise.resolve([]),
    enabled: !!user?.tenant_id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['crm-tasks', user?.tenant_id],
    queryFn: () => user?.tenant_id
      ? base44.entities.CRMTask.filter({ tenant_id: user.tenant_id }, '-created_date', 100)
      : Promise.resolve([]),
    enabled: !!user?.tenant_id,
  });

  const { data: segments = [] } = useQuery({
    queryKey: ['customer-segments', user?.tenant_id],
    queryFn: () => user?.tenant_id
      ? base44.entities.CustomerSegment.filter({ tenant_id: user.tenant_id })
      : Promise.resolve([]),
    enabled: !!user?.tenant_id,
  });

  const { data: automations = [] } = useQuery({
    queryKey: ['crm-automations', user?.tenant_id],
    queryFn: () => user?.tenant_id
      ? base44.entities.CRMAutomation.filter({ tenant_id: user.tenant_id })
      : Promise.resolve([]),
    enabled: !!user?.tenant_id,
  });

  const { data: dashboardConfig } = useQuery({
    queryKey: ['crm-dashboard-config', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const configs = await base44.entities.CRMDashboardConfig.filter({ user_email: user.email });
      return configs[0] || null;
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
      
      if (dashboardConfig) {
        return await base44.entities.CRMDashboardConfig.update(dashboardConfig.id, updates);
      } else {
        return await base44.entities.CRMDashboardConfig.create({
          tenant_id: user.tenant_id,
          user_email: user.email,
          ...updates
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['crm-dashboard-config']);
    }
  });

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    saveDashboardConfigMutation.mutate({ view_mode: mode });
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
          lastInteraction: response.created_date,
          lastResponseId: response.id,
          avgRating: 0,
          totalResponses: 0
        });
      }
      
      const customer = customerMap.get(email);
      customer.responses.push(response);
      customer.totalResponses++;
      
      if (response.created_date > customer.lastInteraction) {
        customer.lastInteraction = response.created_date;
        customer.lastResponseId = response.id;
      }
    });

    // Calcula média de avaliação
    customerMap.forEach((customer) => {
      const ratingsSum = customer.responses
        .filter(r => r.overall_rating)
        .reduce((sum, r) => sum + r.overall_rating, 0);
      const ratingsCount = customer.responses.filter(r => r.overall_rating).length;
      customer.avgRating = ratingsCount > 0 ? ratingsSum / ratingsCount : 0;
    });

    return Array.from(customerMap.values());
  }, [responses]);

  // Filtra clientes
  const filteredCustomers = React.useMemo(() => {
    let filtered = customers;

    // Filtro de busca
    if (searchTerm) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro de segmento
    if (selectedSegment !== 'all') {
      if (selectedSegment === 'promoters') {
        filtered = filtered.filter(c => c.avgRating >= 4);
      } else if (selectedSegment === 'passives') {
        filtered = filtered.filter(c => c.avgRating === 3);
      } else if (selectedSegment === 'detractors') {
        filtered = filtered.filter(c => c.avgRating < 3 && c.avgRating > 0);
      }
    }

    return filtered;
  }, [customers, searchTerm, selectedSegment]);

  // Estatísticas
  const stats = {
    totalCustomers: customers.length,
    promoters: customers.filter(c => c.avgRating >= 4).length,
    detractors: customers.filter(c => c.avgRating < 3 && c.avgRating > 0).length,
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

  return (
    <div className="p-6 space-y-6">
      {/* Header com estatísticas e filtro rápido de detratores */}
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
            onClick={() => setSelectedSegment(selectedSegment === 'detractors' ? 'all' : 'detractors')}
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

              {/* Seção Prioritária: Detratores */}
              {selectedSegment === 'all' && filteredCustomers.filter(c => c.avgRating < 3 && c.avgRating > 0).length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Atenção Urgente - Detratores</h3>
                    <Badge className="bg-red-100 text-red-800">
                      {filteredCustomers.filter(c => c.avgRating < 3 && c.avgRating > 0).length} clientes
                    </Badge>
                  </div>
                  <div className="grid gap-3">
                    {filteredCustomers
                      .filter(c => c.avgRating < 3 && c.avgRating > 0)
                      .slice(0, 5)
                      .map((customer) => (
                        <Card key={customer.email} className="p-4 border-2 border-red-200 bg-red-50/30 hover:shadow-lg transition-all">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                {customer.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                                  <Badge className="bg-red-600 text-white">Urgente</Badge>
                                  {getNPSIcon(customer.avgRating)}
                                </div>
                                <p className="text-sm text-gray-600">{customer.email}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {customer.totalResponses} respostas • Última: {new Date(customer.lastInteraction).toLocaleDateString('pt-BR')}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <p className="text-xs text-gray-600">Avaliação</p>
                                <div className="flex items-center gap-1">
                                  <Star className="w-4 h-4 text-red-500 fill-red-500" />
                                  <p className="text-lg font-bold text-red-600">{customer.avgRating.toFixed(1)}</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Link to={createPageUrl('SurveyResponseDetail') + '?response_id=' + customer.lastResponseId}>
                                  <Button size="sm" className="bg-red-600 hover:bg-red-700">
                                    <ClipboardList className="w-4 h-4 mr-1" />
                                    Ver Pesquisa
                                  </Button>
                                </Link>
                                <Button 
                                  size="sm" 
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (customer.phone) {
                                      window.open(`https://wa.me/${customer.phone.replace(/\D/g, '')}`, '_blank');
                                    }
                                  }}
                                >
                                  <MessageCircle className="w-4 h-4 mr-1" />
                                  WhatsApp
                                </Button>
                                <Button 
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (customer.phone) {
                                      window.open(`tel:${customer.phone}`, '_blank');
                                    }
                                  }}
                                >
                                  <Phone className="w-4 h-4 mr-1" />
                                  Ligar
                                </Button>
                                <Link to={createPageUrl('CustomerDetail') + '?email=' + encodeURIComponent(customer.email)}>
                                  <Button size="sm" variant="outline">
                                    <ChevronRight className="w-4 h-4" />
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                  </div>
                  {filteredCustomers.filter(c => c.avgRating < 3 && c.avgRating > 0).length > 5 && (
                    <Button 
                      variant="outline" 
                      className="w-full mt-3"
                      onClick={() => setSelectedSegment('detractors')}
                    >
                      Ver todos os {filteredCustomers.filter(c => c.avgRating < 3 && c.avgRating > 0).length} detratores
                    </Button>
                  )}
                </div>
              )}

              {/* Lista Normal de Clientes */}
              {(selectedSegment !== 'all' || filteredCustomers.filter(c => c.avgRating >= 3 || c.avgRating === 0).length > 0) && (
                <>
                  {selectedSegment === 'all' && (
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-lg font-bold text-gray-900">Outros Clientes</h3>
                    </div>
                  )}
                  <div className="grid gap-3">
                    {filteredCustomers
                      .filter(c => selectedSegment !== 'all' || c.avgRating >= 3 || c.avgRating === 0)
                      .map((customer) => {
                        const isDetractor = customer.avgRating < 3 && customer.avgRating > 0;
                        return (
                          <Card 
                            key={customer.email} 
                            className={`p-4 hover:shadow-md transition-shadow ${
                              isDetractor ? 'border-2 border-red-200 bg-red-50/20' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 flex-1">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                                  isDetractor 
                                    ? 'bg-gradient-to-br from-red-500 to-red-600' 
                                    : 'bg-gradient-to-br from-blue-500 to-purple-600'
                                }`}>
                                  {customer.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                                    {isDetractor && <Badge className="bg-red-600 text-white text-xs">Urgente</Badge>}
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
                                    <Star className={`w-4 h-4 ${isDetractor ? 'text-red-500 fill-red-500' : 'text-yellow-500 fill-yellow-500'}`} />
                                    <p className={`text-lg font-bold ${isDetractor ? 'text-red-600' : ''}`}>
                                      {customer.avgRating.toFixed(1)}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-center">
                                  <p className="text-sm text-gray-600">Última Interação</p>
                                  <p className="text-sm font-medium">
                                    {new Date(customer.lastInteraction).toLocaleDateString('pt-BR')}
                                  </p>
                                </div>
                                {isDetractor ? (
                                  <div className="flex gap-2">
                                    <Button 
                                      size="sm" 
                                      className="bg-green-600 hover:bg-green-700"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        if (customer.phone) {
                                          window.open(`https://wa.me/${customer.phone.replace(/\D/g, '')}`, '_blank');
                                        }
                                      }}
                                    >
                                      <MessageCircle className="w-4 h-4" />
                                    </Button>
                                    <Link to={createPageUrl('CustomerDetail') + '?email=' + encodeURIComponent(customer.email)}>
                                      <Button size="sm" variant="outline">
                                        <ChevronRight className="w-4 h-4" />
                                      </Button>
                                    </Link>
                                  </div>
                                ) : (
                                  <>
                                    {customer.phone && (
                                      <Button size="sm" variant="outline">
                                        <MessageCircle className="w-4 h-4" />
                                      </Button>
                                    )}
                                    <Link to={createPageUrl('CustomerDetail') + '?email=' + encodeURIComponent(customer.email)}>
                                      <ChevronRight className="w-5 h-5 text-gray-400" />
                                    </Link>
                                  </>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                  </div>
                </>
              )}
            </>
            )}

            {viewMode === 'kanban' && (
            <KanbanView 
            customers={filteredCustomers} 
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