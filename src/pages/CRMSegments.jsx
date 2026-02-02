import React from 'react';
import { UserCheck } from 'lucide-react';

export default function CRMSegments() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <UserCheck className="w-8 h-8 text-purple-600" />
        <div>
          <h1 className="text-2xl font-bold">Segmentos de Clientes</h1>
          <p className="text-gray-600">Crie e gerencie segmentos para campanhas direcionadas</p>
        </div>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
        <p className="text-blue-800">Funcionalidade de segmentação em desenvolvimento</p>
        <p className="text-sm text-blue-600 mt-2">Em breve você poderá criar segmentos dinâmicos baseados em métricas de pesquisa</p>
      </div>
    </div>
  );
}