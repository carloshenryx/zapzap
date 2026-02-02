import React from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function CompletionRate({ responses, templates }) {
  const activeTemplate = templates.find(t => t.is_active);
  
  if (!activeTemplate) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Taxa de Conclusão</h3>
        <p className="text-sm text-slate-500">Nenhum template ativo</p>
      </Card>
    );
  }

  const totalQuestions = activeTemplate.questions.length;
  const completedResponses = responses.filter(r => {
    const answeredQuestions = Object.keys(r.custom_answers || {}).length;
    return answeredQuestions === totalQuestions;
  });

  const partialResponses = responses.filter(r => {
    const answeredQuestions = Object.keys(r.custom_answers || {}).length;
    return answeredQuestions > 0 && answeredQuestions < totalQuestions;
  });

  const abandonedResponses = responses.length - completedResponses.length - partialResponses.length;

  const completionRate = responses.length > 0 
    ? ((completedResponses.length / responses.length) * 100).toFixed(1)
    : 0;

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Taxa de Conclusão</h3>
      
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-4xl font-bold text-green-600 mb-2">{completionRate}%</div>
          <Progress value={parseFloat(completionRate)} className="h-3" />
        </div>

        <div className="grid grid-cols-3 gap-3 pt-4 border-t">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-lg font-bold text-green-600">{completedResponses.length}</span>
            </div>
            <p className="text-xs text-slate-500">Completas</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="text-lg font-bold text-amber-600">{partialResponses.length}</span>
            </div>
            <p className="text-xs text-slate-500">Parciais</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-lg font-bold text-red-600">{abandonedResponses}</span>
            </div>
            <p className="text-xs text-slate-500">Abandonadas</p>
          </div>
        </div>
      </div>
    </Card>
  );
}