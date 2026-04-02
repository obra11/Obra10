import React from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export interface ModuloToggleProps {
  slug: string;
  label: string;
  isActive: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

/**
 * Reusable module toggle button — used in AdminPanel and UserManagement.
 * Shows the module slug/label with a colored active/inactive state.
 */
export const ModuloToggle: React.FC<ModuloToggleProps> = ({
  slug,
  label,
  isActive,
  isLoading = false,
  disabled = false,
  onToggle,
}) => {
  return (
    <button
      onClick={onToggle}
      disabled={disabled || isLoading}
      title={isActive ? `Desativar módulo ${slug}` : `Ativar módulo ${slug}`}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
        isActive
          ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
          : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
      }`}
    >
      {isLoading ? (
        <Loader2 size={12} className="animate-spin" />
      ) : isActive ? (
        <CheckCircle size={12} />
      ) : (
        <XCircle size={12} />
      )}
      {label || slug}
    </button>
  );
};
