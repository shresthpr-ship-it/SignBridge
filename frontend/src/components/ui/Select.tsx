import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options: SelectOption[];
}

export const Select: React.FC<SelectProps> = ({
  label,
  helperText,
  error,
  options,
  className = '',
  id,
  ...props
}) => {
  const generatedId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1">
      {label && (
        <label htmlFor={generatedId} className="block text-xs font-medium text-slate-700">
          {label}
        </label>
      )}
      <div className="relative rounded-md shadow-xs">
        <select
          id={generatedId}
          className={`appearance-none block w-full rounded-md border text-sm text-slate-900 bg-white
            pl-3 pr-8 py-1.5 transition-colors duration-150
            focus:outline-none focus:ring-1
            disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
            ${error 
              ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500 text-rose-900' 
              : 'border-slate-300 focus:border-indigo-600 focus:ring-indigo-600'
            }
            ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
      {error ? (
        <p className="text-xs text-rose-600">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
};
