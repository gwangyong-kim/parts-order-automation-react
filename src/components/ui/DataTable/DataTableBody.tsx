"use client";

import { flexRender, Row, ColumnDef } from "@tanstack/react-table";
import type { EmptyStateConfig } from "./types";

interface DataTableBodyProps<T> {
  rows: Row<T>[];
  columns: ColumnDef<T, unknown>[];
  emptyState?: EmptyStateConfig;
  searchTerm?: string;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
}

export function DataTableBody<T>({
  rows,
  columns,
  emptyState,
  searchTerm,
  onRowClick,
  rowClassName,
}: DataTableBodyProps<T>) {
  if (rows.length === 0 && emptyState) {
    const Icon = emptyState.icon;
    const message = searchTerm ? (emptyState.searchMessage || "검색 결과가 없습니다.") : emptyState.message;

    return (
      <tbody className="divide-y divide-[var(--glass-border)]">
        <tr>
          <td colSpan={columns.length} className="px-6 py-12 text-center">
            <Icon className="w-12 h-12 mx-auto mb-2 text-[var(--text-muted)]" aria-hidden="true" />
            <p className="text-[var(--text-muted)]">{message}</p>
            {!searchTerm && emptyState.actionLabel && emptyState.onAction && (
              <button
                onClick={emptyState.onAction}
                className="mt-4 text-[var(--primary)] hover:underline"
              >
                {emptyState.actionLabel}
              </button>
            )}
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody className="divide-y divide-[var(--glass-border)]">
      {rows.map((row) => {
        const customClassName = rowClassName?.(row.original) || "";
        const isClickable = !!onRowClick;

        return (
          <tr
            key={row.id}
            onClick={() => onRowClick?.(row.original)}
            onKeyDown={(e) => {
              if (isClickable && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onRowClick?.(row.original);
              }
            }}
            className={`hover:bg-[var(--glass-bg)] transition-colors ${
              isClickable ? "cursor-pointer" : ""
            } ${customClassName}`}
            tabIndex={isClickable ? 0 : undefined}
            role={isClickable ? "button" : undefined}
          >
            {row.getVisibleCells().map((cell) => (
              <td
                key={cell.id}
                className="px-3 py-3 text-sm border-r border-[var(--glass-border)] last:border-r-0"
                style={{ width: cell.column.getSize() }}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        );
      })}
    </tbody>
  );
}

export default DataTableBody;
