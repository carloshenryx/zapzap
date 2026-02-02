import React from 'react';
import { Zap } from 'lucide-react';

export default function CRMAutomations() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Zap className="w-8 h-8 text-yellow-600" />
        <div>
          <h1 className="text-2xl font-bold">Automações CRM</h1>
          <p className="text-gray-600">Configure automações para envio de pesquisas e criação de tarefas</p>
        </div>
      </div>
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 text-center">
        <p className="text-purple-800">Funcionalidade de automação em desenvolvimento</p>
        <p className="text-sm text-purple-600 mt-2">Em breve você poderá configurar gatilhos e ações automáticas</p>
      </div>
    </div>
  );
}