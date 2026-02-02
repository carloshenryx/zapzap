import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, X } from 'lucide-react';
import { motion } from 'framer-motion';

export default function NavigationButtons({ 
  onBack, 
  onCancel, 
  showBack = true, 
  showCancel = true,
  primaryColor = '#5423e7' 
}) {
  return (
    <div className="flex items-center justify-between w-full max-w-3xl mx-auto px-4 py-4">
      {/* Back Button */}
      {showBack ? (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </Button>
        </motion.div>
      ) : (
        <div />
      )}

      {/* Cancel Button */}
      {showCancel && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <X className="w-4 h-4" />
            Cancelar
          </Button>
        </motion.div>
      )}
    </div>
  );
}