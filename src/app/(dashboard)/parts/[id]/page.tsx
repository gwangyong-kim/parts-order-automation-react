"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Edit2,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  ArrowLeftRight,
  MapPin,
  Tag,
  Building2,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import type { Part, Transaction } from "@/types/entities";

interface PartWithInventory extends Part {
  inventory?: {
    currentQty: number;
    reservedQty: number;
    incomingQty: number;
    availableQty: number;
    lastInboundDate: string | null;
    lastOutboundDate: string | null;
  };
}

async function fetchPart(id: string): Promise<PartWithInventory> {
  const res = await fetch(`/api/parts/${id}`);
  if (!res.ok) throw new Error("Failed to fetch part");
  const data = await res.json();
  // Transform partCode to partNumber for frontend
  return {
    ...data,
    partNumber: data.partCode,
    leadTime: data.leadTimeDays,
  };
}

async function fetchPartTransactions(id: string): Promise<Transaction[]> {
  const res = await fetch(`/api/parts/${id}/transactions`);
  if (!res.ok) throw new Error("Failed to fetch transactions");
  return res.json();
}

const typeColors: Record<string, string> = {
  INBOUND: "badge-success",
  OUTBOUND: "badge-danger",
  ADJUSTMENT: "badge-warning",
  TRANSFER: "badge-info",
};

const typeLabels: Record<string, string> = {
  INBOUND: "입고",
  OUTBOUND: "출고",
  ADJUSTMENT: "조정",
  TRANSFER: "이동",
};

const typeIcons: Record<string, React.ElementType> = {
  INBOUND: ArrowDownRight,
  OUTBOUND: ArrowUpRight,
  ADJUSTMENT: RotateCcw,
  TRANSFER: ArrowLeftRight,
};

