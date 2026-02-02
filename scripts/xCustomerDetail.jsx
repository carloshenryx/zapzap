import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
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
  Send,
  FileText,
  Zap,
  DollarSign,
  Gift,
  TrendingUp,
  TrendingDown,
  Edit,
  Trash2,
  Pin,
  Tag,
  User,
  CreditCard
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

export default function CustomerDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const customerEmail = urlParams.get('email');

  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewNote, setShowNewNote] = useState(false);
  const [showNewMovement, setShowNewMovement] = useState(false);
  const [showNewTreatment, setShowNewTreatment] = useState(false);
  const [showVoucherDialog, setShowVoucherDialog] = useState(false);
  
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
    tags: []
  });
  
  const [newMovement, setNewMovement] = useState({
    movement_type: 'purchase',
    description: '',
    amount: 0,
    payment_method: 'cash',
    status: 'completed'
  });
  
  const [newTreatment, setNewTreatment] = useState({
    treatment_type: 'complaint_resolution',
    title: '',
    description: '',
    priority: 'medium'
  });
  
  const [newVoucherUsage, setNewVoucherUsage] = useState({
    voucher_id: '',
    code: ''
  });

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['customer-responses', customerEmail],
    queryFn: () => base44.entities.SurveyResponse.filter({ 
      customer_email: customerEmail,
      tenant_id: user.tenant_id 
    }, '-created_date'),
    enabled: !!customerEmail && !!user?.tenant_id,
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ['customer-interactions', customerEmail],
    queryFn: () => base44.entities.CustomerInteraction.filter({ 
      customer_email: customerEmail,
      tenant_id: user.tenant_id 
    }, '-created_date'),
    enabled: !!customerEmail && !!user?.tenant_id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['customer-tasks', customerEmail],
    queryFn: () => base44.entities.CRMTask.filter({ 
      customer_email: customerEmail,
      tenant_id: user.tenant_id 
    }, '-created_date'),
    enabled: !!customerEmail && !!user?.tenant_id,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['customer-notes', customerEmail],
    queryFn: () => base44.entities.CustomerNote.filter({ 
      customer_email: customerEmail,
      tenant_id: user.tenant_id 
    }, '-created_date'),
    enabled: !!customerEmail && !!user?.tenant_id,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ['customer-movements', customerEmail],
    queryFn: () => base44.entities.CustomerMovement.filter({ 
      customer_email: customerEmail,
      tenant_id: user.tenant_id 
    }, '-created_date'),
    enabled: !!customerEmail && !!user?.tenant_id,
  });

  const { data: treatments = [] } = useQuery({
    queryKey: ['customer-treatments', customerEmail],
    queryFn: () => base44.entities.CustomerTreatment.filter({ 
      customer_email: customerEmail,
      tenant_id: user.tenant_id 
    }, '-created_date'),
    enabled: !!customerEmail && !!user?.tenant_id,
  });

  const { data: voucherUsages = [] } = useQuery({
    queryKey: ['customer-vouchers', customerEmail],
    queryFn: () => base44.entities.VoucherUsage.filter({ 
      customer_email: customerEmail,
      tenant_id: user.tenant_id 
    }, '-created_date'),
    enabled: !!customerEmail && !!user?.tenant_id,
  });

  const { data: availableVouchers = [] } = useQuery({
    queryKey: ['available-vouchers'],
    queryFn: () => base44.entities.Voucher.filter({ 
      tenant_id: user.tenant_id,
      is_active: true
    }),
    enabled: !!user?.tenant_id,
  });

  const createTaskMutation = useMutation({
    mutationFn: (taskData) => base44.entities.CRMTask.create({
      ...taskData,
      tenant_id: user.tenant_id,
      customer_email: customerEmail,
      customer_name: customer?.name || 'Cliente',
      assigned_to: user.email
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['customer-tasks']);
      setShowNewTask(false);
      setNewTask({ title: '', description: '', task_type: 'follow_up', priority: 'medium', due_date: '' });
      toast.success('Tarefa criada com sucesso!');
    }
  });

  const createNoteMutation = useMutation({
    mutationFn: (noteData) => base44.entities.CustomerNote.create({
      ...noteData,
      tenant_id: user.tenant_id,
      customer_email: customerEmail,
      customer_name: customer?.name || 'Cliente',
      created_by_user: user.email
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['customer-notes']);
      setShowNewNote(false);
      setNewNote({ title: '', content: '', note_type: 'internal', priority: 'medium', tags: [] });
      toast.success('Nota adicionada com sucesso!');
    }
  });

  const createMovementMutation = useMutation({
    mutationFn: (movementData) => {
      const previousBalance = movements.length > 0 ? movements[0].balance_after : 0;
      const newBalance = previousBalance + parseFloat(movementData.amount);
      
      return base44.entities.CustomerMovement.create({
        ...movementData,
        tenant_id: user.tenant_id,
        customer_email: customerEmail,
        customer_name: customer?.name || 'Cliente',
        balance_after: newBalance,
        created_by_user: user.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['customer-movements']);
      setShowNewMovement(false);
      setNewMovement({ movement_type: 'purchase', description: '', amount: 0, payment_method: 'cash', status: 'completed' });
      toast.success('Movimentação registrada!');
    }
  });

  const createTreatmentMutation = useMutation({
    mutationFn: (treatmentData) => base44.entities.CustomerTreatment.create({
      ...treatmentData,
      tenant_id: user.tenant_id,
      customer_email: customerEmail,
      customer_name: customer?.name || 'Cliente',
      started_at: new Date().toISOString(),
      actions_taken: []
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['customer-treatments']);
      setShowNewTreatment(false);
      setNewTreatment({ treatment_type: 'complaint_resolution', title: '', description: '', priority: 'medium' });
      toast.success('Tratativa criada!');
    }
  });

  const createVoucherUsageMutation = useMutation({
    mutationFn: async (voucherData) => {
      const voucher = availableVouchers.find(v => v.id === voucherData.voucher_id);
      if (!voucher) throw new Error('Voucher não encontrado');
      
      if (voucher.usage_limit && voucher.current_usage >= voucher.usage_limit) {
        throw new Error('Limite de uso do voucher atingido');
      }

      // Criar usage
      await base44.entities.VoucherUsage.create({
        tenant_id: user.tenant_id,
        voucher_id: voucherData.voucher_id,
        customer_email: customerEmail,
        customer_name: customer?.name || 'Cliente',
        code: voucherData.code || `VOUCHER-${Date.now()}`,
        used_at: new Date().toISOString()
      });

      // Incrementar contador
      await base44.entities.Voucher.update(voucher.id, {
        current_usage: (voucher.current_usage || 0) + 1
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['customer-vouchers']);
      queryClient.invalidateQueries(['available-vouchers']);
      setShowVoucherDialog(false);
      setNewVoucherUsage({ voucher_id: '', code: '' });
      toast.success('Voucher concedido!');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao conceder voucher');
    }
  });

  const updateTreatmentMutation = useMutation({
    mutationFn: ({ id, status, resolution }) => base44.entities.CustomerTreatment.update(id, {
      status,
      resolution,
      ...(status === 'resolved' || status === 'closed' ? { resolved_at: new Date().toISOString() } : {})
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['customer-treatments']);
      toast.success('Tratativa atualizada!');
    }
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId) => base44.entities.CustomerNote.delete(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries(['customer-notes']);
      toast.success('Nota excluída!');
    }
  });

  const pinNoteMutation = useMutation({
    mutationFn: ({ noteId, isPinned }) => base44.entities.CustomerNote.update(noteId, { is_pinned: isPinned }),
    onSuccess: () => {
      queryClient.invalidateQueries(['customer-notes']);
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, status }) => base44.entities.CRMTask.update(taskId, { 
      status,
      ...(status === 'completed' && { completed_date: new Date().toISOString() })
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['customer-tasks']);
      toast.success('Status da tarefa atualizado!');
    }
  });

  if (!customerEmail) {
    return <div className="p-6">Cliente não encontrado</div>;
  }

  const customer = responses.length > 0 ? {
    name: responses[0].customer_name || 'Anônimo',
    email: customerEmail,
    phone: responses[0].customer_phone,
    cpf: responses[0].customer_cpf
  } : { name: 'Cliente', email: customerEmail };

  const avgRating = responses.length > 0
    ? responses.filter(r => r.overall_rating).reduce((sum, r) => sum + r.overall_rating, 0) / responses.filter(r => r.overall_rating).length
    : 0;

  const lastResponse = responses[0];
  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const openTreatments = treatments.filter(t => t.status === 'open' || t.status === 'in_progress');
  const currentBalance = movements.length > 0 ? movements[0].balance_after : 0;
  const totalSpent = movements.filter(m => m.movement_type === 'purchase').reduce((sum, m) => sum + (m.amount || 0), 0);
  const pinnedNotes = notes.filter(n => n.is_pinned).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  const regularNotes = notes.filter(n => !n.is_pinned).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  const allActivity = [
    ...responses.map(r => ({ ...r, type: 'survey_response', date: r.created_date })),
    ...interactions.map(i => ({ ...i, type: i.interaction_type, date: i.created_date })),
    ...tasks.map(t => ({ ...t, type: 'task', date: t.created_date }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const getActivityIcon = (type) => {
    const icons = {
      survey_response: <FileText className="w-4 h-4" />,
      whatsapp_message: <MessageCircle className="w-4 h-4" />,
      email_sent: <Mail className="w-4 h-4" />,
      phone_call: <Phone className="w-4 h-4" />,
      internal_note: <FileText className="w-4 h-4" />,
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
          <p className="text-gray-600">{customer.email}</p>
        </div>
        <div className="flex gap-2">
          {customer.phone && (
            <Button variant="outline" onClick={() => window.open(`https://wa.me/${customer.phone.replace(/\D/g, '')}`)}>
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowNewNote(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nota
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
            Tarefa
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
              <p className="text-2xl font-bold">{voucherUsages.length}</p>
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
              <p className="text-2xl font-bold">{notes.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Notas ({notes.length})</TabsTrigger>
          <TabsTrigger value="movements">Movimentações ({movements.length})</TabsTrigger>
          <TabsTrigger value="treatments">Tratativas ({treatments.length})</TabsTrigger>
          <TabsTrigger value="vouchers">Vouchers ({voucherUsages.length})</TabsTrigger>
          <TabsTrigger value="surveys">Pesquisas ({responses.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas ({tasks.length})</TabsTrigger>
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
                      {activity.type === 'task' && `Tarefa: ${activity.title}`}
                      {activity.type === 'whatsapp_message' && 'Mensagem WhatsApp enviada'}
                    </p>
                    <span className="text-xs text-gray-500">
                      {new Date(activity.date).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  {activity.type === 'survey_response' && activity.overall_rating && (
                    <div className="flex gap-1 mb-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < activity.overall_rating ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`} />
                      ))}
                    </div>
                  )}
                  {activity.comment && <p className="text-sm text-gray-600">{activity.comment}</p>}
                  {activity.content && <p className="text-sm text-gray-600">{activity.content}</p>}
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
                  <div className="flex gap-1 mb-2">
                    {response.overall_rating && Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < response.overall_rating ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`} />
                    ))}
                  </div>
                  {response.comment && <p className="text-sm text-gray-700 mb-2">{response.comment}</p>}
                  {response.sentiment && (
                    <Badge variant="outline" className={
                      response.sentiment === 'positive' ? 'border-green-500 text-green-700' :
                      response.sentiment === 'negative' ? 'border-red-500 text-red-700' :
                      'border-gray-500 text-gray-700'
                    }>
                      {response.sentiment === 'positive' ? 'Positivo' : response.sentiment === 'negative' ? 'Negativo' : 'Neutro'}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(response.created_date).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Tarefas */}
        <TabsContent value="tasks" className="space-y-3">
          {tasks.map((task) => (
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
                        <Badge variant="outline">
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
          {pinnedNotes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Pin className="w-4 h-4" /> Notas Fixadas
              </h3>
              {pinnedNotes.map((note) => (
                <Card key={note.id} className="p-4 border-2 border-blue-200 bg-blue-50/30">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      {note.title && <h4 className="font-semibold text-gray-900 mb-1">{note.title}</h4>}
                      <p className="text-sm text-gray-700">{note.content}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge className={getPriorityColor(note.priority)}>{note.priority}</Badge>
                        {note.note_type && <Badge variant="outline">{note.note_type}</Badge>}
                        {note.tags?.map(tag => <Badge key={tag} variant="outline"><Tag className="w-3 h-3 mr-1" />{tag}</Badge>)}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Por {note.created_by_user} em {new Date(note.created_date).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => pinNoteMutation.mutate({ noteId: note.id, isPinned: false })}>
                        <Pin className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteNoteMutation.mutate(note.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
          
          {regularNotes.length > 0 && pinnedNotes.length > 0 && <hr className="my-4" />}
          
          {regularNotes.map((note) => (
            <Card key={note.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {note.title && <h4 className="font-semibold text-gray-900 mb-1">{note.title}</h4>}
                  <p className="text-sm text-gray-700">{note.content}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge className={getPriorityColor(note.priority)}>{note.priority}</Badge>
                    {note.note_type && <Badge variant="outline">{note.note_type}</Badge>}
                    {note.tags?.map(tag => <Badge key={tag} variant="outline"><Tag className="w-3 h-3 mr-1" />{tag}</Badge>)}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Por {note.created_by_user} em {new Date(note.created_date).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => pinNoteMutation.mutate({ noteId: note.id, isPinned: true })}>
                    <Pin className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteNoteMutation.mutate(note.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Movimentações */}
        <TabsContent value="movements" className="space-y-3">
          <Card className="p-4 bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Saldo Atual</p>
                <p className={`text-3xl font-bold ${currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  R$ {currentBalance.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Total Gasto</p>
                <p className="text-2xl font-bold text-gray-900">R$ {totalSpent.toFixed(2)}</p>
              </div>
            </div>
          </Card>
          
          {movements.map((movement) => (
            <Card key={movement.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    movement.amount > 0 ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {movement.amount > 0 ? <TrendingUp className="w-5 h-5 text-green-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
                  </div>
                  <div>
                    <h4 className="font-semibold">{movement.description}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {movement.movement_type.replace('_', ' ')} • {movement.payment_method}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">{movement.status}</Badge>
                      {movement.reference_id && <Badge variant="outline">Ref: {movement.reference_id}</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(movement.created_date).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${movement.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {movement.amount > 0 ? '+' : ''} R$ {movement.amount.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600">Saldo: R$ {movement.balance_after.toFixed(2)}</p>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Tratativas */}
        <TabsContent value="treatments" className="space-y-3">
          {treatments.map((treatment) => (
            <Card key={treatment.id} className={`p-4 ${
              treatment.status === 'open' || treatment.status === 'in_progress' ? 'border-2 border-orange-200' : ''
            }`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-gray-900">{treatment.title}</h4>
                    <Badge className={
                      treatment.status === 'resolved' ? 'bg-green-100 text-green-700' :
                      treatment.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }>
                      {treatment.status}
                    </Badge>
                    <Badge className={getPriorityColor(treatment.priority)}>{treatment.priority}</Badge>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{treatment.description}</p>
                  {treatment.resolution && (
                    <div className="bg-green-50 p-2 rounded mt-2">
                      <p className="text-sm text-green-800"><strong>Resolução:</strong> {treatment.resolution}</p>
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline">{treatment.treatment_type.replace('_', ' ')}</Badge>
                    {treatment.assigned_to && <Badge variant="outline"><User className="w-3 h-3 mr-1" />{treatment.assigned_to}</Badge>}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Criada em {new Date(treatment.started_at || treatment.created_date).toLocaleString('pt-BR')}
                    {treatment.resolved_at && ` • Resolvida em ${new Date(treatment.resolved_at).toLocaleString('pt-BR')}`}
                  </p>
                </div>
                {(treatment.status === 'open' || treatment.status === 'in_progress') && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateTreatmentMutation.mutate({ 
                      id: treatment.id, 
                      status: 'resolved',
                      resolution: 'Resolvido pelo operador'
                    })}>
                      Resolver
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Vouchers */}
        <TabsContent value="vouchers" className="space-y-3">
          {voucherUsages.map((usage) => {
            const voucher = availableVouchers.find(v => v.id === usage.voucher_id);
            return (
              <Card key={usage.id} className="p-4 bg-purple-50 border-purple-200">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    <Gift className="w-10 h-10 text-purple-600" />
                    <div>
                      <h4 className="font-semibold text-gray-900">{voucher?.name || 'Voucher'}</h4>
                      <p className="text-lg font-mono font-bold text-purple-700 mt-1">{usage.code}</p>
                      {voucher && (
                        <div className="mt-2">
                          {voucher.type === 'discount_percentage' && (
                            <Badge className="bg-purple-600 text-white">{voucher.discount_percentage}% OFF</Badge>
                          )}
                          {voucher.type === 'discount_fixed' && (
                            <Badge className="bg-purple-600 text-white">R$ {voucher.discount_fixed} OFF</Badge>
                          )}
                          {voucher.type === 'gift' && (
                            <Badge className="bg-purple-600 text-white">Brinde</Badge>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-gray-600 mt-2">
                        Concedido em {new Date(usage.used_at || usage.created_date).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <Badge variant={usage.redeemed ? 'outline' : 'default'} className={usage.redeemed ? 'bg-gray-100' : 'bg-green-100 text-green-700'}>
                    {usage.redeemed ? 'Utilizado' : 'Disponível'}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

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
            <DialogTitle>Nova Nota</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input
                value={newNote.title}
                onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                placeholder="Título da nota"
              />
            </div>
            <div>
              <Label>Conteúdo</Label>
              <Textarea
                value={newNote.content}
                onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                placeholder="Digite sua nota..."
                rows={5}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <select
                  value={newNote.note_type}
                  onChange={(e) => setNewNote({ ...newNote, note_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="internal">Interna</option>
                  <option value="follow_up">Acompanhamento</option>
                  <option value="complaint">Reclamação</option>
                  <option value="feedback">Feedback</option>
                  <option value="meeting">Reunião</option>
                  <option value="call">Ligação</option>
                </select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <select
                  value={newNote.priority}
                  onChange={(e) => setNewNote({ ...newNote, priority: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createNoteMutation.mutate(newNote)} disabled={!newNote.content}>
                Salvar Nota
              </Button>
              <Button variant="outline" onClick={() => setShowNewNote(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Nova Movimentação */}
      <Dialog open={showNewMovement} onOpenChange={setShowNewMovement}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Movimentação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Descrição</Label>
              <Input
                value={newMovement.description}
                onChange={(e) => setNewMovement({ ...newMovement, description: e.target.value })}
                placeholder="Ex: Compra de produto X"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <select
                  value={newMovement.movement_type}
                  onChange={(e) => setNewMovement({ ...newMovement, movement_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="purchase">Compra</option>
                  <option value="payment">Pagamento</option>
                  <option value="refund">Reembolso</option>
                  <option value="discount">Desconto</option>
                  <option value="credit">Crédito</option>
                  <option value="debit">Débito</option>
                  <option value="voucher_usage">Uso de Voucher</option>
                  <option value="service">Serviço</option>
                </select>
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newMovement.amount}
                  onChange={(e) => setNewMovement({ ...newMovement, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Método de Pagamento</Label>
                <select
                  value={newMovement.payment_method}
                  onChange={(e) => setNewMovement({ ...newMovement, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="cash">Dinheiro</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="debit_card">Cartão de Débito</option>
                  <option value="pix">PIX</option>
                  <option value="transfer">Transferência</option>
                  <option value="voucher">Voucher</option>
                </select>
              </div>
              <div>
                <Label>Status</Label>
                <select
                  value={newMovement.status}
                  onChange={(e) => setNewMovement({ ...newMovement, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="completed">Concluído</option>
                  <option value="pending">Pendente</option>
                  <option value="cancelled">Cancelado</option>
                  <option value="refunded">Reembolsado</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createMovementMutation.mutate(newMovement)} disabled={!newMovement.description || newMovement.amount === 0}>
                Registrar
              </Button>
              <Button variant="outline" onClick={() => setShowNewMovement(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Nova Tratativa */}
      <Dialog open={showNewTreatment} onOpenChange={setShowNewTreatment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tratativa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input
                value={newTreatment.title}
                onChange={(e) => setNewTreatment({ ...newTreatment, title: e.target.value })}
                placeholder="Ex: Reclamação sobre produto"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={newTreatment.description}
                onChange={(e) => setNewTreatment({ ...newTreatment, description: e.target.value })}
                placeholder="Descreva o problema ou situação..."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <select
                  value={newTreatment.treatment_type}
                  onChange={(e) => setNewTreatment({ ...newTreatment, treatment_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="complaint_resolution">Resolução de Reclamação</option>
                  <option value="feedback_response">Resposta a Feedback</option>
                  <option value="recovery">Recuperação</option>
                  <option value="follow_up">Acompanhamento</option>
                  <option value="retention">Retenção</option>
                </select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <select
                  value={newTreatment.priority}
                  onChange={(e) => setNewTreatment({ ...newTreatment, priority: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createTreatmentMutation.mutate(newTreatment)} disabled={!newTreatment.title || !newTreatment.description}>
                Criar Tratativa
              </Button>
              <Button variant="outline" onClick={() => setShowNewTreatment(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Conceder Voucher */}
      <Dialog open={showVoucherDialog} onOpenChange={setShowVoucherDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conceder Voucher</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Selecione o Voucher</Label>
              <select
                value={newVoucherUsage.voucher_id}
                onChange={(e) => setNewVoucherUsage({ ...newVoucherUsage, voucher_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Selecione...</option>
                {availableVouchers.map(voucher => (
                  <option key={voucher.id} value={voucher.id}>
                    {voucher.name} - {voucher.type === 'discount_percentage' ? `${voucher.discount_percentage}% OFF` : `R$ ${voucher.discount_fixed} OFF`}
                    {voucher.usage_limit && ` (${voucher.current_usage || 0}/${voucher.usage_limit} usados)`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Código (opcional - será gerado automaticamente)</Label>
              <Input
                value={newVoucherUsage.code}
                onChange={(e) => setNewVoucherUsage({ ...newVoucherUsage, code: e.target.value })}
                placeholder="CODIGO123"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createVoucherUsageMutation.mutate(newVoucherUsage)} disabled={!newVoucherUsage.voucher_id}>
                Conceder Voucher
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