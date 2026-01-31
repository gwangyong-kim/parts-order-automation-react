import type { ElementType, ReactNode } from "react";
import type { ColumnDef, SortingState, Row } from "@tanstack/react-table";

export interface EmptyStateConfig {
  icon: ElementType;
  message: string;
  searchMessage?: string;
  actionLabel?: string;
  onAction?: () => void;
}

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

export interface DataTableHeaderProps<T> {
  headerGroups: {
    id: string;
    headers: {
      id: string;
      isPlaceholder: boolean;
      column: {
        getCanSort: () => boolean;
        getToggleSortingHandler: () => ((event: unknown) => void) | undefined;
        getIsSorted: () => false | "asc" | "desc";
        getCanResize: () => boolean;
        getIsResizing: () => boolean;
        columnDef: { header: unknown };
        getSize: () => number;
      };
      getContext: () => unknown;
      getSize: () => number;
      getResizeHandler: () => (event: unknown) => void;
    }[];
  }[];
}

export interface DataTableBodyProps<T> {
  rows: Row<T>[];
  columns: ColumnDef<T, unknown>[];
  emptyState?: EmptyStateConfig;
  searchTerm?: string;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
}