export default function PartDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const {
    data: part,
    isLoading: partLoading,
    error: partError,
  } = useQuery({
    queryKey: ["part", id],
    queryFn: () => fetchPart(id),
  });

  const { data: transactions, isLoading: txLoading } = useQuery({
    queryKey: ["part-transactions", id],
    queryFn: () => fetchPartTransactions(id),
    enabled: !!part,
  });

  if (partLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="로딩 중"
        />
      </div>
    );
  }

  if (partError || !part) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-[var(--danger)]">파츠를 찾을 수 없습니다.</p>
        <Link href="/parts" className="mt-4 text-[var(--primary)] hover:underline">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const inventory = part.inventory;
  const isLowStock = inventory && inventory.currentQty <= part.safetyStock;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-[var(--glass-bg)] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                {part.partNumber}
              </h1>
              <span
                className={`badge ${part.isActive ? "badge-success" : "badge-secondary"}`}
              >
                {part.isActive ? "활성" : "비활성"}
              </span>
            </div>
            <p className="text-[var(--text-secondary)]">{part.partName}</p>
          </div>
        </div>
        <Link
          href={`/parts?edit=${id}`}
          className="btn btn-primary"
        >
          <Edit2 className="w-4 h-4" />
          편집
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Current Stock */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">현재 재고</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {inventory?.currentQty ?? 0}
                <span className="text-sm font-normal ml-1">{part.unit}</span>
              </p>
            </div>
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isLowStock ? "bg-[var(--danger)]/10" : "bg-[var(--success)]/10"
              }`}
            >
              <Package
                className={`w-6 h-6 ${
                  isLowStock ? "text-[var(--danger)]" : "text-[var(--success)]"
                }`}
              />
            </div>
          </div>
          {isLowStock && (
            <div className="mt-2 flex items-center gap-1 text-xs text-[var(--danger)]">
              <AlertTriangle className="w-3 h-3" />
              안전재고 이하
            </div>
          )}
        </div>

        {/* Available Stock */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">가용 재고</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {inventory ? inventory.currentQty - inventory.reservedQty : 0}
                <span className="text-sm font-normal ml-1">{part.unit}</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--info)]/10">
              <TrendingUp className="w-6 h-6 text-[var(--info)]" />
            </div>
          </div>
          {inventory && inventory.reservedQty > 0 && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              예약: {inventory.reservedQty} {part.unit}
            </p>
          )}
        </div>

        {/* Safety Stock */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">안전 재고</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {part.safetyStock}
                <span className="text-sm font-normal ml-1">{part.unit}</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--warning)]/10">
              <AlertTriangle className="w-6 h-6 text-[var(--warning)]" />
            </div>
          </div>
        </div>

        {/* Incoming */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">입고 예정</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {inventory?.incomingQty ?? 0}
                <span className="text-sm font-normal ml-1">{part.unit}</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--primary)]/10">
              <TrendingDown className="w-6 h-6 text-[var(--primary)]" />
            </div>
          </div>
        </div>
      </div>

      {/* Part Info & Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Part Details */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            파츠 정보
          </h2>
          <div className="space-y-4">
            {part.description && (
              <div>
                <p className="text-sm text-[var(--text-muted)]">규격</p>
                <p className="text-[var(--text-primary)]">{part.description}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-[var(--text-muted)]" />
              <div>
                <p className="text-sm text-[var(--text-muted)]">저장 위치</p>
                <p className="text-[var(--text-primary)] font-mono">
                  {part.storageLocation || "-"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Tag className="w-4 h-4 text-[var(--text-muted)]" />
              <div>
                <p className="text-sm text-[var(--text-muted)]">카테고리</p>
                <p className="text-[var(--text-primary)]">
                  {part.category?.name || "-"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-[var(--text-muted)]" />
              <div>
                <p className="text-sm text-[var(--text-muted)]">공급업체</p>
                <p className="text-[var(--text-primary)]">
                  {part.supplier?.name || "-"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-[var(--text-muted)]" />
              <div>
                <p className="text-sm text-[var(--text-muted)]">리드타임</p>
                <p className="text-[var(--text-primary)]">{part.leadTime}일</p>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--glass-border)]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[var(--text-muted)]">단가</p>
                  <p className="text-[var(--text-primary)] font-medium">
                    ₩{part.unitPrice.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">최소 발주량</p>
                  <p className="text-[var(--text-primary)]">
                    {part.minOrderQty} {part.unit}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              입출고 기록
            </h2>
            <Link
              href={`/transactions?partId=${id}`}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              전체 보기
            </Link>
          </div>

          {txLoading ? (
            <div className="flex items-center justify-center h-32">
              <div
                className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"
                role="status"
              />
            </div>
          ) : !transactions || transactions.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <ArrowLeftRight className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>입출고 기록이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-bordered">
                <thead>
                  <tr className="border-b border-[var(--glass-border)]">
                    <th className="text-left px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      유형
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      수량
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      이전
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      이후
                    </th>
                    <th className="text-left px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      참조
                    </th>
                    <th className="text-left px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      일시
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 10).map((tx) => {
                    const Icon = typeIcons[tx.transactionType] || ArrowLeftRight;
                    return (
                      <tr
                        key={tx.id}
                        className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)]/50"
                      >
                        <td className="px-3 py-3">
                          <span
                            className={`badge ${
                              typeColors[tx.transactionType] || "badge-secondary"
                            } flex items-center gap-1 w-fit`}
                          >
                            <Icon className="w-3 h-3" />
                            {typeLabels[tx.transactionType] || tx.transactionType}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span
                            className={`font-bold ${
                              tx.transactionType === "INBOUND"
                                ? "text-[var(--success)]"
                                : tx.transactionType === "OUTBOUND"
                                ? "text-[var(--danger)]"
                                : "text-[var(--text-primary)]"
                            }`}
                          >
                            {tx.transactionType === "INBOUND"
                              ? "+"
                              : tx.transactionType === "OUTBOUND"
                              ? "-"
                              : ""}
                            {tx.quantity}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-[var(--text-secondary)] tabular-nums">
                          {tx.beforeQty}
                        </td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums">
                          {tx.afterQty}
                        </td>
                        <td className="px-3 py-3 text-[var(--text-secondary)]">
                          {tx.referenceType
                            ? `${tx.referenceType}${tx.referenceId ? `-${tx.referenceId}` : ""}`
                            : "-"}
                        </td>
                        <td className="px-3 py-3 text-sm text-[var(--text-muted)]">
                          {new Date(tx.createdAt).toLocaleString("ko-KR", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
