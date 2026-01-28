"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Warehouse,
  Search,
  Download,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Package,
  Filter,
  ChevronDown,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

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

export default function InventoryPage() {
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const { data: inventory, isLoading, error } = useQuery({
    queryKey: ["inventory"],
    queryFn: fetchInventory,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const clearFilters = () => {
    setFilterStatus("all");
    setShowFilterDropdown(false);
  };

  const hasActiveFilters = filterStatus !== "all";

  const handleExport = () => {
    if (!filteredInventory || filteredInventory.length === 0) {
      toast.error("내보낼 데이터가 없습니다.");
      return;
    }

    const headers = ["파츠번호", "파츠명", "단위", "현재고", "예약", "가용재고", "안전재고", "상태", "최종갱신"];
    const rows = filteredInventory.map((item) => [
      item.part.partNumber,
      item.part.partName,
      item.part.unit,
      item.currentQty,
      item.reservedQty,
      item.availableQty,
      item.part.safetyStock,
      item.currentQty <= item.part.safetyStock ? "부족" : "정상",
      new Date(item.updatedAt).toLocaleDateString("ko-KR"),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventory_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("파일이 다운로드되었습니다.");
  };

  const filteredInventory = inventory?.filter((item) => {
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

  const lowStockCount = inventory?.filter(
    (item) => item.currentQty <= item.part.safetyStock
  ).length;

  const totalValue = inventory?.reduce(
    (sum, item) => sum + item.currentQty,
    0
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" role="status" aria-label="로딩 중" />
      </div>
    );
  }

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
        <button onClick={handleExport} className="btn btn-secondary">
          <Download className="w-4 h-4" />
          재고현황 다운로드
        </button>
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
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={`btn-secondary ${hasActiveFilters ? "ring-2 ring-[var(--primary-500)] ring-offset-1" : ""}`}
              >
                <Filter className="w-4 h-4" />
                필터
                {hasActiveFilters && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-[var(--primary-500)] text-white rounded-full">1</span>
                )}
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilterDropdown ? "rotate-180" : ""}`} />
              </button>

              {showFilterDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-[var(--gray-200)] shadow-lg py-3 z-50 animate-scale-in">
                  <div className="px-4 pb-2 mb-2 border-b border-[var(--gray-100)] flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--gray-900)]">필터</span>
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="text-xs text-[var(--primary-500)] hover:underline">
                        초기화
                      </button>
                    )}
                  </div>
                  <div className="px-4 py-2">
                    <label className="text-xs font-medium text-[var(--gray-600)] mb-1.5 block">재고 상태</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[var(--gray-300)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                    >
                      <option value="all">전체</option>
                      <option value="low">저재고</option>
                      <option value="normal">정상</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleExport} className="btn-secondary">
              <Download className="w-4 h-4" />
              내보내기
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-bordered">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="table-header table-col-code">파츠품번</th>
                <th className="table-header table-col-name">파츠명</th>
                <th className="table-header table-col-short">단위</th>
                <th className="table-header text-right table-col-qty">현재고</th>
                <th className="table-header text-right table-col-qty">예약</th>
                <th className="table-header text-right table-col-qty">가용재고</th>
                <th className="table-header text-right table-col-qty">안전재고</th>
                <th className="table-header table-col-status">상태</th>
                <th className="table-header table-col-date">최종갱신</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory?.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-cell text-center py-8">
                    <Warehouse className="w-12 h-12 mx-auto mb-2 text-[var(--text-muted)]" />
                    <p className="text-[var(--text-muted)]">재고 데이터가 없습니다.</p>
                  </td>
                </tr>
              ) : (
                filteredInventory?.map((item) => {
                  const isLowStock = item.currentQty <= item.part.safetyStock;
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)] transition-colors ${
                        isLowStock ? "bg-[var(--danger)]/5" : ""
                      }`}
                    >
                      <td className="table-cell font-medium table-col-code">
                        <Link
                          href="/parts"
                          className="text-[var(--primary)] hover:underline table-truncate block"
                          title={item.part.partNumber}
                        >
                          {item.part.partNumber}
                        </Link>
                      </td>
                      <td className="table-cell table-col-name">
                        <span className="table-truncate block" title={item.part.partName}>{item.part.partName}</span>
                      </td>
                      <td className="table-cell table-col-short">{item.part.unit}</td>
                      <td className="table-cell text-right font-medium tabular-nums table-col-qty">
                        {item.currentQty.toLocaleString()}
                      </td>
                      <td className="table-cell text-right text-[var(--text-secondary)] tabular-nums table-col-qty">
                        {item.reservedQty.toLocaleString()}
                      </td>
                      <td className="table-cell text-right font-medium tabular-nums table-col-qty">
                        {item.availableQty.toLocaleString()}
                      </td>
                      <td className="table-cell text-right text-[var(--text-secondary)] tabular-nums table-col-qty">
                        {item.part.safetyStock.toLocaleString()}
                      </td>
                      <td className="table-cell table-col-status">
                        {isLowStock ? (
                          <span className="badge badge-danger flex items-center gap-1 w-fit">
                            <TrendingDown className="w-3 h-3" />
                            부족
                          </span>
                        ) : (
                          <span className="badge badge-success flex items-center gap-1 w-fit">
                            <TrendingUp className="w-3 h-3" />
                            정상
                          </span>
                        )}
                      </td>
                      <td className="table-cell text-[var(--text-secondary)] table-col-date">
                        {new Date(item.updatedAt).toLocaleDateString("ko-KR")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
