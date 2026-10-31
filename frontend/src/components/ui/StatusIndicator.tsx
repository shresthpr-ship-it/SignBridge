import React from 'react';

export type StatusType = 'operational' | 'recording' | 'processing' | 'warning' | 'error' | 'idle' | 'offline';

export interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  pulse?: boolean;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  pulse = false,
  className = '',
}) => {
  const statusConfig: Record<StatusType, { dot: string; ping?: string; defaultLabel: string }> = {
    operational: {
      dot: 'bg-emerald-500',
      ping: 'bg-emerald-400',
      defaultLabel: 'Operational',
    },
    recording: {
      dot: 'bg-rose-500',
      ping: 'bg-rose-400',
      defaultLabel: 'Recording',
    },
    processing: {
      dot: 'bg-indigo-500',
      ping: 'bg-indigo-400',
      defaultLabel: 'Processing',
    },
    warning: {
      dot: 'bg-amber-500',
      defaultLabel: 'Attention',
    },
    error: {
      dot: 'bg-rose-600',
      defaultLabel: 'Error',
    },
    idle: {
      dot: 'bg-slate-400',
      defaultLabel: 'Idle',
    },
    offline: {
      dot: 'bg-slate-300',
      defaultLabel: 'Disconnected',
    },
  };

  const config = statusConfig[status];
  const displayLabel = label !== undefined ? label : config.defaultLabel;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="relative flex h-2 w-2">
        {pulse && config.ping && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.ping}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} />
      </span>
      {displayLabel && (
        <span className="text-xs font-medium text-slate-600 select-none">{displayLabel}</span>
      )}
    </div>
  );
};
