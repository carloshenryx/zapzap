import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export default function AdvancedFilters({
  show,
  templates,
  selectedTemplate,
  setSelectedTemplate,
  dateFilter,
  setDateFilter,
  ratingFilter,
  setRatingFilter,
  npsSegmentFilter,
  setNpsSegmentFilter,
  onReset
}) {
  const hasActiveFilters = selectedTemplate !== 'all' || dateFilter.start || dateFilter.end || 
                           ratingFilter.min !== 0 || ratingFilter.max !== 5 || npsSegmentFilter !== 'all';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-white rounded-xl border border-[#d1d1db] p-6 space-y-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#121217]">Filtros Avançados</h3>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={onReset} className="text-red-600">
                <X className="w-4 h-4 mr-1" />
                Limpar Filtros
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filtro por Template */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Template de Pesquisa</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os templates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os templates</SelectItem>
                  {templates.filter(t => t.is_active).map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      ✓ {template.name}
                    </SelectItem>
                  ))}
                  {templates.filter(t => !t.is_active).map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      ⊗ {template.name} (Inativo)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Data Inicial */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Data Inicial</Label>
              <Input
                type="date"
                value={dateFilter.start}
                onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
              />
            </div>

            {/* Filtro por Data Final */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Data Final</Label>
              <Input
                type="date"
                value={dateFilter.end}
                onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
              />
            </div>

            {/* Filtro por Segmento NPS */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Segmento NPS</Label>
              <Select value={npsSegmentFilter} onValueChange={setNpsSegmentFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os segmentos</SelectItem>
                  <SelectItem value="promoters">🟢 Promotores (4.5-5 ⭐)</SelectItem>
                  <SelectItem value="passives">🟡 Passivos (3.5-4 ⭐)</SelectItem>
                  <SelectItem value="detractors">🔴 Detratores (0-3 ⭐)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filtro de Range de Avaliação */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Faixa de Avaliação: {ratingFilter.min} - {ratingFilter.max} estrelas
            </Label>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min="0"
                max="5"
                value={ratingFilter.min}
                onChange={(e) => setRatingFilter({ ...ratingFilter, min: parseInt(e.target.value) || 0 })}
                className="w-20"
              />
              <span className="text-[#6c6c89]">até</span>
              <Input
                type="number"
                min="0"
                max="5"
                value={ratingFilter.max}
                onChange={(e) => setRatingFilter({ ...ratingFilter, max: parseInt(e.target.value) || 5 })}
                className="w-20"
              />
            </div>
          </div>

          {/* Resumo dos Filtros Ativos */}
          {hasActiveFilters && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900 font-medium mb-2">Filtros Ativos:</p>
              <div className="flex flex-wrap gap-2">
                {selectedTemplate !== 'all' && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    Template: {templates.find(t => t.id === selectedTemplate)?.name}
                  </span>
                )}
                {dateFilter.start && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    De: {new Date(dateFilter.start).toLocaleDateString('pt-BR')}
                  </span>
                )}
                {dateFilter.end && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    Até: {new Date(dateFilter.end).toLocaleDateString('pt-BR')}
                  </span>
                )}
                {(ratingFilter.min !== 0 || ratingFilter.max !== 5) && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    Nota: {ratingFilter.min}-{ratingFilter.max} ⭐
                  </span>
                )}
                {npsSegmentFilter !== 'all' && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    {npsSegmentFilter === 'promoters' ? '🟢 Promotores' : 
                     npsSegmentFilter === 'passives' ? '🟡 Passivos' : '🔴 Detratores'}
                  </span>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
