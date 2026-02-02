import React from 'react';
import { motion } from 'framer-motion';

const faces = [
  { value: 0, emoji: '😞', label: 'Muito Ruim', color: '#ef4444' },
  { value: 1, emoji: '😕', label: 'Ruim', color: '#f97316' },
  { value: 2, emoji: '😐', label: 'Regular', color: '#eab308' },
  { value: 3, emoji: '🙂', label: 'Bom', color: '#84cc16' },
  { value: 4, emoji: '😊', label: 'Muito Bom', color: '#22c55e' },
  { value: 5, emoji: '😍', label: 'Excelente', color: '#10b981' }
];

export default function FaceRating({ value, onChange, readonly = false }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-4 flex-wrap justify-center">
        {faces.map((face) => (
          <motion.button
            key={face.value}
            type="button"
            whileHover={!readonly ? { scale: 1.15 } : {}}
            whileTap={!readonly ? { scale: 0.95 } : {}}
            onClick={() => !readonly && onChange(face.value)}
            disabled={readonly}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all"
            style={{
              backgroundColor: value === face.value ? `${face.color}20` : 'transparent',
              border: `2px solid ${value === face.value ? face.color : '#e5e7eb'}`,
              cursor: readonly ? 'default' : 'pointer'
            }}
          >
            <span className="text-5xl">{face.emoji}</span>
            <span 
              className="text-xs font-medium"
              style={{ color: value === face.value ? face.color : '#6b7280' }}
            >
              {face.label}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}