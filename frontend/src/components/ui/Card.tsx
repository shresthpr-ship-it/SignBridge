import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  actions?: React.ReactNode;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  header,
  footer,
  actions,
  title,
  subtitle,
  compact = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden ${className}`}
      {...props}
    >
      {(header || title) && (
        <div className={`border-b border-slate-200 flex items-center justify-between ${compact ? 'px-4 py-2.5' : 'px-5 py-3.5'}`}>
          {header ? (
            header
          ) : (
            <div>
              {title && <h3 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h3>}
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      <div className={compact ? 'p-4' : 'p-5'}>{children}</div>

      {footer && (
        <div className={`bg-slate-50 border-t border-slate-200 text-xs text-slate-600 ${compact ? 'px-4 py-2.5' : 'px-5 py-3'}`}>
          {footer}
        </div>
      )}
    </div>
  );
};
