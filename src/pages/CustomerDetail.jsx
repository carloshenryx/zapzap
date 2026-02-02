import React, { useMemo, useState } from 'react';
import { supabase, fetchAPI } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Star, 
  Phone, 
  Mail, 
  MessageCircle,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  FileText,
  Zap,
  DollarSign,
  Gift,
  CreditCard,
  Trash2,
  Pin,
  Paperclip,
  ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getScoreLabel5, getUnifiedScore5 } from '@/lib/ratingUtils';

export default function CustomerDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const customerEmail = urlParams.get('email');
  const customerPhone = urlParams.get('phone');

  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewNote, setShowNewNote] = useState(false);
  const [showNewMovement, setShowNewMovement] = useState(false);
  const [showNewTreatment, setShowNewTreatment] = useState(false);
  const [showVoucherDialog, setShowVoucherDialog] = useState(false);
  const [attachmentsDialogResponseId, setAttachmentsDialogResponseId] = useState(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    task_type: 'follow_up',
    priority: 'medium',
    due_date: ''
  });
  const [newNote, setNewNote] = useState({
    title: '',
    content: '',
    note_type: 'internal',
    priority: 'medium',
    tags: [],
  });
  const [newMovement, setNewMovement] = useState({
    movement_type: 'purchase',
    description: '',
    amount: '',
    payment_method: 'cash',
    status: 'completed',
  });
  const [newTreatment, setNewTreatment] = useState({
    treatment_type: 'complaint_resolution',
    title: '',
    description: '',
    priority: 'medium',
  });
  const [newVoucherUsage, setNewVoucherUsage] = useState({
    voucher_id: '',
  });
  const [followupDrafts, setFollowupDrafts] = useState({});

  const queryClient = useQueryClient();
  const { userProfile } = useAuth();
  const user = userProfile;

  const { data: responses = [] } = useQuery({
    queryKey: ['customer-responses', user?.tenant_id, customerEmail, customerPhone],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      let query = supabase
        .from('survey_responses')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (customerEmail && customerPhone) {
        query = query.or(`customer_email.eq.${customerEmail},customer_phone.eq.${customerPhone}`);
      } else if (customerEmail) {
        query = query.eq('customer_email', customerEmail);
      } else if (customerPhone) {
        query = query.eq('customer_phone', customerPhone);
      } else {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.tenant_id && (!!customerEmail || !!customerPhone),
  });

  const { data: attachmentsByResponseId = {} } = useQuery({
    queryKey: ['survey-response-attachments', user?.tenant_id, responses.map(r => r.id).join(',')],
    queryFn: async () => {
      if (!user?.tenant_id || responses.length === 0) return {};
      const result = await fetchAPI('/surveys?action=list-attachments', {
        method: 'POST',
        body: JSON.stringify({ response_ids: responses.map(r => r.id) }),
      });
      return result.attachmentsByResponseId || {};
    },
    enabled: !!user?.tenant_id && responses.length > 0,
    staleTime: 60_000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['customer-tasks', user?.tenant_id, customerEmail, customerPhone],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      const qs = new URLSearchParams({
        action: 'list-customer-tasks',
        limit: '300',
      });
      if (customerEmail) qs.set('email', customerEmail);
      if (customerPhone) qs.set('phone', customerPhone);
      const result = await fetchAPI(`/crm?${qs.toString()}`, { method: 'GET' });
      return result.tasks || [];
    },
    enabled: !!user?.tenant_id && (!!customerEmail || !!customerPhone),
  });

  const { data: whatsappMessages = [] } = useQuery({
    queryKey: ['customer-whatsapp-messages', user?.tenant_id, customerPhone],
    queryFn: async () => {
      if (!user?.tenant_id || !customerPhone) return [];
      const phoneDigits = customerPhone.replace(/\D/g, '');
      if (!phoneDigits) return [];
      try {
        const { data, error } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .eq('tenant_id', user.tenant_id)
          .eq('phone_number', phoneDigits)
          .order('created_at', { ascending: true })
          .limit(200);
        if (error) return [];
        return data || [];
      } catch (_) {
        return [];
      }
    },
    enabled: !!user?.tenant_id && !!customerPhone,
    staleTime: 10_000,
  });

  const { data: customerNotes = [] } = useQuery({
    queryKey: ['customer-notes', user?.tenant_id, customerEmail, customerPhone],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      let query = supabase
        .from('crm_customer_notes')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (customerEmail && customerPhone) {
        query = query.or(`customer_email.eq.${customerEmail},customer_phone.eq.${customerPhone}`);
      } else if (customerEmail) {
        query = query.eq('customer_email', customerEmail);
      } else if (customerPhone) {
        query = query.eq('customer_phone', customerPhone);
      } else {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.tenant_id && (!!customerEmail || !!customerPhone),
  });

  const { data: movements = [] } = useQuery({
    queryKey: ['customer-movements', user?.tenant_id, customerEmail, customerPhone],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      let query = supabase
        .from('crm_customer_movements')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: false })
        .limit(300);

      if (customerEmail && customerPhone) {
        query = query.or(`customer_email.eq.${customerEmail},customer_phone.eq.${customerPhone}`);
      } else if (customerEmail) {
        query = query.eq('customer_email', customerEmail);
      } else if (customerPhone) {
        query = query.eq('customer_phone', customerPhone);
      } else {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.tenant_id && (!!customerEmail || !!customerPhone),
  });

  const { data: treatments = [] } = useQuery({
    queryKey: ['customer-treatments', user?.tenant_id, customerEmail, customerPhone],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      let query = supabase
        .from('crm_customer_treatments')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (customerEmail && customerPhone) {
        query = query.or(`customer_email.eq.${customerEmail},customer_phone.eq.${customerPhone}`);
      } else if (customerEmail) {
        query = query.eq('customer_email', customerEmail);
      } else if (customerPhone) {
        query = query.eq('customer_phone', customerPhone);
      } else {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.tenant_id && (!!customerEmail || !!customerPhone),
  });

  const { data: availableVouchers = [] } = useQuery({
    queryKey: ['available-vouchers', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      const { data, error } = await supabase
        .from('vouchers')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.tenant_id,
    staleTime: 60_000,
  });

  const { data: voucherUsages = [] } = useQuery({
    queryKey: ['customer-vouchers', user?.tenant_id, customerEmail, customerPhone],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      let query = supabase
        .from('voucher_usage')
        .select('*, vouchers(*)')
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (customerEmail && customerPhone) {
        query = query.or(`customer_email.eq.${customerEmail},customer_phone.eq.${customerPhone}`);
      } else if (customerEmail) {
        query = query.eq('customer_email', customerEmail);
      } else if (customerPhone) {
        query = query.eq('customer_phone', customerPhone);
      } else {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.tenant_id && (!!customerEmail || !!customerPhone),
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData) => {
      const body = {
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        customer_name: customer?.name || responses?.[0]?.customer_name || 'Cliente',
        title: taskData.title,
        description: taskData.description || null,
        task_type: taskData.task_type || 'follow_up',
        priority: taskData.priority || 'medium',
        due_date: taskData.due_date || null,
        status: 'pending',
      };

      const result = await fetchAPI('/crm?action=create-task', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      return result.task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-tasks'] });
      setShowNewTask(false);
      setNewTask({ title: '', description: '', task_type: 'follow_up', priority: 'medium', due_date: '' });
      toast.success('Tarefa criada com sucesso!');
    }
  });

  const createCustomerNoteMutation = useMutation({
    mutationFn: async (noteData) => {
      const payload = {
        tenant_id: user.tenant_id,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        customer_name: customer?.name || responses?.[0]?.customer_name || 'Cliente',
        title: noteData.title || 'Nota',
        content: noteData.content,
        note_type: noteData.note_type || 'internal',
        priority: noteData.priority || 'medium',
        tags: Array.isArray(noteData.tags) ? noteData.tags : [],
        is_pinned: false,
        created_by_user: user?.email || null,
      };

      const { data, error } = await supabase
        .from('crm_customer_notes')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-notes'] });
      setShowNewNote(false);
      setNewNote({ title: '', content: '', note_type: 'internal', priority: 'medium', tags: [] });
      toast.success('Nota adicionada com sucesso!');
    },
    onError: (error) => {
      toast.error(error?.message || 'Erro ao adicionar nota');
    },
  });

  const deleteCustomerNoteMutation = useMutation({
    mutationFn: async (noteId) => {
      const { error } = await supabase
        .from('crm_customer_notes')
        .delete()
        .eq('id', noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-notes'] });
      toast.success('Nota excluída!');
    },
    onError: (error) => {
      toast.error(error?.message || 'Erro ao excluir nota');
    },
  });

  const togglePinCustomerNoteMutation = useMutation({
    mutationFn: async ({ noteId, isPinned }) => {
      const { data, error } = await supabase
        .from('crm_customer_notes')
        .update({ is_pinned: isPinned })
        .eq('id', noteId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-notes'] });
    },
    onError: (error) => {
      toast.error(error?.message || 'Erro ao atualizar nota');
    },
  });

  const createMovementMutation = useMutation({
    mutationFn: async (movementData) => {
      const amount = Number(String(movementData.amount).replace(',', '.'));
      if (!Number.isFinite(amount)) {
        throw new Error('Informe um valor válido');
      }

      const payload = {
        tenant_id: user.tenant_id,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        customer_name: customer?.name || responses?.[0]?.customer_name || 'Cliente',
        movement_type: movementData.movement_type || 'purchase',
        description: movementData.description || null,
        amount,
        payment_method: movementData.payment_method || 'cash',
        status: movementData.status || 'completed',
        created_by_user: user?.email || null,
      };

      const { data, error } = await supabase
        .from('crm_customer_movements')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-movements'] });
      setShowNewMovement(false);
      setNewMovement({ movement_type: 'purchase', description: '', amount: '', payment_method: 'cash', status: 'completed' });
      toast.success('Movimentação registrada!');
    },
    onError: (error) => {
      toast.error(error?.message || 'Erro ao registrar movimentação');
    },
  });

  const createTreatmentMutation = useMutation({
    mutationFn: async (treatmentData) => {
      const payload = {
        tenant_id: user.tenant_id,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        customer_name: customer?.name || responses?.[0]?.customer_name || 'Cliente',
        treatment_type: treatmentData.treatment_type || 'complaint_resolution',
        title: treatmentData.title,
        description: treatmentData.description || null,
        priority: treatmentData.priority || 'medium',
        status: 'open',
        started_at: new Date().toISOString(),
        created_by_user: user?.email || null,
        actions_taken: [],
      };

      const { data, error } = await supabase
        .from('crm_customer_treatments')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-treatments'] });
      setShowNewTreatment(false);
      setNewTreatment({ treatment_type: 'complaint_resolution', title: '', description: '', priority: 'medium' });
      toast.success('Tratativa criada!');
    },
    onError: (error) => {
      toast.error(error?.message || 'Erro ao criar tratativa');
    },
  });

  const updateTreatmentMutation = useMutation({
    mutationFn: async ({ id, status, resolution }) => {
      const update = {
        status,
        resolution: resolution || null,
        ...(status === 'resolved' || status === 'closed' ? { resolved_at: new Date().toISOString() } : {}),
      };

      const { data, error } = await supabase
        .from('crm_customer_treatments')
        .update(update)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-treatments'] });
      toast.success('Tratativa atualizada!');
    },
    onError: (error) => {
      toast.error(error?.message || 'Erro ao atualizar tratativa');
    },
  });

  const grantVoucherMutation = useMutation({
    mutationFn: async ({ voucher_id }) => {
      if (!voucher_id) throw new Error('Selecione um voucher');
      const result = await fetchAPI('/vouchers?action=generate', {
        method: 'POST',
        body: JSON.stringify({
          voucher_id,
          customer_email: customerEmail || null,
          customer_phone: customerPhone || null,
          customer_name: customer?.name || responses?.[0]?.customer_name || 'Cliente',
        }),
      });
      return result?.voucher_usage;
    },
    onSuccess: (usage) => {
      queryClient.invalidateQueries({ queryKey: ['customer-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['available-vouchers'] });
      setShowVoucherDialog(false);
      setNewVoucherUsage({ voucher_id: '' });
      toast.success(usage?.code ? `Voucher concedido: ${usage.code}` : 'Voucher concedido!');
    },
    onError: (error) => {
      toast.error(error?.message || 'Erro ao conceder voucher');
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, status }) => fetchAPI('/crm?action=update-task', {
      method: 'POST',
      body: JSON.stringify({
        task_id: taskId,
        updates: {
          status,
          ...(status === 'completed' ? { completed_date: new Date().toISOString() } : {}),
        },
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-tasks'] });
      toast.success('Status da tarefa atualizado!');
    }
  });

  const updateFollowupMutation = useMutation({
    mutationFn: ({ responseId, followup_status, followup_note }) => fetchAPI('/surveys?action=update-followup', {
      method: 'POST',
      body: JSON.stringify({
        response_id: responseId,
        followup_status,
        followup_note,
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-responses'] });
      toast.success('Tratativa atualizada!');
    },
  });

  const allActivity = useMemo(() => {
    const items = [
      ...responses.map(r => ({
        ...r,
        type: 'survey_response',
        date: r.created_at || r.created_date,
      })),
      ...tasks.map(t => ({
        ...t,
        type: t.task_type === 'internal_note' ? 'internal_note' : 'task',
        date: t.created_at || t.created_date,
      })),
      ...customerNotes.map(n => ({
        ...n,
        type: 'customer_note',
        date: n.created_at,
      })),
      ...movements.map(m => ({
        ...m,
        type: 'movement',
        date: m.created_at,
      })),
      ...treatments.map(t => ({
        ...t,
        type: 'treatment',
        date: t.created_at || t.started_at,
      })),
      ...voucherUsages.map(v => ({
        ...v,
        type: 'voucher',
        date: v.created_at,
      })),
      ...whatsappMessages.map(m => ({
        ...m,
        type: 'whatsapp_message',
        date: m.created_at || m.created_date,
      })),
    ].filter(i => !!i.date);

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [responses, tasks, whatsappMessages, customerNotes, movements, treatments, voucherUsages]);

  if (!customerEmail && !customerPhone) {
    return <div className="p-6">Cliente não encontrado</div>;
  }

  const customer = responses.length > 0 ? {
    name: responses[0].customer_name || 'Cliente',
    email: responses[0].customer_email || customerEmail,
    phone: responses[0].customer_phone || customerPhone,
    cpf: responses[0].customer_cpf
  } : { name: 'Cliente', email: customerEmail, phone: customerPhone };

  const ratings = responses.map(r => getUnifiedScore5(r)).filter(v => v !== null);
  const avgRating = ratings.length > 0 ? (ratings.reduce((sum, v) => sum + v, 0) / ratings.length) : 0;

  const lastResponse = responses[0];
  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const legacyNotes = tasks.filter(t => t.task_type === 'internal_note');
  const pinnedNotes = customerNotes.filter(n => n.is_pinned);
  const regularNotes = customerNotes.filter(n => !n.is_pinned);
  const notesCount = customerNotes.length + legacyNotes.length;

  const openTreatments = treatments.filter(t => t.status === 'open' || t.status === 'in_progress');
  const currentBalance = movements.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
  const totalSpent = movements
    .filter(m => m.movement_type === 'purchase')
    .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
  const vouchersCount = voucherUsages.length;
  const attachmentsForDialog = attachmentsDialogResponseId ? (attachmentsByResponseId[attachmentsDialogResponseId] || []) : [];

  const getActivityIcon = (type) => {
    const icons = {
      survey_response: <FileText className="w-4 h-4" />,
      whatsapp_message: <MessageCircle className="w-4 h-4" />,
      email_sent: <Mail className="w-4 h-4" />,
      phone_call: <Phone className="w-4 h-4" />,
      internal_note: <FileText className="w-4 h-4" />,
      customer_note: <FileText className="w-4 h-4" />,
      movement: <DollarSign className="w-4 h-4" />,
      treatment: <AlertCircle className="w-4 h-4" />,
      voucher: <Gift className="w-4 h-4" />,
      task: <CheckCircle2 className="w-4 h-4" />,
      automation_triggered: <Zap className="w-4 h-4" />
    };
    return icons[type] || <FileText className="w-4 h-4" />;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-blue-100 text-blue-700',
      medium: 'bg-yellow-100 text-yellow-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700'
    };
    return colors[priority] || colors.medium;
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: <Clock className="w-4 h-4 text-gray-500" />,
      in_progress: <AlertCircle className="w-4 h-4 text-blue-500" />,
      completed: <CheckCircle2 className="w-4 h-4 text-green-500" />
    };
    return icons[status] || icons.pending;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('CRM')}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          <p className="text-gray-600">{customer.email || customer.phone || '-'}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {customer.phone && (
            <Button variant="outline" onClick={() => window.open(`https://wa.me/${customer.phone.replace(/\D/g, '')}`)}>
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowNewNote(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Nota
          </Button>
          <Button variant="outline" onClick={() => setShowNewMovement(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Movimentação
          </Button>
          <Button variant="outline" onClick={() => setShowNewTreatment(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Tratativa
          </Button>
          <Button variant="outline" onClick={() => setShowVoucherDialog(true)}>
            <Gift className="w-4 h-4 mr-2" />
            Conceder Voucher
          </Button>
          <Button onClick={() => setShowNewTask(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Tarefa
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
            <div>
              <p className="text-sm text-gray-600">Avaliação Média</p>
              <p className="text-2xl font-bold">{avgRating.toFixed(1)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-600">Total Gasto</p>
              <p className="text-xl font-bold">R$ {totalSpent.toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CreditCard className={`w-8 h-8 ${currentBalance >= 0 ? 'text-green-500' : 'text-red-500'}`} />
            <div>
              <p className="text-sm text-gray-600">Saldo Atual</p>
              <p className={`text-xl font-bold ${currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                R$ {currentBalance.toFixed(2)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Gift className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-sm text-gray-600">Vouchers</p>
              <p className="text-2xl font-bold">{vouchersCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-sm text-gray-600">Tratativas Abertas</p>
              <p className="text-2xl font-bold">{openTreatments.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600">Notas</p>
              <p className="text-2xl font-bold">{notesCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList>
          <TabsTrigger value="timeline">Linha do Tempo</TabsTrigger>
          <TabsTrigger value="notes">Notas ({notesCount})</TabsTrigger>
          <TabsTrigger value="movements">Movimentações ({movements.length})</TabsTrigger>
          <TabsTrigger value="treatments">Tratativas ({treatments.length})</TabsTrigger>
          <TabsTrigger value="vouchers">Vouchers ({vouchersCount})</TabsTrigger>
          <TabsTrigger value="surveys">Pesquisas ({responses.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas ({tasks.filter(t => t.task_type !== 'internal_note').length})</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp ({whatsappMessages.length})</TabsTrigger>
        </TabsList>

        {/* Timeline */}
        <TabsContent value="timeline" className="space-y-3">
          {allActivity.map((activity, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">
                      {activity.type === 'survey_response' && 'Respondeu uma pesquisa'}
                      {activity.type === 'internal_note' && 'Nota adicionada'}
                      {activity.type === 'customer_note' && `Nota: ${activity.title || 'Nota'}`}
                      {activity.type === 'movement' && `Movimentação: ${activity.movement_type || 'movimento'}`}
                      {activity.type === 'treatment' && `Tratativa: ${activity.title || 'Tratativa'}`}
                      {activity.type === 'voucher' && 'Voucher concedido'}
                      {activity.type === 'task' && `Tarefa: ${activity.title}`}
                      {activity.type === 'whatsapp_message' && 'Mensagem WhatsApp enviada'}
                    </p>
                    <span className="text-xs text-gray-500">
                      {new Date(activity.date).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  {activity.type === 'survey_response' && (() => {
                    const score5 = getUnifiedScore5(activity);
                    if (score5 === null) return null;
                    const label = getScoreLabel5(score5);
                    return (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-4 h-4 ${i < Math.floor(score5) ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`} />
                          ))}
                        </div>
                        <Badge className={label.className}>
                          {Number.isInteger(score5) ? score5 : score5.toFixed(1)} • {label.label}
                        </Badge>
                      </div>
                    );
                  })()}
                  {activity.comment && <p className="text-sm text-gray-600 whitespace-pre-wrap">{activity.comment}</p>}
                  {activity.description && <p className="text-sm text-gray-600 whitespace-pre-wrap">{activity.description}</p>}
                  {activity.content && <p className="text-sm text-gray-600 whitespace-pre-wrap">{activity.content}</p>}
                  {activity.type === 'survey_response' && (() => {
                    const atts = attachmentsByResponseId[activity.id] || [];
                    if (!atts.length) return null;
                    return (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => setAttachmentsDialogResponseId(activity.id)}
                        >
                          <Paperclip className="w-4 h-4" />
                          Ver anexos ({atts.length})
                        </Button>
                      </div>
                    );
                  })()}
                  {activity.type === 'whatsapp_message' && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {activity.message || activity.text || activity.content || activity.body || ''}
                    </p>
                  )}
                  {activity.type === 'voucher' && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline">{activity?.vouchers?.name || 'Voucher'}</Badge>
                      {activity.code ? <Badge className="bg-purple-100 text-purple-800">{activity.code}</Badge> : null}
                      {activity.redeemed ? <Badge className="bg-green-100 text-green-800">Resgatado</Badge> : <Badge className="bg-yellow-100 text-yellow-800">Não resgatado</Badge>}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Pesquisas */}
        <TabsContent value="surveys" className="space-y-3">
          {responses.map((response) => (
            <Card key={response.id} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  {(() => {
                    const score5 = getUnifiedScore5(response);
                    if (score5 === null) return null;
                    const label = getScoreLabel5(score5);
                    return (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-4 h-4 ${i < Math.floor(score5) ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`} />
                          ))}
                        </div>
                        <Badge className={label.className}>
                          {Number.isInteger(score5) ? score5 : score5.toFixed(1)} • {label.label}
                        </Badge>
                      </div>
                    );
                  })()}
                  {response.comment && <p className="text-sm text-gray-700 mb-2">{response.comment}</p>}
                  {(() => {
                    const atts = attachmentsByResponseId[response.id] || [];
                    if (!atts.length) return null;
                    return (
                      <div className="mt-3 mb-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => setAttachmentsDialogResponseId(response.id)}
                        >
                          <Paperclip className="w-4 h-4" />
                          Ver anexos ({atts.length})
                        </Button>
                      </div>
                    );
                  })()}
                  {response.sentiment && (
                    <Badge variant="outline" className={
                      response.sentiment === 'positive' ? 'border-green-500 text-green-700' :
                      response.sentiment === 'negative' ? 'border-red-500 text-red-700' :
                      'border-gray-500 text-gray-700'
                    }>
                      {response.sentiment === 'positive' ? 'Positivo' : response.sentiment === 'negative' ? 'Negativo' : 'Neutro'}
                    </Badge>
                  )}
                  {(() => {
                    const score5 = getUnifiedScore5(response);
                    if (score5 === null || score5 > 2) return null;
                    const draft = followupDrafts[response.id] || {
                      followup_status: response.followup_status || 'open',
                      followup_note: response.followup_note || '',
                    };
                    return (
                      <div className="mt-4 p-3 rounded-lg border border-red-100 bg-red-50 space-y-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <Badge className="bg-red-200 text-red-900">Cliente em risco</Badge>
                          <Badge className="bg-[#f2f2f6] text-[#121217] border border-[#e7e7ee]">
                            Tratativa: {draft.followup_status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="md:col-span-1">
                            <Label>Status</Label>
                            <select
                              value={draft.followup_status}
                              onChange={(e) => setFollowupDrafts(prev => ({ ...prev, [response.id]: { ...draft, followup_status: e.target.value } }))}
                              className="w-full px-3 py-2 border rounded-lg bg-white"
                            >
                              <option value="open">Aberta</option>
                              <option value="in_progress">Em andamento</option>
                              <option value="resolved">Resolvida</option>
                              <option value="ignored">Cancelada</option>
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <Label>Observação</Label>
                            <Textarea
                              value={draft.followup_note}
                              onChange={(e) => setFollowupDrafts(prev => ({ ...prev, [response.id]: { ...draft, followup_note: e.target.value } }))}
                              placeholder="Ex.: Cliente reclamou do atendimento. Retornar em 2h."
                              className="min-h-[80px] bg-white"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            disabled={updateFollowupMutation.isPending}
                            onClick={() => updateFollowupMutation.mutate({
                              responseId: response.id,
                              followup_status: draft.followup_status,
                              followup_note: draft.followup_note,
                            })}
                          >
                            Salvar tratativa
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(response.created_at || response.created_date).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Tarefas */}
        <TabsContent value="tasks" className="space-y-3">
          {tasks.filter(t => t.task_type !== 'internal_note').map((task) => (
            <Card key={task.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {getStatusIcon(task.status)}
                  <div className="flex-1">
                    <h4 className="font-medium">{task.title}</h4>
                    {task.description && <p className="text-sm text-gray-600 mt-1">{task.description}</p>}
                    <div className="flex gap-2 mt-2">
                      <Badge className={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                      {task.due_date && (
                        <Badge variant="outline" className={new Date(task.due_date).getTime() < Date.now() && task.status !== 'completed' ? 'border-red-400 text-red-700' : ''}>
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(task.due_date).toLocaleDateString('pt-BR')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {task.status === 'pending' && (
                  <Button size="sm" onClick={() => updateTaskMutation.mutate({ taskId: task.id, status: 'completed' })}>
                    Concluir
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Notas */}
        <TabsContent value="notes" className="space-y-3">
          {pinnedNotes.length === 0 && regularNotes.length === 0 && legacyNotes.length === 0 ? (
            <Card className="p-4">
              <div className="text-sm text-gray-600">Nenhuma nota registrada para este cliente.</div>
            </Card>
          ) : null}

          {pinnedNotes.length > 0 ? (
            <div className="space-y-3">
              {pinnedNotes.map((note) => (
                <Card key={note.id} className="p-4 border border-blue-200 bg-blue-50/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-blue-600 text-white">Fixada</Badge>
                        {note.priority ? <Badge className={getPriorityColor(note.priority)}>{note.priority}</Badge> : null}
                      </div>
                      <h4 className="font-medium">{note.title || 'Nota'}</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{note.content}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {note.created_by_user ? `Por ${note.created_by_user} • ` : ''}{note.created_at ? new Date(note.created_at).toLocaleString('pt-BR') : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => togglePinCustomerNoteMutation.mutate({ noteId: note.id, isPinned: false })}
                        title="Desafixar"
                      >
                        <Pin className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => deleteCustomerNoteMutation.mutate(note.id)}
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : null}

          {regularNotes.length > 0 ? (
            <div className="space-y-3">
              {regularNotes.map((note) => (
                <Card key={note.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {note.priority ? <Badge className={getPriorityColor(note.priority)}>{note.priority}</Badge> : null}
                        {note.note_type ? <Badge variant="outline">{note.note_type}</Badge> : null}
                      </div>
                      <h4 className="font-medium">{note.title || 'Nota'}</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{note.content}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {note.created_by_user ? `Por ${note.created_by_user} • ` : ''}{note.created_at ? new Date(note.created_at).toLocaleString('pt-BR') : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => togglePinCustomerNoteMutation.mutate({ noteId: note.id, isPinned: true })}
                        title="Fixar"
                      >
                        <Pin className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => deleteCustomerNoteMutation.mutate(note.id)}
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : null}

          {legacyNotes.length > 0 ? (
            <div className="space-y-3">
              <div className="text-xs text-gray-500">Notas antigas</div>
              {legacyNotes.map((note) => (
                <Card key={note.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.description}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {note.assigned_to ? `Por ${note.assigned_to} • ` : ''}{note.created_at ? new Date(note.created_at).toLocaleString('pt-BR') : ''}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="movements" className="space-y-3">
          {movements.length === 0 ? (
            <Card className="p-4">
              <div className="text-sm text-gray-600">Nenhuma movimentação registrada para este cliente.</div>
            </Card>
          ) : (
            movements.map((m) => (
              <Card key={m.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{m.movement_type}</Badge>
                      {m.status ? <Badge variant="outline">{m.status}</Badge> : null}
                      {m.payment_method ? <Badge variant="outline">{m.payment_method}</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{m.description || '-'}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {m.created_by_user ? `Por ${m.created_by_user} • ` : ''}{m.created_at ? new Date(m.created_at).toLocaleString('pt-BR') : ''}
                    </p>
                  </div>
                  <div className={`text-lg font-bold ${Number(m.amount) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    R$ {Number(m.amount || 0).toFixed(2)}
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="treatments" className="space-y-3">
          {treatments.length === 0 ? (
            <Card className="p-4">
              <div className="text-sm text-gray-600">Nenhuma tratativa registrada para este cliente.</div>
            </Card>
          ) : (
            treatments.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{t.treatment_type}</Badge>
                      {t.priority ? <Badge className={getPriorityColor(t.priority)}>{t.priority}</Badge> : null}
                      <Badge variant="outline">{t.status}</Badge>
                    </div>
                    <h4 className="font-medium mt-2">{t.title}</h4>
                    {t.description ? <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{t.description}</p> : null}
                    {t.resolution ? (
                      <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-200">
                        <div className="text-xs text-green-800 font-medium">Resolução</div>
                        <div className="text-sm text-green-900 whitespace-pre-wrap">{t.resolution}</div>
                      </div>
                    ) : null}
                    <p className="text-xs text-gray-500 mt-2">
                      {t.created_by_user ? `Por ${t.created_by_user} • ` : ''}{t.created_at ? new Date(t.created_at).toLocaleString('pt-BR') : ''}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {t.status === 'open' ? (
                      <Button size="sm" variant="outline" onClick={() => updateTreatmentMutation.mutate({ id: t.id, status: 'in_progress', resolution: t.resolution || '' })}>
                        Iniciar
                      </Button>
                    ) : null}
                    {(t.status === 'open' || t.status === 'in_progress') ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          const resolution = window.prompt('Descreva a resolução (opcional):', t.resolution || '') || '';
                          updateTreatmentMutation.mutate({ id: t.id, status: 'resolved', resolution });
                        }}
                      >
                        Resolver
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="vouchers" className="space-y-3">
          {voucherUsages.length === 0 ? (
            <Card className="p-4">
              <div className="text-sm text-gray-600">Nenhum voucher concedido para este cliente.</div>
            </Card>
          ) : (
            voucherUsages.map((v) => (
              <Card key={v.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{v?.vouchers?.name || 'Voucher'}</Badge>
                      {v.redeemed ? <Badge className="bg-green-100 text-green-800">Resgatado</Badge> : <Badge className="bg-yellow-100 text-yellow-800">Não resgatado</Badge>}
                    </div>
                    {v.code ? <div className="mt-2 font-mono text-sm">{v.code}</div> : null}
                    <p className="text-xs text-gray-500 mt-2">
                      {v.created_at ? new Date(v.created_at).toLocaleString('pt-BR') : ''}
                    </p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-3">
          {customer.phone ? (
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">{customer.phone}</div>
              <Button variant="outline" onClick={() => window.open(`https://wa.me/${String(customer.phone).replace(/\D/g, '')}`)}>
                <MessageCircle className="w-4 h-4 mr-2" />
                Abrir WhatsApp
              </Button>
            </div>
          ) : null}
          {whatsappMessages.length === 0 ? (
            <Card className="p-4">
              <div className="text-sm text-gray-600">Sem mensagens registradas para este cliente.</div>
            </Card>
          ) : (
            <div className="space-y-2">
              {whatsappMessages.map((m) => {
                const isOut =
                  m.direction === 'out' ||
                  m.from_me === true ||
                  m.is_outgoing === true ||
                  m.sent === true;
                const text = m.message || m.text || m.content || m.body || '';
                return (
                  <div key={m.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 border ${isOut ? 'bg-green-50 border-green-200' : 'bg-white border-[#e7e7ee]'}`}>
                      <div className="text-sm text-[#121217] whitespace-pre-wrap">{text}</div>
                      <div className="text-[11px] text-[#6c6c89] mt-1">
                        {m.created_at ? new Date(m.created_at).toLocaleString('pt-BR') : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!attachmentsDialogResponseId} onOpenChange={(open) => { if (!open) setAttachmentsDialogResponseId(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Anexos da Resposta</DialogTitle>
          </DialogHeader>
          {attachmentsForDialog.length === 0 ? (
            <div className="text-sm text-gray-600">Nenhum anexo encontrado.</div>
          ) : (
            <div className="space-y-4">
              {attachmentsForDialog.map((a) => {
                const mime = String(a.mime_type || '').toLowerCase();
                const url = a.signed_url;
                const name = a.original_name || a.storage_path || 'arquivo';
                const size = typeof a.size_bytes === 'number' ? `${(a.size_bytes / (1024 * 1024)).toFixed(1)} MB` : null;

                return (
                  <div key={a.id} className="p-4 border rounded-xl bg-white space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{name}</div>
                        <div className="text-xs text-gray-500">{mime || 'arquivo'}{size ? ` • ${size}` : ''}</div>
                      </div>
                      {url ? (
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => window.open(url, '_blank')}>
                          <ExternalLink className="w-4 h-4" />
                          Abrir
                        </Button>
                      ) : null}
                    </div>
                    {url ? (
                      mime.startsWith('image/') ? (
                        <img src={url} alt={name} className="max-h-[360px] w-full object-contain rounded-lg border" />
                      ) : mime.startsWith('video/') ? (
                        <video src={url} controls className="w-full rounded-lg border max-h-[420px]" />
                      ) : mime.startsWith('audio/') ? (
                        <audio src={url} controls className="w-full" />
                      ) : (
                        <div className="text-sm text-gray-600">Pré-visualização indisponível.</div>
                      )
                    ) : (
                      <div className="text-sm text-gray-600">Link temporário indisponível.</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Nova Tarefa */}
      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tarefa de Acompanhamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Ex: Ligar para o cliente"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Detalhes da tarefa..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <select
                  value={newTask.task_type}
                  onChange={(e) => setNewTask({ ...newTask, task_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="follow_up">Acompanhamento</option>
                  <option value="call">Ligação</option>
                  <option value="email">Email</option>
                  <option value="send_survey">Enviar Pesquisa</option>
                </select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Data de Vencimento</Label>
              <Input
                type="datetime-local"
                value={newTask.due_date}
                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createTaskMutation.mutate(newTask)} disabled={!newTask.title}>
                Criar Tarefa
              </Button>
              <Button variant="outline" onClick={() => setShowNewTask(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Nova Nota */}
      <Dialog open={showNewNote} onOpenChange={setShowNewNote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Nota Interna</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input
                value={newNote.title}
                onChange={(e) => setNewNote(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Retorno combinado"
              />
            </div>
            <div>
              <Label>Conteúdo</Label>
              <Textarea
                value={newNote.content}
                onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Digite sua nota..."
                rows={5}
              />
            </div>
            <div>
              <Label>Prioridade</Label>
              <select
                value={newNote.priority}
                onChange={(e) => setNewNote(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createCustomerNoteMutation.mutate(newNote)} disabled={!newNote.content?.trim()}>
                Salvar Nota
              </Button>
              <Button variant="outline" onClick={() => setShowNewNote(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewMovement} onOpenChange={setShowNewMovement}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Movimentação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <select
                value={newMovement.movement_type}
                onChange={(e) => setNewMovement(prev => ({ ...prev, movement_type: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="purchase">Compra</option>
                <option value="credit">Crédito</option>
                <option value="debit">Débito</option>
                <option value="refund">Estorno</option>
              </select>
            </div>
            <div>
              <Label>Valor</Label>
              <Input
                value={newMovement.amount}
                onChange={(e) => setNewMovement(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="Ex: 99.90"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={newMovement.description}
                onChange={(e) => setNewMovement(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detalhes..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Forma de pagamento</Label>
                <select
                  value={newMovement.payment_method}
                  onChange={(e) => setNewMovement(prev => ({ ...prev, payment_method: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="cash">Dinheiro</option>
                  <option value="pix">Pix</option>
                  <option value="credit_card">Cartão de crédito</option>
                  <option value="debit_card">Cartão de débito</option>
                  <option value="transfer">Transferência</option>
                </select>
              </div>
              <div>
                <Label>Status</Label>
                <select
                  value={newMovement.status}
                  onChange={(e) => setNewMovement(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="completed">Concluída</option>
                  <option value="pending">Pendente</option>
                  <option value="canceled">Cancelada</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createMovementMutation.mutate(newMovement)} disabled={!String(newMovement.amount).trim()}>
                Registrar
              </Button>
              <Button variant="outline" onClick={() => setShowNewMovement(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewTreatment} onOpenChange={setShowNewTreatment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tratativa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <select
                value={newTreatment.treatment_type}
                onChange={(e) => setNewTreatment(prev => ({ ...prev, treatment_type: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="complaint_resolution">Resolução de reclamação</option>
                <option value="follow_up">Acompanhamento</option>
                <option value="refund">Reembolso/Estorno</option>
                <option value="other">Outro</option>
              </select>
            </div>
            <div>
              <Label>Título</Label>
              <Input
                value={newTreatment.title}
                onChange={(e) => setNewTreatment(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Resolver reclamação de atraso"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={newTreatment.description}
                onChange={(e) => setNewTreatment(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detalhes..."
              />
            </div>
            <div>
              <Label>Prioridade</Label>
              <select
                value={newTreatment.priority}
                onChange={(e) => setNewTreatment(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createTreatmentMutation.mutate(newTreatment)} disabled={!newTreatment.title?.trim()}>
                Criar Tratativa
              </Button>
              <Button variant="outline" onClick={() => setShowNewTreatment(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showVoucherDialog} onOpenChange={setShowVoucherDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conceder Voucher</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Voucher</Label>
              <select
                value={newVoucherUsage.voucher_id}
                onChange={(e) => setNewVoucherUsage({ voucher_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Selecione...</option>
                {availableVouchers.map(v => (
                  <option key={v.id} value={v.id}>{v.name || v.code || v.id}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => grantVoucherMutation.mutate(newVoucherUsage)} disabled={!newVoucherUsage.voucher_id}>
                Conceder
              </Button>
              <Button variant="outline" onClick={() => setShowVoucherDialog(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
