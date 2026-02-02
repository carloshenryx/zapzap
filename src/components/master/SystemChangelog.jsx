import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileCode, Plus, Calendar, Tag, AlertCircle, Filter, Search } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SystemChangelog() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterModule, setFilterModule] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    module: 'Dashboard',
    type: 'feature',
    title: '',
    description: '',
    files_changed: '',
    impact: 'medium',
    version: '1.0.0'
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['system-changelog'],
    queryFn: () => base44.entities.SystemChangeLog.list('-date', 100),
  });

  const createLogMutation = useMutation({
    mutationFn: (data) => base44.entities.SystemChangeLog.create({
      ...data,
      date: new Date().toISOString(),
      files_changed: data.files_changed.split(',').map(f => f.trim()).filter(Boolean)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-changelog'] });
      setIsDialogOpen(false);
      setFormData({
        module: 'Dashboard',
        type: 'feature',
        title: '',
        description: '',
        files_changed: '',
        impact: 'medium',
        version: '1.0.0'
      });
    },
  });

  const filteredLogs = logs.filter(log => {
    const moduleMatch = filterModule === 'all' || log.module === filterModule;
    const typeMatch = filterType === 'all' || log.type === filterType;
    const searchMatch = searchTerm === '' || 
      log.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.description.toLowerCase().includes(searchTerm.toLowerCase());
    return moduleMatch && typeMatch && searchMatch;
  });

  const typeColors = {
    feature: 'bg-blue-100 text-blue-800',
    bugfix: 'bg-red-100 text-red-800',
    improvement: 'bg-green-100 text-green-800',
    refactor: 'bg-purple-100 text-purple-800',
    security: 'bg-orange-100 text-orange-800'
  };

  const impactColors = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Changelog do Sistema</h2>
          <p className="text-gray-500 text-sm mt-1">Histórico completo de mudanças e implementações</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Registrar Mudança
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Nova Mudança</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Módulo</Label>
                  <Select value={formData.module} onValueChange={(val) => setFormData({...formData, module: val})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dashboard">Dashboard</SelectItem>
                      <SelectItem value="SendSurvey">SendSurvey</SelectItem>
                      <SelectItem value="Customers">Customers</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="TotemDisplay">TotemDisplay</SelectItem>
                      <SelectItem value="Survey">Survey</SelectItem>
                      <SelectItem value="Layout">Layout</SelectItem>
                      <SelectItem value="MasterDashboard">MasterDashboard</SelectItem>
                      <SelectItem value="Backend">Backend</SelectItem>
                      <SelectItem value="Entity">Entity</SelectItem>
                      <SelectItem value="Component">Component</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={formData.type} onValueChange={(val) => setFormData({...formData, type: val})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feature">Nova Funcionalidade</SelectItem>
                      <SelectItem value="bugfix">Correção de Bug</SelectItem>
                      <SelectItem value="improvement">Melhoria</SelectItem>
                      <SelectItem value="refactor">Refatoração</SelectItem>
                      <SelectItem value="security">Segurança</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Impacto</Label>
                  <Select value={formData.impact} onValueChange={(val) => setFormData({...formData, impact: val})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixo</SelectItem>
                      <SelectItem value="medium">Médio</SelectItem>
                      <SelectItem value="high">Alto</SelectItem>
                      <SelectItem value="critical">Crítico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Versão</Label>
                  <Input
                    value={formData.version}
                    onChange={(e) => setFormData({...formData, version: e.target.value})}
                    placeholder="1.0.0"
                  />
                </div>
              </div>

              <div>
                <Label>Título</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Ex: Implementação de wizard multi-etapas na pesquisa"
                />
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Descreva em detalhes o que foi alterado..."
                  rows={5}
                />
              </div>

              <div>
                <Label>Arquivos Alterados (separados por vírgula)</Label>
                <Textarea
                  value={formData.files_changed}
                  onChange={(e) => setFormData({...formData, files_changed: e.target.value})}
                  placeholder="pages/Survey.js, components/survey/ProgressIndicator.jsx, ..."
                  rows={3}
                />
              </div>

              <Button
                onClick={() => createLogMutation.mutate(formData)}
                disabled={!formData.title || !formData.description || createLogMutation.isPending}
                className="w-full"
              >
                {createLogMutation.isPending ? 'Registrando...' : 'Registrar Mudança'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Search className="w-4 h-4" />
                Buscar
              </Label>
              <Input
                placeholder="Buscar por título ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Filter className="w-4 h-4" />
                Módulo
              </Label>
              <Select value={filterModule} onValueChange={setFilterModule}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Módulos</SelectItem>
                  <SelectItem value="Dashboard">Dashboard</SelectItem>
                  <SelectItem value="SendSurvey">SendSurvey</SelectItem>
                  <SelectItem value="Customers">Customers</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Survey">Survey</SelectItem>
                  <SelectItem value="Layout">Layout</SelectItem>
                  <SelectItem value="Backend">Backend</SelectItem>
                  <SelectItem value="Entity">Entity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Tag className="w-4 h-4" />
                Tipo
              </Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  <SelectItem value="feature">Nova Funcionalidade</SelectItem>
                  <SelectItem value="bugfix">Correção de Bug</SelectItem>
                  <SelectItem value="improvement">Melhoria</SelectItem>
                  <SelectItem value="refactor">Refatoração</SelectItem>
                  <SelectItem value="security">Segurança</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Changelog List */}
      <div className="space-y-4">
        {filteredLogs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <FileCode className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma mudança registrada</p>
            </CardContent>
          </Card>
        ) : (
          filteredLogs.map((log) => (
            <Card key={log.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={typeColors[log.type]}>{log.type}</Badge>
                      <Badge variant="outline">{log.module}</Badge>
                      <Badge className={impactColors[log.impact]}>
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {log.impact}
                      </Badge>
                      {log.version && (
                        <Badge variant="secondary">v{log.version}</Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg">{log.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(log.date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-3 whitespace-pre-wrap">{log.description}</p>
                {log.files_changed && log.files_changed.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">Arquivos alterados:</p>
                    <div className="flex flex-wrap gap-1">
                      {log.files_changed.map((file, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs font-mono">
                          {file}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}