import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PhoneInput({ value, onChange, disabled = false }) {
  const [isValid, setIsValid] = useState(null);
  const [formattedValue, setFormattedValue] = useState(value);

  useEffect(() => {
    // Format phone number as user types
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;

    if (cleaned.length >= 2) {
      formatted = `(${cleaned.slice(0, 2)}`;
      if (cleaned.length > 2) {
        formatted += `) ${cleaned.slice(2, 7)}`;
        if (cleaned.length > 7) {
          formatted += `-${cleaned.slice(7, 11)}`;
        }
      }
    }

    setFormattedValue(formatted);

    // Validate phone number
    if (cleaned.length === 0) {
      setIsValid(null);
    } else if (cleaned.length === 11) {
      // Valid: (XX) 9XXXX-XXXX
      setIsValid(true);
    } else if (cleaned.length === 10) {
      // Valid: (XX) XXXX-XXXX (older format)
      setIsValid(true);
    } else {
      setIsValid(false);
    }
  }, [value]);

  const handleChange = (e) => {
    const input = e.target.value;
    const cleaned = input.replace(/\D/g, '');
    onChange(cleaned);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="phoneNumber" className="flex items-center gap-2">
        <Phone className="w-4 h-4" />
        Celular <span className="text-red-500">*</span>
      </Label>
      <div className="relative">
        <Input
          id="phoneNumber"
          type="tel"
          value={formattedValue}
          onChange={handleChange}
          placeholder="(11) 99999-9999"
          className={`w-full pr-10 transition-all ${
            isValid === true ? 'border-green-500 focus:border-green-600' :
            isValid === false ? 'border-red-500 focus:border-red-600' :
            'border-gray-300'
          }`}
          disabled={disabled}
          required
          maxLength={15}
        />
        <AnimatePresence>
          {isValid !== null && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              {isValid ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <X className="w-5 h-5 text-red-600" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className={`text-xs transition-colors ${
        isValid === true ? 'text-green-600' :
        isValid === false ? 'text-red-600' :
        'text-gray-500'
      }`}>
        {isValid === true ? '✓ Número válido' :
         isValid === false ? '✗ Formato inválido. Use (XX) XXXXX-XXXX' :
         'Número de celular com código de área'}
      </p>
    </div>
  );
}