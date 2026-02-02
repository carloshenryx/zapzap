import React from 'react';
import { Calendar, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export default function PeriodFilter({ 
  selectedPeriod, 
  onPeriodChange,
  customDateRange,
  onCustomDateChange 
}) {
  const periods = [
    { value: 'today', label: 'Hoje' },
    { value: 'week', label: 'Esta Semana' },
    { value: 'month', label: 'Este Mês' },
    { value: 'quarter', label: 'Este Trimestre' },
    { value: 'year', label: 'Este Ano' },
    { value: 'all', label: 'Todos os Períodos' },
    { value: 'custom', label: 'Personalizado' }
  ];

  return (
    <div className="flex items-center gap-3">
      <Filter className="w-4 h-4 text-slate-500" />
      <Select value={selectedPeriod} onValueChange={onPeriodChange}>
        <SelectTrigger className="w-48">
          <Calendar className="w-4 h-4 mr-2" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {periods.map(period => (
            <SelectItem key={period.value} value={period.value}>
              {period.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedPeriod === 'custom' && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Calendar className="w-4 h-4" />
              Definir Período
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Data Inicial</Label>
                <Input
                  type="date"
                  value={customDateRange?.start || ''}
                  onChange={(e) => onCustomDateChange({ ...customDateRange, start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Data Final</Label>
                <Input
                  type="date"
                  value={customDateRange?.end || ''}
                  onChange={(e) => onCustomDateChange({ ...customDateRange, end: e.target.value })}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}