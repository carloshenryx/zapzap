import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export default function ProgressIndicator({ currentStep, totalSteps, primaryColor = '#5423e7' }) {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between relative">
        {/* Progress Line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 -translate-y-1/2 -z-10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(currentStep / (totalSteps - 1)) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="h-full"
            style={{ backgroundColor: primaryColor }}
          />
        </div>

        {/* Step Circles */}
        {Array.from({ length: totalSteps }).map((_, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isPending = index > currentStep;

          return (
            <div key={index} className="relative flex flex-col items-center">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{
                  scale: isCurrent ? [1, 1.15, 1] : 1,
                  backgroundColor: isCompleted || isCurrent ? primaryColor : '#e5e7eb',
                }}
                transition={{
                  scale: isCurrent ? { repeat: Infinity, duration: 1.5 } : {},
                  backgroundColor: { duration: 0.3 }
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-lg relative z-10"
              >
                {isCompleted ? (
                  <Check className="w-5 h-5 text-white" />
                ) : (
                  <span className={`text-sm font-semibold ${isCurrent || isCompleted ? 'text-white' : 'text-gray-400'}`}>
                    {index + 1}
                  </span>
                )}
              </motion.div>

              {/* Step Label */}
              <motion.span
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: isCurrent ? 1 : 0.5, y: 0 }}
                className="absolute -bottom-6 text-xs font-medium text-gray-600 whitespace-nowrap"
              >
                {index === 0 ? 'Dados' : index === totalSteps - 1 ? 'Fim' : `Q${index}`}
              </motion.span>
            </div>
          );
        })}
      </div>
    </div>
  );
}