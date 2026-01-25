"use client";

import { Download, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface FilterOption {
  value: number;
  label: string;
}

interface ReportHeaderProps {
  title: string;
  description?: string;
  filterOptions?: FilterOption[];
  filterValue?: number;
  onFilterChange?: (value: number) => void;
  onExportCSV?: () => void;
  onExportJSON?: () => void;
}

export default function ReportHeader({
  title,
  description,
  filterOptions,
  filterValue,
  onFilterChange,
  onExportCSV,
  onExportJSON,
}: ReportHeaderProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">{title}</h2>
        {description && (
          <p className="text-sm text-[var(--text-muted)] mt-1">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {filterOptions && onFilterChange && (
          <select
            value={filterValue}
            onChange={(e) => onFilterChange(Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]
                       text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2
                       focus:ring-[var(--primary)]/50"
          >
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {(onExportCSV || onExportJSON) && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--glass-bg)]
                         border border-[var(--glass-border)] text-sm text-[var(--text-primary)]
                         hover:bg-[var(--glass-bg)]/80 transition-colors"
            >
              <Download className="w-4 h-4" />
              내보내기
              <ChevronDown className="w-4 h-4" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 w-40 py-1 rounded-lg
                              bg-[var(--card-bg)] border border-[var(--glass-border)]
                              shadow-xl z-50">
                {onExportCSV && (
                  <button
                    onClick={() => {
                      onExportCSV();
                      setShowExportMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)]
                               hover:bg-[var(--glass-bg)] transition-colors"
                  >
                    CSV 다운로드
                  </button>
                )}
                {onExportJSON && (
                  <button
                    onClick={() => {
                      onExportJSON();
                      setShowExportMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)]
                               hover:bg-[var(--glass-bg)] transition-colors"
                  >
                    JSON 다운로드
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
