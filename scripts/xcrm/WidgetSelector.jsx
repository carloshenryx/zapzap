import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  TrendingUp, 
  CheckCircle2, 
  Users, 
  MessageCircle,
  BarChart3,
  Activity
} from 'lucide-react';

const availableWidgets = [
  { id: 'nps_history', name: 'Histórico de NPS', icon: TrendingUp, description: 'Evolução do NPS ao longo do tempo' },
  { id: 'task_performance', name: 'Desempenho de Tarefas', icon: CheckCircle2, description: 'Análise por agente' },
  { id: 'customer_stats', name: 'Estatísticas de Clientes', icon: Users, description: 'Métricas gerais' },
  { id: 'recent_interactions', name: 'Interações Recentes', icon: MessageCircle, description: 'Últimas atividades' },
  { id: 'sentiment_trends', name: 'Tendências de Sentimento', icon: BarChart3, description: 'Análise de sentimento' },
  { id: 'response_rate', name: 'Taxa de Resposta', icon: Activity, description: 'Taxa de conclusão de pesquisas' }
];

export default function WidgetSelector({ open, onOpenChange, activeWidgets, onToggleWidget }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecionar Widgets</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          {availableWidgets.map((widget) => {
            const Icon = widget.icon;
            const isActive = activeWidgets.includes(widget.id);
            
            return (
              <div
                key={widget.id}
                onClick={() => onToggleWidget(widget.id)}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  isActive ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox checked={isActive} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4" />
                      <h4 className="font-medium">{widget.name}</h4>
                    </div>
                    <p className="text-xs text-gray-600">{widget.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}