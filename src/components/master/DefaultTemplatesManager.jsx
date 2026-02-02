import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Search, 
  Eye, 
  Copy,
  Trash2,
  Star,
  Loader2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function DefaultTemplatesManager() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['default-templates'],
    queryFn: async () => {
      const data = await base44.asServiceRole.entities.DefaultSurveyTemplate.list('-created_date', 100);
      return data;
    },
  });

  const categories = [
    { id: 'all', name: 'Todos', icon: '📋', count: templates.length },
    { id: 'Comércio Varejista', name: 'Comércio Varejista', icon: '🏪' },
    { id: 'Alimentação', name: 'Alimentação', icon: '🍔' },
    { id: 'Saúde', name: 'Saúde', icon: '🏥' },
    { id: 'Serviços', name: 'Serviços', icon: '🏢' },
    { id: 'Tecnologia', name: 'Tecnologia', icon: '💻' },
    { id: 'Automotivo', name: 'Automotivo', icon: '🚗' },
    { id: 'Turismo/Hospedagem', name: 'Turismo/Hospedagem', icon: '🏨' },
    { id: 'Educação', name: 'Educação', icon: '🎓' },
    { id: 'Beleza/Estética', name: 'Beleza/Estética', icon: '💇' },
    { id: 'Outros', name: 'Outros', icon: '🏗️' }
  ];

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.subcategory.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id) => base44.asServiceRole.entities.DefaultSurveyTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['default-templates'] });
      toast.success('Template excluído com sucesso');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#121217]">Modelos Padrão de Pesquisas</h2>
          <p className="text-sm text-[#6c6c89] mt-1">
            Biblioteca de templates prontos para diversos tipos de negócios
          </p>
        </div>
        <Button className="bg-[#5423e7] hover:bg-[#5423e7]/90">
          <Plus className="w-4 h-4 mr-2" />
          Novo Template
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c6c89]" />
          <Input
            placeholder="Buscar templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map(cat => {
          const catCount = cat.id === 'all' ? templates.length : templates.filter(t => t.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all whitespace-nowrap",
                selectedCategory === cat.id
                  ? "border-[#5423e7] bg-[#5423e7]/10 text-[#5423e7]"
                  : "border-[#d1d1db] hover:border-[#5423e7]/50"
              )}
            >
              <span>{cat.icon}</span>
              <span className="text-sm font-medium">{cat.name}</span>
              <span className="text-xs bg-white px-2 py-0.5 rounded-full">{catCount}</span>
            </button>
          );
        })}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template, idx) => (
          <motion.div
            key={template.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white rounded-xl border border-[#d1d1db] p-5 hover:shadow-lg transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{template.icon}</span>
                <div>
                  <h3 className="font-semibold text-[#121217] text-sm">{template.name}</h3>
                  <p className="text-xs text-[#6c6c89]">{template.subcategory}</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-[#6c6c89] mb-4 line-clamp-2">
              {template.description}
            </p>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-1 text-xs text-[#6c6c89]">
                <Star className="w-3 h-3" />
                {template.questions?.length || 0} perguntas
              </div>
              <span className="text-xs text-[#6c6c89]">•</span>
              <div className="text-xs text-[#6c6c89]">
                {template.usage_count || 0} usos
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setSelectedTemplate(template)}
              >
                <Eye className="w-3 h-3 mr-1" />
                Ver
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(template.questions));
                  toast.success('Perguntas copiadas!');
                }}
              >
                <Copy className="w-3 h-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm('Deseja excluir este template?')) {
                    deleteTemplateMutation.mutate(template.id);
                  }
                }}
              >
                <Trash2 className="w-3 h-3 text-red-600" />
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[#6c6c89] mb-2">Nenhum template encontrado</p>
          <p className="text-xs text-[#6c6c89]">Tente ajustar os filtros ou busca</p>
        </div>
      )}

      {/* Template Details Dialog */}
      {selectedTemplate && (
        <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>{selectedTemplate.icon}</span>
                {selectedTemplate.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-[#6c6c89] mb-2">Categoria: {selectedTemplate.category}</p>
                <p className="text-sm text-[#6c6c89] mb-2">Subcategoria: {selectedTemplate.subcategory}</p>
                <p className="text-sm text-[#6c6c89]">{selectedTemplate.description}</p>
              </div>

              <div>
                <h4 className="font-semibold text-[#121217] mb-3">Perguntas do Template:</h4>
                <div className="space-y-3">
                  {selectedTemplate.questions?.map((q, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-medium text-[#121217]">{idx + 1}. {q.question}</p>
                        <span className="text-xs px-2 py-0.5 bg-white rounded">{q.type}</span>
                      </div>
                      {q.required && (
                        <span className="text-xs text-red-600">* Obrigatória</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}