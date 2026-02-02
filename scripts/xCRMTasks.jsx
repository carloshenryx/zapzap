import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ListTodo, Plus, Filter, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function CRMTasks() {
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['all-crm-tasks', user?.tenant_id],
    queryFn: () => user?.tenant_id
      ? base44.entities.CRMTask.filter({ tenant_id: user.tenant_id }, '-created_date')
      : Promise.resolve([]),
    enabled: !!user?.tenant_id,
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, updates }) => base44.entities.CRMTask.update(taskId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries(['all-crm-tasks']);
      toast.success('Tarefa atualizada!');
    }
  });

  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    return true;
  });

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Tarefas de Acompanhamento</h1>
          <p className="text-gray-600">Gerencie todas as tarefas do CRM</p>
        </div>
      </div>

      <div className="flex gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="all">Todos os Status</option>
          <option value="pending">Pendente</option>
          <option value="in_progress">Em Progresso</option>
          <option value="completed">Concluída</option>
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="all">Todas as Prioridades</option>
          <option value="urgent">Urgente</option>
          <option value="high">Alta</option>
          <option value="medium">Média</option>
          <option value="low">Baixa</option>
        </select>
      </div>

      <div className="grid gap-3">
        {filteredTasks.map((task) => (
          <Card key={task.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {getStatusIcon(task.status)}
                <div className="flex-1">
                  <h4 className="font-medium">{task.title}</h4>
                  <p className="text-sm text-gray-600">{task.customer_name} - {task.customer_email}</p>
                  {task.description && <p className="text-sm text-gray-500 mt-1">{task.description}</p>}
                  <div className="flex gap-2 mt-2">
                    <Badge className={getPriorityColor(task.priority)}>
                      {task.priority}
                    </Badge>
                    <Badge variant="outline">{task.task_type}</Badge>
                    {task.due_date && (
                      <Badge variant="outline">
                        Vence: {new Date(task.due_date).toLocaleDateString('pt-BR')}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {task.status === 'pending' && (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => updateTaskMutation.mutate({ 
                        taskId: task.id, 
                        updates: { status: 'in_progress' }
                      })}
                    >
                      Iniciar
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => updateTaskMutation.mutate({ 
                        taskId: task.id, 
                        updates: { status: 'completed', completed_date: new Date().toISOString() }
                      })}
                    >
                      Concluir
                    </Button>
                  </>
                )}
                {task.status === 'in_progress' && (
                  <Button 
                    size="sm"
                    onClick={() => updateTaskMutation.mutate({ 
                      taskId: task.id, 
                      updates: { status: 'completed', completed_date: new Date().toISOString() }
                    })}
                  >
                    Concluir
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}