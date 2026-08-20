import React from 'react';

export const AvancoObraBar: React.FC<{
  percentual?: number | null;
  className?: string;
  showLabel?: boolean;
}> = ({ percentual, className = '', showLabel = true }) => {
  if (percentual == null || Number.isNaN(Number(percentual))) {
    return showLabel ? (
      <p className={`text-xs text-gray-400 ${className}`}>Avanço físico não informado</p>
    ) : null;
  }
  const pct = Math.max(0, Math.min(100, Math.round(Number(percentual))));
  return (
    <div className={className}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
            Avanço físico
          </span>
          <span className="text-xs font-bold text-gray-800">{pct}%</span>
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-lunardeli-red transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
