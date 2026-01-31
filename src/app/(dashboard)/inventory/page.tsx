"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createColumnHelper } from "@tanstack/react-table";
import {
  Warehouse,
  Search,
  Download,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Package,
} from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { FilterDropdown } from "@/components/ui/FilterDropdown";
import { useToast } from "@/components/ui/Toast";
import { usePermission } from "@/hooks/usePermission";
import { exportToCSV, formatDateKR } from "@/lib/export-utils";

interface InventoryItem {
  id: number;
  part: {
    id: number;
    partNumber: string;
    partName: string;
    unit: string;
    safetyStock: number;
  };
  currentQty: number;
  reservedQty: number;
  availableQty: number;
  updatedAt: string;
}

async function fetchInventory(): Promise<InventoryItem[]> {
  const res = await fetch("/api/inventory?pageSize=1000");
  if (!res.ok) throw new Error("Failed to fetch inventory");
  const result = await res.json();
  return result.data;
}

const columnHelper = createColumnHelper<InventoryItem>();

export default function InventoryPage() {
  const toast = useToast();
  const router = useRouter();
  const { can } = usePermission();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: inventory, isLoading, error } = useQuery({
    queryKey: ["inventory"],
    queryFn: fetchInventory,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const clearFilters = () => {
    setFilterStatus("all");
  };

  const filteredInventory = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter((item) => {
      const matchesSearch =
        item.part.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.part.partName.toLowerCase().includes(searchTerm.toLowerCase());
      const isLowStock = item.currentQty <= item.part.safetyStock;
      const matchesStatus =
        filterStatus === "all" ? true :
        filterStatus === "low" ? isLowStock :
        filterStatus === "normal" ? !isLowStock : true;
      return matchesSearch && matchesStatus;
    });
  }, [inventory, searchTerm, filterStatus]);

  const handleExport = () => {
    try {
      exportToCSV({
        data: filteredInventory,
        headers: ["파츠번호", "파츠명", "단위", "현재고", "예약", "가용재고", "안전재고", "상태", "최종갱신"],
        rowMapper: (item) => [
          item.part.partNumber,
          item.part.partName,
          item.part.unit,
          item.currentQty,
          item.reservedQty,
          item.availableQty,
          item.part.safetyStock,
          item.currentQty <= item.part.safetyStock ? "부족" : "정상",
          formatDateKR(item.updatedAt),
        ],
        filename: "inventory",
      });
      toast.success("파일이 다운로드되었습니다.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const lowStockCount = inventory?.filter(
    (item) => item.currentQty <= item.part.safetyStock
  ).length;

  const totalValue = inventory?.reduce(
    (sum, item) => sum + item.currentQty,
    0
  );

  // TanStack Table 컬럼 정의
  const columns = useMemo(
    () => [
      // 파츠품번
      columnHelper.accessor("part.partNumber", {
        header: "파츠품번",
        size: 140,
        minSize: 100,
        maxSize: 200,
        cell: ({ row }) => (
          <Link
            href="/parts"
            className="text-[var(--primary)] hover:underline truncate block font-medium"
            title={row.original.part.partNumber}
          >
            {row.original.part.partNumber}
          </Link>
        ),
      }),
      // 파츠명
      columnHelper.accessor("part.partName", {
        header: "파츠명",
        size: 200,
        minSize: 150,
        maxSize: 350,
        cell: ({ row }) => (
          <span className="truncate block" title={row.original.part.partName}>
            {row.original.part.partName}
          </span>
        ),
      }),
      // 단위
      columnHelper.accessor("part.unit", {
        header: "단위",
        size: 70,
        minSize: 50,
        maxSize: 100,
        cell: (info) => info.getValue(),
      }),
      // 현재고
      columnHelper.accessor("currentQty", {
        header: "현재고",
        size: 100,
        minSize: 80,
        maxSize: 120,
        cell: (info) => (
          <span className="text-right block font-medium tabular-nums">
            {info.getValue().toLocaleString()}
          </span>
        ),
      }),
      // 예약
      columnHelper.accessor("reservedQty", {
        header: "예약",
        size: 100,
        minSize: 80,
        maxSize: 120,
        cell: (info) => (
          <span className="text-right block text-[var(--text-secondary)] tabular-nums">
            {info.getValue().toLocaleString()}
          </span>
        ),
      }),
      // 가용재고
      columnHelper.accessor("availableQty", {
        header: "가용재고",
        size: 100,
        minSize: 80,
        maxSize: 120,
        cell: (info) => (
          <span className="text-right block font-medium tabular-nums">
            {info.getValue().toLocaleString()}
          </span>
        ),
      }),
      // 안전재고
      columnHelper.accessor("part.safetyStock", {
        header: "안전재고",
        size: 100,
        minSize: 80,
        maxSize: 120,
        cell: (info) => (
          <span className="text-right block text-[var(--text-secondary)] tabular-nums">
            {info.getValue().toLocaleString()}
          </span>
        ),
      }),
      // 상태
      columnHelper.display({
        id: "status",
        header: "상태",
        size: 90,
        minSize: 80,
        maxSize: 120,
        cell: ({ row }) => {
          const isLowStock = row.original.currentQty <= row.original.part.safetyStock;
          return isLowStock ? (
            <span className="badge badge-danger flex items-center gap-1 w-fit">
              <TrendingDown className="w-3 h-3" />
              부족
            </span>
          ) : (
            <span className="badge badge-success flex items-center gap-1 w-fit">
              <TrendingUp className="w-3 h-3" />
              정상
            </span>
          );
        },
      }),
      // 최종갱신
      columnHelper.accessor("updatedAt", {
        header: "최종갱신",
        size: 110,
        minSize: 100,
        maxSize: 140,
        cell: (info) => (
          <span className="text-[var(--text-secondary)]">
            {new Date(info.getValue()).toLocaleDateString("ko-KR")}
          </span>
        ),
      }),
    ],
    []
  );

  if (error) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-[var(--danger)]">데이터를 불러오는데 실패했습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">현재고 현황</h1>
          <p className="text-[var(--text-secondary)]">
            파츠별 현재고 및 가용재고를 확인합니다.
          </p>
        </div>
        {can("inventory", "export") && (
          <button onClick={handleExport} className="btn btn-secondary">
            <Download className="w-4 h-4" />
            재고현황 다운로드
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">총 품목</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {inventory?.length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--warning)]/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[var(--warning)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">저재고 품목</p>
              <p className="text-xl font-bold text-[var(--warning)]">
                {lowStockCount || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--success)]/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[var(--success)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">총 재고량</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {totalValue?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--info)]/10 rounded-lg flex items-center justify-center">
              <Warehouse className="w-5 h-5 text-[var(--info)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">정상 품목</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {(inventory?.length || 0) - (lowStockCount || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="파츠품번 또는 파츠명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-with-icon w-full"
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2">
            <FilterDropdown
              fields={[
                {
                  name: "status",
                  label: "재고 상태",
                  value: filterStatus,
                  onChange: setFilterStatus,
                  options: [
                    { value: "all", label: "전체" },
                    { value: "low", label: "저재고" },
                    { value: "normal", label: "정상" },
                  ],
                },
              ]}
              onClear={clearFilters}
            />

            {can("inventory", "export") && (
              <button onClick={handleExport} className="btn-secondary">
                <Download className="w-4 h-4" />
                내보내기
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <DataTable
        data={filteredInventory}
        columns={columns}
        isLoading={isLoading}
        searchTerm={searchTerm}
        onRowClick={(item) => router.push(`/parts/${item.part.id}`)}
        rowClassName={(item) =>
          item.currentQty <= item.part.safetyStock ? "bg-[var(--danger)]/5" : ""
        }
        emptyState={{
          icon: Warehouse,
          message: "재고 데이터가 없습니다.",
          searchMessage: "검색 결과가 없습니다.",
        }}
      />
    </div>
  );
}
