import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const columns = [
  { id: 'promoters', title: 'Promotores', color: 'green', filter: (c) => c.avgRating >= 4 },
  { id: 'passives', title: 'Neutros', color: 'yellow', filter: (c) => c.avgRating === 3 },
  { id: 'detractors', title: 'Detratores', color: 'red', filter: (c) => c.avgRating < 3 && c.avgRating > 0 },
  { id: 'no_rating', title: 'Sem Avaliação', color: 'gray', filter: (c) => c.avgRating === 0 }
];

export default function KanbanView({ customers, onCustomerClick }) {
  const getNPSIcon = (rating) => {
    if (rating >= 4) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (rating === 3) return <Minus className="w-4 h-4 text-yellow-600" />;
    if (rating > 0) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      {columns.map((column) => {
        const filteredCustomers = customers.filter(column.filter);
        
        return (
          <div key={column.id} className="space-y-3">
            <div className={`bg-${column.color}-50 border border-${column.color}-200 rounded-lg p-3`}>
              <h3 className={`font-semibold text-${column.color}-700`}>
                {column.title}
                <span className="ml-2 text-sm">({filteredCustomers.length})</span>
              </h3>
            </div>
            
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredCustomers.map((customer) => (
                <Card
                  key={customer.email}
                  className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onCustomerClick(customer)}
                >
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <h4 className="font-medium text-sm truncate">{customer.name}</h4>
                        {getNPSIcon(customer.avgRating)}
                      </div>
                      <p className="text-xs text-gray-600 truncate">{customer.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          <span className="text-xs font-medium">{customer.avgRating.toFixed(1)}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {customer.totalResponses} respostas
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}