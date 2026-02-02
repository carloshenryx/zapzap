import React from 'react';
import { motion } from 'framer-motion';
import { GripVertical, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DraggableCard({ 
  id,
  title, 
  children, 
  isMinimized,
  onToggleMinimize,
  dragHandleProps,
  isDragging = false
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-white rounded-xl border border-[#d1d1db] overflow-hidden transition-all ${
        isDragging ? 'shadow-2xl opacity-50' : 'shadow-sm'
      }`}
    >
      {/* Header com drag handle e minimize */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#d1d1db] bg-slate-50">
        <div className="flex items-center gap-3">
          <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </div>
          <h3 className="text-sm font-semibold text-[#121217]">{title}</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggleMinimize(id)}
          className="h-8 w-8"
        >
          {isMinimized ? (
            <Maximize2 className="w-4 h-4 text-slate-600" />
          ) : (
            <Minimize2 className="w-4 h-4 text-slate-600" />
          )}
        </Button>
      </div>

      {/* Conteúdo */}
      <motion.div
        initial={false}
        animate={{ 
          height: isMinimized ? 0 : 'auto',
          opacity: isMinimized ? 0 : 1
        }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="p-6">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}