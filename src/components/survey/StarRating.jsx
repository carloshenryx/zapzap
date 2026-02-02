import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function StarRating({ value, onChange, readonly = false, size = 'md' }) {
  const [hoverValue, setHoverValue] = React.useState(0);
  
  const sizes = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };
  
  const handleClick = (rating) => {
    if (!readonly && onChange) {
      onChange(rating);
    }
  };
  
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <motion.button
          key={star}
          type="button"
          whileHover={{ scale: readonly ? 1 : 1.15 }}
          whileTap={{ scale: readonly ? 1 : 0.95 }}
          onClick={() => handleClick(star)}
          onMouseEnter={() => !readonly && setHoverValue(star)}
          onMouseLeave={() => setHoverValue(0)}
          className={cn(
            "transition-colors duration-200 focus:outline-none",
            !readonly && "cursor-pointer"
          )}
          disabled={readonly}
        >
          <Star
            className={cn(
              sizes[size],
              "transition-all duration-200",
              (hoverValue || value) >= star
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-slate-300"
            )}
          />
        </motion.button>
      ))}
    </div>
  );
}