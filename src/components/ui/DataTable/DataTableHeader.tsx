"use client";

import { flexRender, HeaderGroup, Header } from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface DataTableHeaderProps<T> {
  headerGroups: HeaderGroup<T>[];
}

export function DataTableHeader<T>({ headerGroups }: DataTableHeaderProps<T>) {
  return (
    <thead className="border-b border-[var(--glass-border)] bg-[var(--glass-bg)]">
      {headerGroups.map((headerGroup) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <HeaderCell key={header.id} header={header} />
          ))}
        </tr>
      ))}
    </thead>
  );
}

interface HeaderCellProps<T> {
  header: Header<T, unknown>;
}

function HeaderCell<T>({ header }: HeaderCellProps<T>) {
  const canSort = header.column.getCanSort();
  const sortDirection = header.column.getIsSorted();
  const canResize = header.column.getCanResize();
  const isResizing = header.column.getIsResizing();

  return (
    <th
      className="relative px-3 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap border-r border-[var(--glass-border)] last:border-r-0"
      style={{ width: header.getSize() }}
    >
      <div
        className={`flex items-center gap-1 ${
          canSort ? "cursor-pointer select-none hover:text-[var(--text-primary)]" : ""
        }`}
        onClick={header.column.getToggleSortingHandler()}
        onKeyDown={(e) => {
          if (canSort && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            header.column.getToggleSortingHandler()?.(e);
          }
        }}
        role={canSort ? "button" : undefined}
        tabIndex={canSort ? 0 : undefined}
        aria-label={canSort ? `${header.column.columnDef.header} 정렬` : undefined}
      >
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}
        {canSort && <SortIndicator direction={sortDirection} />}
      </div>
      {canResize && (
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-[var(--primary)] ${
            isResizing ? "bg-[var(--primary)]" : "bg-transparent"
          }`}
          role="separator"
          aria-label="컬럼 너비 조절"
        />
      )}
    </th>
  );
}

interface SortIndicatorProps {
  direction: false | "asc" | "desc";
}

function SortIndicator({ direction }: SortIndicatorProps) {
  return (
    <span className="text-[var(--text-muted)]">
      {direction === "asc" ? (
        <ArrowUp className="w-3 h-3" aria-label="오름차순" />
      ) : direction === "desc" ? (
        <ArrowDown className="w-3 h-3" aria-label="내림차순" />
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-50" aria-label="정렬 가능" />
      )}
    </span>
  );
}

export default DataTableHeader;
