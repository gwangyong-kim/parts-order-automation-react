"use client";

import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  ColumnDef,
  SortingState,
  ColumnResizeMode,
} from "@tanstack/react-table";
import { DataTableHeader } from "./DataTableHeader";
import { DataTableBody } from "./DataTableBody";
import type { EmptyStateConfig } from "./types";

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  isLoading?: boolean;
  emptyState?: EmptyStateConfig;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  enableColumnResizing?: boolean;
  enableSorting?: boolean;
  initialSorting?: SortingState;
  searchTerm?: string;
  showFooter?: boolean;
  footerText?: string;
  getRowId?: (row: T) => string;
}

export function DataTable<T>({
  data,
  columns,
  isLoading = false,
  emptyState,
  onRowClick,
  rowClassName,
  enableColumnResizing = true,
  enableSorting = true,
  initialSorting = [],
  searchTerm = "",
  showFooter = true,
  footerText = "헤더 경계를 드래그하여 컬럼 너비 조절 | 헤더 클릭으로 정렬",
  getRowId,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnResizeMode] = useState<ColumnResizeMode>("onChange");

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    columnResizeMode: enableColumnResizing ? columnResizeMode : undefined,
    enableColumnResizing,
    getRowId,
  });

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center justify-center h-32">
          <div
            className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"
            role="status"
            aria-label="로딩 중"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table
          className="w-full tanstack-table"
          style={{ minWidth: table.getCenterTotalSize() }}
        >
          <DataTableHeader headerGroups={table.getHeaderGroups()} />
          <DataTableBody
            rows={table.getRowModel().rows}
            columns={columns}
            emptyState={emptyState}
            searchTerm={searchTerm}
            onRowClick={onRowClick}
            rowClassName={rowClassName}
          />
        </table>
      </div>
      {showFooter && data.length > 0 && (
        <div className="px-4 py-2 border-t border-[var(--glass-border)] bg-[var(--glass-bg)]/50 text-xs text-[var(--text-muted)]">
          {footerText}
        </div>
      )}
    </div>
  );
}

export default DataTable;
