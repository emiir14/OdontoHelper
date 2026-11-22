import React from 'react';
import { SearchInput } from './SearchInput';
import { dropdownClass, filterBarClass } from './uiClasses';

export interface FilterDropdownOption {
  value: string;
  label: string;
}

export interface FilterDropdownConfig {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterDropdownOption[];
  ariaLabel?: string;
  className?: string;
}

export interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  dropdowns?: FilterDropdownConfig[];
  rightSlot?: React.ReactNode;
  resultCountLabel?: string;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  searchAriaLabel,
  dropdowns = [],
  rightSlot,
  resultCountLabel,
  className,
}) => (
  <div className={className ? `${filterBarClass} ${className}` : filterBarClass}>
    {/* El buscador siempre va primero a la izquierda */}
    <SearchInput
      value={searchValue}
      onChange={onSearchChange}
      placeholder={searchPlaceholder}
      ariaLabel={searchAriaLabel}
    />

    {dropdowns.map((dd) => (
      <select
        key={dd.id}
        value={dd.value}
        onChange={(e) => dd.onChange(e.target.value)}
        aria-label={dd.ariaLabel || 'Filtrar'}
        className={
          dd.className
            ? `w-full ${dropdownClass} ${dd.className}`
            : `w-full ${dropdownClass} sm:w-52`
        }
      >
        {dd.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    ))}

    {rightSlot}

    {resultCountLabel && (
      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap sm:ml-auto">
        {resultCountLabel}
      </span>
    )}
  </div>
);
