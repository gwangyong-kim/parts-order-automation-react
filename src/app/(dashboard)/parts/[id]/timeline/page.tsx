"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Package, Edit2, History } from "lucide-react";
import { PartTimeline } from "@/components/parts/PartTimeline";
import type { Part } from "@/types/entities";

interface PartWithInventory extends Part {
  inventory?: {
    currentQty: number;
    reservedQty: number;
    incomingQty: number;
    availableQty: number;
  };
}

async function fetchPart(id: string): Promise<PartWithInventory> {
  const res = await fetch(`/api/parts/${id}`);
  if (!res.ok) throw new Error("Failed to fetch part");
  const data = await res.json();
  return {
    ...data,
    partNumber: data.partCode,
    leadTime: data.leadTimeDays,
  };
}

export default function PartTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const {
    data: part,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["part", id],
    queryFn: () => fetchPart(id),
  });

  if (isLoading) {
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

  if (error || !part) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-[var(--danger)]">파츠를 찾을 수 없습니다.</p>
        <Link href="/master-data?tab=parts" className="mt-4 text-[var(--primary)] hover:underline">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

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
              <History className="w-6 h-6 text-[var(--primary)]" />
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                {part.partNumber} 타임라인
              </h1>
            </div>
            <p className="text-[var(--text-secondary)] ml-9">{part.partName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/parts/${id}`} className="btn btn-secondary">
            <Package className="w-4 h-4" />
            상세 정보
          </Link>
          <Link href={`/master-data?tab=parts&edit=${id}`} className="btn btn-primary">
            <Edit2 className="w-4 h-4" />
            편집
          </Link>
        </div>
      </div>

      {/* Part Summary */}
      <div className="glass-card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-[var(--text-muted)]">부품번호</p>
            <p className="font-mono text-[var(--text-primary)]">{part.partNumber}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--text-muted)]">현재 재고</p>
            <p className="font-bold text-[var(--text-primary)]">
              {(part.inventory?.currentQty ?? 0).toLocaleString()} {part.unit}
            </p>
          </div>
          <div>
            <p className="text-sm text-[var(--text-muted)]">가용 재고</p>
            <p className="text-[var(--text-primary)]">
              {(
                (part.inventory?.currentQty ?? 0) - (part.inventory?.reservedQty ?? 0)
              ).toLocaleString()}{" "}
              {part.unit}
            </p>
          </div>
          <div>
            <p className="text-sm text-[var(--text-muted)]">안전 재고</p>
            <p className="text-[var(--text-primary)]">
              {part.safetyStock.toLocaleString()} {part.unit}
            </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <PartTimeline partId={id} />
    </div>
  );
}
