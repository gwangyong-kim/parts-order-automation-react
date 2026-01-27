"use client";

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  emptyMessage?: string;
}

type SortDirection = "asc" | "desc" | null;

export default function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  pageSize = 10,
  emptyMessage = "데이터가 없습니다.",
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [data, sortKey, sortDirection]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortKey(null);
        setSortDirection(null);
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const getValue = (item: T, key: string): unknown => {
    if (key.includes(".")) {
      const keys = key.split(".");
      let value: unknown = item;
      for (const k of keys) {
        if (value && typeof value === "object" && k in value) {
          value = (value as Record<string, unknown>)[k];
        } else {
          return undefined;
        }
      }
      return value;
    }
    return item[key];
  };

  const renderSortIcon = (column: Column<T>) => {
    if (!column.sortable) return null;

    const key = String(column.key);
    if (sortKey !== key) {
      return <ChevronsUpDown className="w-4 h-4 opacity-30" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  if (data.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-[var(--text-muted)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full table-bordered">
          <thead>
            <tr className="border-b border-[var(--glass-border)]">
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase
                             ${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"}
                             ${column.sortable ? "cursor-pointer hover:text-[var(--text-primary)] select-none" : ""}`}
                  onClick={() =>
                    column.sortable && handleSort(String(column.key))
                  }
                >
                  <div
                    className={`flex items-center gap-1 ${column.align === "right" ? "justify-end" : column.align === "center" ? "justify-center" : ""}`}
                  >
                    {column.header}
                    {renderSortIcon(column)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--glass-border)]">
            {paginatedData.map((item, rowIndex) => (
              <tr
                key={rowIndex}
                className="hover:bg-[var(--glass-bg)] transition-colors"
              >
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className={`px-4 py-3 text-sm text-[var(--text-primary)]
                               ${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : ""}`}
                  >
                    {column.render
                      ? column.render(item)
                      : String(getValue(item, String(column.key)) ?? "-")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--glass-border)]">
          <span className="text-sm text-[var(--text-muted)]">
            총 {data.length}개 중 {(currentPage - 1) * pageSize + 1}-
            {Math.min(currentPage * pageSize, data.length)}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm rounded-md bg-[var(--glass-bg)] text-[var(--text-primary)]
                         disabled:opacity-50 disabled:cursor-not-allowed
                         hover:bg-[var(--glass-border)] transition-colors"
            >
              이전
            </button>
            <span className="text-sm text-[var(--text-secondary)]">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm rounded-md bg-[var(--glass-bg)] text-[var(--text-primary)]
                         disabled:opacity-50 disabled:cursor-not-allowed
                         hover:bg-[var(--glass-border)] transition-colors"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
