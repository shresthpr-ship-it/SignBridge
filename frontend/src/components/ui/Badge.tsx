import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'indigo' | 'slate' | 'green' | 'amber' | 'rose' | 'neutral';
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'slate',
  size = 'md',
  dot = false,
  className = '',
}) => {
  const sizeStyles = {
    sm: 'text-[11px] px-1.5 py-0.5 leading-none font-medium',
    md: 'text-xs px-2 py-0.5 font-medium leading-relaxed',
  };

  const variantStyles = {
    indigo: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80',
    slate: 'bg-slate-100 text-slate-700 border border-slate-200',
    green: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
    amber: 'bg-amber-50 text-amber-800 border border-amber-200/80',
    rose: 'bg-rose-50 text-rose-700 border border-rose-200/80',
    neutral: 'bg-slate-50 text-slate-600 border border-slate-200',
  };

  const dotColors = {
    indigo: 'bg-indigo-500',
    slate: 'bg-slate-400',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    neutral: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded font-mono ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
};
