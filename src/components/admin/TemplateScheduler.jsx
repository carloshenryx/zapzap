import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function TemplateScheduler({ userTenantId, templates }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleType, setScheduleType] = useState('sequential_responses');
  const [formData, setFormData] = useState({
    name: '',
    is_active: true,
    schedule_type: 'sequential_responses',
    sequential_config: { steps: [{ template_id: '', response_threshold: 10 }] },
    periodic_config: { frequency: 'daily', template_id: '', time: '09:00', day_of_week: 0 },
    date_config: { date: '', time: '09:00', template_id: '' },
    holiday_config: { holidays: [] }
  });

  const queryClient = useQueryClient();

  const { data: schedules = [] } = useQuery({
    queryKey: ['template-schedules', userTenantId],
    queryFn: () => base44.entities.TemplateSchedule.filter({ tenant_id: userTenantId }),
    enabled: !!userTenantId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TemplateSchedule.create({ ...data, tenant_id: userTenantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-schedules', userTenantId] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Programação criada com sucesso!');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      is_active: true,
      schedule_type: 'sequential_responses',
      sequential_config: { steps: [{ template_id: '', response_threshold: 10 }] },
      periodic_config: { frequency: 'daily', template_id: '', time: '09:00', day_of_week: 0 },
      date_config: { date: '', time: '09:00', template_id: '' },
      holiday_config: { holidays: [] }
    });
    setEditingSchedule(null);
  };

  return (
    <div className="space-y-4">
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button onClick={resetForm} className="gap-2">
            <Clock className="w-4 h-4" />
            Programar Templates
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Programação de Templates</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Programação</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Pesquisa por Período"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Agendamento</Label>
              <Select value={formData.schedule_type} onValueChange={(val) => {
                setFormData({ ...formData, schedule_type: val });
                setScheduleType(val);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential_responses">Fluxo Sequencial (por Respostas)</SelectItem>
                  <SelectItem value="periodic">Periódico (Diário/Semanal/Mensal)</SelectItem>
                  <SelectItem value="date_specific">Data Específica</SelectItem>
                  <SelectItem value="holiday">Datas Comemorativas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fluxo Sequencial */}
            {scheduleType === 'sequential_responses' && (
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                <Label className="text-sm font-semibold">Templates em Sequência</Label>
                {formData.sequential_config.steps.map((step, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Select value={step.template_id} onValueChange={(val) => {
                      const newSteps = [...formData.sequential_config.steps];
                      newSteps[idx].template_id = val;
                      setFormData({ ...formData, sequential_config: { steps: newSteps } });
                    }}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="1"
                      className="w-24"
                      value={step.response_threshold}
                      onChange={(e) => {
                        const newSteps = [...formData.sequential_config.steps];
                        newSteps[idx].response_threshold = parseInt(e.target.value);
                        setFormData({ ...formData, sequential_config: { steps: newSteps } });
                      }}
                      placeholder="Respostas"
                    />
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newSteps = [...formData.sequential_config.steps, { template_id: '', response_threshold: 10 }];
                    setFormData({ ...formData, sequential_config: { steps: newSteps } });
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Adicionar Step
                </Button>
              </div>
            )}

            {/* Periódico */}
            {scheduleType === 'periodic' && (
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                <Select value={formData.periodic_config.frequency} onValueChange={(val) => {
                  setFormData({
                    ...formData,
                    periodic_config: { ...formData.periodic_config, frequency: val }
                  });
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="time"
                  value={formData.periodic_config.time}
                  onChange={(e) => setFormData({
                    ...formData,
                    periodic_config: { ...formData.periodic_config, time: e.target.value }
                  })}
                />
                <Select value={formData.periodic_config.template_id} onValueChange={(val) => {
                  setFormData({
                    ...formData,
                    periodic_config: { ...formData.periodic_config, template_id: val }
                  });
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Data Específica */}
            {scheduleType === 'date_specific' && (
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                <Input
                  type="date"
                  value={formData.date_config.date}
                  onChange={(e) => setFormData({
                    ...formData,
                    date_config: { ...formData.date_config, date: e.target.value }
                  })}
                />
                <Input
                  type="time"
                  value={formData.date_config.time}
                  onChange={(e) => setFormData({
                    ...formData,
                    date_config: { ...formData.date_config, time: e.target.value }
                  })}
                />
                <Select value={formData.date_config.template_id} onValueChange={(val) => {
                  setFormData({
                    ...formData,
                    date_config: { ...formData.date_config, template_id: val }
                  });
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(val) => setFormData({ ...formData, is_active: val })}
              />
              <Label>Ativo</Label>
            </div>

            <Button onClick={() => createMutation.mutate(formData)} className="w-full">
              Criar Programação
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {schedules.length > 0 && (
        <div className="space-y-2 mt-4">
          {schedules.map(sched => (
            <div key={sched.id} className="p-3 bg-white border rounded-lg flex justify-between items-center">
              <div>
                <p className="font-medium text-sm">{sched.name}</p>
                <p className="text-xs text-slate-500">{sched.schedule_type}</p>
              </div>
              <Switch checked={sched.is_active} disabled />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}