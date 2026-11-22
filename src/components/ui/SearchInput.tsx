import React from 'react';
import { Search, X } from 'lucide-react';
import { searchInputClass } from './uiClasses';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  inputClassName?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Buscar...',
  ariaLabel,
  className = 'relative flex-1 min-w-0 sm:min-w-[200px]',
  inputClassName,
}) => (
  <div className={className}>
    <Search
      className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
      aria-hidden="true"
    />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel || placeholder}
      className={inputClassName ? `${searchInputClass} ${inputClassName}` : searchInputClass}
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        aria-label="Limpiar búsqueda"
        title="Limpiar búsqueda"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);
