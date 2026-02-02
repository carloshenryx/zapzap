import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function StatCard({ title, value, subtitle, icon: Icon, trend, className }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-white rounded-2xl p-6 shadow-sm border border-slate-100",
        "hover:shadow-md transition-shadow duration-300",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-slate-800">{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
          )}
          {trend && (
            <p className={cn(
              "text-sm font-medium mt-2",
              trend > 0 ? "text-emerald-600" : "text-rose-600"
            )}>
              {trend > 0 ? "+" : ""}{trend}% vs. mês anterior
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl">
            <Icon className="w-6 h-6 text-indigo-600" />
          </div>
        )}
      </div>
    </motion.div>
  );
}