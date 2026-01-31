"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { Filter, ChevronDown } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterField {
  name: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

interface FilterDropdownProps {
  fields: FilterField[];
  onClear: () => void;
  activeCount?: number;
  children?: ReactNode;
}

export function FilterDropdown({ fields, onClear, activeCount = 0, children }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const hasActiveFilters = activeCount > 0 || fields.some((f) => f.value !== "all" && f.value !== "");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClear = () => {
    onClear();
    setIsOpen(false);
  };

  const filterCount = activeCount || fields.filter((f) => f.value !== "all" && f.value !== "").length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`btn-secondary ${hasActiveFilters ? "ring-2 ring-[var(--primary-500)] ring-offset-1" : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Filter className="w-4 h-4" />
        필터
        {filterCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-xs bg-[var(--primary-500)] text-white rounded-full">
            {filterCount}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 bg-white dark:bg-[var(--glass-bg)] rounded-xl border border-[var(--gray-200)] dark:border-[var(--glass-border)] shadow-lg py-3 z-50 animate-scale-in"
          role="menu"
        >
          <div className="px-4 pb-2 mb-2 border-b border-[var(--gray-100)] dark:border-[var(--glass-border)] flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--gray-900)] dark:text-[var(--text-primary)]">필터</span>
            {hasActiveFilters && (
              <button
                onClick={handleClear}
                className="text-xs text-[var(--primary-500)] hover:underline"
                type="button"
              >
                초기화
              </button>
            )}
          </div>

          {fields.map((field) => (
            <div key={field.name} className="px-4 py-2">
              <label
                htmlFor={`filter-${field.name}`}
                className="text-xs font-medium text-[var(--gray-600)] dark:text-[var(--text-secondary)] mb-1.5 block"
              >
                {field.label}
              </label>
              <select
                id={`filter-${field.name}`}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--gray-300)] dark:border-[var(--glass-border)] rounded-lg bg-white dark:bg-[var(--glass-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {children && (
            <div className="px-4 py-2">
              {children}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FilterDropdown;
