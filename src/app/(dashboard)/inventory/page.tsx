"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Warehouse,
  Search,
  Filter,
  Download,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Package,
} from "lucide-react";

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
  const res = await fetch("/api/inventory");
  if (!res.ok) throw new Error("Failed to fetch inventory");
  return res.json();
}

export default function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const { data: inventory, isLoading, error } = useQuery({
    queryKey: ["inventory"],
    queryFn: fetchInventory,
  });

  const filteredInventory = inventory?.filter((item) => {
    const matchesSearch =
      item.part.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.part.partName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLowStock = showLowStockOnly
      ? item.currentQty <= item.part.safetyStock
      : true;
    return matchesSearch && matchesLowStock;
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
            부품별 현재고 및 가용재고를 확인합니다.
          </p>
        </div>
        <button className="btn btn-secondary">
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
              placeholder="부품번호 또는 부품명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full"
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showLowStockOnly
                  ? "bg-[var(--warning)] text-white"
                  : "btn-secondary"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              저재고만
            </button>
            <button className="btn-secondary flex items-center gap-2">
              <Filter className="w-4 h-4" />
              필터
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="table-header">부품번호</th>
                <th className="table-header">부품명</th>
                <th className="table-header">단위</th>
                <th className="table-header text-right">현재고</th>
                <th className="table-header text-right">예약</th>
                <th className="table-header text-right">가용재고</th>
                <th className="table-header text-right">안전재고</th>
                <th className="table-header">상태</th>
                <th className="table-header">최종갱신</th>
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
                      <td className="table-cell font-medium">{item.part.partNumber}</td>
                      <td className="table-cell">{item.part.partName}</td>
                      <td className="table-cell">{item.part.unit}</td>
                      <td className="table-cell text-right font-medium tabular-nums">
                        {item.currentQty.toLocaleString()}
                      </td>
                      <td className="table-cell text-right text-[var(--text-secondary)] tabular-nums">
                        {item.reservedQty.toLocaleString()}
                      </td>
                      <td className="table-cell text-right font-medium tabular-nums">
                        {item.availableQty.toLocaleString()}
                      </td>
                      <td className="table-cell text-right text-[var(--text-secondary)] tabular-nums">
                        {item.part.safetyStock.toLocaleString()}
                      </td>
                      <td className="table-cell">
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
                      <td className="table-cell text-[var(--text-secondary)]">
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
