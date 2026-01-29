"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  ColumnResizeMode,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, GripVertical } from "lucide-react";

// 샘플 데이터 타입
interface MrpResult {
  id: number;
  partCode: string;
  partName: string;
  supplier: string;
  project: string | null;
  totalRequirement: number;
  currentStock: number;
  netRequirement: number;
  recommendedQty: number;
  unitPrice: number;
  urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

// 샘플 데이터
const sampleData: MrpResult[] = [
  { id: 1, partCode: "P2501-0001", partName: "볼트 M8x20 SUS304", supplier: "ABC산업", project: "스마트팩토리 구축", totalRequirement: 500, currentStock: 100, netRequirement: 400, recommendedQty: 400, unitPrice: 150, urgency: "CRITICAL" },
  { id: 2, partCode: "P2501-0002", partName: "너트 M8 SUS304", supplier: "ABC산업", project: "스마트팩토리 구축", totalRequirement: 500, currentStock: 600, netRequirement: 0, recommendedQty: 0, unitPrice: 80, urgency: "LOW" },
  { id: 3, partCode: "P2501-0003", partName: "와셔 M8 평와셔", supplier: "DEF부품", project: "설비 유지보수", totalRequirement: 300, currentStock: 150, netRequirement: 150, recommendedQty: 200, unitPrice: 30, urgency: "HIGH" },
  { id: 4, partCode: "P2501-0004", partName: "스프링 와셔 M8", supplier: "DEF부품", project: null, totalRequirement: 200, currentStock: 200, netRequirement: 0, recommendedQty: 0, unitPrice: 50, urgency: "LOW" },
  { id: 5, partCode: "P2501-0005", partName: "육각렌치 볼트 M6x15", supplier: "GHI공업", project: "신규 라인 증설", totalRequirement: 1000, currentStock: 300, netRequirement: 700, recommendedQty: 700, unitPrice: 200, urgency: "MEDIUM" },
];

const urgencyConfig = {
  CRITICAL: { label: "긴급", color: "bg-red-100 text-red-700" },
  HIGH: { label: "높음", color: "bg-orange-100 text-orange-700" },
  MEDIUM: { label: "보통", color: "bg-blue-100 text-blue-700" },
  LOW: { label: "낮음", color: "bg-gray-100 text-gray-600" },
};

const columnHelper = createColumnHelper<MrpResult>();

export default function TanstackTableSample() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnResizeMode] = useState<ColumnResizeMode>("onChange");

  // 컬럼 정의 - 핵심 부분!
  const columns = useMemo(
    () => [
      columnHelper.accessor("urgency", {
        header: "긴급도",
        size: 80, // 기본 너비
        minSize: 60, // 최소 너비
        maxSize: 100, // 최대 너비
        cell: (info) => {
          const config = urgencyConfig[info.getValue()];
          return (
            <span className={`px-2 py-1 rounded text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
          );
        },
      }),
      columnHelper.accessor("partCode", {
        header: "파츠코드",
        size: 120,
        minSize: 100,
        maxSize: 150,
        cell: (info) => (
          <span className="font-mono text-sm text-blue-600">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("partName", {
        header: "파츠명",
        size: 180, // 이름은 넓게
        minSize: 120,
        maxSize: 300,
        cell: (info) => (
          <span className="truncate block" title={info.getValue()}>
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("supplier", {
        header: "공급업체",
        size: 100,
        minSize: 80,
        maxSize: 150,
      }),
      columnHelper.accessor("project", {
        header: "프로젝트",
        size: 140,
        minSize: 100,
        maxSize: 200,
        cell: (info) =>
          info.getValue() ? (
            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs truncate block">
              {info.getValue()}
            </span>
          ) : (
            <span className="text-gray-400">-</span>
          ),
      }),
      columnHelper.accessor("totalRequirement", {
        header: "총 소요량",
        size: 90,
        minSize: 70,
        maxSize: 120,
        cell: (info) => (
          <span className="tabular-nums text-right block">
            {info.getValue().toLocaleString()}
          </span>
        ),
      }),
      columnHelper.accessor("currentStock", {
        header: "현재고",
        size: 80,
        minSize: 60,
        maxSize: 100,
        cell: (info) => (
          <span className="tabular-nums text-right block">
            {info.getValue().toLocaleString()}
          </span>
        ),
      }),
      columnHelper.accessor("netRequirement", {
        header: "순소요량",
        size: 90,
        minSize: 70,
        maxSize: 120,
        cell: (info) => {
          const value = info.getValue();
          return (
            <span
              className={`tabular-nums text-right block font-medium ${
                value > 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              {value.toLocaleString()}
            </span>
          );
        },
      }),
      columnHelper.accessor("recommendedQty", {
        header: "권장 발주량",
        size: 100,
        minSize: 80,
        maxSize: 130,
        cell: (info) => {
          const value = info.getValue();
          return value > 0 ? (
            <span className="tabular-nums text-right block font-bold text-blue-600">
              {value.toLocaleString()}
            </span>
          ) : (
            <span className="text-gray-400 text-right block">-</span>
          );
        },
      }),
      columnHelper.accessor("unitPrice", {
        header: "단가",
        size: 90,
        minSize: 70,
        maxSize: 120,
        cell: (info) => (
          <span className="tabular-nums text-right block">
            ₩{info.getValue().toLocaleString()}
          </span>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: sampleData,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode,
    enableColumnResizing: true, // 컬럼 리사이즈 활성화
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Tanstack Table 샘플</h2>
        <input
          type="text"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="검색..."
          className="px-3 py-2 border rounded-lg w-64"
        />
      </div>

      {/* 테이블 */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className="w-full"
            style={{ width: table.getCenterTotalSize() }}
          >
            <thead className="bg-gray-50 border-b">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="relative px-4 py-3 text-left text-sm font-semibold text-gray-700"
                      style={{ width: header.getSize() }}
                    >
                      <div
                        className={`flex items-center gap-1 ${
                          header.column.getCanSort() ? "cursor-pointer select-none" : ""
                        }`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}

                        {/* 정렬 아이콘 */}
                        {header.column.getCanSort() && (
                          <span className="text-gray-400">
                            {header.column.getIsSorted() === "asc" ? (
                              <ArrowUp className="w-4 h-4" />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ArrowDown className="w-4 h-4" />
                            ) : (
                              <ArrowUpDown className="w-4 h-4" />
                            )}
                          </span>
                        )}
                      </div>

                      {/* 컬럼 리사이즈 핸들 */}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-blue-500 ${
                            header.column.getIsResizing() ? "bg-blue-500" : "bg-transparent"
                          }`}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3 text-sm"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 기능 설명 */}
      <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
        <h3 className="font-semibold mb-2">✨ Tanstack Table 기능:</h3>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>컬럼 리사이즈:</strong> 헤더 경계를 드래그하여 너비 조절</li>
          <li><strong>정렬:</strong> 헤더 클릭으로 오름차순/내림차순 정렬</li>
          <li><strong>검색:</strong> 전체 데이터 필터링</li>
          <li><strong>자동 너비:</strong> size/minSize/maxSize로 유연한 컬럼 크기</li>
        </ul>
      </div>
    </div>
  );
}
