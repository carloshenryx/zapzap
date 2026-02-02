import React, { useState, useMemo } from 'react';
import { supabase, fetchAPI } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Star, Smile, MessageSquare, BarChart, Trash2, Edit, CheckCircle2, Webhook, BookOpen, X, Copy, Palette, FileText, Clock, Eye, Settings as SettingsIcon, Gift } from 'lucide-react';
import WebhookTriggerManager from '@/components/admin/WebhookTriggerManager';
import SurveyPreview from '@/components/admin/SurveyPreview';
import TemplateLibrary from '@/components/admin/TemplateLibrary';
import DraggableQuestionList from '@/components/admin/DraggableQuestionList';
import VoucherManager from '@/components/admin/VoucherManager';
import TenantSettingsManager from '@/components/admin/TenantSettingsManager';
import TemplateScheduler from '@/components/admin/TemplateScheduler';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlanLimits } from '@/components/hooks/usePlanLimits';
import PlanLimitAlert from '@/components/plan/PlanLimitAlert';
import PlanUsageIndicator from '@/components/plan/PlanUsageIndicator';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';

export default function Admin() {
  const [activeTab, setActiveTab] = useState('templates');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const planLimits = usePlanLimits();
  const [formData, setFormData] = useState({
    name: '',
    is_active: false,
    questions: [],
    send_via_whatsapp: false,
    send_via_whatsapp_conversation: false,
    send_via_email: false,
    send_via_sms: false,
    allow_anonymous: false,
    allow_attachments: false,
    completion_period: {
      enabled: false,
      days: 7,
      hours: 0,
      close_automatically: false
    },
    voucher_config: {
      enabled: false,
      voucher_id: '',
      conditions: []
    },
    design: {
      primary_color: '#5423e7',
      secondary_color: '#3b82f6',
      font_family: 'Inter',
      logo_url: '',
      background_image_url: '',
      theme_preset: 'default'
    }
  });
  const [newQuestion, setNewQuestion] = useState({ question: '', type: 'text', required: true });
  const [editingQuestionSkipLogic, setEditingQuestionSkipLogic] = useState(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDesignEditor, setShowDesignEditor] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [showDefaultTemplatesDialog, setShowDefaultTemplatesDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showPreview, setShowPreview] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [googleLinkInput, setGoogleLinkInput] = useState('');

  const queryClient = useQueryClient();
  const { userProfile, isLoadingAuth } = useAuth(); // Get loading state too
  const user = userProfile; // Alias for compatibility

  const { data: tenant } = useQuery({
    queryKey: ['tenant', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return null;
      const { data: tenants } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', user.tenant_id)
        .single();
      return tenants;
    },
    enabled: !!user?.tenant_id,
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .order('created_date', { ascending: false })
        .limit(1);
      return data || [];
    },
    enabled: !!user?.tenant_id,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['survey-templates', user?.tenant_id],
    queryFn: () => user?.tenant_id
      ? supabase.from('survey_templates').select('*').eq('tenant_id', user.tenant_id).order('created_at', { ascending: false }).then(r => r.data || [])
      : Promise.resolve([]),
    enabled: !!user?.tenant_id,
  });

  const { data: defaultTemplates = [] } = useQuery({
    queryKey: ['default-templates'],
    queryFn: async () => {
      const { data } = await supabase.from('default_survey_template').select('*').order('created_at', { ascending: false }).limit(100);
      return data;
    },
  });

  const { data: vouchers = [] } = useQuery({
    queryKey: ['vouchers', user?.tenant_id],
    queryFn: () => user?.tenant_id
      ? supabase.from('vouchers').select('*').eq('tenant_id', user.tenant_id).eq('is_active', true).then(r => r.data || [])
      : Promise.resolve([]),
    enabled: !!user?.tenant_id,
  });

  // Filtrar vouchers que ainda têm disponibilidade (não atingiram limite de uso)
  // Filtrar vouchers que ainda têm disponibilidade
  const availableVouchers = useMemo(() => vouchers.filter(v => {
    if (!v.usage_limit) return true; // Sem limite = sempre disponível
    return (v.current_usage || 0) < v.usage_limit; // Com limite = verificar
  }), [vouchers]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      console.log('🔍 CREATE TEMPLATE - User data:', user);
      console.log('🔍 CREATE TEMPLATE - Tenant ID:', user?.tenant_id);

      if (!user?.tenant_id) {
        throw new Error('Tenant ID não encontrado. Por favor, faça logout e login novamente.');
      }

      // Criar template usando a API Supabase
      const response = await fetchAPI('/surveys?action=create-template', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          questions: data.questions,
          is_active: data.is_active,
          send_via_whatsapp: data.send_via_whatsapp,
          send_via_whatsapp_conversation: data.send_via_whatsapp_conversation,
          send_via_email: data.send_via_email,
          send_via_sms: data.send_via_sms,
          allow_anonymous: data.allow_anonymous,
          allow_attachments: data.allow_attachments,
          completion_period: data.completion_period,
          google_redirect: data.google_redirect,
          usage_limit: data.usage_limit,
          voucher_config: data.voucher_config,
          design: data.design,
        }),
      });

      return response.template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-templates', user?.tenant_id] });
      queryClient.invalidateQueries({ queryKey: ['consumption', user?.tenant_id] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Modelo criado com sucesso!');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao criar modelo');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: template } = await supabase.from('survey_templates').update(data).eq('id', id).select().single();
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-templates', user?.tenant_id] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Modelo atualizado com sucesso!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await supabase.from('survey_templates').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-templates', user?.tenant_id] });
      toast.success('Modelo excluído com sucesso!');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      // Desativar todos os outros se estiver ativando este
      if (is_active) {
        const activeTemplates = templates.filter(t => t.is_active && t.id !== id);
        await Promise.all(activeTemplates.map(t =>
          supabase.from('survey_templates').update({ is_active: false }).eq('id', t.id)
        ));
      }
      const { data } = await supabase.from('survey_templates').update({ is_active }).eq('id', id).select().single();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-templates', user?.tenant_id] });
    },
  });

  const updateTenantGoogleLinkMutation = useMutation({
    mutationFn: async (googleLink) => {
      if (!tenant?.id) throw new Error('Tenant não encontrado');
      const { data } = await supabase.from('tenants').update({ google_review_link: googleLink }).eq('id', tenant.id).select().single();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', user?.tenant_id] });
      toast.success('Link do Google salvo com sucesso!');
      setGoogleLinkInput('');
    },
    onError: () => {
      toast.error('Erro ao salvar link do Google');
    }
  });

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (!user?.tenant_id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <p className="text-red-600 font-semibold mb-2">❌ Erro ao carregar perfil</p>
          <p className="text-gray-600 mb-4">Não foi possível encontrar seu Tenant ID. Por favor, faça logout e login novamente.</p>
          <Button onClick={() => window.location.href = '/login'}>Ir para Login</Button>
        </div>
      </div>
    );
  }

  const resetForm = () => {
    setFormData({
      name: '',
      is_active: false,
      questions: [],
      send_via_whatsapp: false,
      send_via_whatsapp_conversation: false,
      send_via_email: false,
      send_via_sms: false,
      allow_anonymous: false,
      allow_attachments: false,
      completion_period: {
        enabled: false,
        days: 7,
        hours: 0,
        close_automatically: false
      },
      google_redirect: {
        enabled: false,
        conditions: []
      },
      usage_limit: {
        enabled: false,
        max_uses: 100,
        current_uses: 0,
        fallback_template_id: ''
      },
      voucher_config: {
        enabled: false,
        voucher_id: '',
        conditions: []
      },
      design: {
        primary_color: '#5423e7',
        secondary_color: '#3b82f6',
        font_family: 'Inter',
        logo_url: '',
        background_image_url: '',
        theme_preset: 'default'
      }
    });
    setEditingTemplate(null);
    setNewQuestion({ question: '', type: 'text', required: true });
  };

  const predefinedTemplates = [
    {
      id: 'nps',
      name: 'NPS - Net Promoter Score',
      description: 'Medir lealdade e satisfação dos clientes',
      icon: '📊',
      questions: [
        { id: Date.now() + '_1', question: 'Em uma escala de 0 a 10, o quanto você recomendaria nossa empresa para um amigo ou colega?', type: 'faces', required: true, skip_logic: { enabled: false, conditions: [] } },
        { id: Date.now() + '_2', question: 'O que é o principal motivo para sua nota?', type: 'text', required: false, skip_logic: { enabled: false, conditions: [] } }
      ]
    },
    {
      id: 'csat',
      name: 'CSAT - Satisfação do Cliente',
      description: 'Avaliar satisfação com produto/serviço',
      icon: '⭐',
      questions: [
        { id: Date.now() + '_1', question: 'Como você avalia sua satisfação geral com nosso serviço?', type: 'stars', required: true, skip_logic: { enabled: false, conditions: [] } },
        { id: Date.now() + '_2', question: 'Como você avalia a qualidade do atendimento?', type: 'stars', required: true, skip_logic: { enabled: false, conditions: [] } },
        { id: Date.now() + '_3', question: 'O que podemos melhorar?', type: 'text', required: false, skip_logic: { enabled: false, conditions: [] } }
      ]
    },
    {
      id: 'product_feedback',
      name: 'Feedback de Produto',
      description: 'Coletar opiniões sobre produtos',
      icon: '📦',
      questions: [
        { id: Date.now() + '_1', question: 'O produto atendeu suas expectativas?', type: 'boolean', required: true, skip_logic: { enabled: false, conditions: [] } },
        { id: Date.now() + '_2', question: 'Como você avalia a qualidade do produto?', type: 'stars', required: true, skip_logic: { enabled: false, conditions: [] } },
        { id: Date.now() + '_3', question: 'Você compraria novamente?', type: 'boolean', required: true, skip_logic: { enabled: false, conditions: [] } },
        { id: Date.now() + '_4', question: 'Deixe um comentário sobre sua experiência:', type: 'text', required: false, skip_logic: { enabled: false, conditions: [] } }
      ]
    },
    {
      id: 'post_service',
      name: 'Pós-Atendimento',
      description: 'Avaliar experiência após atendimento',
      icon: '💬',
      questions: [
        { id: Date.now() + '_1', question: 'O atendente foi educado e prestativo?', type: 'boolean', required: true, skip_logic: { enabled: false, conditions: [] } },
        { id: Date.now() + '_2', question: 'Seu problema foi resolvido?', type: 'boolean', required: true, skip_logic: { enabled: false, conditions: [] } },
        { id: Date.now() + '_3', question: 'Como você avalia o tempo de resposta?', type: 'stars', required: true, skip_logic: { enabled: false, conditions: [] } },
        { id: Date.now() + '_4', question: 'Comentários adicionais:', type: 'text', required: false, skip_logic: { enabled: false, conditions: [] } }
      ]
    }
  ];

  const handleImportQuestions = (sourceTemplateId) => {
    const sourceTemplate = templates.find(t => t.id === sourceTemplateId);
    if (sourceTemplate && sourceTemplate.questions) {
      const importedQuestions = sourceTemplate.questions.map(q => ({
        ...q,
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      }));
      setFormData({
        ...formData,
        questions: [...formData.questions, ...importedQuestions]
      });
      setShowImportDialog(false);
      toast.success(`${importedQuestions.length} perguntas importadas com sucesso!`);
    }
  };

  const handleApplyTemplate = (template) => {
    const templateQuestions = template.questions.map(q => ({
      ...q,
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    }));

    setFormData({
      ...formData,
      name: template.name,
      questions: templateQuestions
    });
    setShowTemplatesDialog(false);
    toast.success(`Template "${template.name}" aplicado com sucesso!`);
  };

  const handleApplyDefaultTemplate = (template) => {
    const templateQuestions = template.questions.map(q => ({
      ...q,
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      skip_logic: q.skip_logic || { enabled: false, conditions: [] }
    }));

    setFormData({
      name: template.name,
      is_active: false,
      questions: templateQuestions,
      send_via_whatsapp: template.send_via_whatsapp || false,
      send_via_whatsapp_conversation: template.send_via_whatsapp_conversation || false,
      send_via_email: template.send_via_email || false,
      send_via_sms: template.send_via_sms || false,
      allow_anonymous: template.allow_anonymous || false,
      allow_attachments: template.allow_attachments || false,
      design: template.design || {
        primary_color: '#5423e7',
        secondary_color: '#3b82f6',
        font_family: 'Inter',
        logo_url: '',
        background_image_url: '',
        theme_preset: 'default'
      }
    });
    setShowDefaultTemplatesDialog(false);
    setIsDialogOpen(true);

    toast.success(`Template "${template.name}" carregado! Continue configurando...`);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const fileName = `logo-${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from('public-assets').upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('public-assets').getPublicUrl(fileName);

      setFormData(prev => ({
        ...prev,
        design: { ...prev.design, logo_url: publicUrl }
      }));
      toast.success('Logo enviado!');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erro ao enviar logo');
    }
  };

  const handleBackgroundImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const fileName = `background-${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from('public-assets').upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('public-assets').getPublicUrl(fileName);

      setFormData(prev => ({
        ...prev,
        design: { ...prev.design, background_image_url: publicUrl }
      }));
      toast.success('Imagem enviada!');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erro ao enviar imagem');
    }
  };

  const designThemes = {
    default: {
      primary_color: '#5423e7',
      secondary_color: '#3b82f6',
      font_family: 'Inter'
    },
    modern: {
      primary_color: '#6366f1',
      secondary_color: '#8b5cf6',
      font_family: 'Poppins'
    },
    elegant: {
      primary_color: '#1e293b',
      secondary_color: '#64748b',
      font_family: 'Playfair Display'
    },
    vibrant: {
      primary_color: '#f59e0b',
      secondary_color: '#ef4444',
      font_family: 'Montserrat'
    },
    minimal: {
      primary_color: '#000000',
      secondary_color: '#737373',
      font_family: 'Helvetica'
    },
    dark: {
      primary_color: '#8b5cf6',
      secondary_color: '#ec4899',
      font_family: 'Inter'
    }
  };

  const handleApplyTheme = (themeName) => {
    const theme = designThemes[themeName];
    if (theme) {
      setFormData({
        ...formData,
        design: {
          ...formData.design,
          ...theme,
          theme_preset: themeName
        }
      });
      toast.success(`Tema "${themeName}" aplicado!`);
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({ ...template, allow_attachments: !!template.allow_attachments });
    setIsDialogOpen(true);
  };

  const handleAddQuestion = () => {
    if (!newQuestion.question.trim()) return;
    setFormData({
      ...formData,
      questions: [...formData.questions, {
        ...newQuestion,
        id: Date.now().toString(),
        skip_logic: { enabled: false, conditions: [] }
      }]
    });
    setNewQuestion({ question: '', type: 'text', required: true });
  };

  const handleUpdateQuestionSkipLogic = (questionId, skipLogic) => {
    setFormData({
      ...formData,
      questions: formData.questions.map(q =>
        q.id === questionId ? { ...q, skip_logic: skipLogic } : q
      )
    });
  };

  const handleAddSkipCondition = (questionId) => {
    const question = formData.questions.find(q => q.id === questionId);
    if (!question) return;

    const newCondition = {
      answer_value: '',
      operator: 'equals',
      skip_to_question_id: ''
    };

    const updatedSkipLogic = {
      ...question.skip_logic,
      enabled: true,
      conditions: [...(question.skip_logic?.conditions || []), newCondition]
    };

    handleUpdateQuestionSkipLogic(questionId, updatedSkipLogic);
  };

  const handleRemoveSkipCondition = (questionId, conditionIndex) => {
    const question = formData.questions.find(q => q.id === questionId);
    if (!question) return;

    const updatedConditions = question.skip_logic.conditions.filter((_, idx) => idx !== conditionIndex);
    const updatedSkipLogic = {
      ...question.skip_logic,
      conditions: updatedConditions,
      enabled: updatedConditions.length > 0
    };

    handleUpdateQuestionSkipLogic(questionId, updatedSkipLogic);
  };

  const handleUpdateSkipCondition = (questionId, conditionIndex, field, value) => {
    const question = formData.questions.find(q => q.id === questionId);
    if (!question) return;

    const updatedConditions = question.skip_logic.conditions.map((cond, idx) =>
      idx === conditionIndex ? { ...cond, [field]: value } : cond
    );

    const updatedSkipLogic = {
      ...question.skip_logic,
      conditions: updatedConditions
    };

    handleUpdateQuestionSkipLogic(questionId, updatedSkipLogic);
  };

  const handleRemoveQuestion = (questionId) => {
    setFormData({
      ...formData,
      questions: formData.questions.filter(q => q.id !== questionId)
    });
  };

  const handleReorderQuestions = (reorderedQuestions) => {
    setFormData({
      ...formData,
      questions: reorderedQuestions
    });
  };

  const handleSelectLibraryTemplate = (template) => {
    handleApplyDefaultTemplate(template);
  };

  const handleEditQuestion = (question) => {
    setEditingQuestion(question);
    setEditingQuestionSkipLogic(question);
  };

  const handleSaveQuestionEdit = () => {
    if (!editingQuestion) return;

    setFormData({
      ...formData,
      questions: formData.questions.map(q =>
        q.id === editingQuestion.id ? editingQuestion : q
      )
    });

    setEditingQuestion(null);
    setEditingQuestionSkipLogic(null);
    toast.success('Pergunta atualizada!');
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || formData.questions.length === 0) {
      toast.error('Preencha o nome e adicione pelo menos uma pergunta');
      return;
    }

    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const questionTypeIcons = {
    text: MessageSquare,
    stars: Star,
    faces: Smile,
    rating: BarChart,
    boolean: CheckCircle2
  };

  const questionTypeLabels = {
    text: 'Texto Livre',
    stars: 'Estrelas (1-5)',
    faces: 'Carinhas (0-10)',
    rating: 'Avaliação (0-10)',
    boolean: 'Sim/Não'
  };

  return (
    <div className="bg-[#f7f7f8] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-[#121217]">Painel Administrativo</h1>
              <p className="text-sm text-[#6c6c89] mt-1">Gerencie modelos de pesquisa e integrações</p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="templates" className="gap-2">
                <FileText className="w-4 h-4" />
                Templates
              </TabsTrigger>
              <TabsTrigger value="vouchers" className="gap-2">
                <Gift className="w-4 h-4" />
                Vouchers
              </TabsTrigger>
              <TabsTrigger value="webhooks" className="gap-2">
                <Webhook className="w-4 h-4" />
                Webhooks
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <SettingsIcon className="w-4 h-4" />
                Configurações
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="space-y-6">
            {/* Plan Usage Indicators */}
            {planLimits.plan && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-[#d1d1db] p-6"
              >
                <h3 className="text-sm font-semibold text-[#121217] mb-4">Uso do Plano - {planLimits.plan.name}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <PlanUsageIndicator
                    label="Pesquisas Criadas"
                    current={templates.length}
                    max={planLimits.plan.max_surveys}
                  />
                  <PlanUsageIndicator
                    label="Mensagens Mensais"
                    current={planLimits.consumption.messages_sent}
                    max={planLimits.plan.max_messages}
                  />
                  <PlanUsageIndicator
                    label="Usuários"
                    current={0}
                    max={planLimits.plan.max_users}
                  />
                </div>
              </motion.div>
            )}

            {/* Alert se limite atingido */}
            {planLimits.isLimitReached('surveys') && (
              <PlanLimitAlert
                title="Limite de Pesquisas Atingido"
                message={`Você atingiu o limite de ${planLimits.plan.max_surveys} pesquisas do plano ${planLimits.plan.name}. Faça upgrade para criar mais pesquisas.`}
                featureName="pesquisas"
                currentUsage={templates.length}
                maxLimit={planLimits.plan.max_surveys}
              />
            )}

            {/* Criar Novo Modelo */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Seus Modelos de Pesquisa</h2>
                <p className="text-sm text-gray-500 mt-1">Gerencie seus modelos personalizados</p>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <motion.div whileHover={{ scale: planLimits.isLimitReached('surveys') ? 1 : 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      onClick={resetForm}
                      disabled={planLimits.isLimitReached('surveys')}
                      className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-lg gap-2 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      {planLimits.isLimitReached('surveys') ? 'Limite Atingido' : 'Novo Modelo'}
                    </Button>
                  </motion.div>
                </DialogTrigger>
                <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <div className="flex items-center justify-between">
                      <DialogTitle>{editingTemplate ? 'Editar Modelo' : 'Novo Modelo de Pesquisa'}</DialogTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPreview(!showPreview)}
                        className="gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        {showPreview ? 'Ocultar' : 'Preview'}
                      </Button>
                    </div>
                  </DialogHeader>

                  <div className="flex-1 overflow-hidden flex gap-4">
                    {/* Editor Form */}
                    <div className={`${showPreview ? 'w-1/2' : 'w-full'} overflow-y-auto pr-2 space-y-6 py-4`}>
                      {/* Nome */}
                      <div className="space-y-2">
                        <Label>Nome do Modelo</Label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Ex: Pesquisa de Satisfação Principal"
                        />
                      </div>

                      <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                        <Label className="text-sm font-semibold">Canais de Envio</Label>
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">WhatsApp</Label>
                            <Switch
                              checked={formData.send_via_whatsapp}
                              onCheckedChange={(val) => setFormData({ ...formData, send_via_whatsapp: val })}
                            />
                          </div>
                          {formData.send_via_whatsapp && (
                            <div className="ml-4 flex items-center justify-between p-3 bg-white rounded border border-green-200">
                              <div>
                                <Label className="text-sm">Resposta Interativa (Chat)</Label>
                                <p className="text-xs text-slate-500">Perguntas respondidas direto no WhatsApp</p>
                              </div>
                              <Switch
                                checked={formData.send_via_whatsapp_conversation}
                                onCheckedChange={(val) => setFormData({ ...formData, send_via_whatsapp_conversation: val })}
                              />
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Email</Label>
                            <Switch
                              checked={formData.send_via_email}
                              onCheckedChange={(val) => setFormData({ ...formData, send_via_email: val })}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">SMS</Label>
                            <Switch
                              checked={formData.send_via_sms}
                              onCheckedChange={(val) => setFormData({ ...formData, send_via_sms: val })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                        <Label className="text-sm font-semibold">Configurações de Privacidade</Label>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm">Permitir Resposta Anônima</Label>
                            <p className="text-xs text-slate-500">Cliente pode escolher não se identificar</p>
                          </div>
                          <Switch
                            checked={formData.allow_anonymous}
                            onCheckedChange={(val) => setFormData({ ...formData, allow_anonymous: val })}
                          />
                        </div>
                      </div>

                      <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                        <Label className="text-sm font-semibold">Anexos</Label>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm">Permitir anexar arquivos na resposta</Label>
                            <p className="text-xs text-slate-500">Disponível em todos os canais, exceto Click no Totem</p>
                          </div>
                          <Switch
                            checked={!!formData.allow_attachments}
                            onCheckedChange={(val) => setFormData({ ...formData, allow_attachments: val })}
                          />
                        </div>
                      </div>

                      <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="text-sm font-semibold">Período de Finalização da Pesquisa</Label>
                          <Switch
                            checked={formData.completion_period?.enabled || false}
                            onCheckedChange={(val) => setFormData({
                              ...formData,
                              completion_period: { ...formData.completion_period, enabled: val }
                            })}
                          />
                        </div>

                        {formData.completion_period?.enabled && (
                          <div className="space-y-3 bg-white p-3 rounded-lg border border-slate-200">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label className="text-xs">Dias</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="365"
                                  value={formData.completion_period?.days || 7}
                                  onChange={(e) => setFormData({
                                    ...formData,
                                    completion_period: { ...formData.completion_period, days: parseInt(e.target.value) || 0 }
                                  })}
                                  placeholder="7"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Horas Adicionais</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="23"
                                  value={formData.completion_period?.hours || 0}
                                  onChange={(e) => setFormData({
                                    ...formData,
                                    completion_period: { ...formData.completion_period, hours: parseInt(e.target.value) || 0 }
                                  })}
                                  placeholder="0"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-sm">Fechar Automaticamente</Label>
                                <p className="text-xs text-slate-500">Pesquisa será fechada após o período</p>
                              </div>
                              <Switch
                                checked={formData.completion_period?.close_automatically || false}
                                onCheckedChange={(val) => setFormData({
                                  ...formData,
                                  completion_period: { ...formData.completion_period, close_automatically: val }
                                })}
                              />
                            </div>

                            <div className="p-2 bg-blue-50 border border-blue-200 rounded flex gap-2 text-xs text-blue-700">
                              <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <span>Período total: {(formData.completion_period?.days || 0)} dias e {(formData.completion_period?.hours || 0)} horas</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">Design Visual</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDesignEditor(!showDesignEditor)}
                          >
                            <Palette className="w-3 h-3 mr-1" />
                            {showDesignEditor ? 'Ocultar' : 'Editar'}
                          </Button>
                        </div>

                        {showDesignEditor && (
                          <div className="p-4 bg-slate-50 rounded-lg space-y-4">
                            {/* Temas Pré-Definidos */}
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">🎨 Temas Pré-Definidos</Label>
                              <div className="grid grid-cols-3 gap-2">
                                {Object.keys(designThemes).map((themeName) => {
                                  const theme = designThemes[themeName];
                                  const isActive = formData.design?.theme_preset === themeName;
                                  return (
                                    <button
                                      key={themeName}
                                      type="button"
                                      onClick={() => handleApplyTheme(themeName)}
                                      className={`p-3 rounded-lg border-2 transition-all ${isActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                      <div className="flex gap-1 mb-1">
                                        <div className="w-4 h-4 rounded" style={{ backgroundColor: theme.primary_color }} />
                                        <div className="w-4 h-4 rounded" style={{ backgroundColor: theme.secondary_color }} />
                                      </div>
                                      <p className="text-xs font-medium capitalize">{themeName}</p>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="border-t border-slate-200 pt-4">
                              <Label className="text-xs font-semibold mb-3 block">Personalização Manual</Label>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label className="text-xs">Cor Primária</Label>
                                  <div className="flex gap-2">
                                    <Input
                                      type="color"
                                      value={formData.design?.primary_color || '#5423e7'}
                                      onChange={(e) => setFormData({
                                        ...formData,
                                        design: { ...formData.design, primary_color: e.target.value, theme_preset: 'custom' }
                                      })}
                                      className="w-16 h-10"
                                    />
                                    <Input
                                      value={formData.design?.primary_color || '#5423e7'}
                                      onChange={(e) => setFormData({
                                        ...formData,
                                        design: { ...formData.design, primary_color: e.target.value, theme_preset: 'custom' }
                                      })}
                                      className="flex-1"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-xs">Cor Secundária</Label>
                                  <div className="flex gap-2">
                                    <Input
                                      type="color"
                                      value={formData.design?.secondary_color || '#3b82f6'}
                                      onChange={(e) => setFormData({
                                        ...formData,
                                        design: { ...formData.design, secondary_color: e.target.value, theme_preset: 'custom' }
                                      })}
                                      className="w-16 h-10"
                                    />
                                    <Input
                                      value={formData.design?.secondary_color || '#3b82f6'}
                                      onChange={(e) => setFormData({
                                        ...formData,
                                        design: { ...formData.design, secondary_color: e.target.value, theme_preset: 'custom' }
                                      })}
                                      className="flex-1"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs">Fonte</Label>
                              <Select
                                value={formData.design?.font_family || 'Inter'}
                                onValueChange={(val) => setFormData({
                                  ...formData,
                                  design: { ...formData.design, font_family: val }
                                })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Inter">Inter</SelectItem>
                                  <SelectItem value="Arial">Arial</SelectItem>
                                  <SelectItem value="Roboto">Roboto</SelectItem>
                                  <SelectItem value="Open Sans">Open Sans</SelectItem>
                                  <SelectItem value="Lato">Lato</SelectItem>
                                  <SelectItem value="Poppins">Poppins</SelectItem>
                                  <SelectItem value="Montserrat">Montserrat</SelectItem>
                                  <SelectItem value="Playfair Display">Playfair Display</SelectItem>
                                  <SelectItem value="Helvetica">Helvetica</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs">Logo (opcional)</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleLogoUpload}
                                  className="flex-1"
                                />
                                {formData.design?.logo_url && (
                                  <img
                                    src={formData.design.logo_url}
                                    alt="Logo"
                                    className="w-10 h-10 object-contain rounded border"
                                  />
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs">Imagem de Fundo (opcional)</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleBackgroundImageUpload}
                                  className="flex-1"
                                />
                                {formData.design?.background_image_url && (
                                  <img
                                    src={formData.design.background_image_url}
                                    alt="Background"
                                    className="w-10 h-10 object-cover rounded border"
                                  />
                                )}
                              </div>
                              <p className="text-xs text-slate-500">
                                A imagem será usada como fundo da pesquisa
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">Perguntas (Arraste para Reordenar)</Label>
                          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                            <DialogTrigger asChild>
                              <Button type="button" variant="outline" size="sm">
                                <Copy className="w-3 h-3 mr-1" />
                                Importar
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Importar Perguntas</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-3 py-4">
                                {templates.filter(t => t.id !== editingTemplate?.id).map((template) => (
                                  <button
                                    key={template.id}
                                    onClick={() => handleImportQuestions(template.id)}
                                    className="w-full p-3 border rounded-lg hover:bg-slate-50 text-left transition-colors"
                                  >
                                    <div className="font-medium text-sm">{template.name}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {template.questions?.length || 0} perguntas
                                    </div>
                                  </button>
                                ))}
                                {templates.filter(t => t.id !== editingTemplate?.id).length === 0 && (
                                  <p className="text-sm text-slate-500 text-center py-4">
                                    Nenhum modelo disponível para importar
                                  </p>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>

                        <DraggableQuestionList
                          questions={formData.questions}
                          onReorder={handleReorderQuestions}
                          onEdit={handleEditQuestion}
                          onDelete={handleRemoveQuestion}
                        />

                        <div className="space-y-2 p-4 border-2 border-dashed rounded-lg">
                          <Input
                            placeholder="Digite a pergunta..."
                            value={newQuestion.question}
                            onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                          />
                          <div className="flex gap-2">
                            <Select
                              value={newQuestion.type}
                              onValueChange={(val) => setNewQuestion({ ...newQuestion, type: val })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Texto Livre</SelectItem>
                                <SelectItem value="stars">Estrelas (1-5)</SelectItem>
                                <SelectItem value="faces">Carinhas (0-10)</SelectItem>
                                <SelectItem value="rating">Avaliação (0-10)</SelectItem>
                                <SelectItem value="boolean">Sim/Não</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={newQuestion.required}
                                onCheckedChange={(val) => setNewQuestion({ ...newQuestion, required: val })}
                              />
                              <Label className="text-sm">Obrigatório</Label>
                            </div>
                            <Button onClick={handleAddQuestion} size="sm">
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Google Redirect Config */}
                      <div className="space-y-3 p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <Label className="text-sm font-semibold text-green-900 flex items-center gap-2">
                              🌟 Redirecionamento para Google
                            </Label>
                            <p className="text-xs text-green-700 mt-1">Redirecione clientes satisfeitos para avaliar no Google Meu Negócio</p>
                          </div>
                          <Switch
                            checked={formData.google_redirect?.enabled || false}
                            onCheckedChange={(val) => setFormData({
                              ...formData,
                              google_redirect: { ...formData.google_redirect, enabled: val }
                            })}
                          />
                        </div>

                        {formData.google_redirect?.enabled && (
                          <div className="space-y-3 bg-white p-3 rounded-lg">
                            {!tenant?.google_review_link && (
                              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-3">
                                <div className="flex items-start gap-2">
                                  <span className="text-lg">⚠️</span>
                                  <div className="flex-1">
                                    <p className="text-xs font-semibold text-yellow-900 mb-1">Link do Google não configurado</p>
                                    <p className="text-xs text-yellow-800 mb-2">Preencha o link do Google Meu Negócio para ativar o redirecionamento.</p>

                                    <div className="space-y-2">
                                      <Input
                                        value={googleLinkInput}
                                        onChange={(e) => setGoogleLinkInput(e.target.value)}
                                        placeholder="https://g.page/r/..."
                                        className="text-xs"
                                      />
                                      <Button
                                        size="sm"
                                        onClick={() => updateTenantGoogleLinkMutation.mutate(googleLinkInput)}
                                        disabled={!googleLinkInput.trim() || updateTenantGoogleLinkMutation.isPending}
                                        className="w-full"
                                      >
                                        {updateTenantGoogleLinkMutation.isPending ? 'Salvando...' : 'Salvar Link do Google'}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {tenant?.google_review_link && (
                              <div className="p-2 bg-green-100 border border-green-300 rounded flex items-center gap-2 text-xs text-green-800">
                                <span>✅</span>
                                <span>Link do Google configurado: {tenant.google_review_link}</span>
                              </div>
                            )}

                            <div className="space-y-2">
                              <Label className="text-xs">Nota Mínima para Redirecionar (opcional)</Label>
                              <Input
                                type="number"
                                min="1"
                                max="5"
                                placeholder="Ex: 4"
                                value={formData.google_redirect?.conditions?.[0]?.min_rating || ''}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  google_redirect: {
                                    ...formData.google_redirect,
                                    conditions: [{
                                      min_rating: e.target.value ? parseFloat(e.target.value) : undefined
                                    }]
                                  }
                                })}
                              />
                              <p className="text-xs text-slate-500">
                                Apenas clientes com nota igual ou superior serão redirecionados. Deixe em branco para redirecionar todos.
                              </p>
                            </div>

                            {!tenant?.google_review_link && (
                              <div className="p-2 bg-blue-50 border border-blue-200 rounded flex gap-2 text-xs text-blue-700">
                                <span>💡 Ou configure em: Configurações &gt; Informações Gerais</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Usage Limit Config */}
                      <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <Label className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                              📊 Limite de Usos
                            </Label>
                            <p className="text-xs text-blue-700 mt-1">Configure um limite de usos e um template alternativo ao atingir o limite</p>
                          </div>
                          <Switch
                            checked={formData.usage_limit?.enabled || false}
                            onCheckedChange={(val) => setFormData({
                              ...formData,
                              usage_limit: { ...formData.usage_limit, enabled: val }
                            })}
                          />
                        </div>

                        {formData.usage_limit?.enabled && (
                          <div className="space-y-3 bg-white p-3 rounded-lg">
                            <div className="space-y-2">
                              <Label className="text-xs">Máximo de Usos Permitidos</Label>
                              <Input
                                type="number"
                                min="1"
                                value={formData.usage_limit?.max_uses || 100}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  usage_limit: { ...formData.usage_limit, max_uses: parseInt(e.target.value) || 100 }
                                })}
                                placeholder="100"
                              />
                              <p className="text-xs text-slate-500">
                                Usos atuais: {formData.usage_limit?.current_uses || 0}/{formData.usage_limit?.max_uses || 100}
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs">Template Alternativo (Fallback)</Label>
                              <Select
                                value={formData.usage_limit?.fallback_template_id || ''}
                                onValueChange={(val) => setFormData({
                                  ...formData,
                                  usage_limit: { ...formData.usage_limit, fallback_template_id: val }
                                })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione um template alternativo" />
                                </SelectTrigger>
                                <SelectContent>
                                  {templates.filter(t => t.id !== editingTemplate?.id).map((template) => (
                                    <SelectItem key={template.id} value={template.id}>
                                      {template.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-slate-500">
                                Este template será utilizado após o limite de usos ser atingido
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Voucher Config */}
                      <div className="space-y-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <Label className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                              <Gift className="w-4 h-4" />
                              Recompensa com Voucher
                            </Label>
                            <p className="text-xs text-amber-700 mt-1">Ofereça vouchers aos clientes que completarem a pesquisa</p>
                          </div>
                          <Switch
                            checked={formData.voucher_config?.enabled || false}
                            onCheckedChange={(val) => setFormData({
                              ...formData,
                              voucher_config: { ...formData.voucher_config, enabled: val }
                            })}
                          />
                        </div>

                        {formData.voucher_config?.enabled && (
                          <div className="space-y-3 bg-white p-3 rounded-lg">
                            <div className="space-y-2">
                              <Label className="text-xs">Selecione o Voucher</Label>
                              <Select
                                value={formData.voucher_config?.voucher_id || ''}
                                onValueChange={(val) => setFormData({
                                  ...formData,
                                  voucher_config: { ...formData.voucher_config, voucher_id: val }
                                })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Escolha um voucher" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableVouchers.map((voucher) => (
                                    <SelectItem key={voucher.id} value={voucher.id}>
                                      {voucher.design?.icon} {voucher.name} ({voucher.code})
                                      {voucher.usage_limit && ` (${voucher.current_usage || 0}/${voucher.usage_limit})`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {availableVouchers.length === 0 && (
                                <p className="text-xs text-amber-600">
                                  {vouchers.length > 0
                                    ? 'Todos os vouchers ativos atingiram seu limite de uso. Crie novos vouchers ou aumente o limite existente.'
                                    : 'Nenhum voucher ativo. Crie um voucher na aba "Vouchers" primeiro.'}
                                </p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs">Nota Mínima para Ganhar (opcional)</Label>
                              <Input
                                type="number"
                                min="1"
                                max="10"
                                placeholder="Ex: 8"
                                value={formData.voucher_config?.conditions?.[0]?.min_rating || ''}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  voucher_config: {
                                    ...formData.voucher_config,
                                    conditions: [{
                                      min_rating: e.target.value ? parseFloat(e.target.value) : undefined,
                                      require_recommendation: formData.voucher_config?.conditions?.[0]?.require_recommendation || false
                                    }]
                                  }
                                })}
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Requer Recomendação?</Label>
                              <Switch
                                checked={formData.voucher_config?.conditions?.[0]?.require_recommendation || false}
                                onCheckedChange={(val) => setFormData({
                                  ...formData,
                                  voucher_config: {
                                    ...formData.voucher_config,
                                    conditions: [{
                                      min_rating: formData.voucher_config?.conditions?.[0]?.min_rating,
                                      require_recommendation: val
                                    }]
                                  }
                                })}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <Button onClick={handleSubmit} className="w-full mt-6">
                        {editingTemplate ? 'Atualizar Modelo' : 'Criar Modelo'}
                      </Button>
                    </div>

                    <AnimatePresence>
                      {showPreview && (
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="w-1/2 border-l border-gray-200 overflow-y-auto"
                        >
                          <SurveyPreview
                            formData={formData}
                            primaryColor={formData.design?.primary_color}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Dialog para Editar Pergunta e Skip Logic */}
            <Dialog open={!!editingQuestion} onOpenChange={(open) => !open && setEditingQuestion(null)}>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Editar Pergunta e Lógica de Pulo</DialogTitle>
                </DialogHeader>

                {editingQuestion && (
                  <div className="space-y-6 py-4">
                    {/* Editar texto da pergunta */}
                    <div className="space-y-2">
                      <Label>Texto da Pergunta</Label>
                      <Input
                        value={editingQuestion.question}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                        placeholder="Digite a pergunta..."
                      />
                    </div>

                    {/* Tipo da pergunta */}
                    <div className="space-y-2">
                      <Label>Tipo de Resposta</Label>
                      <Select
                        value={editingQuestion.type}
                        onValueChange={(val) => setEditingQuestion({ ...editingQuestion, type: val })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Texto Livre</SelectItem>
                          <SelectItem value="stars">Estrelas (1-5)</SelectItem>
                          <SelectItem value="faces">Carinhas (0-10)</SelectItem>
                          <SelectItem value="rating">Avaliação (0-10)</SelectItem>
                          <SelectItem value="boolean">Sim/Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Obrigatória */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editingQuestion.required}
                        onCheckedChange={(val) => setEditingQuestion({ ...editingQuestion, required: val })}
                      />
                      <Label>Pergunta Obrigatória</Label>
                    </div>

                    {/* Lógica de Pulo */}
                    <div className="space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-semibold text-purple-900">🔀 Lógica de Pulo (Skip Logic)</Label>
                          <p className="text-xs text-purple-700 mt-1">Pule perguntas baseado na resposta do usuário</p>
                        </div>
                        <Switch
                          checked={editingQuestion.skip_logic?.enabled || false}
                          onCheckedChange={(val) => setEditingQuestion({
                            ...editingQuestion,
                            skip_logic: { ...editingQuestion.skip_logic, enabled: val, conditions: editingQuestion.skip_logic?.conditions || [] }
                          })}
                        />
                      </div>

                      {editingQuestion.skip_logic?.enabled && (
                        <div className="space-y-3">
                          {editingQuestion.skip_logic.conditions?.map((condition, idx) => (
                            <div key={idx} className="p-3 bg-white rounded-lg border border-purple-200 space-y-2">
                              <div className="flex items-center justify-between mb-2">
                                <Label className="text-xs font-medium">Condição {idx + 1}</Label>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const updatedConditions = editingQuestion.skip_logic.conditions.filter((_, i) => i !== idx);
                                    setEditingQuestion({
                                      ...editingQuestion,
                                      skip_logic: { ...editingQuestion.skip_logic, conditions: updatedConditions }
                                    });
                                  }}
                                >
                                  <X className="w-3 h-3 text-red-500" />
                                </Button>
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                {/* Operador */}
                                <div className="space-y-1">
                                  <Label className="text-xs">Operador</Label>
                                  <Select
                                    value={condition.operator}
                                    onValueChange={(val) => {
                                      const updatedConditions = [...editingQuestion.skip_logic.conditions];
                                      updatedConditions[idx] = { ...condition, operator: val };
                                      setEditingQuestion({
                                        ...editingQuestion,
                                        skip_logic: { ...editingQuestion.skip_logic, conditions: updatedConditions }
                                      });
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="equals">Igual a</SelectItem>
                                      <SelectItem value="not_equals">Diferente de</SelectItem>
                                      <SelectItem value="greater_than">Maior que</SelectItem>
                                      <SelectItem value="less_than">Menor que</SelectItem>
                                      <SelectItem value="greater_or_equal">Maior ou igual</SelectItem>
                                      <SelectItem value="less_or_equal">Menor ou igual</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Valor da resposta */}
                                <div className="space-y-1">
                                  <Label className="text-xs">Valor</Label>
                                  <Input
                                    value={condition.answer_value}
                                    onChange={(e) => {
                                      const updatedConditions = [...editingQuestion.skip_logic.conditions];
                                      updatedConditions[idx] = { ...condition, answer_value: e.target.value };
                                      setEditingQuestion({
                                        ...editingQuestion,
                                        skip_logic: { ...editingQuestion.skip_logic, conditions: updatedConditions }
                                      });
                                    }}
                                    placeholder="Ex: 5, Sim"
                                  />
                                </div>

                                {/* Pergunta destino ou ação especial */}
                                <div className="space-y-1">
                                  <Label className="text-xs">Pular para</Label>
                                  <Select
                                    value={condition.skip_to_question_id}
                                    onValueChange={(val) => {
                                      const updatedConditions = [...editingQuestion.skip_logic.conditions];
                                      updatedConditions[idx] = { ...condition, skip_to_question_id: val };
                                      setEditingQuestion({
                                        ...editingQuestion,
                                        skip_logic: { ...editingQuestion.skip_logic, conditions: updatedConditions }
                                      });
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__END_SURVEY__">🏁 Finalizar Pesquisa</SelectItem>
                                      <SelectItem value="__GOOGLE_REVIEW__">⭐ Redirecionar para Google</SelectItem>
                                      {formData.questions
                                        .filter(q => q.id !== editingQuestion.id)
                                        .map((q, qIdx) => (
                                          <SelectItem key={q.id} value={q.id}>
                                            Pergunta {qIdx + 1}: {q.question.substring(0, 30)}...
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <p className="text-xs text-purple-700 mt-2">
                                Se resposta {condition.operator === 'equals' ? 'for igual a' :
                                  condition.operator === 'not_equals' ? 'for diferente de' :
                                    condition.operator === 'greater_than' ? 'for maior que' :
                                      condition.operator === 'less_than' ? 'for menor que' :
                                        condition.operator === 'greater_or_equal' ? 'for maior ou igual a' :
                                          'for menor ou igual a'} "{condition.answer_value}", pular para pergunta selecionada
                              </p>
                            </div>
                          ))}

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newCondition = {
                                answer_value: '',
                                operator: 'equals',
                                skip_to_question_id: ''
                              };
                              setEditingQuestion({
                                ...editingQuestion,
                                skip_logic: {
                                  ...editingQuestion.skip_logic,
                                  conditions: [...(editingQuestion.skip_logic?.conditions || []), newCondition]
                                }
                              });
                            }}
                            className="w-full"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Adicionar Condição
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setEditingQuestion(null)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSaveQuestionEdit}>
                        Salvar Alterações
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Templates Grid - Modelos do Tenant */}
            <div className="grid gap-4">
              {templates.map((template, idx) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white rounded-xl p-5 border border-[#d1d1db]"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-sm font-semibold text-[#121217]">{template.name}</h3>
                        {template.is_active && (
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Ativo
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{template.questions.length} perguntas</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={template.is_active}
                        onCheckedChange={(val) => toggleActiveMutation.mutate({ id: template.id, is_active: val })}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(template)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(template.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  {/* Canais */}
                  <div className="flex gap-2 mb-3">
                    {template.send_via_whatsapp && (
                      <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">WhatsApp</span>
                    )}
                    {template.send_via_email && (
                      <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">Email</span>
                    )}
                    {template.send_via_sms && (
                      <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded">SMS</span>
                    )}
                  </div>

                  {/* Questions Preview */}
                  <div className="space-y-2">
                    {template.questions.slice(0, 3).map((q) => {
                      const Icon = questionTypeIcons[q.type];
                      return (
                        <div key={q.id} className="flex items-center gap-2 text-sm text-slate-600">
                          <Icon className="w-3 h-3" />
                          <span>{q.question}</span>
                          {q.required && <span className="text-red-500">*</span>}
                        </div>
                      );
                    })}
                    {template.questions.length > 3 && (
                      <p className="text-xs text-slate-400">+{template.questions.length - 3} mais</p>
                    )}
                  </div>
                </motion.div>
              ))}

              {templates.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-[#d1d1db]">
                  <p className="text-sm text-[#6c6c89]">Nenhum modelo criado ainda. Use um template da biblioteca abaixo!</p>
                </div>
              )}
            </div>

            {/* Template Scheduler */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-gray-200 p-6 mt-6"
            >
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Agendamento de Templates</h2>
                <p className="text-sm text-gray-500 mt-1">Programe templates por período, data, ou fluxo sequencial</p>
              </div>
              <TemplateScheduler userTenantId={user?.tenant_id} templates={templates} />
            </motion.div>

            {/* Template Library - ABAIXO dos templates do tenant */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-gray-200 p-6 mt-6"
            >
              <TemplateLibrary
                templates={defaultTemplates}
                onSelectTemplate={handleSelectLibraryTemplate}
                selectedId={selectedTemplate?.id}
              />
            </motion.div>

            <div className="flex gap-2">
              <Dialog open={showDefaultTemplatesDialog} onOpenChange={setShowDefaultTemplatesDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Star className="w-4 h-4" />
                    Biblioteca Completa
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Biblioteca de Templates Padrão</DialogTitle>
                  </DialogHeader>

                  {/* Category Filters */}
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                    {[
                      { id: 'all', name: 'Todos', icon: '📋' },
                      { id: 'Comércio Varejista', name: 'Comércio', icon: '🏪' },
                      { id: 'Alimentação', name: 'Alimentação', icon: '🍔' },
                      { id: 'Saúde', name: 'Saúde', icon: '🏥' },
                      { id: 'Serviços', name: 'Serviços', icon: '🏢' },
                      { id: 'Tecnologia', name: 'Tecnologia', icon: '💻' },
                      { id: 'Automotivo', name: 'Automotivo', icon: '🚗' },
                      { id: 'Turismo/Hospedagem', name: 'Turismo', icon: '🏨' },
                      { id: 'Educação', name: 'Educação', icon: '🎓' },
                      { id: 'Beleza/Estética', name: 'Beleza', icon: '💇' },
                      { id: 'Outros', name: 'Outros', icon: '🏗️' }
                    ].map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all whitespace-nowrap text-sm ${selectedCategory === cat.id
                          ? "border-purple-600 bg-purple-50 text-purple-700"
                          : "border-slate-200 hover:border-purple-300"
                          }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.name}</span>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
                    {defaultTemplates
                      .filter(t => selectedCategory === 'all' || t.category === selectedCategory)
                      .map((template) => (
                        <motion.button
                          key={template.id}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => handleApplyDefaultTemplate(template)}
                          className="p-4 border-2 border-slate-200 rounded-xl hover:border-purple-500 hover:shadow-lg transition-all text-left"
                        >
                          <div className="text-3xl mb-2">{template.icon}</div>
                          <h4 className="font-semibold text-slate-900 mb-1 text-sm">{template.name}</h4>
                          <p className="text-xs text-slate-500 mb-2">{template.subcategory}</p>
                          <p className="text-xs text-slate-400 mb-3 line-clamp-2">{template.description}</p>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-slate-400">
                              {template.questions?.length || 0} perguntas
                            </div>
                            {template.usage_count > 0 && (
                              <div className="text-xs text-purple-600 flex items-center gap-1">
                                <Star className="w-3 h-3" />
                                {template.usage_count} usos
                              </div>
                            )}
                          </div>
                        </motion.button>
                      ))}
                  </div>

                  {defaultTemplates.filter(t => selectedCategory === 'all' || t.category === selectedCategory).length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-slate-500">Nenhum template encontrado nesta categoria</p>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              <Dialog open={showTemplatesDialog} onOpenChange={setShowTemplatesDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <FileText className="w-4 h-4" />
                    Templates Internos
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Escolha um Template</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    {predefinedTemplates.map((template) => (
                      <motion.button
                        key={template.id}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => handleApplyTemplate(template)}
                        className="p-4 border-2 border-slate-200 rounded-xl hover:border-indigo-500 transition-all text-left"
                      >
                        <div className="text-3xl mb-2">{template.icon}</div>
                        <h4 className="font-semibold text-slate-900 mb-1">{template.name}</h4>
                        <p className="text-xs text-slate-500 mb-3">{template.description}</p>
                        <div className="text-xs text-slate-400">
                          {template.questions.length} perguntas
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}

        {/* Vouchers Tab */}
        {activeTab === 'vouchers' && (
          <VoucherManager userTenantId={user?.tenant_id} />
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <TenantSettingsManager />
        )}

        {/* Webhooks Tab */}
        {activeTab === 'webhooks' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
                    <BookOpen className="w-4 h-4" />
                    Documentação do Webhook
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Documentação de Webhooks</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4 text-sm">
                    <div>
                      <h4 className="font-semibold mb-2">O que é um Webhook?</h4>
                      <p className="text-slate-600">Um webhook é uma forma de seu sistema externo enviar dados automaticamente para nossa plataforma quando um evento importante ocorre. Por exemplo, quando um cliente faz uma compra no seu sistema, você pode automaticamente enviar uma pesquisa de satisfação pelo WhatsApp.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">URL do Webhook</h4>
                      <p className="text-slate-600 mb-2">Use a URL fornecida em cada webhook configurado para fazer requisições POST com os dados do cliente:</p>
                      <code className="block bg-slate-100 p-2 rounded text-xs mb-2">POST {window.location.origin}/functions/triggerWhatsAppSurvey</code>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Headers</h4>
                      <p className="text-slate-600 mb-2">Envie a chave do webhook no header para validar a requisição:</p>
                      <code className="block bg-slate-100 p-2 rounded text-xs mb-2">X-Webhook-Key: SUA_CHAVE</code>
                      <p className="text-xs text-slate-500">A chave aparece em cada webhook configurado abaixo.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Corpo da Requisição</h4>
                      <p className="text-slate-600 mb-2">Envie um JSON com as seguintes informações:</p>
                      <code className="block bg-slate-900 text-white p-3 rounded text-xs overflow-x-auto">{`{
          "tenant_id": "seu_tenant_id",
          "customer_phone": "5511999999999",
          "external_trigger_id": "seu_identificador",
          "customer_name": "Nome (opcional)"
          }`}</code>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded">
                      <p className="text-blue-900 text-sm"><strong>Dica:</strong> O cliente receberá a pesquisa via WhatsApp segundos após a requisição ser recebida.</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <WebhookTriggerManager userPlanType={subscription?.[0]?.plan_type} />
          </div>
        )}
      </div>
    </div>
  );
}
