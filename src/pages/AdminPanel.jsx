import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash, Upload, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '../utils';
import { Link } from 'react-router-dom';

export default function AdminPanel() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    is_active: false,
    send_via_sms: false,
    send_via_whatsapp: true,
    send_via_email: false
  });
  const [newQuestion, setNewQuestion] = useState({
    template_id: '',
    question_text: '',
    question_type: 'stars',
    is_required: false,
    order: 1
  });
  const [backgroundFile, setBackgroundFile] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['templates', user?.tenant_id],
    queryFn: () => user?.tenant_id 
      ? base44.entities.SurveyTemplate.filter({ tenant_id: user.tenant_id }, '-created_date')
      : Promise.resolve([]),
    enabled: !!user?.tenant_id,
  });

  const { data: questions = [] } = useQuery({
    queryKey: ['questions', user?.tenant_id],
    queryFn: () => user?.tenant_id
      ? base44.entities.SurveyQuestion.filter({ tenant_id: user.tenant_id }, 'order')
      : Promise.resolve([]),
    enabled: !!user?.tenant_id,
  });

  const { data: totemSettings = [] } = useQuery({
    queryKey: ['totem-settings', user?.tenant_id],
    queryFn: () => user?.tenant_id
      ? base44.entities.TotemSettings.filter({ tenant_id: user.tenant_id })
      : Promise.resolve([]),
    enabled: !!user?.tenant_id,
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data) => base44.entities.SurveyTemplate.create({ ...data, tenant_id: user?.tenant_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', user?.tenant_id] });
      setIsCreateOpen(false);
      setNewTemplate({
        name: '',
        description: '',
        is_active: false,
        send_via_sms: false,
        send_via_whatsapp: true,
        send_via_email: false
      });
      toast.success('Modelo criado com sucesso!');
    }
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SurveyTemplate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', user?.tenant_id] });
      toast.success('Modelo atualizado!');
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id) => base44.entities.SurveyTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', user?.tenant_id] });
      toast.success('Modelo excluído!');
    }
  });

  const createQuestionMutation = useMutation({
    mutationFn: (data) => base44.entities.SurveyQuestion.create({ ...data, tenant_id: user?.tenant_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', user?.tenant_id] });
      setNewQuestion({
        template_id: '',
        question_text: '',
        question_type: 'stars',
        is_required: false,
        order: 1
      });
      toast.success('Pergunta adicionada!');
    }
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (id) => base44.entities.SurveyQuestion.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', user?.tenant_id] });
      toast.success('Pergunta excluída!');
    }
  });

  const uploadBackgroundMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const settings = totemSettings[0];
      if (settings) {
        return base44.entities.TotemSettings.update(settings.id, { background_image_url: file_url });
      } else {
        return base44.entities.TotemSettings.create({ background_image_url: file_url, is_active: true, tenant_id: user?.tenant_id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['totem-settings', user?.tenant_id] });
      toast.success('Imagem de fundo atualizada!');
      setBackgroundFile(null);
    }
  });

  const handleCreateTemplate = () => {
    createTemplateMutation.mutate(newTemplate);
  };

  const handleToggleActive = (template) => {
    updateTemplateMutation.mutate({
      id: template.id,
      data: { ...template, is_active: !template.is_active }
    });
  };

  const handleAddQuestion = () => {
    if (!newQuestion.template_id || !newQuestion.question_text) {
      toast.error('Selecione um modelo e preencha a pergunta');
      return;
    }
    createQuestionMutation.mutate(newQuestion);
  };

  const handleUploadBackground = () => {
    if (backgroundFile) {
      uploadBackgroundMutation.mutate(backgroundFile);
    }
  };

  const getQuestionTypeLabel = (type) => {
    const types = {
      text: 'Texto Livre',
      stars: 'Estrelas (1-5)',
      emoji_scale: 'Escala Emoji (0-10)',
      yes_no: 'Sim/Não'
    };
    return types[type] || type;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Painel Administrativo</h1>
            <p className="text-slate-500 mt-1">Gerencie modelos de pesquisa e configurações</p>
          </div>
          <Link to={createPageUrl('TotemDisplay')}>
            <Button variant="outline" className="gap-2">
              <Eye className="w-4 h-4" />
              Ver Totem
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="templates" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="templates">Modelos de Pesquisa</TabsTrigger>
            <TabsTrigger value="questions">Perguntas</TabsTrigger>
            <TabsTrigger value="totem">Configuração Totem</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-4">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Novo Modelo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Criar Modelo de Pesquisa</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nome do Modelo</Label>
                    <Input
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                      placeholder="Ex: Pesquisa de Satisfação Geral"
                    />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea
                      value={newTemplate.description}
                      onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                      placeholder="Descreva o objetivo desta pesquisa"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>Canais de Envio</Label>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm">WhatsApp</span>
                      <Switch
                        checked={newTemplate.send_via_whatsapp}
                        onCheckedChange={(checked) => setNewTemplate({ ...newTemplate, send_via_whatsapp: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm">SMS</span>
                      <Switch
                        checked={newTemplate.send_via_sms}
                        onCheckedChange={(checked) => setNewTemplate({ ...newTemplate, send_via_sms: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm">E-mail</span>
                      <Switch
                        checked={newTemplate.send_via_email}
                        onCheckedChange={(checked) => setNewTemplate({ ...newTemplate, send_via_email: checked })}
                      />
                    </div>
                  </div>
                  <Button onClick={handleCreateTemplate} className="w-full">
                    Criar Modelo
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <div className="grid gap-4">
              {templates.map((template) => (
                <div key={template.id} className="bg-white rounded-xl p-6 shadow-sm border">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-800">{template.name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          template.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {template.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      {template.description && (
                        <p className="text-slate-500 text-sm mb-3">{template.description}</p>
                      )}
                      <div className="flex gap-2">
                        {template.send_via_whatsapp && (
                          <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded">WhatsApp</span>
                        )}
                        {template.send_via_sms && (
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">SMS</span>
                        )}
                        {template.send_via_email && (
                          <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded">E-mail</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(template)}
                      >
                        {template.is_active ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTemplateMutation.mutate(template.id)}
                      >
                        <Trash className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="questions" className="space-y-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h3 className="text-lg font-semibold mb-4">Adicionar Nova Pergunta</h3>
              <div className="grid gap-4">
                <div>
                  <Label>Modelo de Pesquisa</Label>
                  <Select
                    value={newQuestion.template_id}
                    onValueChange={(value) => setNewQuestion({ ...newQuestion, template_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Pergunta</Label>
                  <Input
                    value={newQuestion.question_text}
                    onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                    placeholder="Digite sua pergunta"
                  />
                </div>
                <div>
                  <Label>Tipo de Resposta</Label>
                  <Select
                    value={newQuestion.question_type}
                    onValueChange={(value) => setNewQuestion({ ...newQuestion, question_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto Livre</SelectItem>
                      <SelectItem value="stars">Estrelas (1-5)</SelectItem>
                      <SelectItem value="emoji_scale">Escala Emoji (0-10)</SelectItem>
                      <SelectItem value="yes_no">Sim/Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <Label>Pergunta Obrigatória</Label>
                  <Switch
                    checked={newQuestion.is_required}
                    onCheckedChange={(checked) => setNewQuestion({ ...newQuestion, is_required: checked })}
                  />
                </div>
                <Button onClick={handleAddQuestion} className="w-full">
                  Adicionar Pergunta
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {templates.map((template) => {
                const templateQuestions = questions.filter(q => q.template_id === template.id);
                if (templateQuestions.length === 0) return null;

                return (
                  <div key={template.id} className="bg-white rounded-xl p-6 shadow-sm border">
                    <h3 className="text-lg font-semibold mb-4">{template.name}</h3>
                    <div className="space-y-2">
                      {templateQuestions.map((q, idx) => (
                        <div key={q.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div>
                            <span className="text-sm font-medium text-slate-700">
                              {idx + 1}. {q.question_text}
                            </span>
                            <div className="flex gap-2 mt-1">
                              <span className="text-xs text-slate-500">{getQuestionTypeLabel(q.question_type)}</span>
                              {q.is_required && (
                                <span className="text-xs text-red-600">Obrigatória</span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteQuestionMutation.mutate(q.id)}
                          >
                            <Trash className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="totem" className="space-y-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h3 className="text-lg font-semibold mb-4">Configuração do Totem</h3>
              <div className="space-y-4">
                <div>
                  <Label>Imagem de Fundo</Label>
                  <div className="mt-2 flex items-center gap-4">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setBackgroundFile(e.target.files[0])}
                    />
                    <Button
                      onClick={handleUploadBackground}
                      disabled={!backgroundFile || uploadBackgroundMutation.isPending}
                      className="gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Upload
                    </Button>
                  </div>
                </div>
                {totemSettings[0]?.background_image_url && (
                  <div>
                    <Label>Preview</Label>
                    <img
                      src={totemSettings[0].background_image_url}
                      alt="Background"
                      className="mt-2 rounded-lg max-h-48 object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}