import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Check, Star, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function TemplateLibrary({ templates = [], onSelectTemplate, selectedId = null }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Extract unique categories
  const categories = ['all', ...new Set(templates.map(t => t.category).filter(Boolean))];

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = !searchTerm || 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.subcategory?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    
    return matchesSearch && matchesCategory && template.is_active;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Biblioteca de Templates</h3>
        <p className="text-sm text-gray-600">
          Escolha um template pronto e personalize para seu negócio
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === category
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category === 'all' ? 'Todos' : category}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-gray-500">Nenhum template encontrado</p>
          </div>
        ) : (
          filteredTemplates.map((template, idx) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="relative group"
            >
              <button
                onClick={() => onSelectTemplate(template)}
                className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
                  selectedId === template.id
                    ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                    : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                {/* Icon & Badge */}
                <div className="flex items-start justify-between mb-3">
                  <div className="text-3xl">{template.icon || '📋'}</div>
                  {selectedId === template.id && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center"
                    >
                      <Check className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                </div>

                {/* Title & Category */}
                <h4 className="font-semibold text-gray-900 mb-1 line-clamp-1">
                  {template.name}
                </h4>
                <p className="text-xs text-gray-500 mb-3">{template.subcategory}</p>

                {/* Description */}
                {template.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {template.description}
                  </p>
                )}

                {/* Stats */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    {template.questions?.length || 0} perguntas
                  </span>
                  {template.usage_count > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      <Star className="w-3 h-3 mr-1" />
                      {template.usage_count} usos
                    </Badge>
                  )}
                </div>

                {/* Popular Badge */}
                {template.usage_count > 10 && (
                  <div className="absolute -top-2 -right-2">
                    <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 border-0 text-white shadow-lg">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Popular
                    </Badge>
                  </div>
                )}
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}